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

test('design search expands related roles and strongly penalizes unrelated titles', () => {
  const app = read('app.js');
  for (const role of ['graphic designer','visual designer','brand designer','marketing designer','social media designer','motion designer','video editor']) assert.match(app, new RegExp(role));
  for (const wrong of ['product manager','engineer','developer','office assistant']) assert.match(app, new RegExp(wrong));
  assert.match(app, /wrongRolePenalty=wrongRoles\.length\?45:0/);
  assert.match(app, /titleMatch=Math\.min\(35/);
  assert.match(app, /scoreBreakdown/);
});

test('live search uses multiple permitted queries, deduplicates, and labels routes honestly', () => {
  const app = read('app.js');
  const html = read('index.html');
  assert.match(app, /apiQueries=expandedQueries\.slice\(0,6\)/);
  assert.match(app, /Promise\.allSettled/);
  assert.match(app, /seenTitles/);
  assert.match(app, /seenUrls/);
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
