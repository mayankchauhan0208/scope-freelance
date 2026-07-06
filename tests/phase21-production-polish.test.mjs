import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const read=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const universal=require('../universal-search.js');

test('ranking exposes evidence-based experience and source quality',()=>{
  const profile={targetRole:'Data Analyst',skills:['SQL','data analysis'],years:4,experiences:[{title:'Data Analyst'}]};
  const result=universal.rank(profile,{title:'Data Analyst',description:'SQL data analysis role',source:'Arbeitnow',url:'https://example.test/apply'});
  assert.equal(result.breakdown.experienceFit,8);
  assert.equal(result.breakdown.sourceQuality,1);
  assert.ok(result.score<=100);
});

test('live search is bounded, cancellable, and communicates loading',()=>{
  const app=read('app.js');
  assert.match(app,/fetchJsonWithTimeout\([\s\S]*AbortController/);
  assert.match(app,/expandedQueries\.slice\(0,4\)/);
  assert.match(app,/aria-busy/);
  assert.match(app,/Search source unavailable\. Try guided search or retry\./);
});

test('real opportunity records do not receive fabricated scoring fields',()=>{
  const app=read('app.js');
  const liveSave=app.match(/function saveLiveJob\(job\)[\s\S]*?function draftLiveEmail/)?.[0]||'';
  const manualSave=app.match(/let imported=\{[\s\S]*?opportunities\.unshift\(imported\)/)?.[0]||'';
  for(const source of [liveSave,manualSave])assert.doesNotMatch(source,/portfolio:|credibility:|competition:|deadline:|payment:|longterm:|international:|clarity:/);
  assert.match(app,/isDemoOpportunity\(o\)\?analyze\(o\)\.risks/);
});

test('auth operations block duplicate clicks and restore controls',()=>{
  const sync=read('supabase-sync.js');
  assert.match(sync,/withAuthBusy/);
  assert.match(sync,/button\.disabled = true/);
  assert.match(sync,/finally[\s\S]*button\.disabled = false/);
});
