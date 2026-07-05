import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const resume = require(path.join(root, 'resume-builder.js'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sample = `Jordan Example
Graphic Designer
jordan@example.com | +91 98765 43210
Location: Delhi, India
https://linkedin.com/in/jordan-example
https://example.com/portfolio
Skills: Graphic Design, Branding, Campaign Design, Social Media Design, Typography, Layout
Tools: Photoshop, Illustrator, Figma, After Effects

Professional Summary
Graphic designer focused on brand systems, campaign assets, and clear visual communication for digital channels.

Professional Experience
Graphic Designer | Example Studio | 2022 - Present
- Created campaign assets across digital channels.
- Improved delivery speed by 25% through reusable templates.

Projects
Brand launch system with social, presentation, and campaign assets.

Education
Bachelor of Design
`;

test('resume extraction finds verified profile fields and sections', () => {
  const profile = resume.extractProfile(sample, { targetRole: 'Graphic Designer', roles: ['Graphic Designer'] });
  assert.equal(profile.fullName, 'Jordan Example');
  assert.equal(profile.email, 'jordan@example.com');
  assert.match(profile.phone, /98765/);
  assert.equal(profile.location, 'Delhi, India');
  assert.match(profile.linkedinUrl, /linkedin\.com/);
  assert.match(profile.portfolioUrl, /portfolio/);
  assert.ok(profile.tools.includes('Photoshop'));
  assert.match(profile.sections.experience, /Improved delivery speed by 25%/);
  assert.equal(profile.confidence.email, 'Found in resume');
});

test('missing resume facts remain missing and are never fabricated', () => {
  const profile = resume.extractProfile('Taylor Person\nSkills: Design, Branding\nProfessional Summary\nCreative professional seeking suitable work.', {});
  assert.equal(profile.email, '');
  assert.equal(profile.phone, '');
  assert.equal(profile.sections.education, '');
  assert.equal(profile.confidence.email, 'Missing');
  const generated = resume.generateAtsResume(profile, 'Corporate', 'Designer');
  assert.match(generated, /Missing — add email, phone, and location manually/);
  assert.match(generated, /EDUCATION\nMissing — add this manually/);
});

test('ATS analysis returns practical section scores and improvements', () => {
  const profile = resume.extractProfile(sample, { targetRole: 'Graphic Designer', roles: ['Graphic Designer'] });
  const result = resume.analyzeAts(sample, profile, 'Graphic Designer');
  assert.ok(result.score >= 50 && result.score <= 100);
  assert.equal(Object.keys(result.factors).length, 7);
  assert.equal(Object.values(result.max).reduce((sum, value) => sum + value, 0), 100);
  assert.ok(Array.isArray(result.issues));
  assert.ok(Array.isArray(result.missingKeywords));
  const generated = resume.generateAtsResume(profile, 'Design/Marketing-focused', 'Graphic Designer');
  assert.match(generated, /Jordan Example/);
  assert.match(generated, /PROFESSIONAL EXPERIENCE/);
  assert.match(generated, /Improved delivery speed by 25%/);
});

test('Phase 3 schema and cloud methods remain owner-scoped', () => {
  const migration = read('supabase/migrations/003_resume_profile_ats_builder.sql');
  const sync = read('supabase-sync.js');
  for (const column of ['original_text','extracted_data','ats_score','issues','generated_text','tone','target_role','version_name']) assert.match(migration, new RegExp(column));
  assert.match(migration, /alter table public\.resumes enable row level security/i);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.match(sync, /user_id: session\.user\.id/);
  assert.match(sync, /\.eq\('user_id', session\.user\.id\)/);
  assert.match(sync, /ai_used: false/);
  const rlsCheck = read('supabase/tests/phase3_resume_rls_checks.sql');
  assert.match(rlsCheck, /User B cannot read User A resume versions/);
  assert.match(rlsCheck, /set local role anon/);
});

test('ATS Builder UI exposes reviewed save, copy, and export actions', () => {
  const html = read('index.html');
  for (const id of ['atsOriginal','atsAnalyze','atsScore','atsImproved','atsSyncProfile','atsCopy','atsExportText','atsExportMarkdown','atsSaveVersion','atsVersions']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /Nothing is invented or sent to AI/);
});
