const test = require('node:test');
const assert = require('node:assert/strict');
const { loadUserPermissions, requirePermission } = require('../permissions');

function poolFor(rows) { return { execute: async () => [rows] }; }

test('permissions load from the current role on every request', async () => {
  const manager = { sub: '7', role: 'project_manager' };
  const permissions = await loadUserPermissions(poolFor([{ permission: 'project.create' }, { permission: 'project.view' }]), manager);
  assert.deepEqual(permissions, ['project.create', 'project.view']);
  assert.equal(requirePermission({ ...manager, permissions }, 'project.create'), true);
  assert.equal(requirePermission({ ...manager, permissions }, 'system.user'), false);
});

test('admin bypass is explicit and ordinary roles do not inherit stale JWT permissions', async () => {
  assert.deepEqual(await loadUserPermissions(poolFor([]), { sub: '1', role: 'admin' }), ['*']);
  assert.equal(requirePermission({ sub: '2', role: 'project_member', permissions: [] }, 'project.create'), false);
});
