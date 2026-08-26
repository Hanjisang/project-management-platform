import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requestIdMiddleware } from '../src/common/request-id.middleware';
import type { PrismaService as PrismaServiceType } from '../src/prisma/prisma.service';

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const runId = Date.now().toString().slice(-9);
const prefix = `FP${runId}`;
type Agent = ReturnType<typeof request.agent>;

interface Session {
  agent: Agent;
  csrf: string;
  user: { id: string; username: string; isAdministrator: boolean };
}

function cookieValue(cookies: string[], name: string): string {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  return cookie?.split(';')[0]?.slice(name.length + 1) ?? '';
}

describe.skipIf(!hasDatabase)('functional parity recovery against MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaServiceType;
  let server: Parameters<typeof request>[0];
  let admin: Session;

  async function login(username: string, password: string): Promise<Session> {
    const agent = request.agent(server);
    const response = await agent
      .post('/api/v2/auth/login')
      .send({ username, password })
      .expect(200);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    return {
      agent,
      csrf: cookieValue(cookies, 'csrf_token'),
      user: response.body.data.user,
    };
  }

  function write(session: Session, method: 'post' | 'patch' | 'put' | 'delete', path: string) {
    return session.agent[method](path).set('x-csrf-token', session.csrf);
  }

  async function createProject(suffix: string, status: 'ACTIVE' | 'NOT_STARTED') {
    return prisma.project.create({
      data: {
        code: `${prefix}${suffix}`,
        name: `Parity ${suffix}`,
        customerName: 'Parity Customer',
        managerUserId: admin.user.id,
        approverUserId: admin.user.id,
        status,
        plannedStartDate: new Date('2026-01-01'),
        plannedGoLiveDate: new Date('2026-12-31'),
        members: {
          create: { userId: admin.user.id, projectRole: 'PROJECT_MANAGER' },
        },
      },
    });
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = 'functional-parity-access-secret-32-chars';
    process.env.JWT_REFRESH_SECRET = 'functional-parity-refresh-secret-32-chars';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.AI_ENABLED = 'false';
    process.env.AI_FAKE_ENABLED = 'false';
    const { AppModule } = await import('../src/app.module');
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.use(cookieParser());
    app.setGlobalPrefix('api/v2', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer() as Parameters<typeof request>[0];
    admin = await login(
      process.env.ADMIN_USERNAME ?? 'admin',
      process.env.ADMIN_PASSWORD ?? 'integration-admin-password',
    );
  }, 60_000);

  afterAll(async () => {
    if (prisma) await prisma.project.deleteMany({ where: { code: { startsWith: prefix } } });
    if (app) await app.close();
  });

  it('blocks close for ordinary required documents until approved', async () => {
    const project = await createProject('DOC', 'ACTIVE');
    const required = await prisma.document.create({
      data: {
        projectId: project.id,
        name: '上线方案',
        required: true,
        status: 'DRAFT',
        createdById: admin.user.id,
      },
    });
    await prisma.document.create({
      data: {
        projectId: project.id,
        name: '普通附件',
        required: false,
        status: 'DRAFT',
        createdById: admin.user.id,
      },
    });
    await prisma.document.create({
      data: {
        projectId: project.id,
        name: '已删除必需附件',
        required: true,
        status: 'DRAFT',
        deletedAt: new Date(),
        createdById: admin.user.id,
      },
    });

    for (const status of ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] as const) {
      await prisma.document.update({ where: { id: required.id }, data: { status } });
      const response = await write(admin, 'post', `/api/v2/projects/${project.id}/close`).send();
      expect(response.status).toBe(409);
      expect(response.body.details.missingRequiredDocuments).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: required.id, name: '上线方案', status })]),
      );
    }

    await prisma.document.update({ where: { id: required.id }, data: { status: 'APPROVED' } });
    const closed = await write(admin, 'post', `/api/v2/projects/${project.id}/close`).send();
    expect(closed.status).toBe(201);
    expect(closed.body.data.status).toBe('COMPLETED');
  });

  it('confirms a message task without a prior SOP plan and preserves message provenance', async () => {
    const project = await createProject('MSG', 'NOT_STARTED');
    expect(await prisma.projectPlan.findUnique({ where: { projectId: project.id } })).toBeNull();
    const message = await prisma.message.create({
      data: {
        source: 'MANUAL',
        projectId: project.id,
        senderName: 'Parity Fixture',
        content: '请创建一个接口确认任务',
        receivedAt: new Date(),
        status: 'PENDING_CONFIRMATION',
        createdById: admin.user.id,
      },
    });
    const analysis = await prisma.messageAnalysis.create({
      data: {
        messageId: message.id,
        provider: 'fixture',
        status: 'SUCCEEDED',
        result: {},
        completedAt: new Date(),
      },
    });
    const action = await prisma.pendingAction.create({
      data: {
        messageId: message.id,
        analysisId: analysis.id,
        projectId: project.id,
        type: 'CREATE_TASK',
        payload: {
          title: '消息来源任务',
          description: '由确认动作创建',
          priority: 'HIGH',
          dueDate: null,
        },
      },
    });

    const confirmed = await write(admin, 'post', `/api/v2/messages/${message.id}/confirm`)
      .send({ decisions: [{ actionId: action.id, decision: 'CONFIRM' }] });
    expect(confirmed.status).toBe(201);

    const savedAction = await prisma.pendingAction.findUniqueOrThrow({ where: { id: action.id } });
    expect(savedAction.status).toBe('CONFIRMED');
    expect(savedAction.resultResourceType).toBe('ProjectWorkItem');
    expect(savedAction.resultResourceId).toBeTruthy();
    const savedWorkItem = await prisma.projectWorkItem.findUniqueOrThrow({
      where: { id: savedAction.resultResourceId ?? '' },
    });
    expect(savedWorkItem.sourceType).toBe('MESSAGE');
    expect(savedWorkItem.sourceId).toBe(message.id);

    const plan = await prisma.projectPlan.findUnique({
      where: { projectId: project.id },
      include: { stages: true },
    });
    expect(plan?.name).toBe('项目自定义执行计划');
    expect(plan?.stages.some((stage) => stage.name === '临时任务' && stage.isCustom)).toBe(true);

    const detail = await admin.agent
      .get(`/api/v2/work-items/${savedAction.resultResourceId}`)
      .expect(200);
    expect(detail.body.data.sourceType).toBe('MESSAGE');
    expect(detail.body.data.sourceId).toBe(message.id);

    await write(admin, 'post', `/api/v2/messages/${message.id}/confirm`)
      .send({ decisions: [{ actionId: action.id, decision: 'CONFIRM' }] })
      .expect(201);
    expect(
      await prisma.projectWorkItem.count({ where: { projectId: project.id, name: '消息来源任务' } }),
    ).toBe(1);

    const implementationSopVersion = await prisma.sopVersion.findFirstOrThrow({
      where: {
        status: 'PUBLISHED',
        template: { code: 'PATHOLOGY_IMPLEMENTATION_STANDARD' },
      },
    });
    await write(admin, 'post', `/api/v2/projects/${project.id}/plan`)
      .send({ sopVersionId: implementationSopVersion.id })
      .expect(201);
    const adoptedWorkItem = await prisma.projectWorkItem.findUniqueOrThrow({
      where: { id: savedWorkItem.id },
    });
    expect(adoptedWorkItem.sourceType).toBe('MESSAGE');
    expect(adoptedWorkItem.sourceId).toBe(message.id);
    expect(
      await prisma.projectPlan.count({ where: { projectId: project.id } }),
    ).toBe(1);

    await prisma.projectWorkItem.update({
      where: { id: savedWorkItem.id },
      data: { sourceType: 'MANUAL', sourceId: null },
    });
    const legacyDetail = await admin.agent
      .get(`/api/v2/work-items/${savedWorkItem.id}`)
      .expect(200);
    expect(legacyDetail.body.data.sourceType).toBe('MESSAGE');
    expect(legacyDetail.body.data.sourceId).toBe(message.id);
  });
});
