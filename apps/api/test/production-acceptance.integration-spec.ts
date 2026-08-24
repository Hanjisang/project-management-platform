import { rm } from 'node:fs/promises';
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
const prefix = `EX${runId}`;
const uploadRoot = `.tmp/execution-acceptance-${runId}`;
type Agent = ReturnType<typeof request.agent>;

interface Session {
  agent: Agent;
  csrf: string;
  cookies: string[];
  user: { id: string; username: string; isAdministrator: boolean };
}

function cookieValue(cookies: string[], name: string): string {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  return cookie?.split(';')[0]?.slice(name.length + 1) ?? '';
}

function openXmlFixture(directory: 'word/' | 'xl/'): Buffer {
  return Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from(`[Content_Types].xml ${directory}`, 'ascii'),
  ]);
}

describe.skipIf(!hasDatabase)('V2 unified execution domain against MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaServiceType;
  let server: Parameters<typeof request>[0];
  let admin: Session;
  let manager: Session;
  let member: Session;
  let viewer: Session;
  let approver: Session;
  let projectId = '';
  let otherProjectId = '';
  let sopTemplateId = '';
  let sopVersionId = '';
  let sopStageId = '';
  let sopTaskId = '';
  let sopDeliverableId = '';
  let sopCriterionId = '';
  let planId = '';
  let stageId = '';
  let workItemId = '';
  let checklistIds: string[] = [];
  let projectDeliverableId = '';
  let documentId = '';
  let latestVersionId = '';
  let changeId = '';
  let otherManagerUserId = '';

  async function login(username: string, password: string): Promise<Session> {
    const agent = request.agent(server);
    const response = await agent
      .post('/api/v2/auth/login')
      .send({ username, password })
      .expect(200);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const csrf = cookieValue(cookies, 'csrf_token');
    expect(csrf).not.toBe('');
    return { agent, csrf, cookies, user: response.body.data.user };
  }

  function write(session: Session, method: 'post' | 'patch' | 'put' | 'delete', path: string) {
    return session.agent[method](path).set('x-csrf-token', session.csrf);
  }

  async function waitForJob(versionId: string, expected: 'SUCCEEDED' | 'FAILED') {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const job = await prisma.aiReviewJob.findUnique({ where: { documentVersionId: versionId } });
      if (job?.status === expected) return job;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`AI job for ${versionId} did not reach ${expected}`);
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = 'execution-acceptance-access-secret-32-chars';
    process.env.JWT_REFRESH_SECRET = 'execution-acceptance-refresh-secret-32-chars';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.STORAGE_PATH = uploadRoot;
    process.env.AI_ENABLED = 'false';
    process.env.AI_FAKE_ENABLED = 'true';
    delete process.env.AI_API_KEY;
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
      process.env.ADMIN_USERNAME ?? 'acceptance_admin',
      process.env.ADMIN_PASSWORD ?? 'acceptance-admin-password',
    );
    const users = [
      { key: 'manager', displayName: '执行域项目经理', roleCodes: ['PROJECT_MANAGER'] },
      { key: 'member', displayName: '执行域成员', roleCodes: ['MEMBER'] },
      { key: 'viewer', displayName: '执行域只读', roleCodes: ['VIEWER'] },
      { key: 'approver', displayName: '执行域审批人', roleCodes: ['PROJECT_MANAGER'] },
      { key: 'other', displayName: '其他项目经理', roleCodes: ['PROJECT_MANAGER'] },
    ];
    for (const user of users) {
      const created = await write(admin, 'post', '/api/v2/users')
        .send({
          username: `${prefix.toLowerCase()}${user.key}`,
          displayName: user.displayName,
          password: 'execution-user-password',
          roleCodes: user.roleCodes,
        })
        .expect(201);
      if (user.key === 'other') otherManagerUserId = created.body.data.id;
    }
    manager = await login(`${prefix.toLowerCase()}manager`, 'execution-user-password');
    member = await login(`${prefix.toLowerCase()}member`, 'execution-user-password');
    viewer = await login(`${prefix.toLowerCase()}viewer`, 'execution-user-password');
    approver = await login(`${prefix.toLowerCase()}approver`, 'execution-user-password');

    const project = await write(admin, 'post', '/api/v2/projects')
      .send({
        code: `${prefix}A`,
        name: '统一执行域验收项目',
        customerName: '验收客户',
        managerUserId: manager.user.id,
        approverUserId: approver.user.id,
        plannedStartDate: '2026-01-01',
        plannedGoLiveDate: '2026-04-11',
      })
      .expect(201);
    projectId = project.body.data.id;
    const other = await write(admin, 'post', '/api/v2/projects')
      .send({
        code: `${prefix}B`,
        name: '隔离项目',
        customerName: '其他客户',
        managerUserId: otherManagerUserId,
        approverUserId: otherManagerUserId,
        plannedStartDate: '2026-01-01',
        plannedGoLiveDate: '2026-04-11',
      })
      .expect(201);
    otherProjectId = other.body.data.id;
    await write(admin, 'put', `/api/v2/projects/${projectId}/members`)
      .send({
        members: [
          { userId: member.user.id, projectRole: 'IMPLEMENTER' },
          { userId: viewer.user.id, projectRole: 'VIEWER' },
          { userId: approver.user.id, projectRole: 'VIEWER' },
        ],
      })
      .expect(200);
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.project.deleteMany({ where: { code: { startsWith: prefix } } });
      await prisma.sopTemplate.deleteMany({ where: { code: { startsWith: prefix } } });
      await prisma.user.deleteMany({ where: { username: { startsWith: prefix.toLowerCase() } } });
    }
    if (app) await app.close();
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it('1. authenticates with secure cookies and live CSRF protection', async () => {
    expect(admin.cookies.find((value) => value.startsWith('access_token='))).toContain('HttpOnly');
    await admin.agent.get('/api/v2/auth/me').expect(200);
    await admin.agent.post('/api/v2/projects').send({}).expect(403);
  });

  it('2. denies cross-project enumeration', async () => {
    await member.agent.get(`/api/v2/projects/${otherProjectId}`).expect(403);
    await member.agent.get(`/api/v2/work-items?projectId=${otherProjectId}`).expect(403);
  });

  it('3. creates an SOP draft', async () => {
    const template = await write(admin, 'post', '/api/v2/sop/templates')
      .send({ code: `${prefix}SOP`, name: '执行域 SOP' })
      .expect(201);
    sopTemplateId = template.body.data.id;
    const version = await write(admin, 'post', `/api/v2/sop/templates/${sopTemplateId}/versions`)
      .send({ version: 'V1.0' })
      .expect(201);
    sopVersionId = version.body.data.id;
  });

  it('4. creates a stage and canonical SOP task', async () => {
    const stage = await write(admin, 'post', `/api/v2/sop/versions/${sopVersionId}/stages`)
      .send({ name: '接口阶段', defaultDurationDays: 100 })
      .expect(201);
    sopStageId = stage.body.data.id;
    const task = await write(admin, 'post', `/api/v2/sop/stages/${sopStageId}/tasks`)
      .send({ name: '接口对接', defaultDurationDays: 100, required: true })
      .expect(201);
    sopTaskId = task.body.data.id;
  });

  it('5. creates required checklist definitions', async () => {
    for (const name of ['申请接口验证', '收费接口验证'])
      await write(admin, 'post', `/api/v2/sop/tasks/${sopTaskId}/checklist-items`)
        .send({ name, required: true })
        .expect(201);
  });

  it('6. creates an AI-reviewed deliverable definition', async () => {
    const deliverable = await write(admin, 'post', `/api/v2/sop/tasks/${sopTaskId}/deliverables`)
      .send({
        name: '接口确认表',
        required: true,
        reviewMode: 'AI_WITH_HUMAN_OVERRIDE',
        aiAutoApproveThreshold: 85,
        aiReviewInstruction: '只检查接口确认内容',
      })
      .expect(201);
    sopDeliverableId = deliverable.body.data.id;
  });

  it('7. uploads a deliverable template', async () => {
    const response = await write(
      admin,
      'post',
      `/api/v2/sop/deliverables/${sopDeliverableId}/templates`,
    )
      .attach('file', openXmlFixture('xl/'), {
        filename: '接口确认表.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);
    expect(response.body.data.fileName).toBe('接口确认表.xlsx');
  });

  it('8. creates a structured review criterion', async () => {
    const criterion = await write(
      admin,
      'post',
      `/api/v2/sop/deliverables/${sopDeliverableId}/review-criteria`,
    )
      .send({
        name: '接口清单完整',
        description: '申请与收费接口均需列出',
        required: true,
        weight: 100,
      })
      .expect(201);
    sopCriterionId = criterion.body.data.id;
  });

  it('9. publishes and freezes the SOP version', async () => {
    await write(admin, 'post', `/api/v2/sop/versions/${sopVersionId}/publish`).send({}).expect(201);
    await write(admin, 'patch', `/api/v2/sop/deliverable-review-criteria/${sopCriterionId}`)
      .send({ name: '禁止修改' })
      .expect(409);
  });

  it('10. clones the published version into an editable draft', async () => {
    const clone = await write(admin, 'post', `/api/v2/sop/versions/${sopVersionId}/clone`)
      .send({ version: 'V1.1' })
      .expect(201);
    const criterionId = clone.body.data.stages[0].tasks[0].deliverables[0].reviewCriteria[0].id;
    await write(admin, 'patch', `/api/v2/sop/deliverable-review-criteria/${criterionId}`)
      .send({ name: '克隆后可修改' })
      .expect(200);
  });

  it('11. generates one ProjectWorkItem without creating a legacy Task', async () => {
    const response = await write(manager, 'post', `/api/v2/projects/${projectId}/plan`)
      .send({ sopVersionId })
      .expect(201);
    planId = response.body.data.id;
    stageId = response.body.data.stages[0].id;
    workItemId = response.body.data.stages[0].workItems[0].id;
    expect(response.body.data.stages[0].workItems).toHaveLength(1);
  });

  it('12. snapshots checklist, deliverable, template and criteria', async () => {
    const item = await prisma.projectWorkItem.findUniqueOrThrow({
      where: { id: workItemId },
      include: {
        checklistItems: true,
        deliverables: { include: { templates: true, reviewCriteria: true } },
      },
    });
    checklistIds = item.checklistItems.map((entry) => entry.id);
    projectDeliverableId = item.deliverables[0]!.id;
    expect(item.checklistItems).toHaveLength(2);
    expect(item.deliverables[0]!.templates).toHaveLength(1);
    expect(item.deliverables[0]!.reviewCriteria).toHaveLength(1);
  });

  it('13. exposes the same WorkItem in execution and task-center APIs', async () => {
    const execution = await manager.agent
      .get(`/api/v2/projects/${projectId}/execution`)
      .expect(200);
    const center = await member.agent.get(`/api/v2/work-items?projectId=${projectId}`).expect(200);
    expect(execution.body.data.stages[0].workItems[0].id).toBe(workItemId);
    expect(center.body.data.items[0].id).toBe(workItemId);
  });

  it('14. keeps viewer access read-only', async () => {
    await viewer.agent.get(`/api/v2/work-items/${workItemId}`).expect(200);
    await write(viewer, 'patch', `/api/v2/work-items/${workItemId}`)
      .send({ name: '越权' })
      .expect(403);
  });

  it('15. starts the project and creates immutable baseline V1', async () => {
    await write(manager, 'post', `/api/v2/projects/${projectId}/start`).send({}).expect(201);
    expect(
      (await prisma.projectBaseline.findMany({ where: { projectId } })).map(
        (baseline) => baseline.version,
      ),
    ).toEqual([1]);
  });

  it('16. blocks completion while required execution units are incomplete', async () => {
    const response = await write(member, 'post', `/api/v2/work-items/${workItemId}/complete`)
      .send({})
      .expect(409);
    expect(response.body.code).toBe('WORK_ITEM_COMPLETION_BLOCKED');
  });

  it('17. derives 33% after the first of three required units', async () => {
    await write(member, 'patch', `/api/v2/work-item-checklist/${checklistIds[0]}`)
      .send({ completed: true })
      .expect(200);
    expect(
      (await prisma.projectWorkItem.findUniqueOrThrow({ where: { id: workItemId } })).progress,
    ).toBe(33);
  });

  it('18. derives 67% after both checklist units', async () => {
    await write(member, 'patch', `/api/v2/work-item-checklist/${checklistIds[1]}`)
      .send({ completed: true })
      .expect(200);
    expect(
      (await prisma.projectWorkItem.findUniqueOrThrow({ where: { id: workItemId } })).progress,
    ).toBe(67);
  });

  it('19. uploads the logical deliverable document and contributes one half unit', async () => {
    const response = await write(
      manager,
      'post',
      `/api/v2/project-deliverables/${projectDeliverableId}/documents`,
    )
      .field('name', '接口确认表')
      .field('version', 'V1.0')
      .attach('file', Buffer.from('申请接口与收费接口均已确认'), {
        filename: '接口确认表.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    documentId = response.body.data.id;
    latestVersionId = response.body.data.versions[0].id;
    expect(
      (await prisma.projectWorkItem.findUniqueOrThrow({ where: { id: workItemId } })).progress,
    ).toBe(83);
  });

  it('20. persists a structured Fake-AI approval and reaches 100%', async () => {
    await waitForJob(latestVersionId, 'SUCCEEDED');
    const review = await prisma.documentVersionReview.findFirstOrThrow({
      where: { documentVersionId: latestVersionId, reviewType: 'AI' },
      include: { criterionResults: true },
    });
    expect(review.status).toBe('APPROVED');
    expect(review.criterionResults).toHaveLength(1);
    expect(
      (await prisma.projectWorkItem.findUniqueOrThrow({ where: { id: workItemId } })).progress,
    ).toBe(100);
  }, 20_000);

  it('21. completes the canonical WorkItem', async () => {
    const response = await write(member, 'post', `/api/v2/work-items/${workItemId}/complete`)
      .send({})
      .expect(201);
    expect(response.body.data).toEqual(expect.objectContaining({ status: 'DONE', progress: 100 }));
  });

  it('22. a new version immediately resets effective progress and reopens the WorkItem', async () => {
    const response = await write(manager, 'post', `/api/v2/documents/${documentId}/versions`)
      .field('version', 'V2.0')
      .attach('file', Buffer.from('FAKE_REJECT'), {
        filename: '接口确认表-v2.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    latestVersionId = response.body.data.id;
    const item = await prisma.projectWorkItem.findUniqueOrThrow({ where: { id: workItemId } });
    expect(item.progress).toBe(83);
    expect(item.status).toBe('IN_PROGRESS');
  });

  it('23. AI rejection remains a half unit and stores findings', async () => {
    await waitForJob(latestVersionId, 'SUCCEEDED');
    const review = await prisma.documentVersionReview.findFirstOrThrow({
      where: { documentVersionId: latestVersionId, reviewType: 'AI' },
      include: { findings: true },
    });
    expect(review.status).toBe('REJECTED');
    expect(review.findings.length).toBeGreaterThan(0);
    expect(
      (await prisma.projectWorkItem.findUniqueOrThrow({ where: { id: workItemId } })).progress,
    ).toBe(83);
  }, 20_000);

  it('24. an authorized human review overrides AI rejection', async () => {
    await write(approver, 'post', `/api/v2/documents/${documentId}/reviews`)
      .send({ status: 'APPROVED', comment: '人工确认通过' })
      .expect(201);
    expect(
      (await prisma.projectWorkItem.findUniqueOrThrow({ where: { id: workItemId } })).progress,
    ).toBe(100);
  });

  it('25. accepts the exact +20% baseline boundary as a direct adjustment', async () => {
    const response = await write(manager, 'post', `/api/v2/projects/${projectId}/adjustments`)
      .send({ proposedCompletionDate: '2026-05-01', reason: '+20% 边界' })
      .expect(201);
    expect(response.body.data.impact).toEqual(
      expect.objectContaining({ classification: 'DIRECT_ADJUSTMENT', changeRate: 20 }),
    );
  });

  it('26. accepts the exact -20% baseline boundary as a direct adjustment', async () => {
    const response = await write(manager, 'post', `/api/v2/projects/${projectId}/adjustments`)
      .send({ proposedCompletionDate: '2026-03-22', reason: '-20% 边界' })
      .expect(201);
    expect(response.body.data.impact.changeRate).toBe(-20);
  });

  it('27. prevents split adjustments by always using baseline V1', async () => {
    for (const [days, date] of [
      [110, '2026-04-21'],
      [118, '2026-04-29'],
    ] as const) {
      const response = await write(manager, 'post', `/api/v2/projects/${projectId}/adjustments`)
        .send({ proposedCompletionDate: date, reason: `${days} 天` })
        .expect(201);
      expect(response.body.data.impact.classification).toBe('DIRECT_ADJUSTMENT');
    }
    const preflight = await write(
      manager,
      'post',
      `/api/v2/projects/${projectId}/change-impact/preflight`,
    )
      .send({ proposedCompletionDate: '2026-05-02' })
      .expect(201);
    expect(preflight.body.data.classification).toBe('REQUIRES_CHANGE_REQUEST');
  });

  it('28. always classifies formal scope change as approval-required', async () => {
    const response = await write(
      manager,
      'post',
      `/api/v2/projects/${projectId}/change-impact/preflight`,
    )
      .send({ proposedCompletionDate: '2026-04-11', scopeChange: true })
      .expect(201);
    expect(response.body.data.classification).toBe('REQUIRES_CHANGE_REQUEST');
  });

  it('29. records and notifies every direct adjustment without replacing the baseline', async () => {
    await write(manager, 'post', `/api/v2/projects/${projectId}/work-items`)
      .send({ name: '联系 HIS 厂商', required: false, ownerUserId: member.user.id })
      .expect(201);
    expect(
      await prisma.projectAdjustmentLog.count({ where: { projectId } }),
    ).toBeGreaterThanOrEqual(4);
    expect(
      await prisma.notification.count({
        where: { projectId, userId: approver.user.id, type: 'PLAN_ADJUSTED' },
      }),
    ).toBeGreaterThanOrEqual(4);
    expect(
      (
        await prisma.projectBaseline.findFirstOrThrow({
          where: { projectId },
          orderBy: { version: 'desc' },
        })
      ).version,
    ).toBe(1);
  });

  it('30. lets only the PM create and submit a formal CR', async () => {
    await write(member, 'post', `/api/v2/projects/${projectId}/change-requests`)
      .send({})
      .expect(403);
    const created = await write(manager, 'post', `/api/v2/projects/${projectId}/change-requests`)
      .send({
        title: '新增退费接口',
        description: '新增 required 核心接口并延长工期',
        changeType: 'MIXED',
        reason: '客户确认范围扩大',
        source: 'CUSTOMER',
        operations: [
          {
            operationType: 'PROJECT_COMPLETION_DATE_CHANGE',
            payload: { plannedCompletionDate: '2026-05-06' },
          },
          {
            operationType: 'ADD_WORK_ITEM',
            payload: { planStageId: stageId, name: '退费接口对接', required: true },
          },
          {
            operationType: 'DELIVERABLE_NEEDS_REVISION',
            entityId: projectDeliverableId,
            payload: { reason: '补充退费接口验收内容' },
          },
        ],
      })
      .expect(201);
    expect(JSON.parse(created.body.data.aiImpactSummary)).toEqual(
      expect.objectContaining({ status: 'SUCCEEDED', provider: 'fake-test' }),
    );
    changeId = created.body.data.id;
    await write(member, 'post', `/api/v2/change-requests/${changeId}/submit`).send({}).expect(403);
    await write(manager, 'post', `/api/v2/change-requests/${changeId}/submit`).send({}).expect(201);
  });

  it('31. enforces the configured approver, applies once and creates baseline V2', async () => {
    await write(manager, 'post', `/api/v2/change-requests/${changeId}/approve`)
      .send({ comment: '越权审批' })
      .expect(403);
    await write(approver, 'post', `/api/v2/change-requests/${changeId}/approve`)
      .send({ comment: '同意变更' })
      .expect(201);
    await write(manager, 'post', `/api/v2/change-requests/${changeId}/apply`).send({}).expect(201);
    const second = await write(manager, 'post', `/api/v2/change-requests/${changeId}/apply`)
      .send({})
      .expect(201);
    expect(second.body.data.status).toBe('APPLIED');
    expect(
      (
        await prisma.projectBaseline.findFirstOrThrow({
          where: { projectId },
          orderBy: { version: 'desc' },
        })
      ).version,
    ).toBe(2);
    expect(
      await prisma.projectWorkItem.count({
        where: { projectId, name: '退费接口对接', sourceType: 'CHANGE' },
      }),
    ).toBe(1);
    expect(
      (await prisma.projectDeliverable.findUniqueOrThrow({ where: { id: projectDeliverableId } }))
        .needsRevision,
    ).toBe(true);
  });

  it('32. leaves an auditable unified graph with no legacy runtime tables', async () => {
    expect(await prisma.projectPlan.count({ where: { id: planId } })).toBe(1);
    expect(await prisma.projectWorkItem.count({ where: { projectId } })).toBe(3);
    expect(
      await prisma.auditLog.count({ where: { resourceId: { in: [workItemId, changeId] } } }),
    ).toBeGreaterThan(0);
    const tables = await prisma.$queryRaw<
      Array<{ table_name: string }>
    >`SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('tasks', 'project_plan_tasks')`;
    expect(tables).toEqual([]);
  });
});
