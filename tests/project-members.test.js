const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

test('project member GET endpoint returns the composite drawer contract', () => {
  assert.match(server, /project:\s*\{[\s\S]*?managerId:[\s\S]*?\},\s*members:\s*members\.map[\s\S]*?candidates:\s*candidates\.map/);
  assert.match(server, /DATE_FORMAT\(planned_go_live,"%Y-%m-%d"\) AS plannedGoLive/);
});

test('project member PUT endpoint accepts the selected manager and keeps them as a member', () => {
  assert.ok(server.includes("if (!body.managerUserId || !Array.isArray(body.members))"));
  assert.ok(server.includes("if (!memberIds.includes(String(users[0].id))) memberIds.push(String(users[0].id));"));
  assert.match(server, /String\(userId\) === String\(users\[0\]\.id\) \? 'manager' : 'member'/);
  assert.match(server, /managerName:\s*users\[0\]\.display_name/);
});

test('member drawer reports a clear error when the API contract is incomplete', () => {
  assert.ok(html.includes("if(!data.project||!Array.isArray(data.members)||!Array.isArray(data.candidates))throw new Error('项目成员数据格式异常，请刷新后重试');"));
});
