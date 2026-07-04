import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/007_beta_operations_admin.sql');
const admin = read('admin-operations.js');
const html = read('index.html');

test('admin authorization is enforced in Supabase, not only hidden in the UI', () => {
  assert.match(migration, /create table if not exists public\.admin_users/);
  assert.match(migration, /alter table public\.admin_users enable row level security/);
  assert.match(migration, /create or replace function public\.is_roledesk_admin\(\)/);
  assert.match(migration, /auth\.jwt\(\) ->> 'email'/);
  assert.match(migration, /revoke all on public\.admin_users from anon, authenticated/);
  assert.match(html, /id="adminNav" hidden/);
  assert.match(admin, /cloud\.rpc\('is_roledesk_admin'\)/);
  assert.doesNotMatch(admin, /mayankchauhan0208@gmail\.com|connect\.mayankchauhan@gmail\.com/);
});

test('beta access and feedback changes use admin-verified RPCs', () => {
  for (const rpc of ['admin_add_beta_user','admin_update_beta_user','admin_deactivate_beta_user','admin_update_feedback_status']) {
    assert.match(migration, new RegExp(`function public\\.${rpc}`));
  }
  assert.ok((migration.match(/if not public\.is_roledesk_admin\(\)/g) || []).length >= 4);
  assert.match(admin, /cloud\.rpc\('admin_add_beta_user'/);
  assert.match(admin, /cloud\.rpc\('admin_update_beta_user'/);
  assert.match(admin, /cloud\.rpc\('admin_update_feedback_status'/);
  assert.doesNotMatch(admin, /from\('beta_access'\)\.insert|from\('beta_access'\)\.update/);
  assert.doesNotMatch(admin, /from\('feedback'\)\.update/);
});

test('feedback review statuses and private reads are defined', () => {
  for (const status of ['new','reviewed','planned','fixed','archived']) assert.match(migration, new RegExp(`'${status}'`));
  assert.match(migration, /feedback_admin_select/);
  assert.match(migration, /using \(public\.is_roledesk_admin\(\)\)/);
  assert.doesNotMatch(admin, /password|access_token|refresh_token|service_role/i);
  assert.match(html, /Admin tools affect beta access\. Review before changing\./);
  assert.match(read('sw.js'), /admin-operations\.js/);
});
