import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('phase26 analytics client records only approved event names and scrubs private contact data', () => {
  const analytics = read('analytics.js');
  assert.match(analytics, /RoleDeskAnalytics/);
  assert.match(analytics, /application_kit_generated/);
  assert.match(analytics, /job_marked_applied/);
  assert.match(analytics, /source_health_checked/);
  assert.match(analytics, /roledesk-analytics-queue-v1/);
  assert.match(analytics, /REDACTED_EMAIL/);
  assert.match(analytics, /REDACTED_PHONE/);
});

test('admin dashboard exposes phase26 operations panels without private resume or draft content', () => {
  const html = read('index.html');
  const admin = read('admin-operations.js');
  assert.match(html, /adminProductHealth/);
  assert.match(html, /adminFunnelGrid/);
  assert.match(html, /adminUserList/);
  assert.match(html, /adminErrorList/);
  assert.match(html, /adminSourceHealth/);
  assert.match(html, /adminNoteForm/);
  assert.match(admin, /admin_phase26_dashboard/);
  assert.match(admin, /admin_add_note/);
  assert.match(admin, /Resume text and private drafts are not shown|resume text/i);
  assert.doesNotMatch(admin, /original_text|generated_text|emailBody|resume_text/);
});

test('phase26 migration is additive, rls-protected, and admin-scoped', () => {
  const sql = read('supabase/migrations/014_admin_analytics_growth.sql');
  assert.match(sql, /create table if not exists public\.analytics_events/);
  assert.match(sql, /create table if not exists public\.error_logs/);
  assert.match(sql, /create table if not exists public\.source_health_logs/);
  assert.match(sql, /create table if not exists public\.admin_notes/);
  assert.match(sql, /create table if not exists public\.referral_events/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /public\.is_roledesk_admin\(\)/);
  assert.match(sql, /admin_phase26_dashboard/);
  assert.match(sql, /admin_add_note/);
  assert.doesNotMatch(sql, /\bdrop\s+table\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
  assert.doesNotMatch(sql, /\balter\s+table\s+\w+\s+rename\b/i);
});

test('phase26 event hooks preserve manual approval boundaries', () => {
  const app = read('app.js');
  const kit = read('application-kit.js');
  const coverage = read('coverage-ui.js');
  assert.match(app, /job_search_performed/);
  assert.match(app, /job_saved/);
  assert.match(app, /email_marked_sent/);
  assert.match(app, /followup_scheduled/);
  assert.match(kit, /application_kit_generated/);
  assert.match(coverage, /job_marked_applied/);
  assert.match(app + kit + coverage, /RoleDesk does not send|will not submit anything|manual/i);
  assert.doesNotMatch(app + kit + coverage, /sendEmail\(|autoApply|submit\(\)/);
});
