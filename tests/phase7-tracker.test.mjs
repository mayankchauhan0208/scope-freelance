import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const tracker=require(path.join(root,'tracker-engine.js'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const now=new Date('2026-07-03T08:00:00Z');
const items=[
  {id:1,title:'A',platform:'LinkedIn',sourceMethod:'Guided',status:'Draft Prepared',skill:80,budget:1000,currency:'USD',followup:{nextAt:'2026-07-02',status:'scheduled'}},
  {id:2,title:'B',platform:'Upwork',sourceMethod:'Manual Import',status:'Proposal Sent',skill:70,budget:0,communication:{status:'Sent Manually'},followup:{nextAt:'2026-07-03',status:'scheduled'}},
  {id:3,title:'C',platform:'LinkedIn',sourceMethod:'Live API',status:'Client Replied',skill:90,budget:800,currency:'EUR',communication:{status:'Reply Received'}},
  {id:4,title:'D',platform:'Contra',status:'Hired',skill:88,budget:1200,currency:'USD'}
];

test('follow-up states distinguish overdue, due, completed, snoozed, and unset',()=>{
  assert.equal(tracker.followUpState(items[0],now),'Overdue');
  assert.equal(tracker.followUpState(items[1],now),'Due today');
  assert.equal(tracker.followUpState({followup:{nextAt:'2026-07-04',status:'completed'}},now),'Completed');
  assert.equal(tracker.followUpState({followup:{nextAt:'2026-07-01',status:'snoozed'}},now),'Snoozed');
  assert.equal(tracker.followUpState({},now),'No follow-up set');
});

test('analytics count real records, handle conversions, and exclude missing budgets',()=>{
  const data=tracker.analytics(items,now);
  assert.equal(data.total,4);assert.equal(data.drafted,4);assert.equal(data.sent,3);assert.equal(data.replies,2);assert.equal(data.wins,1);
  assert.equal(data.due,2);assert.equal(data.overdue,1);assert.equal(data.missingBudget,1);
  assert.deepEqual(data.values,{USD:2200,EUR:800});
  assert.equal(data.rates.sentToReply,67);
  assert.equal(tracker.analytics([],now).rates.savedToDrafted,null);
});

test('filters and sorting cover status, source, score, follow-up, and budget',()=>{
  assert.deepEqual(tracker.filterAndSort(items,{followup:'overdue',now},'score').map(x=>x.id),[1]);
  assert.deepEqual(tracker.filterAndSort(items,{source:'LinkedIn',minScore:85},'score').map(x=>x.id),[3]);
  assert.deepEqual(tracker.filterAndSort(items,{budget:'missing'},'budget').map(x=>x.id),[2]);
  assert.deepEqual(tracker.filterAndSort([{id:5,country:'India',createdAt:'2026-07-01'},{id:6,country:'Germany',createdAt:'2026-01-01'}],{location:'india',savedDays:'7',now},'updated').map(x=>x.id),[5]);
});

test('timeline labels manual events as user reported',()=>{
  const updated=tracker.addTimeline(items[0],'email.marked_sent','Marked sent manually');
  assert.equal(updated.timeline[0].metadata.verification,'user_reported');
  assert.match(updated.timeline[0].label,/manually/i);
});

test('tracker UI exposes views, filters, analytics, reminders, and no automatic action',()=>{
  const html=read('index.html'),app=read('app.js');
  for(const id of ['trackerAnalytics','conversionMetrics','pipelineValuePanel','trackerStatusFilter','trackerSourceFilter','trackerFollowupFilter','trackerCommunicationFilter','trackerScoreFilter','trackerBudgetFilter','trackerLocationFilter','trackerSavedFilter','trackerSort','trackerDetail'])assert.match(html,new RegExp(`id="${id}"`));
  for(const view of ['kanban','list','table'])assert.match(html,new RegExp(`data-tracker-view="${view}"`));
  assert.match(app,/Marked sent manually/);assert.doesNotMatch(app,/autoSend|autoApply|\.submit\(\)/);
});

test('migration preserves RLS, bounds fields, and blocks forged authoritative events',()=>{
  const migration=read('supabase/migrations/005_tracker_analytics_followups.sql'),sync=read('supabase-sync.js');
  assert.match(migration,/alter table public\.opportunities enable row level security/);
  assert.match(migration,/user_id = actor and source_url = p_source_url/);
  assert.match(migration,/p_event_type not in/);assert.doesNotMatch(migration,/'email\.sent'/);
  assert.match(migration,/provider_confirmed',false/);assert.match(migration,/octet_length/);
  assert.match(sync,/\.eq\('user_id', userId\)/);assert.doesNotMatch(sync,/service_role|GOOGLE_CLIENT_SECRET|OPENAI_API_KEY/);
});
