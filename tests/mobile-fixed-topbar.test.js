const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

test('mobile top bar is fixed to the viewport', () => {
  assert.ok(html.includes('.topbar{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:90!important'));
});

test('mobile content reserves the measured top bar height', () => {
  assert.ok(html.includes('.content{padding-top:calc(var(--mobile-topbar-height,74px) + 12px)!important}'));
  assert.ok(html.includes('function syncMobileTopbarHeight()'));
  assert.ok(html.includes("root.style.setProperty('--mobile-topbar-height'"));
});

test('top bar height stays synchronized after responsive changes', () => {
  assert.ok(html.includes('new ResizeObserver(syncMobileTopbarHeight).observe(mobileTopbar)'));
  assert.ok(html.includes("window.addEventListener('orientationchange',syncMobileTopbarHeight)"));
});
