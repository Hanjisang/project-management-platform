const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

test('project document tables opt into the full-width mobile card layout', () => {
  assert.match(html, /<table class="project-documents-mobile-table"[^>]*>[\s\S]*?<tbody id="projectDeliverableRows"/);
  assert.match(html, /<table class="project-documents-mobile-table"[^>]*>[\s\S]*?<tbody id="projectDocumentRows"/);
});

test('mobile document tables cancel the global 720px table width', () => {
  assert.ok(html.includes('.project-documents-mobile-table{min-width:0!important;width:100%!important;display:block!important;overflow:visible!important}'));
  assert.ok(html.includes('.project-documents-mobile-table thead{display:none!important}'));
  assert.ok(html.includes('#projectDeliverableRows,#projectDocumentRows{display:grid!important;width:100%!important;min-width:0!important;gap:12px}'));
});

test('uploaded document rows and actions become touchable full-width cards', () => {
  assert.ok(html.includes('#projectDocumentRows tr{display:grid!important;width:100%!important;'));
  assert.ok(html.includes('#projectDocumentRows td:last-child{grid-column:1/-1!important;display:grid!important;'));
  assert.ok(html.includes('#projectDocumentRows td:last-child .btn{width:100%!important;'));
});
