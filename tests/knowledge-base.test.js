const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('knowledge base exposes persistence and REST routes', () => {
  assert.match(server, /CREATE TABLE IF NOT EXISTS knowledge_articles/);
  assert.ok(server.includes("url.pathname === '/api/knowledge'"));
  assert.ok(server.includes('knowledgeMatch'));
  assert.ok(server.includes('/deposit'));
});

test('knowledge base permissions are registered', () => {
  for (const code of ['knowledge.view','knowledge.create','knowledge.edit','knowledge.review','knowledge.delete']) {
    assert.ok(server.includes(code), `missing ${code}`);
  }
});

test('data center contains a working knowledge base page', () => {
  assert.ok(html.includes('id="page-knowledge"'));
  assert.ok(html.includes('onclick="openKnowledgeBase()"'));
  assert.ok(html.includes('id="knowledgeRows"'));
  assert.ok(html.includes('function loadKnowledgeBase'));
  assert.ok(html.includes('function openKnowledgeEditor'));
});

test('approved project documents can be deposited', () => {
  assert.ok(html.includes('openKnowledgeDeposit'));
  assert.ok(html.includes('/deposit'));
  assert.ok(html.includes("['已通过','已确认']"));
});

test('all inline browser scripts remain valid JavaScript', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  assert.ok(scripts.length > 0);
  scripts.forEach((source, index) => assert.doesNotThrow(() => new vm.Script(source), `inline script ${index + 1}`));
});
