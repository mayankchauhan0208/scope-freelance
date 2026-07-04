import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const portals = require(path.join(root, 'portal-center.js'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Portal Center honestly classifies live, guided, and manual sources', () => {
  const byName = new Map(portals.portalRegistry.map(portal => [portal.name,portal]));
  assert.equal(byName.get('Remotive').status,'Live API');
  assert.equal(byName.get('Arbeitnow').status,'Live API');
  for (const name of ['LinkedIn','Naukri','Indeed','Upwork','Contra','Fiverr','Freelancer','Behance Jobs','Dribbble Jobs']) assert.equal(byName.get(name).status,'Guided Search');
  for (const name of ['Company career page','Job post URL','Client brief URL','Freelance lead URL']) assert.equal(byName.get(name).status,'Manual Import');
});

test('guided search URLs use official HTTPS routes', () => {
  const expected = {linkedin:'linkedin.com',naukri:'naukri.com',indeed:'indeed.com',upwork:'upwork.com',contra:'contra.com',fiverr:'fiverr.com',freelancer:'freelancer.com',behance:'behance.net',dribbble:'dribbble.com'};
  for (const [provider,host] of Object.entries(expected)) {
    const url = new URL(portals.guidedSearchUrl(provider,'Graphic Designer'));
    assert.equal(url.protocol,'https:');
    assert.ok(url.hostname.endsWith(host),`${provider}: ${url.hostname}`);
  }
});

test('design searches expand to the required related roles', () => {
  const terms = portals.expandedSearchTerms({targetRole:'Graphic Designer',skills:['Branding'],tools:['Figma']},'Graphic Designer');
  for (const role of ['Graphic Designer','Visual Designer','Brand Designer','Marketing Designer','Creative Designer','Digital Designer','Social Media Designer','Campaign Designer','Motion Designer','Video Editor','UI Visual Designer','Freelance Designer','Remote Designer']) assert.ok(terms.includes(role),role);
});

test('deduplication detects matching URLs and normalized title/company/location', () => {
  const result = portals.dedupeOpportunities([
    {title:'Graphic Designer',company:'Acme',location:'Remote',url:'https://example.test/job'},
    {title:'Graphic Designer',company:'Acme',location:'Remote',url:'https://example.test/job/'},
    {title:' Graphic  Designer ',company:'ACME',location:'remote',url:'https://other.test/job'},
    {title:'Brand Designer',company:'Acme',location:'Remote',url:'https://example.test/brand'}
  ]);
  assert.equal(result.items.length,2);
  assert.equal(result.removed,2);
});

test('manual import validates URLs, ranks locally, and supports tracker drafts', () => {
  const html = read('index.html'), app = read('app.js');
  for (const field of ['publicEmail','applyUrl','workMode','notes']) assert.match(html,new RegExp(`name="${field}"`));
  assert.match(app,/safeHttpUrl\(enteredApplyUrl\)/);
  assert.match(app,/RoleDeskSmartEngine\?\.rankOpportunity/);
  assert.match(app,/sourceMethod:'Manual Import'/);
  assert.match(app,/draftStoredEmail/);
  assert.match(app,/proposalOpportunity/);
  assert.match(app,/persist\(\)/);
});

test('search metrics, filters, and source labels are present', () => {
  const html = read('index.html'), app = read('app.js');
  for (const id of ['filterSource','filterMode','filterEmployment','filterCompensation','filterLocation','filterFreshness','filterStatus','liveSort','metricFetched','metricDuplicates','metricReviewable','metricHidden']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/dedupeOpportunities/);
  assert.match(app,/applyLiveFilters/);
  assert.match(app,/duplicates removed/);
});

test('restricted portals are guided only and no scraping or secrets were added', () => {
  const app = read('app.js'), portalSource = read('portal-center.js'), sync = read('supabase-sync.js');
  assert.doesNotMatch(app,/fetch\([^\n]*(linkedin|naukri|upwork|indeed|contra|fiverr|freelancer|behance|dribbble)/i);
  assert.doesNotMatch(portalSource,/fetch\(|XMLHttpRequest|password|access_token|refresh_token|client_secret/i);
  assert.doesNotMatch(sync,/from\('portal_connections'\)\.(insert|update|upsert)/);
  assert.match(read('index.html'),/does not scrape or submit applications automatically/);
});
