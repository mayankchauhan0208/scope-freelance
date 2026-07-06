import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const engine=require('../opportunity-engine.js');
const tracker=require('../tracker-engine.js');
const read=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');

test('pipeline uses clear career stages and maps legacy records safely',()=>{
  assert.deepEqual(engine.stages,['Discovered','Recommended','Shortlisted','Resume Ready','Cover Letter Ready','Applied','Follow-Up Needed','Interview Scheduled','Offer','Rejected','Closed / Not Relevant']);
  assert.equal(tracker.statusOf({status:'Saved'}),'Shortlisted');
  assert.equal(tracker.statusOf({status:'Interview'}),'Interview Scheduled');
});

test('readiness and opportunity quality are separate and evidence based',()=>{
  const profile={targetRole:'Data Analyst',skills:['SQL','Power BI'],text:'Reviewed resume',portfolioUrl:''};
  const job={title:'Data Analyst',client:'Example Ltd',brief:'A detailed SQL and Power BI role with clear responsibilities. '.repeat(5),skill:82,applicationUrl:'https://example.test/careers/apply',publishedAt:new Date().toISOString(),workMode:'remote',salary:'INR 8–10 lakh',source:'Company careers',sourceMethod:'Manual Import',missingKeywords:['Python']};
  const readiness=engine.readiness(profile,job),quality=engine.quality(job);
  assert.ok(readiness.score>=60);
  assert.ok(quality.score>=60);
  assert.notEqual(readiness.score,quality.score);
  assert.match(readiness.explanation,/ready/i);
});

test('contact discovery never invents an email address',()=>{
  assert.equal(engine.contact({client:'Example Ltd',url:'https://example.test/jobs'}).verifiedEmail,'');
  assert.equal(engine.contact({email:'jobs@example.test',sourceMethod:'Live API',url:'https://example.test/jobs'}).verifiedEmail,'jobs@example.test');
  assert.match(engine.nextAction({},{}),/verify|review/i);
});

test('phase 22 migration keeps contacts and delivery logs owner scoped',()=>{
  const sql=read('supabase/migrations/010_real_opportunity_pipeline.sql');
  assert.match(sql,/create table if not exists public\.opportunity_contacts/);
  assert.match(sql,/create table if not exists public\.email_delivery_logs/);
  assert.match(sql,/email_delivery_logs_owner_select/);
  assert.match(sql,/revoke insert, update, delete on public\.email_delivery_logs from authenticated/);
  assert.match(sql,/mark_application_applied/);
  assert.match(sql,/auth\.uid\(\)/);
});

test('auth supports resend with honest delivery guidance',()=>{
  const html=read('index.html'),sync=read('supabase-sync.js'),docs=read('docs/EMAIL_RELIABILITY.md');
  assert.match(html,/resendConfirmation/);
  assert.match(sync,/cloud\.auth\.resend/);
  assert.match(sync,/Check your inbox and spam folder/);
  assert.match(docs,/custom SMTP is not configured/);
  assert.match(docs,/never proof of delivery/);
});

test('application flow remains manual and approval first',()=>{
  const app=read('app.js'),html=read('index.html');
  assert.match(app,/Mark applied manually/);
  assert.match(app,/No verified email found\. Apply using the official application link\./);
  assert.match(html,/never sends emails, submits applications, or applies automatically/i);
});
