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
const prefix = `AC${runId}`;
const uploadRoot = `.tmp/acceptance-${runId}`;
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

describe.skipIf(!hasDatabase)('V2 production acceptance against MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaServiceType;
  let server: Parameters<typeof request>[0];
  let admin: Session;
  let managerA: Session;
  let memberA: Session;
  let viewerA: Session;
  let managerB: Session;
  let projectA = '';
  let projectB = '';
  let sopTemplateId = '';
  let sopV1 = '';
  let sopStageV1 = '';
  let sopTaskV1 = '';
  let planTaskId = '';
  let requiredDocumentId = '';
  let linkedTaskId = '';
  let highIssueId = '';

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

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = 'acceptance-access-secret-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'acceptance-refresh-secret-at-least-32-characters';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.STORAGE_PATH = uploadRoot;
    process.env.AI_ENABLED = 'false';
    process.env.AI_FAKE_ENABLED = 'true';
    delete process.env.AI_API_KEY;
    delete process.env.DINGTALK_SIGNING_SECRET;
    delete process.env.ZENTAO_BASE_URL;
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
      {
        username: `${prefix.toLowerCase()}pma`,
        displayName: '验收经理 A',
        roleCodes: ['PROJECT_MANAGER'],
      },
      {
        username: `${prefix.toLowerCase()}member`,
        displayName: '验收成员 A',
        roleCodes: ['MEMBER'],
      },
      {
        username: `${prefix.toLowerCase()}viewer`,
        displayName: '验收只读 A',
        roleCodes: ['VIEWER'],
      },
      {
        username: `${prefix.toLowerCase()}pmb`,
        displayName: '验收经理 B',
        roleCodes: ['PROJECT_MANAGER'],
      },
    ];
    for (const user of users)
      await write(admin, 'post', '/api/v2/users')
        .send({ ...user, password: 'acceptance-user-password' })
        .expect(201);

    managerA = await login(users[0]!.username, 'acceptance-user-password');
    memberA = await login(users[1]!.username, 'acceptance-user-password');
    viewerA = await login(users[2]!.username, 'acceptance-user-password');
    managerB = await login(users[3]!.username, 'acceptance-user-password');

    const createdA = await write(admin, 'post', '/api/v2/projects')
      .send({
        code: `${prefix}A`,
        name: '验收项目 A',
        customerName: '验收客户',
        managerUserId: managerA.user.id,
      })
      .expect(201);
    projectA = createdA.body.data.id as string;
    const createdB = await write(admin, 'post', '/api/v2/projects')
      .send({
        code: `${prefix}B`,
        name: '验收项目 B',
        customerName: '隔离客户',
        managerUserId: managerB.user.id,
      })
      .expect(201);
    projectB = createdB.body.data.id as string;
    await write(admin, 'put', `/api/v2/projects/${projectA}/members`)
      .send({
        members: [
          { userId: memberA.user.id, projectRole: 'IMPLEMENTER' },
          { userId: viewerA.user.id, projectRole: 'VIEWER' },
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

  it('accepts login/me, secure cookie flags, hashed refresh rotation, logout and live CSRF enforcement', async () => {
    const accessCookie = admin.cookies.find((value) => value.startsWith('access_token=')) ?? '';
    const refreshCookie = admin.cookies.find((value) => value.startsWith('refresh_token=')) ?? '';
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('SameSite=Strict');
    expect(refreshCookie).toContain('HttpOnly');
    expect(admin.cookies.find((value) => value.startsWith('csrf_token='))).not.toContain(
      'HttpOnly',
    );
    const payload = JSON.parse(
      Buffer.from(
        cookieValue(admin.cookies, 'access_token').split('.')[1]!,
        'base64url',
      ).toString(),
    ) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(15 * 60);
    await admin.agent.get('/api/v2/auth/me').expect(200);

    const rawRefresh = cookieValue(memberA.cookies, 'refresh_token');
    const stored = await prisma.refreshToken.findFirstOrThrow({
      where: { userId: memberA.user.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored.tokenHash).not.toBe(rawRefresh);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    await memberA.agent.post('/api/v2/auth/refresh').send({}).expect(403);
    await request(server)
      .post('/api/v2/auth/refresh')
      .set('Cookie', memberA.cookies)
      .set('x-csrf-token', memberA.csrf)
      .send({})
      .expect(200);
    await request(server)
      .post('/api/v2/auth/refresh')
      .set('Cookie', memberA.cookies)
      .set('x-csrf-token', memberA.csrf)
      .send({})
      .expect(401);

    const viewerCookies = viewerA.cookies;
    await request(server)
      .post('/api/v2/auth/logout')
      .set('Cookie', viewerCookies)
      .set('x-csrf-token', viewerA.csrf)
      .send({})
      .expect(204);
    await request(server)
      .post('/api/v2/auth/refresh')
      .set('Cookie', viewerCookies)
      .set('x-csrf-token', viewerA.csrf)
      .send({})
      .expect(401);
  });

  it('enforces RBAC, project ID enumeration protection and dashboard scope', async () => {
    await managerA.agent.get(`/api/v2/projects/${projectA}`).expect(200);
    await memberA.agent.get(`/api/v2/projects/${projectA}`).expect(200);
    await viewerA.agent.get(`/api/v2/projects/${projectA}`).expect(200);
    await viewerA.agent.get('/api/v2/users').expect(403);
    await write(viewerA, 'post', '/api/v2/tasks')
      .send({ projectId: projectA, title: 'Viewer must not create' })
      .expect(403);

    const deniedGets = [
      `/api/v2/projects/${projectB}`,
      `/api/v2/tasks?projectId=${projectB}`,
      `/api/v2/issues?projectId=${projectB}`,
      `/api/v2/projects/${projectB}/documents`,
      `/api/v2/messages?projectId=${projectB}`,
      `/api/v2/reports/daily?projectId=${projectB}`,
      `/api/v2/projects/${projectB}/members`,
    ];
    for (const path of deniedGets) await memberA.agent.get(path).expect(403);
    await write(memberA, 'patch', `/api/v2/projects/${projectB}`)
      .send({ name: '越权修改' })
      .expect(403);
    await write(memberA, 'post', '/api/v2/tasks')
      .send({ projectId: projectB, title: '越权任务' })
      .expect(403);
    await write(memberA, 'post', '/api/v2/issues')
      .send({ projectId: projectB, type: 'ISSUE', title: '越权问题', severity: 'LOW' })
      .expect(403);

    await prisma.task.create({
      data: {
        projectId: projectB,
        title: 'B overdue',
        dueDate: new Date('2020-01-01'),
        createdById: managerB.user.id,
      },
    });
    await prisma.issue.create({
      data: {
        projectId: projectB,
        type: 'RISK',
        title: 'B risk',
        severity: 'CRITICAL',
        createdById: managerB.user.id,
      },
    });
    const dashboard = await memberA.agent.get('/api/v2/dashboard').expect(200);
    expect(dashboard.body.data.summary.projectCount).toBe(1);
    expect(dashboard.body.data.summary.overdueTaskCount).toBe(0);
    expect(dashboard.body.data.summary.highRiskIssueCount).toBe(0);
    expect(JSON.stringify(dashboard.body.data)).not.toContain(projectB);
  });

  it('creates and publishes SOP V1, snapshots it into a plan and keeps the published version immutable', async () => {
    const template = await write(admin, 'post', '/api/v2/sop/templates')
      .send({ code: `${prefix}SOP`, name: '生产验收 SOP' })
      .expect(201);
    sopTemplateId = template.body.data.id as string;
    const version = await write(admin, 'post', `/api/v2/sop/templates/${sopTemplateId}/versions`)
      .send({ version: 'V1.0' })
      .expect(201);
    sopV1 = version.body.data.id as string;
    const stage = await write(admin, 'post', `/api/v2/sop/versions/${sopV1}/stages`)
      .send({ name: '实施阶段', defaultDurationDays: 7 })
      .expect(201);
    sopStageV1 = stage.body.data.id as string;
    const task = await write(admin, 'post', `/api/v2/sop/stages/${sopStageV1}/tasks`)
      .send({
        name: '接口实施',
        defaultDurationDays: 7,
        deliverableRequired: true,
        deliverableName: '接口验收单',
      })
      .expect(201);
    sopTaskV1 = task.body.data.id as string;
    for (let index = 1; index <= 4; index += 1)
      await write(admin, 'post', `/api/v2/sop/tasks/${sopTaskV1}/checklist-items`)
        .send({ name: `检查项 ${index}` })
        .expect(201);
    const published = await write(admin, 'post', `/api/v2/sop/versions/${sopV1}/publish`)
      .send({})
      .expect(201);
    expect(published.body.data.stages[0].weight).toBe(100);
    expect(published.body.data.stages[0].tasks[0].weight).toBe(100);
    await write(admin, 'patch', `/api/v2/sop/stages/${sopStageV1}`)
      .send({ name: '禁止修改' })
      .expect(409);

    const generated = await write(managerA, 'post', `/api/v2/projects/${projectA}/plan`)
      .send({ sopVersionId: sopV1 })
      .expect(201);
    expect(generated.body.data.stages).toHaveLength(1);
    expect(generated.body.data.stages[0].tasks[0].checklistItems).toHaveLength(4);
    planTaskId = generated.body.data.stages[0].tasks[0].id as string;
    expect(generated.body.data.stages[0].tasks[0].name).toBe('接口实施');
  });

  it('computes checklist → task → stage → plan → project progress and supports lifecycle start/pause/resume', async () => {
    await write(managerA, 'post', `/api/v2/projects/${projectA}/start`).send({}).expect(201);
    await write(managerA, 'post', `/api/v2/projects/${projectA}/pause`).send({}).expect(201);
    await write(managerA, 'post', `/api/v2/projects/${projectA}/resume`).send({}).expect(201);
    const plan = await managerA.agent.get(`/api/v2/projects/${projectA}/plan`).expect(200);
    const items = plan.body.data.stages[0].tasks[0].checklistItems as Array<{ id: string }>;
    for (const item of items.slice(0, 2))
      await write(managerA, 'patch', `/api/v2/checklist-items/${item.id}`)
        .send({ completed: true })
        .expect(200);
    const progressed = await managerA.agent.get(`/api/v2/projects/${projectA}/plan`).expect(200);
    expect(progressed.body.data.stages[0].tasks[0].progress).toBe(50);
    expect(progressed.body.data.stages[0].progress).toBe(50);
    expect(progressed.body.data.progress).toBe(50);
    const project = await managerA.agent.get(`/api/v2/projects/${projectA}`).expect(200);
    expect(project.body.data.progress).toBe(50);
  });

  it('syncs SOP V2 without mutating the V1 snapshot identity or clearing execution data', async () => {
    await write(managerA, 'patch', `/api/v2/plan-tasks/${planTaskId}`)
      .send({ ownerUserId: memberA.user.id })
      .expect(200);
    const clone = await write(admin, 'post', `/api/v2/sop/versions/${sopV1}/clone`)
      .send({ version: 'V2.0' })
      .expect(201);
    const v2 = clone.body.data;
    await write(admin, 'patch', `/api/v2/sop/tasks/${v2.stages[0].tasks[0].id}`)
      .send({
        name: '接口实施 V2',
        defaultDurationDays: 9,
        required: true,
        deliverableRequired: true,
        deliverableName: '接口验收单',
      })
      .expect(200);
    await write(admin, 'post', `/api/v2/sop/tasks/${v2.stages[0].tasks[0].id}/checklist-items`)
      .send({ name: 'V2 新检查项' })
      .expect(201);
    await write(admin, 'post', `/api/v2/sop/versions/${v2.id}/publish`).send({}).expect(201);

    const beforeSync = await managerA.agent.get(`/api/v2/projects/${projectA}/plan`).expect(200);
    expect(beforeSync.body.data.sourceSopVersionId).toBe(sopV1);
    expect(beforeSync.body.data.stages[0].tasks[0].name).toBe('接口实施');
    const preview = await managerA.agent
      .get(`/api/v2/projects/${projectA}/plan/sync-preview?sopVersionId=${v2.id}`)
      .expect(200);
    expect(preview.body.data.diff.length).toBeGreaterThan(0);
    const synced = await write(managerA, 'post', `/api/v2/projects/${projectA}/plan/sync`)
      .send({ sopVersionId: v2.id, acceptedDiffHash: preview.body.data.diffHash })
      .expect(201);
    const syncedTask = synced.body.data.stages[0].tasks[0];
    expect(syncedTask.id).toBe(planTaskId);
    expect(syncedTask.name).toBe('接口实施 V2');
    expect(syncedTask.ownerUserId).toBe(memberA.user.id);
    expect(syncedTask.actualStartDate).toBeTruthy();
    const syncedChecklist = syncedTask.checklistItems as Array<{ completed: boolean }>;
    expect(syncedChecklist.filter((item) => item.completed)).toHaveLength(2);
  });

  it('covers Task create/update/start/complete/cancel with linked and unlinked plan tasks', async () => {
    const linked = await write(memberA, 'post', '/api/v2/tasks')
      .send({
        projectId: projectA,
        planTaskId,
        title: '关联计划任务',
        ownerUserId: memberA.user.id,
      })
      .expect(201);
    linkedTaskId = linked.body.data.id as string;
    expect(linked.body.data.planTaskId).toBe(planTaskId);
    await write(memberA, 'patch', `/api/v2/tasks/${linkedTaskId}`)
      .send({ title: '关联计划任务-已修改', status: 'IN_PROGRESS', progress: 30 })
      .expect(200);
    const completed = await write(memberA, 'patch', `/api/v2/tasks/${linkedTaskId}`)
      .send({ status: 'DONE' })
      .expect(200);
    expect(completed.body.data.progress).toBe(100);

    const standalone = await write(memberA, 'post', '/api/v2/tasks')
      .send({ projectId: projectA, title: '独立任务' })
      .expect(201);
    expect(standalone.body.data.planTaskId).toBeNull();
    await write(memberA, 'patch', `/api/v2/tasks/${standalone.body.data.id}`)
      .send({ status: 'CANCELLED' })
      .expect(200);
  });

  it('covers Issue/Risk/Change/Blocker, all severities and status transitions with health recomputation', async () => {
    const fixtures = [
      ['ISSUE', 'LOW'],
      ['RISK', 'MEDIUM'],
      ['CHANGE', 'HIGH'],
      ['BLOCKER', 'CRITICAL'],
    ] as const;
    const ids: string[] = [];
    for (const [type, severity] of fixtures) {
      const created = await write(memberA, 'post', '/api/v2/issues')
        .send({
          projectId: projectA,
          type,
          title: `${type} 验收`,
          severity,
          probability: 4,
          impact: 5,
        })
        .expect(201);
      ids.push(created.body.data.id as string);
    }
    highIssueId = ids[2]!;
    for (const status of ['PROCESSING', 'WAITING', 'RESOLVED', 'CLOSED'])
      await write(memberA, 'patch', `/api/v2/issues/${ids[0]}`).send({ status }).expect(200);
    const project = await managerA.agent.get(`/api/v2/projects/${projectA}`).expect(200);
    expect(project.body.data.health).toBe('HIGH_RISK');
    await write(memberA, 'patch', `/api/v2/issues/${ids[3]}`)
      .send({ status: 'CLOSED' })
      .expect(200);
  });

  it('uploads, versions, downloads, rejects, approves and deletes documents', async () => {
    const created = await write(memberA, 'post', `/api/v2/projects/${projectA}/documents`)
      .field('name', '接口验收单')
      .field('version', 'V1.0')
      .field('required', 'true')
      .field('planTaskId', planTaskId)
      .attach('file', Buffer.from('acceptance document v1'), {
        filename: 'acceptance.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    requiredDocumentId = created.body.data.id as string;
    const v1Id = created.body.data.versions[0].id as string;
    const download = await memberA.agent
      .get(`/api/v2/document-versions/${v1Id}/download`)
      .expect(200);
    expect(download.text).toBe('acceptance document v1');
    await write(admin, 'post', `/api/v2/documents/${requiredDocumentId}/reviews`)
      .send({ status: 'PENDING' })
      .expect(201);
    await write(admin, 'post', `/api/v2/documents/${requiredDocumentId}/reviews`)
      .send({ status: 'REJECTED', comment: '需要修订' })
      .expect(201);
    await write(memberA, 'post', `/api/v2/documents/${requiredDocumentId}/versions`)
      .field('version', 'V1.1')
      .attach('file', Buffer.from('acceptance document v2'), {
        filename: 'acceptance-v2.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    await write(admin, 'post', `/api/v2/documents/${requiredDocumentId}/reviews`)
      .send({ status: 'PENDING' })
      .expect(201);
    await write(admin, 'post', `/api/v2/documents/${requiredDocumentId}/reviews`)
      .send({ status: 'APPROVED', comment: '验收通过' })
      .expect(201);

    const disposable = await write(memberA, 'post', `/api/v2/projects/${projectA}/documents`)
      .field('name', '可删除附件')
      .field('version', 'V1.0')
      .attach('file', Buffer.from('delete me'), {
        filename: 'delete-me.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    await write(admin, 'delete', `/api/v2/documents/${disposable.body.data.id}`).expect(204);
    const list = await memberA.agent.get(`/api/v2/projects/${projectA}/documents`).expect(200);
    const documents = list.body.data as Array<{ id: string }>;
    expect(documents.some((item) => item.id === disposable.body.data.id)).toBe(false);
  });

  it('runs Message → Analysis → PendingAction → confirm idempotently and blocks cross-project confirmation', async () => {
    const status = await managerA.agent.get('/api/v2/messages/ai-status').expect(200);
    expect(status.body.data).toEqual({
      configured: true,
      provider: 'fake-test',
      model: 'deterministic',
    });
    const message = await write(managerA, 'post', '/api/v2/messages/manual')
      .send({
        projectId: projectA,
        senderName: '项目群',
        content: '儿童医院接口已经调通，但退费接口还有问题，研发计划周三处理。',
      })
      .expect(201);
    const messageId = message.body.data.id as string;
    const analyzed = await write(managerA, 'post', `/api/v2/messages/${messageId}/analyze`)
      .send({})
      .expect(201);
    expect(analyzed.body.data.status).toBe('SUCCEEDED');
    const actions = analyzed.body.data.actions as Array<{ id: string; type: string }>;
    expect(actions.map((item) => item.type)).toEqual(
      expect.arrayContaining(['CREATE_TASK', 'CREATE_ISSUE']),
    );
    const decisions = actions.map((action) => ({
      actionId: action.id,
      decision: 'CONFIRM',
    }));
    const [first, concurrent] = await Promise.all([
      write(managerA, 'post', `/api/v2/messages/${messageId}/confirm`).send({ decisions }),
      write(managerA, 'post', `/api/v2/messages/${messageId}/confirm`).send({ decisions }),
    ]);
    expect([first.status, concurrent.status].every((value) => value < 500)).toBe(true);
    await write(managerA, 'post', `/api/v2/messages/${messageId}/confirm`)
      .send({ decisions })
      .expect(201);
    expect(await prisma.task.count({ where: { sourceType: 'MESSAGE', sourceId: messageId } })).toBe(
      1,
    );
    expect(
      await prisma.issue.count({ where: { sourceType: 'MESSAGE', sourceId: messageId } }),
    ).toBe(1);

    const foreign = await write(managerB, 'post', '/api/v2/messages/manual')
      .send({ projectId: projectB, senderName: 'B 项目群', content: 'B 项目有问题需要跟进' })
      .expect(201);
    const foreignAnalysis = await write(
      managerB,
      'post',
      `/api/v2/messages/${foreign.body.data.id}/analyze`,
    )
      .send({})
      .expect(201);
    await write(memberA, 'post', `/api/v2/messages/${foreign.body.data.id}/confirm`)
      .send({
        decisions: [{ actionId: foreignAnalysis.body.data.actions[0].id, decision: 'CONFIRM' }],
      })
      .expect(403);
  });

  it('returns structured close blockers, then closes only after required work is complete', async () => {
    const blocked = await write(managerA, 'post', `/api/v2/projects/${projectA}/close`)
      .send({})
      .expect(409);
    expect(blocked.body.code).toBe('PROJECT_CLOSE_BLOCKED');
    expect(blocked.body.details.incompletePlanTasks.length).toBeGreaterThan(0);
    expect(blocked.body.details.openHighPriorityIssues.length).toBeGreaterThan(0);
    expect(blocked.body.details.missingRequiredDeliverables).toEqual([]);

    const plan = await managerA.agent.get(`/api/v2/projects/${projectA}/plan`).expect(200);
    for (const item of plan.body.data.stages[0].tasks[0].checklistItems as Array<{
      id: string;
      completed: boolean;
    }>)
      if (!item.completed)
        await write(managerA, 'patch', `/api/v2/checklist-items/${item.id}`)
          .send({ completed: true })
          .expect(200);
    await write(memberA, 'patch', `/api/v2/issues/${highIssueId}`)
      .send({ status: 'RESOLVED' })
      .expect(200);
    await prisma.issue.updateMany({
      where: { projectId: projectA, severity: { in: ['HIGH', 'CRITICAL'] } },
      data: { status: 'CLOSED', resolvedAt: new Date() },
    });
    await prisma.task.updateMany({
      where: { projectId: projectA, status: { notIn: ['DONE', 'CANCELLED'] } },
      data: { status: 'DONE', progress: 100, completedAt: new Date() },
    });
    const closed = await write(managerA, 'post', `/api/v2/projects/${projectA}/close`)
      .send({})
      .expect(201);
    expect(closed.body.data.status).toBe('COMPLETED');
    expect(closed.body.data.progress).toBe(100);
  });

  it('keeps unconfigured external adapters non-fatal while fake AI is test-only', async () => {
    const dingtalk = await admin.agent.get('/api/v2/integrations/dingtalk/status').expect(200);
    const zentao = await admin.agent.get('/api/v2/integrations/zentao/status').expect(200);
    expect(dingtalk.body.data.status).toBe('NOT_CONFIGURED');
    expect(zentao.body.data.status).toBe('NOT_CONFIGURED');
    expect(process.env.NODE_ENV).toBe('test');
  });
});
