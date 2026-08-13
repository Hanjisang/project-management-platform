const assert = require('node:assert/strict');
const test = require('node:test');
const { saveDataUrl } = require('../storage');

test('upload rejects unsupported extensions before writing', () => {
  assert.throws(() => saveDataUrl('data:text/plain;base64,SGVsbG8=', 'notes.txt'), error => error.statusCode === 400);
});

test('upload rejects a file whose bytes do not match the extension', () => {
  assert.throws(() => saveDataUrl('data:application/pdf;base64,SGVsbG8=', 'fake.pdf'), error => error.statusCode === 400);
});

test('upload rejects mismatched declared mime type', () => {
  const pdf = Buffer.from('%PDF-1.7\n').toString('base64');
  assert.throws(() => saveDataUrl(`data:text/plain;base64,${pdf}`, 'file.pdf'), error => error.statusCode === 400);
});
