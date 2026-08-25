import { expect, test } from '@playwright/test';

const permissions = [
  'project.view', 'project.create', 'project.edit', 'project.delete', 'project.start', 'project.pause', 'project.close', 'project.member.manage',
  'sop.view', 'sop.create', 'sop.edit', 'sop.publish', 'plan.view', 'plan.edit', 'task.view', 'task.create', 'task.edit', 'task.complete',
  'issue.view', 'issue.create', 'issue.edit', 'issue.close', 'document.view', 'document.upload', 'document.review', 'document.delete',
  'message.view', 'message.create', 'message.analyze', 'message.confirm', 'report.view', 'report.submit', 'knowledge.view', 'knowledge.create',
  'knowledge.review', 'user.manage', 'role.manage', 'audit.view', 'integration.manage',
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v2/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const user = { id: 'u1', username: 'admin', displayName: '系统管理员', permissions, isAdministrator: true };
    let data: unknown = {};
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/dashboard')) data = { summary: { projectCount: 1, NORMAL: 1, WARNING: 0, HIGH_RISK: 0, overdueTaskCount: 0, pendingMessageCount: 0 }, upcomingProjects: [], stageDistribution: [], progressRanking: [], riskRanking: [], overdueTasks: [], highRiskIssues: [], workload: [] };
    else if (path.endsWith('/projects')) data = { items: [], page: 1, pageSize: 100, total: 0 };
    else if (path.endsWith('/messages')) data = { items: [], page: 1, pageSize: 100, total: 0 };
    else if (path.endsWith('/messages/ai-status')) data = { configured: false, provider: 'openai-compatible' };
    else if (path.endsWith('/integrations/dingtalk/status')) data = { configured: false, status: 'NOT_CONFIGURED', fullChatMonitoring: false };
    else if (path.endsWith('/integrations/zentao/status')) data = { configured: false, status: 'NOT_CONFIGURED' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, requestId: 'e2e-request' }) });
  });
});

async function navigate(
  page: import('@playwright/test').Page,
  label: string,
  path: string,
): Promise<void> {
  let navigation = page.locator('.sidebar');
  if ((page.viewportSize()?.width ?? 1280) < 860) {
    await page.getByRole('button', { name: '打开导航' }).click();
    navigation = page.locator('.el-drawer:visible');
    await expect(navigation).toBeVisible();
    await navigation.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished),
      );
    });
  }
  await navigation.getByRole('button', { name: label, exact: true }).click();
  await expect(page).toHaveURL(path);
}

test('navigates the responsive shell and reports unconfigured AI honestly', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: '管理驾驶舱' })).toBeVisible({ timeout: 15_000 });
  await navigate(page, '消息中心', '/messages');
  await expect(page.getByText('AI 服务未配置')).toBeVisible();
  await navigate(page, '集成配置', '/system/integrations');
  await expect(page.getByRole('heading', { name: '集成配置', level: 2 })).toBeVisible();
  await expect(page.getByText('当前未配置')).toBeVisible();
});
