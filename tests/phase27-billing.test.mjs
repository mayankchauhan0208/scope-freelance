import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('pricing and billing pages expose plan UX without fake payment success', () => {
  const html = read('index.html');
  const billing = read('billing-ui.js');
  assert.match(html, /id="plansView"/);
  assert.match(html, /id="billingView"/);
  assert.match(html, /Payment integration is not active yet/);
  assert.match(billing, /createCheckout/);
  assert.match(billing, /No fake payment success state was created/);
  assert.doesNotMatch(billing, /payment successful/i);
});

test('plan system is config-driven with expected plans and limits', () => {
  const config = read('billing-config.js');
  for (const plan of ['free','beta','pro','premium','admin','custom']) assert.match(config, new RegExp(`${plan}: \\{`));
  for (const key of ['resume_analyses','job_searches','application_kits','resume_variants','exports','followup_reminders','verified_job_checks']) assert.match(config, new RegExp(key));
  assert.match(config, /featureMap/);
  assert.match(config, /UNLIMITED/);
});

test('frontend gates major premium actions but keeps approval boundaries', () => {
  const app = read('app.js');
  const kit = read('application-kit.js');
  const resume = read('resume-builder.js');
  const coverage = read('coverage-ui.js');
  const combined = `${app}\n${kit}\n${resume}\n${coverage}`;
  for (const feature of ['job_search','resume_analysis','application_kit','export','followup','recruiter_email','resume_variant']) assert.match(combined, new RegExp(`consume\\('${feature}'\\)`));
  assert.match(combined, /RoleDesk will not submit anything|never sends|does not send/i);
  assert.doesNotMatch(combined, /autoApply|sendEmail\(|submit\(\)/);
});

test('billing migration is additive, rls protected, and webhook-ready', () => {
  const sql = read('supabase/migrations/015_billing_plans_usage.sql');
  for (const table of ['plan_catalog','user_subscriptions','usage_counters','checkout_sessions','payment_webhook_events','plan_change_logs']) assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  for (const fn of ['get_billing_status','record_usage_event','create_checkout_placeholder','admin_assign_user_plan','admin_billing_dashboard','process_payment_webhook']) assert.match(sql, new RegExp(fn));
  assert.match(sql, /signature_verified/);
  assert.match(sql, /public\.is_roledesk_admin\(\)/);
  assert.match(sql, /enable row level security/);
  assert.doesNotMatch(sql, /\bdrop\s+table\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
  assert.doesNotMatch(sql, /\brename\b/i);
});
