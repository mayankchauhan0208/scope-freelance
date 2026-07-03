import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('MVP positioning and approval-first safety copy are consistent',()=>{
  const html=read('index.html'),readme=read('README.md'),manifest=read('manifest.webmanifest');
  for(const text of ['RoleDesk','Build your resume. Find better roles. Apply with confidence.'])assert.match(`${html}\n${readme}\n${manifest}`,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(html,/never applies, sends, submits, bids, signs, accepts work, or contacts anyone/i);
  assert.doesNotMatch(`${html}\n${read('app.js')}`,/autoSend|autoApply|\.submit\(\)/);
});

test('dashboard setup center covers the eleven MVP onboarding steps',()=>{
  const html=read('index.html'),app=read('app.js');
  for(const id of ['setupProgressValue','setupProgressBar','mvpSetupList','setupNextText','setupNextAction'])assert.match(html,new RegExp(`id="${id}"`));
  for(const label of ['Create account','Add contact details','Add résumé','Review profile','Add portfolio','Set target roles','Generate ATS résumé','Run Smart Search','Save opportunity','Generate first draft','Track follow-up'])assert.match(app,new RegExp(label));
  assert.match(app,/roledesk-mvp-progress-v1/);
  assert.match(app,/scope-cache-owner-v1/);
});

test('deployment, testing, release, and security docs describe the real MVP',()=>{
  const deployment=read('docs/DEPLOYMENT.md'),checks=read('docs/MVP_TEST_CHECKLIST.md'),release=read('docs/RELEASE_NOTES.md'),security=read('SECURITY.md'),readme=read('README.md');
  for(const number of ['001','002','003','004','005'])assert.match(`${deployment}\n${readme}`,new RegExp(`migration[s]?[^\n]*${number}|${number}[^\n]*migration`,'i'));
  assert.match(deployment,/codex\/smart-opportunity-engine/);assert.match(deployment,/GitHub Pages/);assert.match(deployment,/beta/i);assert.match(deployment,/redirect URL/i);
  assert.match(security,/extensions\.digest/);assert.match(checks,/User A cannot access user B/);assert.match(release,/guided-only/);
  assert.match(release,/not a full LLM/i);assert.match(release,/Gmail OAuth/i);
});

test('production artifacts preserve compatibility and avoid premature domain configuration',()=>{
  const ignore=read('.gitignore'),html=read('index.html'),app=read('app.js'),sync=read('supabase-sync.js');
  assert.match(ignore,/^pdf\/$/m);assert.match(ignore,/\.env/);assert.equal(fs.existsSync(path.join(root,'CNAME')),false);
  assert.doesNotMatch(`${html}\n${app}\n${sync}`,/roledesk\.in/i);
  assert.match(`${app}\n${sync}`,/scope-/i);
  assert.match(read('sw.js'),/mvp-polish\.css/);
});

test('documentation never claims current Gmail OAuth, external AI, or restricted scraping',()=>{
  const readme=read('README.md'),architecture=read('docs/V2_ARCHITECTURE.md'),gmail=read('docs/GMAIL_OAUTH_FUTURE.md');
  assert.match(readme,/Smart Draft Mode is deterministic local logic, not a hosted LLM/);
  assert.match(architecture,/Future architecture—not implemented/);
  assert.match(gmail,/does not connect to Gmail/);
  assert.match(readme,/guided official searches/);
});
