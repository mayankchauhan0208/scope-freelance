import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = {
  window: {},
  globalThis: {},
  localStorage: { data:{}, getItem(key){ return this.data[key] || null; }, setItem(key,value){ this.data[key] = String(value); } },
  ScopeSecurity: { escapeHtml:value=>String(value||'').replace(/[<>&"]/g,''), safeHttpUrl:value=>/^https?:\/\//i.test(String(value||'')) ? String(value) : '' },
  RoleDeskTracker: { matchScore:()=>72 },
  RoleDeskOpportunityEngine: { readiness:()=>({score:68}), quality:()=>({score:74}) },
  RoleDeskSmartEngine: { detectTruthWarnings:(profile,text)=>/999%/.test(text)?['Possible unsupported metric.']:[], rankOpportunity:()=>({score:72}) },
  RoleDeskState: {
    getProfile:()=>({
      fullName:'Mayank Chauhan', email:'mayank@example.com', phone:'+91 9999999999', location:'India',
      targetRole:'Product Designer', skills:['Figma','Design Systems','SaaS'], tools:['Figma'],
      portfolioUrl:'https://example.com', sections:{ summary:'Designer focused on SaaS dashboards.', experience:'Product Designer at Example Studio\n- Designed SaaS dashboard flows.', projects:'SaaS dashboard redesign.', education:'B.Des' },
      rawText:'Product Designer Figma Design Systems SaaS dashboard Example Studio'
    }),
    getOpportunities:()=>[{ id:1, title:'Product Designer', client:'Acme', brief:'Need Figma, SaaS dashboard and design systems.', skills:['Figma'], applicationUrl:'https://acme.test/apply', trustScore:80, status:'Shortlisted' }]
  }
};
root.window = root;
root.globalThis = root;
vm.createContext(root);
vm.runInContext(fs.readFileSync('application-kit.js','utf8'), root);

const kit = root.RoleDeskApplicationKit.buildKit(1, { tone:'Professional' });
assert.equal(kit.opportunityTitle, 'Product Designer');
assert.ok(kit.assets.tailoredResume.includes('ROLE-FOCUSED SKILLS'));
assert.ok(kit.assets.coverLetter.includes('Acme'));
assert.ok(kit.assets.recruiterEmail.includes('Subject: Application: Product Designer'));
assert.ok(kit.assets.linkedInMessage.includes('Short:'));
assert.ok(kit.assets.freelanceProposal.includes('Questions:'));
assert.ok(kit.scores.improvedMatch >= kit.scores.resumeMatch);
assert.ok(kit.checklist.some(item => item.label === 'Resume tailored'));
assert.ok(Object.values(kit.assetQuality).every(item => Number.isFinite(item.score)));
assert.ok(!kit.assets.tailoredResume.includes('999%'));

const risky = root.RoleDeskApplicationKit.quality('Improved results by 999%.', kit.analysis, 'coverLetter');
assert.ok(risky.fixes.includes('Possible unsupported metric.'));
console.log('Phase 25 application kit checks passed');
