const assert = require('node:assert/strict');
const test = require('node:test');
const { migrate } = require('../scripts/migrate-round1-technical-audit');

function pool(existing = false, fail = false, legacyRoles = true) {
  const calls = [];
  return {
    calls,
    async query(sql) {
      calls.push(sql);
      if (fail && sql.includes('ALTER TABLE')) throw new Error('DDL failed');
      return [[]];
    },
    async execute(sql) {
      calls.push(sql);
      if (sql.startsWith('SELECT version')) return [existing ? [{ version: 'round1-technical-audit' }] : []];
      if (sql.includes("COLUMN_NAME='role_key'")) return [[{ columnType: 'varchar(64)', characterSet: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci' }]];
      if (sql.includes("COLUMN_NAME='permissions_json'")) return [legacyRoles ? [{ present: 1 }] : []];
      return [{ affectedRows: 1 }];
    }
  };
}

test('migration writes version only after successful DDL and is repeatable', async () => {
  const first = pool();
  await migrate(first);
  assert.ok(first.calls.some(sql => sql.includes('role_key varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')));
  assert.ok(first.calls.some(sql => sql.includes('JSON_TABLE')));
  assert.ok(first.calls.some(sql => sql.startsWith('INSERT INTO schema_migrations')));
  const second = pool(true);
  await migrate(second);
  assert.equal(second.calls.filter(sql => sql.includes('knowledge_articles')).length, 0);
});

test('migration supports a fresh normalized roles table', async () => {
  const fresh = pool(false, false, false);
  await migrate(fresh);
  assert.ok(fresh.calls.some(sql => sql.includes("INSERT IGNORE INTO roles (role_key,name) VALUES")));
  assert.ok(!fresh.calls.some(sql => sql.includes('JSON_TABLE')));
});

test('migration failure does not write version', async () => {
  const broken = pool(false, true);
  await assert.rejects(() => migrate(broken));
  assert.equal(broken.calls.filter(sql => sql.startsWith('INSERT INTO schema_migrations')).length, 0);
});
