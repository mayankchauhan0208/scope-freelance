import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('multi-user UI contains no personal checklist or invented win probability', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /checklist for Mayank|Winning chance|Select a demo item/i);
  assert.match(html, /Your first-week checklist/);
});

test('authentication failures are converted to safe user-facing messages', () => {
  const sync = read('supabase-sync.js');
  assert.match(sync, /Email or password is incorrect\. Try again\./);
  assert.match(sync, /Unable to request a password reset right now\. Try again\./);
  assert.doesNotMatch(sync, /setStatus\(error\.message/);
});

test('mobile hardening keeps dense workflows usable', () => {
  const css = read('mvp-polish.css');
  assert.match(css, /min-height:44px/);
  assert.match(css, /scroll-snap-type:x proximity/);
  assert.match(css, /\.tracker-filters\{display:grid/);
});

test('service worker publishes a versioned allowlisted cache', () => {
  const worker = read('sw.js');
  assert.match(worker, /CACHE_VERSION='v\d+'/);
  assert.match(worker, /APPROVED_URLS/);
});
