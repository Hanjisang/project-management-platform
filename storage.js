const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const storageDirectory = path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(storageDirectory, { recursive: true });

function saveDataUrl(dataUrl, originalName) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('文件编码不正确');
  const extension = path.extname(originalName || '').replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12);
  const key = `${crypto.randomUUID()}${extension}`;
  fs.writeFileSync(path.join(storageDirectory, key), Buffer.from(match[2], 'base64'));
  return { key, mimeType: match[1] };
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

module.exports = { saveDataUrl, readObject, deleteObject };
