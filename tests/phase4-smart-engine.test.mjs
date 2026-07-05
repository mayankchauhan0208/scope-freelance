import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
require(path.join(root, 'resume-builder.js'));
require(path.join(root, 'universal-search.js'));
const engine = require(path.join(root, 'smart-engine.js'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const profile = { fullName:'Jordan Example',email:'jordan@example.test',phone:'+91 98765 43210',location:'Delhi, India',targetRole:'Graphic Designer',roles:['Graphic Designer'],skills:['Branding','Typography','Layout','Visual Design'],tools:['Photoshop','Illustrator','Figma'],portfolioUrl:'https://portfolio.example.test',linkedinUrl:'https://linkedin.com/in/jordan-example',experienceSummary:'Graphic designer creating verified brand and campaign systems.',availability:'Available in two weeks',rawText:'Jordan Example Graphic Designer Branding Typography Layout Visual Design Photoshop Illustrator Figma' };

test('resume analysis and ATS scoring work locally without an API key', () => {
  const text = `Jordan Example\njordan@example.test\n+91 98765 43210\nLocation: Delhi, India\n\nProfessional Summary\nGraphic designer creating brand systems.\n\nSkills\nBranding, Typography, Layout, Visual Design\n\nTools\nPhotoshop, Illustrator, Figma\n\nProfessional Experience\nDesigner, 2022–2026\n- Improved delivery speed by 25%.`;
  const analysis = engine.analyzeResumeText(text, {}, 'Graphic Designer');
  assert.equal(analysis.extracted.fullName, 'Jordan Example');
  assert.ok(analysis.ats.score >= 0 && analysis.ats.score <= 100);
  assert.ok(Array.isArray(analysis.improvementSuggestions));
});

test('ATS generation uses confirmed facts and placeholders instead of invention', () => {
  const generated = engine.generateATSResume({ fullName:'Jordan Example',skills:['Branding'] }, { targetRole:'Designer' });
  assert.match(generated, /Jordan Example/);
  assert.match(generated, /\[Add details\]/);
  assert.doesNotMatch(generated, /Google|Microsoft|10 years|Bachelor of Arts/);
});

test('opportunity ranking boosts profile fit and penalizes unrelated job families', () => {
  const relevant = engine.rankOpportunity(profile,{title:'Senior Graphic Designer',description:'Remote branding role using Photoshop and Figma.',remote:true,salary:'₹8L'});
  const unrelated = engine.rankOpportunity(profile,{title:'Backend Developer',description:'Build Java APIs and databases.',remote:true});
  assert.ok(relevant.score > unrelated.score);
  assert.ok(unrelated.breakdown.wrongFamilyPenalty >= 30);
  assert.ok(relevant.matchedKeywords.length > 0);
});

test('smart drafts use profile identity and expose missing facts', () => {
  const proposal = engine.generateProposalDraft(profile,{title:'Brand Designer',client:'Example Co',brief:'Branding and visual design'});
  assert.match(proposal.text, /Jordan Example/);
  assert.match(proposal.text, /^Hi team,/);
  const email = engine.generateEmailDraft({}, {title:'Designer'});
  assert.match(email.text, /\[Name not confirmed\]/);
  assert.ok(email.warnings.some(warning => /Name not confirmed/i.test(warning)));
});

test('truth warnings flag unsupported claims', () => {
  const warnings = engine.detectTruthWarnings(profile,'I have 12 years of experience and improved results by 80%.');
  assert.ok(warnings.some(warning => /years/i.test(warning)));
  assert.ok(warnings.some(warning => /metric/i.test(warning)));
});

test('Smart Engine has no network or secret dependency and UI remains supervised', () => {
  const source = read('smart-engine.js'), app = read('app.js'), html = read('index.html');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|openai|gemini|groq|api[_-]?key/i);
  assert.match(html, /Smart Draft Mode — Free local intelligence/);
  for (const id of ['atsEdit','atsCopy','atsSaveVersion','proposalEdit','proposalSave','emailEdit','emailSave','emailTruthWarnings']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html, /No automatic sending/);
  assert.match(app, /submit the form yourself/);
  assert.doesNotMatch(app, /autoApply|autoSend/);
});
