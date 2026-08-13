const assert = require('node:assert/strict');
const test = require('node:test');
const { VERSION, rolePermissions, migrate } = require('../scripts/migrate-overnight-hardening');

function mockPool(existing = false) {
  const calls = [];
  return {
    calls,
    async query(sql) { calls.push({ sql }); return [[]]; },
    async execute(sql, values = []) { calls.push({ sql, values }); if (sql.startsWith('SELECT version')) return [existing ? [{ version: VERSION }] : []]; return [{ affectedRows: 1 }]; }
  };
}

test('hardening migration grants writes explicitly but keeps viewer read-only', async () => {
  assert.ok(rolePermissions.project_manager.includes('project.edit'));
  assert.ok(rolePermissions.project_member.includes('task.update'));
  assert.ok(!rolePermissions.viewer.some(permission => /create|edit|delete|update|review|lifecycle|members|sync/.test(permission)));
  const pool = mockPool(); await migrate(pool);
  assert.ok(pool.calls.some(call => call.sql.includes('CREATE TABLE IF NOT EXISTS login_logs')));
  assert.ok(pool.calls.some(call => call.sql.startsWith('INSERT INTO schema_migrations')));
});

test('hardening migration is repeatable', async () => {
  const pool = mockPool(true); await migrate(pool);
  assert.equal(pool.calls.filter(call => call.sql.startsWith('ALTER TABLE')).length, 0);
});
