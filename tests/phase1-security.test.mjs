import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const security = require(path.join(root, 'security-utils.js'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('URL validation allows only credential-free http and https URLs', () => {
  assert.equal(security.safeHttpUrl('https://example.com/job').startsWith('https://'), true);
  assert.equal(security.safeHttpUrl('http://example.com/job').startsWith('http://'), true);
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'vbscript:test', 'https://user:pass@example.com']) {
    assert.equal(security.safeHttpUrl(unsafe), '', unsafe);
  }
});

test('HTML escaping covers text and attribute delimiters', () => {
  assert.equal(security.escapeHtml(`<img src=x onerror="x">'`), '&lt;img src=x onerror=&quot;x&quot;&gt;&#39;');
});

test('service worker caches only allowlisted same-origin unauthenticated assets', () => {
  const sw = read('sw.js');
  assert.match(sw, /url\.origin!==self\.location\.origin/);
  assert.match(sw, /if\(url\.search\)return false/);
  assert.match(sw, /request\.headers\.has\('authorization'\)/);
  assert.match(sw, /APPROVED_URLS\.has/);
  assert.match(sw, /cache-control/);
  assert.match(sw, /startsWith\('scope-'\)/);
  assert.doesNotMatch(sw, /if\(event\.request\.method!==['"]GET['"]\)return;event\.respondWith\(fetch/);
});

test('CSP blocks untrusted scripts and limits API connections', () => {
  const html = read('index.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /connect-src 'self' https:\/\/mnvcgtjbdywrenmnktem\.supabase\.co/);
});

test('frontend authentication is not tied to the former owner email', () => {
  const sync = read('supabase-sync.js');
  assert.doesNotMatch(sync, /connect\.mayankchauhan@gmail\.com/i);
  assert.doesNotMatch(sync, /const ownerEmail/i);
  assert.match(sync, /resetPasswordForEmail/);
  assert.match(sync, /flowType: 'pkce'/);
});

test('extension is user-triggered and has no global content-script match', () => {
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert.equal('content_scripts' in manifest, false);
  assert.equal('host_permissions' in manifest, false);
  assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'scripting', 'storage'].sort());
  const popup = read('extension/popup.js');
  assert.match(popup, /executeScript/);
  assert.match(popup, /reviewed/);
});

test('migration contains owner RLS, trusted audit, and RPC-only approval controls', () => {
  const sql = read('supabase/migrations/002_security_data_foundation.sql');
  for (const table of ['profiles','resumes','opportunities','drafts','applications','portal_connections','activity_logs']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(sql, /create or replace function public\.approve_draft/i);
  assert.match(sql, /create or replace function public\.revoke_draft_approval/i);
  assert.doesNotMatch(sql, /create or replace function public\.create_activity_log/i);
  assert.match(sql, /drop function if exists public\.create_activity_log/i);
  assert.match(sql, /revoke update on public\.drafts from authenticated/i);
  assert.match(sql, /guard_draft_approval_changes/i);
  assert.match(sql, /approved_by = actor/i);
  assert.match(sql, /scope\.approval_rpc/i);
  assert.match(sql, /Ownership preflight failed/i);
  assert.match(sql, /validate constraint drafts_opportunity_owner_fk/i);
  assert.match(sql, /validate constraint drafts_approved_by_owner_check/i);
  assert.match(sql, /validate constraint opportunities_status_allowed/i);
  assert.match(sql, /validate constraint applications_opportunity_owner_fk/i);
  assert.match(sql, /validate constraint applications_resume_owner_fk/i);
  assert.match(sql, /validate constraint applications_draft_owner_fk/i);
  assert.doesNotMatch(read('supabase/rollbacks/002_security_data_foundation.rollback.sql'), /grant update on public\.drafts to authenticated/i);
});
