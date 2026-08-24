import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test';
import { cleanupAcceptanceData } from '../../api/test/acceptance-cleanup';

test.describe.configure({ mode: 'serial' });

const runId = Date.now().toString().slice(-8);
const prefix = `PW${runId}`;
const projectName = `Playwright 项目 ${runId}`;
const projectBName = `隔离项目 B ${runId}`;
const password = 'playwright-user-password';
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
let adminApi: APIRequestContext;
let memberApi: APIRequestContext;
let viewerApi: APIRequestContext;
let adminState: Awaited<ReturnType<APIRequestContext['storageState']>>;
let memberState: Awaited<ReturnType<APIRequestContext['storageState']>>;
let viewerState: Awaited<ReturnType<APIRequestContext['storageState']>>;
let csrf = '';
let memberCsrf = '';
let viewerCsrf = '';
let managerId = '';
let memberId = '';
let projectId = '';
let projectBId = '';
let templateId = '';
let versionId = '';
let documentId = '';

function token(state: Awaited<ReturnType<APIRequestContext['storageState']>>): string {
  return state.cookies.find((cookie) => cookie.name === 'csrf_token')?.value ?? '';
}

async function data(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: Record<string, any> }).data;
}

async function write(
  api: APIRequestContext,
  csrfToken: string,
  method: 'post' | 'put' | 'patch' | 'delete',
  path: string,
  body: unknown = {},
) {
  const response = await api[method](path, {
    data: body,
    headers: { 'x-csrf-token': csrfToken },
  });
  return data(response);
}

async function useState(context: BrowserContext, state: typeof adminState): Promise<void> {
  await context.clearCookies();
  await context.addCookies(state.cookies);
}

test.beforeAll(async () => {
  adminApi = await playwrightRequest.newContext({ baseURL });
  const login = await adminApi.post('/api/v2/auth/login', {
    data: {
      username: process.env.ADMIN_USERNAME ?? 'acceptance_admin',
      password: process.env.ADMIN_PASSWORD ?? 'acceptance-admin-password',
    },
  });
  await data(login);
  adminState = await adminApi.storageState();
  csrf = token(adminState);

  const manager = await write(adminApi, csrf, 'post', '/api/v2/users', {
    username: `${prefix.toLowerCase()}manager`,
    password,
    displayName: `E2E 经理 ${runId}`,
    roleCodes: ['PROJECT_MANAGER'],
  });
  managerId = manager.id;
  const member = await write(adminApi, csrf, 'post', '/api/v2/users', {
    username: `${prefix.toLowerCase()}member`,
    password,
    displayName: `E2E 成员 ${runId}`,
    roleCodes: ['MEMBER'],
  });
  memberId = member.id;
  const viewer = await write(adminApi, csrf, 'post', '/api/v2/users', {
    username: `${prefix.toLowerCase()}viewer`,
    password,
    displayName: `E2E 只读 ${runId}`,
    roleCodes: ['VIEWER'],
  });

  const project = await write(adminApi, csrf, 'post', '/api/v2/projects', {
    code: `${prefix}A`,
    name: projectName,
    customerName: 'Playwright 客户',
    managerUserId: managerId,
  });
  projectId = project.id;
  const projectB = await write(adminApi, csrf, 'post', '/api/v2/projects', {
    code: `${prefix}B`,
    name: projectBName,
    customerName: '隔离客户',
    managerUserId: managerId,
  });
  projectBId = projectB.id;
  await write(adminApi, csrf, 'put', `/api/v2/projects/${projectId}/members`, {
    members: [
      { userId: memberId, projectRole: 'IMPLEMENTER' },
      { userId: viewer.id, projectRole: 'VIEWER' },
    ],
  });

  const template = await write(adminApi, csrf, 'post', '/api/v2/sop/templates', {
    code: `${prefix}SOP`,
    name: `Playwright SOP ${runId}`,
  });
  templateId = template.id;
  const version = await write(
    adminApi,
    csrf,
    'post',
    `/api/v2/sop/templates/${templateId}/versions`,
    { version: 'V1.0' },
  );
  versionId = version.id;
  const stage = await write(adminApi, csrf, 'post', `/api/v2/sop/versions/${versionId}/stages`, {
    name: 'E2E 实施阶段',
    defaultDurationDays: 5,
  });
  const taskDefinition = await write(
    adminApi,
    csrf,
    'post',
    `/api/v2/sop/stages/${stage.id}/tasks`,
    { name: 'E2E 计划任务', defaultDurationDays: 5 },
  );
  for (const name of ['E2E 检查一', 'E2E 检查二'])
    await write(
      adminApi,
      csrf,
      'post',
      `/api/v2/sop/tasks/${taskDefinition.id}/checklist-items`,
      { name },
    );
  await write(adminApi, csrf, 'post', `/api/v2/sop/versions/${versionId}/publish`);
  await write(adminApi, csrf, 'post', `/api/v2/projects/${projectId}/plan`, {
    sopVersionId: versionId,
  });

  memberApi = await playwrightRequest.newContext({ baseURL });
  await data(
    await memberApi.post('/api/v2/auth/login', {
      data: { username: `${prefix.toLowerCase()}member`, password },
    }),
  );
  memberState = await memberApi.storageState();
  memberCsrf = token(memberState);

  viewerApi = await playwrightRequest.newContext({ baseURL });
  await data(
    await viewerApi.post('/api/v2/auth/login', {
      data: { username: `${prefix.toLowerCase()}viewer`, password },
    }),
  );
  viewerState = await viewerApi.storageState();
  viewerCsrf = token(viewerState);
});

test.afterAll(async () => {
  if (documentId)
    await adminApi.delete(`/api/v2/documents/${documentId}`, {
      headers: { 'x-csrf-token': csrf },
    });
  await cleanupAcceptanceData({
    projectIds: [projectId, projectBId],
    templateId,
    usernamePrefix: prefix.toLowerCase(),
  });
  await Promise.all([adminApi.dispose(), memberApi.dispose(), viewerApi.dispose()]);
});

test.beforeEach(async ({ context }) => {
  await useState(context, adminState);
});

test('A — user/project membership and lifecycle are visible through the real UI', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: '项目管理', level: 2 })).toBeVisible();
  await page.getByPlaceholder('搜索编码、项目或客户').fill(`${prefix}A`);
  await page.getByText(projectName, { exact: true }).click();
  await expect(page.getByRole('heading', { name: projectName, level: 2 })).toBeVisible();
  await page.getByRole('tab', { name: '项目成员' }).click();
  await expect(page.getByText(`E2E 成员 ${runId}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '启动项目' }).click();
  await expect(page.getByText('进行中', { exact: true })).toBeVisible();
});

test('B — published SOP tree is rendered from MySQL', async ({ page }) => {
  await page.goto('/sop');
  await page.getByRole('button').filter({ hasText: `Playwright SOP ${runId}` }).click();
  await page.getByText('V1.0', { exact: true }).click();
  await expect(page.getByText('E2E 实施阶段', { exact: true })).toBeVisible();
  await expect(page.getByText('E2E 计划任务', { exact: true })).toBeVisible();
  await expect(page.getByText('□ E2E 检查一')).toBeVisible();
  await expect(page.getByText('已发布', { exact: true })).toBeVisible();
});

test('C — checklist completion propagates plan and project progress in the UI', async ({ page }) => {
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: '实施计划' }).click();
  await expect(page.getByText('整体进度 0%')).toBeVisible();
  await page.locator('label.el-checkbox').filter({ hasText: 'E2E 检查一' }).click();
  await expect(page.getByText('整体进度 50%')).toBeVisible();
  const project = await data(await adminApi.get(`/api/v2/projects/${projectId}`));
  expect(project.progress).toBe(50);
});

test('D — creates, starts and completes an execution Task through the UI', async ({ page }) => {
  const title = `E2E Task ${runId}`;
  await page.goto('/tasks');
  await page.getByRole('button', { name: '创建任务' }).click();
  const dialog = page.getByRole('dialog', { name: '创建执行任务' });
  await dialog.locator('.el-form-item').filter({ hasText: '项目' }).locator('.el-select').click();
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: projectName }).click();
  await dialog.locator('.el-form-item').filter({ hasText: '标题' }).locator('input').fill(title);
  const createdResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/v2/tasks') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  const created = await createdResponse;
  expect(created.status(), await created.text()).toBe(201);
  await page.reload();
  const row = page.locator('.el-table__row').filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '开始' }).click();
  await page.reload();
  await row.getByRole('button', { name: '完成' }).click();
  await page.reload();
  await expect(row.getByText('已完成', { exact: true })).toBeVisible();
});

test('E — HIGH Risk changes dashboard health and can be closed through the UI', async ({ page }) => {
  const title = `E2E HIGH Risk ${runId}`;
  await page.goto('/issues');
  await page.getByRole('button', { name: '新增问题风险' }).click();
  const dialog = page.getByRole('dialog', { name: '新增问题或风险' });
  const selects = dialog.locator('.el-select');
  await selects.nth(0).click();
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: projectName }).click();
  await selects.nth(1).click();
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: 'RISK' }).click();
  await dialog.locator('.el-form-item').filter({ hasText: '标题' }).locator('input').fill(title);
  await selects.nth(2).click();
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: 'HIGH' }).click();
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  const row = page.locator('.el-table__row').filter({ hasText: title });
  await expect(row).toContainText('高');
  await page.goto('/dashboard');
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.goto('/issues');
  await page.locator('.el-table__row').filter({ hasText: title }).getByRole('button', { name: '解决' }).click();
  await page.locator('.el-table__row').filter({ hasText: title }).getByRole('button', { name: '关闭' }).click();
  await expect(page.locator('.el-table__row').filter({ hasText: title })).toContainText('已关闭');
});

test('F — uploads and approves a real Document without committing a fixture file', async ({ page }) => {
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: '交付物' }).click();
  await page.getByRole('button', { name: '上传文档' }).click();
  const dialog = page.getByRole('dialog', { name: '上传交付文档' });
  await dialog.locator('.el-form-item').filter({ hasText: '文档名称' }).locator('input').fill(`E2E 文档 ${runId}`);
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'playwright-acceptance.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('playwright production acceptance'),
  });
  await dialog.getByRole('button', { name: '上传', exact: true }).click();
  const row = page.locator('.el-table__row').filter({ hasText: `E2E 文档 ${runId}` });
  await expect(row).toBeVisible();
  const documents = await data(await adminApi.get(`/api/v2/projects/${projectId}/documents`));
  documentId = documents.find((item: { name: string }) => item.name === `E2E 文档 ${runId}`).id;
  await row.getByRole('button', { name: '提交审核' }).click();
  await row.getByRole('button', { name: '通过' }).click();
  await expect(row).toContainText('已通过');
});

test('G — Message analysis and human confirmation create real idempotent actions', async ({ page }) => {
  const content = `E2E 接口已经调通，但退费接口还有问题 ${runId}`;
  await page.goto('/messages');
  await page.getByRole('button', { name: '人工录入' }).click();
  const dialog = page.getByRole('dialog', { name: '人工录入项目消息' });
  await dialog.locator('.el-select').click();
  await page.locator('.el-select-dropdown__item:visible').filter({ hasText: projectName }).click();
  await dialog.locator('.el-form-item').filter({ hasText: '发送人' }).locator('input').fill('E2E 项目群');
  await dialog.locator('textarea').fill(content);
  await dialog.getByRole('button', { name: '录入消息' }).click();
  const card = page.locator('article.panel').filter({ hasText: content });
  await card.getByRole('button', { name: 'AI 结构化分析' }).click();
  await expect(card.getByText('CREATE_TASK', { exact: true })).toBeVisible();
  while (await card.getByRole('button', { name: '确认', exact: true }).count()) {
    const confirmButtons = card.getByRole('button', { name: '确认', exact: true });
    const pendingCount = await confirmButtons.count();
    await confirmButtons.first().click();
    const confirmation = page.getByRole('dialog', { name: '人工确认' });
    const confirmed = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v2/messages/`) &&
        response.url().endsWith('/confirm') &&
        response.request().method() === 'POST',
    );
    await confirmation.getByRole('button', { name: '确定' }).click();
    expect((await confirmed).ok()).toBe(true);
    await expect(confirmation).toBeHidden();
    await expect(confirmButtons).toHaveCount(pendingCount - 1);
    await expect(page.getByText('已确认并幂等执行').last()).toBeVisible();
  }
  const messages = await data(await adminApi.get(`/api/v2/messages?projectId=${projectId}&search=${runId}`));
  const message = messages.items.find((item: { content: string }) => item.content === content);
  const decisions = message.pendingActions.map((action: { id: string }) => ({
    actionId: action.id,
    decision: 'CONFIRM',
  }));
  await write(adminApi, csrf, 'post', `/api/v2/messages/${message.id}/confirm`, { decisions });
  const tasks = await data(await adminApi.get(`/api/v2/tasks?projectId=${projectId}&search=跟进消息事项`));
  const issues = await data(await adminApi.get(`/api/v2/issues?projectId=${projectId}&search=消息中识别的问题`));
  expect(tasks.items.filter((item: { sourceId: string }) => item.sourceId === message.id)).toHaveLength(1);
  expect(issues.items.filter((item: { sourceId: string }) => item.sourceId === message.id)).toHaveLength(1);
});

test('security — member project enumeration is denied and Viewer has no create control or API access', async ({
  page,
  context,
}) => {
  await useState(context, memberState);
  const denied = page.waitForResponse(
    (response) => response.url().includes(`/api/v2/projects/${projectBId}`) && response.status() === 403,
  );
  await page.goto(`/projects/${projectBId}`);
  await denied;
  await expect(page.getByText('项目加载失败')).toBeVisible();
  expect(
    (
      await memberApi.get(`/api/v2/tasks?projectId=${projectBId}`, {
        headers: { 'x-csrf-token': memberCsrf },
      })
    ).status(),
  ).toBe(403);

  await useState(context, viewerState);
  await page.goto('/tasks');
  await expect(page.getByRole('button', { name: '创建任务' })).toHaveCount(0);
  expect(
    (
      await viewerApi.post('/api/v2/tasks', {
        headers: { 'x-csrf-token': viewerCsrf },
        data: { projectId, title: 'Viewer forbidden' },
      })
    ).status(),
  ).toBe(403);
});
