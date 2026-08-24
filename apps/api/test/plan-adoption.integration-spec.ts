import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requestIdMiddleware } from '../src/common/request-id.middleware';
import type { PrismaService as PrismaServiceType } from '../src/prisma/prisma.service';

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const runId = Date.now().toString().slice(-8);
const prefix = `PA${runId}`;
type Agent = ReturnType<typeof request.agent>;
type GeneratedPlanResponse = {
  sourceSopVersionId: string | null;
  stages: Array<{ name: string }>;
};

function cookieValue(cookies: string[], name: string): string {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  return cookie?.split(';')[0]?.slice(name.length + 1) ?? '';
}

describe.skipIf(!hasDatabase)('temporary manual plan adoption', () => {
  let app: INestApplication;
  let prisma: PrismaServiceType;
  let server: Parameters<typeof request>[0];
  let agent: Agent;
  let csrf = '';
  let adminId = '';
  let projectId = '';
  let templateId = '';

  function write(method: 'post' | 'patch' | 'put' | 'delete', path: string) {
    return agent[method](path).set('x-csrf-token', csrf);
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = 'plan-adoption-access-secret-at-least-32-chars';
    process.env.JWT_REFRESH_SECRET = 'plan-adoption-refresh-secret-at-least-32-chars';
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

    agent = request.agent(server);
    const login = await agent
      .post('/api/v2/auth/login')
      .send({
        username: process.env.ADMIN_USERNAME ?? 'admin',
        password: process.env.ADMIN_PASSWORD ?? 'integration-admin-password',
      })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    csrf = cookieValue(cookies, 'csrf_token');
    adminId = login.body.data.user.id as string;
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.project.deleteMany({ where: { code: { startsWith: prefix } } });
      await prisma.sopTemplate.deleteMany({ where: { code: { startsWith: prefix } } });
    }
    if (app) await app.close();
  });

  it('keeps an unstarted manual work item when a formal SOP plan is generated later', async () => {
    const project = await write('post', '/api/v2/projects')
      .send({
        code: `${prefix}P`,
        name: '临时任务后补 SOP 项目',
        customerName: '计划吸收测试客户',
        managerUserId: adminId,
        approverUserId: adminId,
        plannedStartDate: '2026-09-01',
        plannedGoLiveDate: '2026-12-31',
      })
      .expect(201);
    projectId = project.body.data.id as string;

    const manual = await write('post', `/api/v2/projects/${projectId}/work-items`)
      .send({
        name: '先行联系院方确认窗口',
        description: '正式 SOP 生成前创建的非必需临时任务',
        required: false,
        priority: 'MEDIUM',
      })
      .expect(201);
    const manualWorkItemId = manual.body.data.id as string;

    const temporaryPlan = await prisma.projectPlan.findUniqueOrThrow({
      where: { projectId },
      include: { stages: { include: { workItems: true } } },
    });
    expect(temporaryPlan.sourceSopVersionId).toBeNull();
    expect(temporaryPlan.stages).toHaveLength(1);
    expect(temporaryPlan.stages[0]?.name).toBe('临时任务');
    expect(temporaryPlan.stages[0]?.workItems[0]?.id).toBe(manualWorkItemId);

    const template = await write('post', '/api/v2/sop/templates')
      .send({ code: `${prefix}SOP`, name: '正式实施 SOP' })
      .expect(201);
    templateId = template.body.data.id as string;

    const version = await write('post', `/api/v2/sop/templates/${templateId}/versions`)
      .send({ version: 'V1.0' })
      .expect(201);
    const versionId = version.body.data.id as string;

    const stage = await write('post', `/api/v2/sop/versions/${versionId}/stages`)
      .send({ name: '事前准备', defaultDurationDays: 5 })
      .expect(201);
    const stageId = stage.body.data.id as string;

    await write('post', `/api/v2/sop/stages/${stageId}/tasks`)
      .send({ name: '项目调研', defaultDurationDays: 3, required: true })
      .expect(201);
    await write('post', `/api/v2/sop/versions/${versionId}/publish`).send({}).expect(201);

    const generated = await write('post', `/api/v2/projects/${projectId}/plan`)
      .send({ sopVersionId: versionId })
      .expect(201);
    const generatedData = generated.body.data as GeneratedPlanResponse;

    expect(generatedData.sourceSopVersionId).toBe(versionId);
    expect(generatedData.stages.map((item) => item.name)).toEqual(['事前准备', '临时任务']);

    const persistedManual = await prisma.projectWorkItem.findUniqueOrThrow({
      where: { id: manualWorkItemId },
      include: { stage: true },
    });
    expect(persistedManual.sourceType).toBe('MANUAL');
    expect(persistedManual.status).toBe('TODO');
    expect(persistedManual.progress).toBe(0);
    expect(persistedManual.stage.name).toBe('临时任务');

    const planCount = await prisma.projectPlan.count({ where: { projectId } });
    expect(planCount).toBe(1);
  });
});
