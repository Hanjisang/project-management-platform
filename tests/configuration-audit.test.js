const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8').replace(/\r\n/g, '\n');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('docker compose has valid administrator display-name interpolation', () => {
  assert.match(compose, /DEFAULT_ADMIN_DISPLAY_NAME:\s+\$\{DEFAULT_ADMIN_DISPLAY_NAME:-System Administrator\}/);
  assert.doesNotMatch(compose, /DEFAULT_ADMIN_DISPLAY_NAME:.*[^}]$/m);
});
test('issue type and level catalogs are fixed on the server', () => {
  for (const item of ['客户需求','产品缺陷','代码缺陷','接口缺陷','项目风险','配置问题','高','中','低']) assert.ok(server.includes(item));
  assert.ok(server.includes('validateIssuePayload'));
});
test('health endpoint is available for deployment checks', () => assert.ok(server.includes("url.pathname === '/api/health'")));
test('SOP templates have a restricted download route and one canonical download action', () => {
  assert.ok(server.includes('serveDeliverableTemplate'));
  assert.match(server, /\^\\\/templates\\\/\(\[a-z0-9-\]\+\\\.\(docx\|xlsx\)\)\$\//);
  assert.ok(server.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
  assert.ok(server.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
  assert.ok(html.includes('下载模板'));
  assert.ok(html.includes("'software-hardware-interface-list','xlsx'"));
  assert.ok(html.includes("'go-live-confirmation','docx'"));
  assert.ok(!html.includes('下载 Word'));
  assert.ok(!html.includes('下载 Excel'));
  assert.ok(!html.includes('previewSopDeliverableTemplate'));
});
test('project basic editing and safe deletion are exposed', () => {
  assert.ok(server.includes('project.delete')); assert.ok(server.includes("method === 'PUT'"));
  assert.ok(html.includes('openProjectBasicEditor()')); assert.ok(html.includes('deleteCurrentProject()'));
});
test('implementation plan exposes editable stage and task workdays', () => {
  assert.ok(html.includes('id="planStageDuration"')); assert.ok(html.includes('id="planTaskDuration"'));
  assert.ok(html.includes('duration:taskDuration')); assert.ok(server.includes('recalculateEntirePlan'));
});
