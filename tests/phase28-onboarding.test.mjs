import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const html = read('index.html');
const app = read('app.js');
const onboarding = read('onboarding.js');
const sync = read('supabase-sync.js');
const analytics = read('analytics.js');
const migration = read('supabase/migrations/016_onboarding_activation.sql');
const workflow = read('.github/workflows/deploy-pages.yml');
const sw = read('sw.js');

assert.match(html, /onboarding\.css\?v=1/);
assert.match(html, /id="onboardingPanel"/);
assert.match(html, /id="onboardingDialog"/);
assert.match(html, /onboarding\.js\?v=1/);

for (const text of ['Quick start','Finish setup and get your first win','Reminder preferences']) {
  assert.match(onboarding, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(html, /RoleDesk setup/);

for (const event of [
  'onboarding_started',
  'resume_analyzed',
  'career_target_set',
  'notification_preferences_saved',
  'onboarding_completed',
  'first_job_searched',
  'first_job_saved',
  'first_application_kit_generated',
  'first_application_marked_applied',
  'first_followup_scheduled'
]) {
  assert.match(analytics, new RegExp(event));
  assert.match(migration, new RegExp(event));
}

assert.match(app, /RoleDeskMvp=Object\.freeze\(\{mark:markMvpProgress,render:renderMvpSetup,progress:mvpProgress\}\)/);
assert.match(app, /RoleDeskOnboarding\?\.render/);
assert.match(app, /first_job_searched/);
assert.match(app, /first_job_saved/);
assert.match(sync, /RoleDeskOnboardingCloud/);
assert.match(sync, /upsert_onboarding_progress/);
assert.match(sync, /record_onboarding_event/);

for (const table of ['onboarding_progress','user_career_goals','user_preferences','onboarding_events','demo_mode_state']) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
}

assert.doesNotMatch(migration, /\bdrop\s+table\b/i);
assert.doesNotMatch(migration, /\btruncate\b/i);
assert.match(workflow, /onboarding\.css/);
assert.match(workflow, /onboarding\.js/);
assert.match(sw, /CACHE_VERSION='v38'/);
assert.match(sw, /onboarding\.css/);
assert.match(sw, /onboarding\.js/);
assert.doesNotMatch(app + onboarding, /\.submit\(\)|sendEmail|autoApply/i);

console.log('Phase 28 onboarding checks passed');
