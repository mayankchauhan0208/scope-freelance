import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sources=require('../source-registry.js'),engine=require('../coverage-engine.js');

test('source registry is structured and honest about live feeds',()=>{
  const fields=['id','name','category','method','status','official_url','supports_keyword_search','supports_location_search','supports_remote_filter','supports_apply_link','supports_email_detection','requires_api','requires_oauth','is_guided_only','is_live_feed','is_manual_import','safety_note','limitations','last_reviewed','user_action_label'];
  assert.ok(sources.sourceRegistry.length>=35);
  for(const source of sources.sourceRegistry)for(const field of fields)assert.ok(Object.hasOwn(source,field),`${source.id}.${field}`);
  assert.deepEqual(sources.sourceRegistry.filter(x=>x.is_live_feed).map(x=>x.id).sort(),['arbeitnow','remotive']);
  for(const id of ['linkedin','naukri','indeed','upwork','contra','fiverr','freelancer'])assert.equal(sources.sourceRegistry.find(x=>x.id===id).is_guided_only,true);
});

test('guided URLs and MNC directory use official HTTPS routes',()=>{
  for(const id of ['linkedin','naukri','indeed','upwork'])assert.equal(new URL(sources.guidedUrl(id,'Graphic Designer','India')).protocol,'https:');
  assert.ok(sources.companies.length>=60);
  for(const company of sources.companies)assert.equal(new URL(company.career_url).protocol,'https:');
});

test('route detection and packets never guess contact data',()=>{
  assert.deepEqual(engine.publicEmails('Write to Jobs@Example.com or design@example.com'),['jobs@example.com','design@example.com']);
  const missing=engine.route({title:'Designer',brief:'No contact here'});assert.equal(missing.type,'Missing Apply Route');assert.equal(missing.email,'');
  const packet=engine.packet({fullName:'Mayank Chauhan',skills:['Branding']},{title:'Brand Designer',client:'Acme',brief:'Branding role',url:'https://example.com/jobs',skill:80});
  assert.equal(packet.route.quality,'Low');assert.ok(packet.missing.includes('email'));assert.ok(packet.answers.some(answer=>answer.missing.length));
});
