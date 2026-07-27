const assert = require('node:assert/strict');
const test = require('node:test');
const { validateStructuredMessageResult } = require('../message-result');
test('empty result is safe', () => assert.deepEqual(validateStructuredMessageResult(null), { task: null, issue: null }));
test('valid task and issue normalize', () => { const value = validateStructuredMessageResult({ task: { name: ' T ', dueDate: '2026-08-01', progress: 120, status: '进行中' }, issue: { title: 'I', dueDate: '2026-08-02', type: '配置问题', level: '高', status: '处理中' } }); assert.equal(value.task.name, 'T'); assert.equal(value.task.progress, 100); });
for (const result of [{ task: { name: '', dueDate: '2026-08-01' } }, { task: { name: 'x', dueDate: 'bad' } }, { issue: { title: 'x', dueDate: '2026-08-01', type: 'bad', level: '高' } }]) test('invalid structured result returns 400', () => assert.throws(() => validateStructuredMessageResult(result), error => error.statusCode === 400));
