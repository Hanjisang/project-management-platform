import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type SuperAgentRawResponse from 'superagent/lib/node/response';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  IMPLEMENTATION_SOP_CODE,
  IMPLEMENTATION_SOP_EXPECTED_COUNTS,
  IMPLEMENTATION_SOP_VERSION,
  seedImplementationSop,
} from '../prisma/seed-implementation-sop';
import { requestIdMiddleware } from '../src/common/request-id.middleware';
import type { PrismaService as PrismaServiceType } from '../src/prisma/prisma.service';

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const runId = Date.now().toString().slice(-9);
const projectCode = `SOP${runId}`;
type Agent = ReturnType<typeof request.agent>;

interface Session {
  agent: Agent;
  csrf: string;
  user: { id: string };
}

function cookieValue(cookies: string[], name: string): string {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  return cookie?.split(';')[0]?.slice(name.length + 1) ?? '';
}

function binaryParser(
  response: SuperAgentRawResponse,
  callback: (error: Error | null, body: unknown) => void,
): void {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => callback(error, undefined));
}

describe.skipIf(!hasDatabase)('preloaded implementation SOP against MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaServiceType;
  let server: Parameters<typeof request>[0];
  let admin: Session;
  let projectId = '';
  let versionId = '';
  let firstCounts: typeof IMPLEMENTATION_SOP_EXPECTED_COUNTS;
  let secondCounts: typeof IMPLEMENTATION_SOP_EXPECTED_COUNTS;

  async function storageRootForExistingSeed(raw: PrismaClient): Promise<string | null> {
    const template = await raw.sopDeliverableTemplate.findFirst({
      where: {
        deliverable: {
          task: {
            stage: {
              version: {
                template: { code: IMPLEMENTATION_SOP_CODE },
                version: IMPLEMENTATION_SOP_VERSION,
              },
            },
          },
        },
      },
    });
    if (!template) return null;
    const roots = [
      ...(process.env.STORAGE_PATH ? [resolve(process.env.STORAGE_PATH)] : []),
      resolve('storage'),
      resolve('apps/api/storage'),
    ];
    for (const root of [...new Set(roots)]) {
      try {
        await access(join(root, template.objectKey));
        return root;
      } catch {
        // Check the next npm workspace working directory.
      }
    }
    throw new Error(`Seeded template object is unavailable: ${template.objectKey}`);
  }

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

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = 'preloaded-sop-access-secret-with-32-chars';
    process.env.JWT_REFRESH_SECRET = 'preloaded-sop-refresh-secret-with-32-chars';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.AI_ENABLED = 'false';
    process.env.AI_FAKE_ENABLED = 'false';

    const raw = new PrismaClient();
    try {
      process.env.STORAGE_PATH =
        (await storageRootForExistingSeed(raw)) ?? resolve(`.tmp/preloaded-sop-${runId}`);
      const first = await seedImplementationSop(raw);
      const second = await seedImplementationSop(raw);
      versionId = first.versionId;
      firstCounts = first.counts;
      secondCounts = second.counts;
    } finally {
      await raw.$disconnect();
    }

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
    if (prisma && projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    if (app) await app.close();
  });

  it('keeps the published seed idempotent and preserves the formal structure', async () => {
    expect(firstCounts).toEqual(IMPLEMENTATION_SOP_EXPECTED_COUNTS);
    expect(secondCounts).toEqual(firstCounts);
    expect(await prisma.sopTemplate.count({ where: { code: IMPLEMENTATION_SOP_CODE } })).toBe(1);
    expect(
      await prisma.sopVersion.count({
        where: {
          template: { code: IMPLEMENTATION_SOP_CODE },
          version: IMPLEMENTATION_SOP_VERSION,
        },
      }),
    ).toBe(1);

    const version = await prisma.sopVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { template: true, stages: { orderBy: { sortOrder: 'asc' } } },
    });
    expect(version.template.name).toBe('病理信息化项目实施标准SOP');
    expect(version.version).toBe('V1.9.1');
    expect(version.status).toBe('PUBLISHED');
    expect(version.publishedAt).not.toBeNull();
    expect(version.stages.map((stage) => stage.name)).toEqual([
      '01 事前准备',
      '02 实施执行',
      '03 试行验证',
      '04 上线切换',
      '05 验收交付',
    ]);

    const goLivePlan = await prisma.sopDeliverable.findMany({
      where: {
        name: '上线实施方案',
        task: { stage: { sopVersionId: versionId } },
      },
      include: { templates: true },
    });
    expect(goLivePlan).toHaveLength(1);
    expect(goLivePlan[0]?.templates.map((template) => template.fileName).sort()).toEqual([
      '上线实施方案_儿童医院.docx',
      '上线实施方案_标准模板_V1.0.docx',
    ]);
    expect(
      await prisma.sopDeliverableTemplate.count({
        where: {
          deliverable: { name: '院方确认函', task: { stage: { sopVersionId: versionId } } },
        },
      }),
    ).toBe(0);
    const uploader = await prisma.user.findUniqueOrThrow({ where: { username: 'system-seed' } });
    expect(uploader.status).toBe('DISABLED');
  });

  it('generates the canonical project execution snapshots without legacy task tables', async () => {
    const project = await prisma.project.create({
      data: {
        code: projectCode,
        name: '预置 SOP 计划生成验收项目',
        customerName: '集成测试客户',
        managerUserId: admin.user.id,
        approverUserId: admin.user.id,
        status: 'NOT_STARTED',
        plannedStartDate: new Date('2026-09-01'),
        plannedGoLiveDate: new Date('2027-03-01'),
        members: { create: { userId: admin.user.id, projectRole: 'PROJECT_MANAGER' } },
      },
    });
    projectId = project.id;

    await admin.agent
      .post(`/api/v2/projects/${project.id}/plan`)
      .set('x-csrf-token', admin.csrf)
      .send({ sopVersionId: versionId })
      .expect(201);

    const counts = {
      plan: await prisma.projectPlan.count({ where: { projectId: project.id } }),
      stages: await prisma.projectStage.count({ where: { plan: { projectId: project.id } } }),
      workItems: await prisma.projectWorkItem.count({ where: { projectId: project.id } }),
      checklist: await prisma.projectChecklistItem.count({
        where: { workItem: { projectId: project.id } },
      }),
      deliverables: await prisma.projectDeliverable.count({
        where: { workItem: { projectId: project.id } },
      }),
      templates: await prisma.projectDeliverableTemplate.count({
        where: { projectDeliverable: { workItem: { projectId: project.id } } },
      }),
      documents: await prisma.document.count({ where: { projectId: project.id } }),
    };
    expect(counts).toEqual({
      plan: 1,
      stages: IMPLEMENTATION_SOP_EXPECTED_COUNTS.stages,
      workItems: IMPLEMENTATION_SOP_EXPECTED_COUNTS.tasks,
      checklist: IMPLEMENTATION_SOP_EXPECTED_COUNTS.checklist,
      deliverables: IMPLEMENTATION_SOP_EXPECTED_COUNTS.deliverables,
      templates: IMPLEMENTATION_SOP_EXPECTED_COUNTS.templates,
      documents: 0,
    });
    expect(
      await prisma.projectWorkItem.count({
        where: { projectId: project.id, sourceType: { not: 'SOP' } },
      }),
    ).toBe(0);

    const legacyTables = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('tasks', 'project_plan_tasks')
    `;
    expect(legacyTables).toEqual([]);
  });

  it.each([
    {
      fileName: '三方会议纪要_标准模板_V1.0.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    {
      fileName: '项目计划_标准模板_V1.0.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  ])(
    'downloads the real $fileName template with matching metadata',
    async ({ fileName, mimeType }) => {
      const template = await prisma.projectDeliverableTemplate.findFirstOrThrow({
        where: {
          fileName,
          projectDeliverable: { workItem: { projectId } },
        },
      });
      const response = await admin.agent
        .get(`/api/v2/project-deliverable-templates/${template.id}/download`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      const body = response.body as Buffer;
      expect(response.headers['content-type']).toContain(mimeType);
      expect(response.headers['content-disposition']).toContain(
        `filename*=UTF-8''${encodeURIComponent(template.fileName)}`,
      );
      expect(body.length).toBeGreaterThan(0);
      expect(BigInt(body.length)).toBe(template.size);
      expect(createHash('sha256').update(body).digest('hex')).toBe(template.checksum);
    },
  );
});
