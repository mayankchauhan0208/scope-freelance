import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('first-run onboarding exposes eight guided steps and manual controls', () => {
  const app = read('app.js'), html = read('index.html');
  for (const label of ['Complete profile','Paste or upload résumé','Review extracted details','Review ATS score','Review Search Intent','Search or import','Create Application Packet','Track a follow-up']) assert.match(app, new RegExp(label));
  assert.match(html, /id="skipOnboarding"/);
  assert.match(html, /Start Application Workflow/);
  assert.match(html, /setupProgressValue/);
});

test('customer activation cards use honest empty states and real counters', () => {
  const app = read('app.js'), html = read('index.html');
  for (const text of ['No resume added yet','No opportunities yet','No application packets yet','No drafts yet','No follow-ups yet']) assert.match(html, new RegExp(text));
  assert.match(app, /renderActivationSummary/);
  assert.match(app, /realOpportunities\(\)/);
  assert.match(app, /feedbackCount/);
});

test('launch feedback and aggregate admin metrics stay database protected', () => {
  const html = read('index.html'), migration = read('supabase/migrations/009_public_beta_activation.sql'), admin = read('admin-operations.js');
  for (const category of ['Login issue','Resume analyzer issue','Search result issue','Application packet issue','Tracker/follow-up issue','Mobile/UI issue']) assert.match(html, new RegExp(category));
  assert.match(migration, /security definer/);
  assert.match(migration, /is_roledesk_admin\(\)/);
  assert.match(migration, /revoke all on function public\.admin_launch_metrics\(\) from public, anon/);
  assert.match(admin, /admin_launch_metrics/);
});

test('launch page and source shortcuts stay universal and approval-first', () => {
  const html = read('index.html'), app = read('app.js');
  assert.match(html, /Build your resume\. Find better roles\. Apply with confidence\./);
  assert.match(html, /No fake integrations/);
  assert.doesNotMatch(html, /categories\/graphics-design|jobs\/graphic-design|freelance-jobs\/design|remote-design-jobs/);
  assert.doesNotMatch(html, /<option>Graphic Designer<\/option>/);
  assert.doesNotMatch(app, /function\s+auto(?:Send|Apply)/i);
});
