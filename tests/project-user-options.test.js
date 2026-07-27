const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('project creators can load minimal active-user options without user-management permission', () => {
  assert.ok(server.includes("['GET',/^\\/api\\/project-user-options$/,'project.create']"));
  assert.ok(server.includes("url.pathname === '/api/project-user-options'"));
  assert.match(server, /SELECT u\.id,u\.username,u\.display_name AS displayName,u\.role,r\.name AS roleName FROM users u LEFT JOIN roles r ON r\.role_key=u\.role WHERE u\.status="active"/);
});

test('new project manager selector uses the scoped option endpoint', () => {
  const match = html.match(/async function loadProjectManagerOptions\(\)\{([\s\S]*?)\}\nconst initialProjectsLoad/);
  assert.ok(match, 'loadProjectManagerOptions function not found');
  assert.ok(match[1].includes("fetch('/api/project-user-options')"));
  assert.ok(!match[1].includes("fetch('/api/users')"));
  assert.ok(match[1].includes('user.roleName||roleLabels[user.role]'));
});
