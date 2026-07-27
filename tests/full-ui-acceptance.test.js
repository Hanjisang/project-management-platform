const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

test('RBAC presentation contains only users and roles', () => {
  assert.ok(html.includes('<h3>用户与角色权限中心</h3>'));
  assert.ok(!html.includes('<span>组织部门</span>'));
  assert.ok(!html.includes('统一维护用户、部门、角色'));
});

test('non-functional placeholder entries are removed', () => {
  assert.ok(!html.includes('<button class="btn btn-light">导出记录</button>'));
  assert.ok(!html.includes('<h4>钉钉配置</h4>'));
  assert.ok(!html.includes('<h4>数据字典</h4>'));
  assert.ok(!html.includes('<h4>AI分析规则</h4>'));
});

test('core wide tables opt into mobile card layouts', () => {
  assert.match(html, /<table class="knowledge-mobile-table"/);
  assert.ok(html.includes('class="rbac-mobile-table user-mobile-table"'));
  assert.ok(html.includes('class="rbac-mobile-table role-mobile-table"'));
  assert.ok(html.includes('.zentao-task-table{min-width:0!important'));
});

test('mobile filters and key actions remain reachable and touchable', () => {
  assert.ok(html.includes('#tab-pcheck .filter-bar{display:grid!important;grid-template-columns:1fr!important'));
  assert.ok(html.includes('#tab-pcheck .link-button{min-height:44px!important'));
  assert.ok(html.includes('#tab-pcheck .check-stage-collapse{width:44px!important;height:44px!important'));
  assert.ok(html.includes('.deliverable-chip{min-height:44px!important'));
  assert.ok(html.includes('#tab-pdoc .link-button{min-height:44px!important'));
  assert.ok(html.includes('.quick-step-check{width:44px!important;height:44px!important'));
  assert.ok(html.includes('.portfolio-search input{min-height:44px!important'));
});

test('integration tabs expose concise accessible names', () => {
  assert.match(html, /aria-label="禅道任务同步"[^>]*><span aria-hidden="true">禅<\/span>/);
  assert.match(html, /aria-label="钉钉消息对接"[^>]*><span aria-hidden="true">钉<\/span>/);
});

test('filter reset terminology is consistent', () => {
  assert.ok(!html.includes('>重置筛选</button>'));
});

test('restoring the user and role workspace reloads its data', () => {
  assert.ok(html.includes("}else if(page==='userRoles'){"));
  assert.ok(html.includes("await openUserManagement();"));
});
