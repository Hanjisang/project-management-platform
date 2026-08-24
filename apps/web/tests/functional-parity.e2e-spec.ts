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
const prefix = `PF${runId}`;
const projectName = `Parity 项目 ${runId}`;
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5174';
let adminApi: APIRequestContext;
let adminState: Awaited<ReturnType<APIRequestContext['storageState']>>;
let csrf = '';
let adminId = '';
let projectId = '';
let templateId = '';
let versionId = '';
let workItemId = '';
let cancelledTaskId = '';

function token(state: Awaited<ReturnType<APIRequestContext['storageState']>>): string {
  return state.cookies.find((cookie) => cookie.name === 'csrf_token')?.value ?? '';
}

async function data(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  const body = await response.text();
  expect(response.ok(), `${response.status()} ${body}`).toBe(true);
  return (JSON.parse(body) as { data: Record<string, any> }).data;
}

async function write(
  method: 'post' | 'put' | 'patch' | 'delete',
  path: string,
  body: unknown = {},
) {
  const response = await adminApi[method](path, {
    data: body,
    headers: { 'x-csrf-token': csrf },
  });
  return data(response);
}

async function useAdmin(context: BrowserContext): Promise<void> {
  await context.clearCookies();
  await context.addCookies(adminState.cookies);
}

test.beforeAll(async () => {
  adminApi = await playwrightRequest.newContext({ baseURL });
  const login = await adminApi.post('/api/v2/auth/login', {
    data: {
      username: process.env.ADMIN_USERNAME ?? 'acceptance_admin',
      password: process.env.ADMIN_PASSWORD ?? 'acceptance-admin-password',
    },
  });
  const loginData = await data(login);
  adminId = loginData.user.id;
  adminState = await adminApi.storageState();
  csrf = token(adminState);

  const project = await write('post', '/api/v2/projects', {
    code: `${prefix}A`,
    name: projectName,
    customerName: 'Parity 客户',
    managerUserId: adminId,
    approverUserId: adminId,
    plannedStartDate: '2026-01-01',
    plannedGoLiveDate: '2026-12-31',
  });
  projectId = project.id;

  const template = await write('post', '/api/v2/sop/templates', {
    code: `${prefix}SOP`,
    name: `Parity SOP ${runId}`,
  });
  templateId = template.id;
  const version = await write('post', `/api/v2/sop/templates/${templateId}/versions`, {
    version: 'V1.0',
  });
  versionId = version.id;
  const stage = await write('post', `/api/v2/sop/versions/${versionId}/stages`, {
    name: 'Parity 实施阶段',
    defaultDurationDays: 10,
  });
  await write('post', `/api/v2/sop/stages/${stage.id}/tasks`, {
    name: 'Parity 计划任务',
    defaultDurationDays: 10,
    required: true,
  });
  await write('post', `/api/v2/sop/versions/${versionId}/publish`);
  const plan = await write('post', `/api/v2/projects/${projectId}/plan`, { sopVersionId: versionId });
  workItemId = plan.stages[0].workItems[0].id;
});

test.afterAll(async () => {
  await cleanupAcceptanceData({
    projectIds: [projectId],
    templateId,
    usernamePrefix: prefix.toLowerCase(),
  });
  await adminApi?.dispose();
});

test.beforeEach(async ({ context }) => {
  await useAdmin(context);
});

test('H — dashboard keeps legacy metrics beside the new execution workspace', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: '管理驾驶舱', level: 2 })).toBeVisible();
  await expect(page.getByText('正常项目', { exact: true })).toBeVisible();
  await expect(page.getByText('待确认消息', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '项目进度排行', level: 3 })).toBeVisible();
  const projectCard = page.locator('.my-project-grid .project-card').filter({ hasText: projectName });
  await expect(projectCard).toHaveCount(1);
  await expect(projectCard.getByRole('heading', { name: projectName, level: 3 })).toBeVisible();
});

test('I — implementation plan edits the same WorkItem owner and schedule directly', async ({ page }) => {
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: '实施计划' }).click();
  const task = page.locator('.plan-task').filter({ hasText: 'Parity 计划任务' });
  await task.getByRole('button', { name: '编辑计划' }).click();
  const dialog = page.getByRole('dialog', { name: '编辑任务计划' });
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: '计划开始' })
    .locator('input')
    .fill('2026-02-01');
  await dialog
    .locator('.el-form-item')
    .filter({ hasText: '计划结束' })
    .locator('input')
    .fill('2026-02-10');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(task).toContainText('2026-02-01 至 2026-02-10');

  await page.goto('/tasks');
  const row = page.locator('.el-table__row').filter({ hasText: 'Parity 计划任务' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('2026-02-10');
  const apiTask = await data(await adminApi.get(`/api/v2/work-items/${workItemId}`));
  expect(apiTask.plannedStartDate.slice(0, 10)).toBe('2026-02-01');
  expect(apiTask.plannedEndDate.slice(0, 10)).toBe('2026-02-10');
});

test('J — cancelling a task keeps it in execution history', async ({ page }) => {
  const created = await write('post', `/api/v2/projects/${projectId}/work-items`, {
    name: `Parity 可取消任务 ${runId}`,
    required: false,
  });
  cancelledTaskId = created.id;

  await page.goto('/tasks');
  await page.getByPlaceholder('搜索任务').fill(`Parity 可取消任务 ${runId}`);
  const row = page.locator('.el-table__row').filter({ hasText: `Parity 可取消任务 ${runId}` });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '取消' }).click();
  const confirm = page.getByRole('dialog', { name: '取消任务' });
  await expect(confirm.getByText('任务将保留在执行历史中，不会物理删除。', { exact: false })).toBeVisible();
  await confirm.getByRole('button', { name: '确定' }).click();
  await expect(row).toContainText('已取消');
  const retained = await data(await adminApi.get(`/api/v2/work-items/${cancelledTaskId}`));
  expect(retained.status).toBe('CANCELLED');
});

test('K — ordinary required document blocks close until human approval', async ({ page }) => {
  await write('post', `/api/v2/work-items/${workItemId}/complete`);
  await write('post', `/api/v2/projects/${projectId}/start`);

  await page.goto(`/projects/${projectId}`);
  await page.getByRole('tab', { name: '交付物' }).click();
  await page.getByRole('button', { name: '上传文档' }).click();
  const upload = page.getByRole('dialog', { name: '上传交付文档' });
  await upload.locator('.el-form-item').filter({ hasText: '文档名称' }).locator('input').fill(`Parity 上线方案 ${runId}`);
  await upload.getByText('设为项目结项必需交付物', { exact: true }).click();
  await upload.locator('input[type=file]').setInputFiles({
    name: 'parity-close-required.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('required closure evidence'),
  });
  await upload.getByRole('button', { name: '上传', exact: true }).click();
  const row = page.locator('.el-table__row').filter({ hasText: `Parity 上线方案 ${runId}` });
  await expect(row).toBeVisible();

  await page.getByRole('button', { name: '项目结项' }).click();
  await page.getByRole('dialog', { name: '确认项目结项' }).getByRole('button', { name: '确定' }).click();
  const blocked = page.getByRole('dialog', { name: '项目暂不可结项' });
  await expect(blocked.getByText('普通必需文档', { exact: true })).toBeVisible();
  await expect(blocked.getByText(`Parity 上线方案 ${runId}：草稿`, { exact: true })).toBeVisible();
  await blocked.getByRole('button', { name: '确定' }).click();

  await row.getByRole('button', { name: '提交审核' }).click();
  await row.getByRole('button', { name: '通过' }).click();
  await expect(row).toContainText('已通过');

  await page.getByRole('button', { name: '项目结项' }).click();
  await page.getByRole('dialog', { name: '确认项目结项' }).getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('已结项', { exact: true })).toBeVisible();
});
