const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const storageDirectory = path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(storageDirectory, { recursive: true });

const allowedFiles = new Map([
  ['.pdf', { mime: 'application/pdf', magic: buffer => buffer.subarray(0, 5).toString('ascii') === '%PDF-' }],
  ['.docx', { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: buffer => buffer[0] === 0x50 && buffer[1] === 0x4b }],
  ['.xlsx', { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: buffer => buffer[0] === 0x50 && buffer[1] === 0x4b }],
  ['.doc', { mime: 'application/msword', magic: buffer => buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')) }],
  ['.xls', { mime: 'application/vnd.ms-excel', magic: buffer => buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')) }]
]);

function saveDataUrl(dataUrl, originalName) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('文件编码不正确');
  const extension = path.extname(originalName || '').toLowerCase();
  const policy = allowedFiles.get(extension);
  if (!policy) { const error = new Error('仅支持 PDF、Word 和 Excel 文件'); error.statusCode = 400; throw error; }
  const normalizedMime = String(match[1]).toLowerCase();
  if (normalizedMime !== policy.mime && normalizedMime !== 'application/octet-stream') { const error = new Error('文件类型与扩展名不一致'); error.statusCode = 400; throw error; }
  const content = Buffer.from(match[2], 'base64');
  if (!content.length || content.length > 10 * 1024 * 1024) { const error = new Error('文件大小必须在 10 MB 以内'); error.statusCode = 413; throw error; }
  if (!policy.magic(content)) { const error = new Error('文件内容与声明类型不一致'); error.statusCode = 400; throw error; }
  const key = `${crypto.randomUUID()}${extension}`;
  fs.writeFileSync(path.join(storageDirectory, key), content);
  return { key, mimeType: policy.mime, size: content.length };
}

function readObject(key) {
  const safeKey = path.basename(String(key || ''));
  const target = path.join(storageDirectory, safeKey);
  if (!safeKey || !fs.existsSync(target)) return null;
  return fs.readFileSync(target);
}
function deleteObject(key) {
  const safeKey = path.basename(String(key || ''));
  const target = path.join(storageDirectory, safeKey);
  if (safeKey && fs.existsSync(target)) fs.unlinkSync(target);
}

module.exports = { saveDataUrl, readObject, deleteObject, allowedFiles };
