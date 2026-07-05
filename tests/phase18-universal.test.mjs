import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const universal=require('../universal-search.js');
global.RoleDeskUniversalSearch=universal;
const resume=require('../resume-builder.js');
const smart=require('../smart-engine.js');
const read=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');

const fixtures={
  full:`AARAV SHARMA\nSoftware Engineer\naarav@example.com | +91 98765 43210\nLocation: Bengaluru, India\nhttps://linkedin.com/in/aarav-sharma\nhttps://github.com/aarav\nProfessional Summary\nSoftware Engineer with 5 years of SaaS experience using JavaScript, TypeScript and React.\nSkills: JavaScript, TypeScript, React, API development, testing\nTools: Git, Docker, AWS\nWork Experience\nSoftware Engineer | Example Tech | Jan 2021 - Present\n- Built React systems and improved release speed by 35%.\nEducation\nB.Tech Computer Science | Example University | 2020\nProjects\nCustomer analytics platform https://github.com/aarav/project`,
  missingPortfolio:`Neha Rao\nData Analyst\nneha@example.com\n+91-99887-77665\nLocation: Pune, India\nSummary\nData analyst with 3 years of reporting experience.\nSkills: SQL, data analysis, dashboarding\nTools: Power BI, Excel, Python\nExperience\nData Analyst | Example Ltd | 2022 - Present\n- Built dashboards that reduced reporting time by 20%.\nEducation\nBSc Statistics | 2021`,
  weak:`Ravi Kumar\nravi@example.com\nObjective\nLooking for a good job and willing to learn.\nEducation\nGraduate`,
  designer:`Mira Sen\nGraphic Designer\nSkills: graphic design, branding, typography, UI design\nTools: Figma, Photoshop, Illustrator\nExperience\nGraphic Designer | Studio | 2022 - Present\n- Designed brand systems for digital campaigns.`,
  software:`Kabir Mehta\nBackend Developer\nSkills: Java, Python, API development, testing\nTools: Git, Docker, AWS\nExperience\nBackend Developer | Tech Co | 2021 - Present`,
  accountant:`Isha Verma\nAccountant\nSkills: accounting, GST, taxation, bookkeeping, financial reporting\nTools: Tally, Excel, SAP\nExperience\nAccounts Executive | Retail Co | 2020 - Present`,
  hr:`Sara Khan\nHR Executive\nSkills: recruitment, onboarding, employee engagement, talent acquisition\nTools: HRMS, Workday, LinkedIn Recruiter\nExperience\nHR Executive | Services Co | 2022 - Present`,
  sales:`Arjun Das\nSales Manager\nSkills: B2B sales, business development, lead generation, negotiation\nTools: Salesforce, HubSpot\nExperience\nSales Manager | SaaS Co | 2019 - Present`,
  data:`Pooja Nair\nData Analyst\nSkills: SQL, data analysis, statistics, reporting\nTools: Power BI, Tableau, Python\nExperience\nBI Analyst | Finance Co | 2021 - Present`,
  fresher:`Dev Shah\nSoftware Engineer Intern\nSkills: JavaScript, React, testing\nTools: Git\nEducation\nB.Tech Computer Science | 2026`,
  senior:`Anita Roy\nDirector Operations\n12 years of operations management experience.\nSkills: operations management, process improvement, vendor management\nTools: SAP, ERP, Excel\nExperience\nDirector Operations | Manufacturing Co | 2014 - Present`
};

test('resume extraction handles identity, links, phone, sections and honest missing data',()=>{
  const profile=resume.extractProfile(fixtures.full,{});
  assert.equal(profile.fullName,'Aarav Sharma');
  assert.equal(profile.email,'aarav@example.com');
  assert.match(profile.phone,/98765/);
  assert.equal(profile.location,'Bengaluru, India');
  assert.match(profile.linkedinUrl,/linkedin/);
  assert.match(profile.githubUrl,/github/);
  assert.ok(profile.experiences.length);
  assert.ok(profile.educationRecords.length);
  assert.equal(resume.extractProfile(fixtures.missingPortfolio,{}).portfolioUrl,'');
});

test('ATS score uses seven transparent categories totaling 100',()=>{
  const strong=resume.extractProfile(fixtures.full,{}),strongScore=resume.analyzeAts(fixtures.full,strong,strong.targetRole);
  const weak=resume.extractProfile(fixtures.weak,{}),weakScore=resume.analyzeAts(fixtures.weak,weak,weak.targetRole);
  assert.equal(Object.values(strongScore.max).reduce((a,b)=>a+b,0),100);
  assert.equal(strongScore.score,Object.values(strongScore.factors).reduce((a,b)=>a+b,0));
  assert.ok(strongScore.score>weakScore.score);
  assert.ok(strongScore.topFixes.length<=5);
  assert.ok(['High','Medium','Low'].includes(strongScore.confidence));
  assert.ok(weakScore.missingFields.length);
});

test('universal taxonomy activates only resume-supported job families',()=>{
  const cases=[['designer','design'],['software','software'],['accountant','finance'],['hr','hr'],['sales','sales'],['data','data']];
  for(const [name,expected] of cases){const profile=resume.extractProfile(fixtures[name],{}),clusters=universal.roleClusters(profile);assert.ok(clusters.categories.includes(expected),`${name} -> ${expected}`)}
  const accounting=universal.roleClusters(resume.extractProfile(fixtures.accountant,{}));
  assert.ok(!accounting.primary.some(role=>/graphic|visual|brand designer/i.test(role)));
});

test('seniority is evidence-based and remains unconfirmed without evidence',()=>{
  assert.equal(universal.seniority(resume.extractProfile(fixtures.fresher,{})).level,'entry');
  assert.equal(universal.seniority(resume.extractProfile(fixtures.senior,{})).level,'director');
  assert.equal(universal.seniority({skills:['Excel']}).confirmed,false);
});

test('queries are generated from each resume instead of a fixed design list',()=>{
  for(const name of ['designer','software','accountant','hr','sales','data']){const profile=resume.extractProfile(fixtures[name],{}),queries=universal.queries(profile);assert.ok(queries.length);assert.ok(queries.some(query=>query.toLowerCase().includes(profile.targetRole.toLowerCase())))}
  const accountingQueries=universal.queries(resume.extractProfile(fixtures.accountant,{})).join(' ');
  assert.doesNotMatch(accountingQueries,/Graphic Designer|Visual Designer|Brand Designer/i);
});

test('ranking rewards relevant roles and apply routes while penalizing unrelated families',()=>{
  const profiles={designer:resume.extractProfile(fixtures.designer,{}),software:resume.extractProfile(fixtures.software,{}),accountant:resume.extractProfile(fixtures.accountant,{}),hr:resume.extractProfile(fixtures.hr,{}),sales:resume.extractProfile(fixtures.sales,{}),data:resume.extractProfile(fixtures.data,{})};
  const jobs={designer:{title:'Brand Designer',description:'Branding and Figma role',url:'https://example.test/apply'},software:{title:'Backend Developer',description:'Java API development and Docker',url:'https://example.test/apply'},accountant:{title:'Accounts Executive',description:'GST, Tally and bookkeeping',url:'https://example.test/apply'},hr:{title:'Recruiter',description:'Recruitment and onboarding',url:'https://example.test/apply'},sales:{title:'Business Development Manager',description:'B2B sales and lead generation',url:'https://example.test/apply'},data:{title:'BI Analyst',description:'SQL, Power BI and reporting',url:'https://example.test/apply'}};
  for(const name of Object.keys(profiles)){const relevant=universal.rank(profiles[name],jobs[name]),irrelevant=universal.rank(profiles[name],jobs.software);if(name!=='software')assert.ok(relevant.score>irrelevant.score,`${name} relevance`);assert.ok(relevant.matchedKeywords.length);assert.ok(relevant.reason)}
  const withRoute=universal.rank(profiles.data,jobs.data),withoutRoute=universal.rank(profiles.data,{...jobs.data,url:''});assert.ok(withRoute.score>withoutRoute.score);assert.ok(withoutRoute.riskFlags.some(flag=>/apply route/i.test(flag)));
});

test('public access migration removes beta gate without weakening admin or owner RLS',()=>{
  const migration=read('supabase/migrations/008_public_customer_access.sql'),base=read('supabase/migrations/002_security_data_foundation.sql'),admin=read('supabase/migrations/007_beta_operations_admin.sql');
  assert.match(migration,/drop trigger if exists enforce_beta_access_before_signup/);
  assert.match(migration,/security definer[\s\S]*set search_path/);
  assert.match(migration,/on conflict \(user_id\) do update/);
  assert.match(base,/alter table public\.profiles enable row level security/);
  assert.match(admin,/is_roledesk_admin/);
});

test('search intent is editable and production auth uses the live redirect',()=>{
  const html=read('index.html'),intent=read('search-intent.js'),sync=read('supabase-sync.js'),app=read('app.js');
  for(const field of ['intentTargetRole','intentAlternateRoles','intentIncludeSkills','intentExcludeSkills','intentIndustries','intentLocation','intentRemote','intentJobType','intentSeniority','intentMinimum','intentFreelance','intentInternships','intentMnc'])assert.match(intent,new RegExp(field));
  assert.match(intent,/Regenerate from resume/);
  assert.match(sync,/LIVE_REDIRECT_URL = 'https:\/\/mayankchauhan0208\.github\.io\/scope-freelance\/'/);
  assert.doesNotMatch(`${html}\n${sync}\n${app}`,/localhost:3000/);
  assert.doesNotMatch(app,/\|\|'Graphic Designer'/);
});

test('drafts and application workflow retain manual approval boundaries',()=>{
  const smartSource=read('smart-engine.js'),coverage=read('coverage-engine.js'),coverageUi=read('coverage-ui.js'),html=read('index.html');
  const draft=smart.generateProposalDraft(resume.extractProfile(fixtures.accountant,{}),{title:'Accounts Executive',client:'Example',brief:'GST and Tally accounting'});
  assert.doesNotMatch(draft.text,/\[Your name\]/);
  assert.match(`${coverage}\n${coverageUi}\n${html}`,/Mark applied manually/);
  assert.match(html,/never sends emails, submits applications, or applies automatically/i);
  assert.doesNotMatch(smartSource,/fetch\(|XMLHttpRequest|service_role/);
});
