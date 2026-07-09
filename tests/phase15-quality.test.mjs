import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('identity uses profile, resume, email, then an editable placeholder', () => {
  const app = read('app.js');
  assert.match(app, /resumeProfile\?\.fullName/);
  assert.match(app, /extractResumeName/);
  assert.match(app, /emailNameFallback/);
  assert.match(app, /\[Your name\]/);
  assert.match(app, /Add your name in My Profile before approving/);
});

test('universal search expands profile-derived roles and penalizes unrelated job families', () => {
  const app = read('app.js');
  const universal = read('universal-search.js');
  for (const family of ['software','finance','hr','healthcare','hospitality','manufacturing']) assert.match(universal, new RegExp(`'${family}'`));
  assert.match(app, /RoleDeskUniversalSearch/);
  assert.match(universal, /wrongFamilyPenalty/);
  assert.match(universal, /titleSimilarity/);
  assert.match(universal, /breakdown/);
});

test('live search uses multiple permitted queries, deduplicates, and labels routes honestly', () => {
  const app = read('app.js');
  const html = read('index.html');
  const sources = read('job-source-engine.js');
  assert.match(app, /apiQueries=expandedQueries\.slice\(0,4\)/);
  assert.match(app, /RoleDeskJobSources\.search/);
  assert.match(sources, /Promise\.allSettled/);
  assert.match(sources, /canonicalUrl/);
  assert.match(sources, /dedupe/);
  assert.match(html, /Remotive<\/b> Live API/);
  assert.match(html, /Arbeitnow<\/b> Live API/);
  assert.match(html, /LinkedIn<\/b> Guided search/);
  assert.match(html, /Upwork<\/b> Guided search/);
});

test('proposal drafts use known profile facts and expose missing-data warnings', () => {
  const app = read('app.js');
  const html = read('index.html');
  assert.match(app, /strengthsLine/);
  assert.match(app, /proofLine/);
  assert.match(app, /Complete before sending/);
  assert.match(html, /proposalIdentityWarning/);
  assert.match(html, /emailIdentityWarning/);
  assert.doesNotMatch(app, /relevant professional experience/);
});

test('the product retains supervised send and apply boundaries', () => {
  const html = read('index.html');
  const app = read('app.js');
  assert.match(html, /No automatic sending/);
  assert.match(app, /submit the form yourself/);
  assert.match(html, /No auto-send\. No auto-apply\./i);
  assert.doesNotMatch(app, /function\s+auto(?:Apply|Send)|auto(?:Apply|Send)\s*=/i);
});
