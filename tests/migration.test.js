const assert = require('node:assert/strict');
const test = require('node:test');
const { migrate } = require('../scripts/migrate-round1-technical-audit');
function pool(existing = false, fail = false) { const calls = []; return { calls, async query(sql) { calls.push(sql); if (fail && sql.includes('ALTER TABLE')) throw new Error('DDL failed'); return [[]]; }, async execute(sql) { calls.push(sql); if (sql.startsWith('SELECT version')) return [existing ? [{ version: 'round1-technical-audit' }] : []]; return [{ affectedRows: 1 }]; } }; }
test('migration writes version only after successful DDL and is repeatable', async () => { const first = pool(); await migrate(first); assert.ok(first.calls.some(sql => sql.startsWith('INSERT INTO schema_migrations'))); const second = pool(true); await migrate(second); assert.equal(second.calls.filter(sql => sql.includes('knowledge_articles')).length, 0); });
test('migration failure does not write version', async () => { const broken = pool(false, true); await assert.rejects(() => migrate(broken)); assert.equal(broken.calls.filter(sql => sql.startsWith('INSERT INTO schema_migrations')).length, 0); });
