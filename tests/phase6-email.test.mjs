import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const email = require(path.join(root, 'email-desk.js'));
const read = file => fs.readFileSync(path.join(root,file),'utf8');

test('email validation blocks missing recipient, subject, and body', () => {
  const result = email.validateDraft({recipient:'',subject:'',body:''},{fullName:'Jordan Example'});
  assert.equal(result.canApprove,false);
  assert.ok(result.errors.some(item=>/Recipient email is missing/i.test(item)));
  assert.ok(result.errors.some(item=>/Subject is missing/i.test(item)));
  assert.ok(result.errors.some(item=>/body is missing/i.test(item)));
});

test('Gmail compose URL safely encodes reviewed fields and contains no send action', () => {
  const url = email.buildGmailComposeUrl({recipient:'client@example.test',subject:'Brand role & next step',body:'Hello team,\n\nLine two.'},'me@example.test');
  const parsed = new URL(url);
  assert.equal(parsed.hostname,'mail.google.com');
  assert.equal(parsed.searchParams.get('to'),'client@example.test');
  assert.equal(parsed.searchParams.get('su'),'Brand role & next step');
  assert.equal(parsed.searchParams.get('body'),'Hello team,\n\nLine two.');
  assert.equal(parsed.searchParams.get('send'),null);
  assert.equal(email.buildGmailComposeUrl({recipient:'bad',subject:'x',body:'y'}), '');
});

test('follow-up generation is editable, factual, and warns without prior context', () => {
  const result = email.generateFollowUp({fullName:'Jordan Example'},{title:'Brand Designer',client:'Example Studio'},'Reply after interest','');
  assert.match(result.text,/Jordan Example/);
  assert.match(result.text,/Brand Designer/);
  assert.ok(result.warnings.some(item=>/No previous email/i.test(item)));
  assert.ok(result.warnings.some(item=>/do not imply/i.test(item)));
  assert.doesNotMatch(result.text,/received your reply|you said|as discussed yesterday/i);
});

test('communication tracking is explicitly user-reported', () => {
  const updated = email.updateCommunication({title:'Role'},{status:'Sent Manually',followUpDate:'2026-07-10',notes:'Sent from Gmail manually.'});
  assert.equal(updated.communication.status,'Sent Manually');
  assert.equal(updated.communication.providerConfirmed,false);
  assert.equal(updated.communication.verification,'user_reported');
  assert.equal(updated.communication.followUpDate,'2026-07-10');
});

test('Email Desk exposes supervised controls, tracking, follow-ups, and history', () => {
  const html = read('index.html'), app = read('app.js');
  for (const id of ['emailOpportunity','emailRecipientName','emailCompany','emailValidationWarnings','approveEmail','copyApprovedEmail','openGmailDraft','emailSave','markEmailSent','markEmailReply','emailFollowUpDate','communicationStatus','emailCommunicationNotes','generateFollowUp','followUpOutput','saveFollowUp','savedEmailDrafts']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/Open reviewed draft in Gmail/);
  assert.match(html,/You must send it yourself/);
  assert.match(app,/buildGmailComposeUrl/);
  assert.match(app,/confirm\('Open this reviewed draft in Gmail/);
  assert.match(app,/content change|revokeEmailApproval/i);
  assert.match(app,/communication-badge/);
});

test('email activity RPC is owner-checked and never claims provider confirmation', () => {
  const migration = read('supabase/migrations/004_email_communication_tracking.sql'), sync = read('supabase-sync.js');
  assert.match(migration,/record_email_client_event/);
  assert.match(migration,/d\.user_id = actor/);
  assert.match(migration,/'provider_confirmed', false/);
  assert.match(migration,/'verification', 'user_reported'/);
  assert.match(migration,/p_event_type not in/);
  assert.match(sync,/\.eq\('user_id', session\.user\.id\).*\.eq\('kind','email'\)/);
  assert.doesNotMatch(sync,/create_activity_log/);
});

test('future OAuth documentation contains placeholders but frontend contains no OAuth secret', () => {
  const docs = read('docs/GMAIL_OAUTH_FUTURE.md'), html = read('index.html'), app = read('app.js'), sync = read('supabase-sync.js');
  for (const name of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI']) assert.match(docs,new RegExp(name));
  assert.doesNotMatch(`${html}\n${app}\n${sync}`,/GOOGLE_CLIENT_SECRET|refresh_token|access_token/);
  assert.match(docs,/server-side/i);
});

test('no automatic send, apply, Gmail scraping, or form submission was added', () => {
  const app = read('app.js'), html = read('index.html');
  assert.doesNotMatch(app,/gmail.*fetch|fetch.*gmail|autoSend|autoApply/i);
  assert.match(html,/No automatic sending/);
  assert.match(app,/submit the form yourself/);
  assert.doesNotMatch(app,/\.submit\(\)/);
});
