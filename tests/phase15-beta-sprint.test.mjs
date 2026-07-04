import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('beta notice keeps review and manual-action boundaries visible', () => {
  const html = read('index.html');
  assert.match(html, /Use carefully, review every draft/);
  assert.match(html, /never sends emails, submits applications, or applies automatically/);
});

test('admin triage exposes priorities, requested labels, and ten issue categories', () => {
  const admin = read('admin-operations.js');
  const html = read('index.html');
  assert.match(admin, /Critical/);
  assert.match(admin, /Reviewing/);
  assert.match(admin, /Won't fix now/);
  assert.match(admin, /Later/);
  assert.equal((admin.match(/\[[`'][^\n]+ issue[`'],/g) || []).length, 10);
  assert.match(html, /betaIssueChecklist/);
  assert.match(admin, /admin_update_feedback_status/);
});

test('one-week operating guide documents daily use and blocker-first scope', () => {
  const docs = read('docs/BETA_OPERATIONS.md');
  assert.match(docs, /Mayank's daily RoleDesk workflow/);
  assert.match(docs, /Critical:[\s\S]*High:[\s\S]*Medium:[\s\S]*Low:/);
  assert.match(docs, /Do not build Gmail OAuth, external AI, payments, auto-send, auto-apply/);
});

test('service worker publishes the beta sprint cache', () => {
  assert.match(read('sw.js'), /CACHE_VERSION='v27'/);
});
