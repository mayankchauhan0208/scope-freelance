import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const resume = require('../resume-builder.js');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sync = fs.readFileSync(new URL('../supabase-sync.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/006_public_beta_feedback.sql', import.meta.url), 'utf8');

test('name extraction handles leading names and inline design titles', () => {
  for (const sample of [
    'MAYANK CHAUHAN',
    'Mayank Chauhan',
    'MAYANK CHAUHAN | Graphic Designer',
    'MAYANK CHAUHAN Senior Graphic Designer',
    'MAYANK CHAUHAN Senior Creative Designer | Senior Graphic Designer | AI Visual Direction'
  ]) assert.equal(resume.extractName(sample), 'Mayank Chauhan');
});

test('reviewed names are preserved and low-confidence names require review', () => {
  const kept = resume.extractProfile('DIFFERENT NAME\nSenior Designer', { fullName:'Reviewed Person', confidence:{ fullName:'User-added' } });
  assert.equal(kept.fullName, 'Reviewed Person');
  assert.equal(kept.confidence.fullName, 'User-added');
  assert.equal(resume.extractProfile('Senior Graphic Designer\nPortfolio', {}).confidence.fullName, 'Needs review');
});

test('password recovery uses the current origin and handles expired links', () => {
  assert.match(sync, /window\.location\.origin \+ window\.location\.pathname/);
  assert.match(sync, /This reset link is expired or invalid\. Request a new reset link\./);
  assert.doesNotMatch(sync, /localhost:3000/);
  assert.match(html, /id="resetPassword">Reset password/);
});

test('feedback flow is additive, owner-readable, and never publicly readable', () => {
  assert.match(migration, /create table if not exists public\.feedback/);
  assert.match(migration, /alter table public\.feedback enable row level security/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.doesNotMatch(migration, /policy[^;]+for select[^;]+to anon/is);
  assert.doesNotMatch(migration, /drop table|truncate/i);
  assert.match(html, /RoleDesk is improving with real-user feedback/);
  assert.match(app, /RoleDeskFeedbackCloud/);
});
