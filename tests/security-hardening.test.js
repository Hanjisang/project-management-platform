const assert = require('node:assert/strict');
const test = require('node:test');
const { apiPermissionForRequest, sameOriginWriteAllowed, LoginThrottle } = require('../security');
const { requirePermission } = require('../permissions');

test('every core write route maps to a server permission', () => {
  const cases = [
    ['PUT', '/api/projects/7', 'project.edit'],
    ['DELETE', '/api/projects/7', 'project.delete'],
    ['PUT', '/api/projects/7/members', 'project.members'],
    ['PATCH', '/api/projects/7/schedule', 'project.edit'],
    ['PUT', '/api/projects/7/plan', 'plan.edit'],
    ['POST', '/api/tasks', 'task.create'],
    ['PATCH', '/api/tasks/9', 'task.update'],
    ['POST', '/api/projects/7/documents', 'document.create'],
    ['PATCH', '/api/projects/7/documents/2/review', 'document.review'],
    ['DELETE', '/api/sop/templates/3', 'sop.delete']
  ];
  for (const [method, path, permission] of cases) assert.equal(apiPermissionForRequest(method, path), permission, `${method} ${path}`);
});

test('viewer permissions cannot satisfy write guards', () => {
  const viewer = { role: 'viewer', permissions: ['project.view', 'task.view', 'document.view'] };
  for (const permission of ['project.edit', 'task.update', 'document.create', 'document.review']) assert.equal(requirePermission(viewer, permission), false);
});

test('cross-site writes are rejected while same-origin writes and reads pass', () => {
  assert.equal(sameOriginWriteAllowed({ method: 'POST', headers: { host: 'app.local', origin: 'https://evil.local' } }), false);
  assert.equal(sameOriginWriteAllowed({ method: 'POST', headers: { host: 'app.local', origin: 'https://app.local' } }), true);
  assert.equal(sameOriginWriteAllowed({ method: 'DELETE', headers: { host: 'app.local', 'sec-fetch-site': 'cross-site' } }), false);
  assert.equal(sameOriginWriteAllowed({ method: 'GET', headers: { host: 'app.local', origin: 'https://evil.local' } }), true);
});

test('login throttle blocks after five failures and resets on clear', () => {
  const throttle = new LoginThrottle({ windowMs: 1000, blockMs: 2000 });
  for (let index = 0; index < 5; index++) throttle.fail('ip:user', 100);
  assert.equal(throttle.blocked('ip:user', 101), true);
  throttle.clear('ip:user');
  assert.equal(throttle.blocked('ip:user', 101), false);
});
