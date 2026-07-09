(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RoleDeskResume = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  const toolNames = ['Photoshop','Illustrator','Figma','Canva','After Effects','Premiere Pro','InDesign','PowerPoint','Excel','WordPress','Webflow','Midjourney','Stable Diffusion','Google Analytics','Meta Ads','Adobe Creative Suite','JavaScript','TypeScript','React','Node.js','Python','Java','Git','Docker','Kubernetes','AWS','Azure','Power BI','Tableau','Looker','Tally','QuickBooks','SAP','Oracle Financials','Salesforce','HubSpot','Zoho CRM','Pipedrive','HRMS','Workday','Jira','Confluence','Asana','Trello','Notion','Zendesk','Freshdesk','Intercom','Shopify','Magento','AutoCAD'];
  const requiredProfileFields = [
    ['full name','fullName'],['email','email'],['phone','phone'],['location','location'],['target roles','roles'],['skills','skills'],['tools','tools'],['portfolio URL','portfolioUrl'],['LinkedIn URL','linkedinUrl'],['experience summary','experienceSummary'],['preferred locations','preferredLocation'],['remote preference','remotePreference'],['availability','availability']
  ];
  const sectionAliases = {
    experience:['experience','professional experience','work experience','employment history'],
    education:['education','academic background'],certifications:['certifications','certificates'],
    projects:['projects','portfolio highlights','selected work'],achievements:['achievements','awards','accomplishments'],summary:['summary','professional summary','profile','about']
  };
  const clean = value => String(value || '').replace(/\r/g, '').trim();
  const currentProfile = () => root?.RoleDeskState?.getProfile?.() || {};
  const unique = values => [...new Set(values.map(value => clean(value)).filter(Boolean))];
  const safeUrl = value => root?.ScopeSecurity?.safeHttpUrl ? root.ScopeSecurity.safeHttpUrl(value) : (/^https?:\/\//i.test(clean(value)) ? clean(value) : '');
  const lines = text => String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const titleStart = /\b(?:senior|sr\.?|junior|jr\.?|lead|principal|creative|graphic|visual|product|ui|ux|web|brand|marketing|motion|art|design|designer|developer|engineer|manager|director|specialist|consultant|strategist|analyst|coordinator|executive|officer|intern|accountant|finance|recruiter|human resources|hr|sales|teacher|trainer|nurse|legal|support|operations|administrator|writer|editor)\b/i;
  const nonName = /\b(?:resume|curriculum|vitae|profile|summary|experience|education|skills|portfolio|contact|objective|private limited|pvt\.? ltd|technologies|solutions|university|college|company|corporation)\b/i;
  function normalizeName(value) {
    const name = clean(value).replace(/\s+/g, ' ').replace(/[,:;|\-]+$/g, '').trim();
    if (!name || name !== name.toUpperCase()) return name;
    return name.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  }
  function nameCandidate(value) {
    const candidate = clean(value).replace(/\s+/g, ' ').replace(/[,:;|\-]+$/g, '').trim();
    const words = candidate.split(/\s+/);
    if (words.length < 2 || words.length > 4 || candidate.length > 60 || nonName.test(candidate)) return '';
    if (!words.every(word => /^[A-Za-z][A-Za-z.'-]*$/.test(word))) return '';
    return normalizeName(candidate);
  }
  function extractNameResult(text) {
    const first = lines(text).slice(0, 12);
    const labeled = first.map(line => line.match(/^(?:full\s+name|name)\s*[:\-]\s*(.+)$/i)).find(Boolean);
    if (labeled) {
      const name = nameCandidate(labeled[1].split(/[|•·–—]/)[0]);
      if (name) return { name, confidence: 'Found in resume' };
    }
    for (const line of first) {
      let prefix = line.split(/[|•·–—]/)[0].trim();
      const boundary = prefix.match(titleStart);
      if (boundary?.index === 0) continue;
      if (boundary?.index > 0) prefix = prefix.slice(0, boundary.index).trim();
      const name = nameCandidate(prefix);
      if (name) return { name, confidence: boundary?.index > 0 ? 'Needs review' : 'Found in resume' };
    }
    return { name: '', confidence: 'Needs review' };
  }
  function extractName(text) {
    return extractNameResult(text).name;
  }
  function extractSection(text, aliases) {
    const all = String(text || '').split(/\r?\n/), headings = Object.values(sectionAliases).flat(); let active = false, found = [];
    for (const raw of all) {
      const line = raw.trim(), normalized = line.toLowerCase().replace(/[:\-]+$/, '').trim();
      if (aliases.includes(normalized)) { active = true; continue; }
      if (active && headings.includes(normalized)) break;
      if (active && line) found.push(line);
    }
    return found.join('\n').trim();
  }
  function extractPhone(text) {
    const candidates = String(text || '').match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d(?:[\d\s().-]{7,}\d)/g) || [];
    return candidates.map(value=>value.trim()).find(value=>{const digits=value.replace(/\D/g,'');return digits.length>=10&&digits.length<=15&&!/^\d{4}[ -]?\d{4}$/.test(value)}) || '';
  }
  function structuredEntries(section='') {
    const source=String(section||'').split(/\n+/).map(line=>line.trim()).filter(Boolean),entries=[];let current=[];
    const flush=()=>{if(!current.length)return;const raw=current.join('\n'),date=(raw.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*(?:-|–|—|to)\s*(?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})|\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:Present|Current|(?:19|20)\d{2})/i)||[''])[0];entries.push({heading:current[0]||'',dateRange:date,details:current.slice(1),raw});current=[]};
    source.forEach(line=>{if(current.length&&/(?:Present|Current|\b(?:19|20)\d{2})/i.test(line)&&!/^[-•*]/.test(line))flush();current.push(line)});flush();return entries;
  }
  function extractProfile(text, existing = {}) {
    const raw = clean(text), resumeLines = lines(text), urls = [...raw.matchAll(/https?:\/\/[^\s,;)]+/gi)].map(match => safeUrl(match[0])).filter(Boolean),signals=root?.RoleDeskUniversalSearch?.extractSignals?.(raw)||{};
    const nameResult = extractNameResult(text);
    const existingName = [existing.fullName, existing.displayName].map(clean).find(value => value && !/^\[?your name\]?$/i.test(value) && value !== 'Needs review') || '';
    const found = {
      fullName: nameResult.name,
      email: (raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0],
      phone: extractPhone(raw),
      location: (resumeLines.map(line => line.match(/^(?:location|address|based in)\s*[:\-]\s*(.{2,100})$/i)).find(Boolean) || [,''])[1],
      linkedinUrl: urls.find(url => /linkedin\.com/i.test(url)) || '',
      githubUrl: urls.find(url => /github\.com/i.test(url)) || '',
      portfolioUrl: urls.find(url => /behance|dribbble|portfolio|adobe|notion|medium|substack/i.test(url)) || urls.find(url=>!/linkedin|github/i.test(url)) || '',
      tools: unique([...(signals.tools||[]),...toolNames.filter(tool => new RegExp(tool.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g, '\\s*'), 'i').test(raw))]),
      experienceSummary: extractSection(text, sectionAliases.summary),
      sections: Object.fromEntries(Object.entries(sectionAliases).map(([key, aliases]) => [key, extractSection(text, aliases)]))
    };
    const skillsSection=(raw.match(/(?:skills?|expertise|competencies)\s*[:\-]\s*([^\n]+)/i)?.[1] || '').split(/[,|•]/),skills=unique([...(signals.skills||[]),...skillsSection]),clusters=root?.RoleDeskUniversalSearch?.roleClusters?.({...signals,skills,tools:found.tools})||{primary:[]},roles=unique([...(signals.targetRole?[signals.targetRole]:[]),...(clusters.primary||[])]);
    const experiences=structuredEntries(found.sections.experience),educationRecords=structuredEntries(found.sections.education),projectRecords=structuredEntries(found.sections.projects);
    const profile = { ...existing, ...Object.fromEntries(Object.entries(found).map(([key,value]) => [key, value || existing[key] || ''])), skills: unique([...(existing.skills || []), ...skills]), roles: unique([...(existing.roles || []), ...roles]),targetRole:existing.targetRole||signals.targetRole||roles[0]||'',currentTitle:existing.currentTitle||signals.currentTitle||roles[0]||'',pastTitles:unique([...(existing.pastTitles||[]),...(signals.pastTitles||[])]),years:existing.years??signals.years??null,industries:unique([...(existing.industries||[]),...(signals.industries||[])]),experiences,educationRecords,projectRecords,skillsByCategory:Object.fromEntries((root?.RoleDeskUniversalSearch?.categoriesFor?.({...signals,skills,tools:found.tools})||[]).map(row=>[row.item.name,{skills:row.item.skills.filter(skill=>skills.some(value=>value.toLowerCase()===skill.toLowerCase())),tools:row.item.tools.filter(tool=>found.tools.some(value=>value.toLowerCase()===tool.toLowerCase()))}])),rawText:raw,text:raw,extractionVersion:6 };
    profile.fullName = existingName || nameResult.name || '';
    profile.displayName = existing.displayName && existingName ? existing.displayName : profile.fullName;
    profile.confidence = {};
    for (const [,key] of requiredProfileFields) {
      const value = profile[key], hasValue = Array.isArray(value) ? value.length > 0 : !!clean(value);
      profile.confidence[key] = found[key] ? 'Found in resume' : hasValue ? 'User-added' : 'Missing';
    }
    if (skills.length) profile.confidence.skills = 'Found in resume';
    if (roles.length) profile.confidence.roles = 'Needs review';
    profile.confidence.fullName = existingName ? (existing.confidence?.fullName || 'User-added') : nameResult.confidence;
    profile.confidence.githubUrl = found.githubUrl ? 'Found in resume' : profile.githubUrl ? 'User-added' : 'Missing';
    profile.confidence.sections = Object.fromEntries(Object.keys(sectionAliases).map(key => [key, found.sections[key] ? 'Found in resume' : 'Missing']));
    return profile;
  }
  function profileCompleteness(profile = {}) {
    const completed = requiredProfileFields.filter(([,key]) => Array.isArray(profile[key]) ? profile[key].length : clean(profile[key])).length;
    const missing = requiredProfileFields.filter(([,key]) => !(Array.isArray(profile[key]) ? profile[key].length : clean(profile[key]))).map(([label]) => label);
    return { percent: Math.round((completed / requiredProfileFields.length) * 100 / 5) * 5, missing };
  }
  function analyzeAts(text, profile = {}, targetRole = '') {
    const raw = clean(text), lower = raw.toLowerCase(), bullets = raw.split('\n').filter(line => /^[-•*]/.test(line.trim())), roleTokens = unique(`${targetRole} ${(profile.skills || []).join(' ')}`.toLowerCase().split(/[^a-z0-9+#]+/).filter(token => token.length > 2));
    const languageWarnings = [];
    if (/\bi\b/.test(raw)) languageWarnings.push('Review lowercase “i” for capitalization.');
    if (/[!?]{2,}| {2,}/.test(raw)) languageWarnings.push('Review repeated punctuation or spacing.');
    const factors = {
      contact: profile.email && profile.phone ? 10 : profile.email || profile.phone ? 5 : 0,
      roleTitle: clean(targetRole || profile.targetRole) ? 8 : 0,
      summary: clean(profile.experienceSummary || profile.sections?.summary).length >= 60 ? 10 : 0,
      skills: (profile.skills || []).length >= 6 ? 12 : Math.min(10,(profile.skills || []).length * 2),
      tools: (profile.tools || []).length >= 3 ? 8 : Math.min(6,(profile.tools || []).length * 2),
      experience: clean(profile.sections?.experience).length >= 120 ? 14 : clean(profile.sections?.experience) ? 7 : 0,
      achievements: /\b\d+(?:\.\d+)?%|\b\d+\+|[$₹€£]\s?\d|\b\d{2,}\b/.test(profile.sections?.experience || raw) ? 10 : bullets.length ? 4 : 0,
      projects: clean(profile.sections?.projects).length >= 60 ? 8 : clean(profile.sections?.projects) ? 4 : 0,
      keywords: roleTokens.length ? Math.round(8 * roleTokens.filter(token => lower.includes(token)).length / roleTokens.length) : 4,
      formatting: /\t|\|{2,}|<table|\u0000/i.test(raw) ? 0 : 4,
      readability: raw.length >= 250 && raw.split('\n').filter(Boolean).length >= 6 ? 2 : 1,
      language: languageWarnings.length ? 0 : 3,
      links: profile.portfolioUrl && profile.linkedinUrl ? 3 : profile.portfolioUrl || profile.linkedinUrl || profile.githubUrl ? 2 : 0
    };
    const max = {contact:10,roleTitle:8,summary:10,skills:12,tools:8,experience:14,achievements:10,projects:8,keywords:8,formatting:4,readability:2,language:3,links:3};
    const score = Math.round(Object.values(factors).reduce((sum,value) => sum + value,0) / 5) * 5;
    const issues = [];
    if (factors.contact < max.contact) issues.push('Add a clear email and phone number.');
    if (!factors.roleTitle) issues.push('Add a specific target role.');
    if (!factors.summary) issues.push('Add a concise professional summary based only on verified experience.');
    if (factors.skills < 8) issues.push('Add relevant, truthful skills for the target role.');
    if (!factors.tools) issues.push('List only tools you actually use.');
    if (factors.experience < 10) issues.push('Structure experience with employer, role, dates, and clear bullets.');
    if (factors.achievements < 8) issues.push('Strengthen weak bullets with verified outcomes or measurable evidence.');
    if (!factors.projects) issues.push('Add relevant projects or portfolio highlights when available.');
    if (!factors.formatting) issues.push('Remove tables, columns, tabs, or complex formatting for ATS readability.');
    if (languageWarnings.length) issues.push('Run a final spelling and grammar review.');
    const weakBullets = bullets.filter(line => !/\b(led|created|designed|managed|improved|increased|reduced|delivered|launched|built|developed|achieved|optimized)\b/i.test(line)).slice(0,5);
    const missingKeywords = roleTokens.filter(token => !lower.includes(token)).slice(0,10);
    return { score, factors, max, issues, missingKeywords, languageWarnings, weakBullets, truthWarnings: /\[(?:missing|add|your)/i.test(raw) ? ['Resolve placeholders before using this resume.'] : [] };
  }
  function analyzeAtsV6(text, profile = {}, targetRole = '') {
    const raw=clean(text),lower=raw.toLowerCase(),sections=profile.sections||{},experience=clean(sections.experience),education=clean(sections.education),certifications=clean(sections.certifications),projects=clean(sections.projects),summary=clean(profile.experienceSummary||sections.summary),skills=unique(profile.skills||[]),tools=unique(profile.tools||[]),role=clean(targetRole||profile.targetRole||profile.currentTitle),links=[profile.linkedinUrl,profile.portfolioUrl,profile.githubUrl].filter(Boolean),bullets=raw.split('\n').filter(line=>/^[-•*]/.test(line.trim())),roleTokens=unique(`${role} ${skills.slice(0,8).join(' ')}`.toLowerCase().split(/[^a-z0-9+#.]+/).filter(token=>token.length>2)),keywordHits=roleTokens.filter(token=>lower.includes(token)),hasDates=/(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:present|current|(?:19|20)\d{2})/i.test(experience),hasStructure=Boolean(experience&&hasDates&&(profile.experiences?.length||/\b(company|role|position|employer)\b/i.test(experience))),hasResponsibility=bullets.length>=2||/\b(responsible|managed|developed|created|delivered|supported|analyzed|prepared|coordinated)\b/i.test(experience),hasMeasurement=/\b\d+(?:\.\d+)?%|[$₹€£]\s?\d|\b\d+\+\b|\b\d{2,}\b/.test(experience),hasAction=/\b(led|created|designed|managed|improved|increased|reduced|delivered|launched|built|developed|achieved|optimized|analyzed|implemented|coordinated)\b/i.test(experience),complexFormatting=/\t|\|{2,}|<table|\u0000/i.test(raw),simpleHeadings=['experience','education','skills'].filter(heading=>new RegExp(`(^|\\n)\\s*(?:professional |work )?${heading}s?\\s*[:\\-]?\\s*($|\\n)`,'im').test(raw)).length;
    const genericSkills=skills.filter(skill=>/communication|teamwork|hardworking|leadership|problem solving|time management/i.test(skill)).length,categoryMatch=Object.values(profile.skillsByCategory||{}).some(group=>(group.skills||[]).length||(group.tools||[]).length);
    const factors={
      contactIdentity:(clean(profile.fullName)?3:0)+(profile.email?3:0)+(profile.phone?3:0)+(profile.location?2:0)+(links.length?4:0),
      professionalSummary:(role?4:0)+((profile.years!==null&&profile.years!==undefined)||(profile.industries||[]).length?3:0)+(summary&&keywordHits.length?3:0),
      skills:Math.min(8,skills.length*2)+Math.min(5,tools.length*2)+(categoryMatch?5:skills.length>=3?3:0)+(genericSkills<=Math.max(2,Math.floor(skills.length/2))?2:0),
      experience:(hasStructure?8:experience?4:0)+(hasResponsibility?6:0)+(hasMeasurement?6:0)+(hasAction?3:0)+(hasDates?2:0),
      educationCertifications:(education?5:0)+(certifications?3:0)+(education&&education.length>20?2:0),
      portfolioProjects:(profile.portfolioUrl||projects?5:0)+((profile.industries||[]).length||categoryMatch?3:0)+(projects&&(/https?:\/\//i.test(projects)||hasMeasurement)?2:0),
      atsFormattingReadability:Math.min(3,simpleHeadings)+(complexFormatting?0:2)+(roleTokens.length?Math.round(3*keywordHits.length/roleTokens.length):0)+(experience&&skills&&education?2:0)
    };
    const max={contactIdentity:15,professionalSummary:10,skills:20,experience:25,educationCertifications:10,portfolioProjects:10,atsFormattingReadability:10},score=Math.max(0,Math.min(100,Object.values(factors).reduce((sum,value)=>sum+value,0))),missingFields=[];
    if(!clean(profile.fullName))missingFields.push('full name');if(!profile.email)missingFields.push('email');if(!profile.phone)missingFields.push('phone');if(!profile.location)missingFields.push('location');if(!role)missingFields.push('target role');if(!skills.length)missingFields.push('skills');if(!experience)missingFields.push('experience');if(!education)missingFields.push('education');if(!profile.portfolioUrl&&!projects)missingFields.push('portfolio or projects');
    const issues=[];if(factors.contactIdentity<12)issues.push('Complete missing identity and contact fields.');if(factors.professionalSummary<7)issues.push('Add a concise target role, domain, and evidence-based summary.');if(factors.skills<14)issues.push('Add verified hard skills and tools relevant to the target role.');if(factors.experience<18)issues.push('Structure experience with employer, role, dates, responsibilities, and verified impact.');if(factors.educationCertifications<7)issues.push('Add clear education and relevant certifications when available.');if(factors.portfolioProjects<7)issues.push('Add relevant projects, work samples, or a verified portfolio link.');if(factors.atsFormattingReadability<7)issues.push('Use simple headings and avoid tables, columns, or unusual formatting.');
    const improved=Object.entries(factors).filter(([key,value])=>value>=max[key]*.75).map(([key])=>key.replace(/([A-Z])/g,' $1')),reduced=Object.entries(factors).filter(([key,value])=>value<max[key]*.5).map(([key])=>key.replace(/([A-Z])/g,' $1')),confidence=raw.length>500&&missingFields.length<=3?'High':raw.length>200?'Medium':'Low';
    return{score,factors,max,issues:issues.slice(0,5),topFixes:issues.slice(0,5),improved,reduced,missingFields,missingKeywords:roleTokens.filter(token=>!lower.includes(token)).slice(0,10),languageWarnings:[],weakBullets:bullets.filter(line=>!hasAction).slice(0,5),confidence,truthWarnings:/\[(?:missing|add|your)/i.test(raw)?['Resolve placeholders before using this resume.']:[]};
  }
  function generateAtsResume(profile = {}, tone = 'Corporate', targetRole = '') {
    const section = (title, value) => `${title}\n${clean(value) || 'Missing — add this manually'}`;
    const contact = [profile.email,profile.phone,profile.location].filter(Boolean).join(' | ');
    const links = [profile.portfolioUrl && `Portfolio: ${profile.portfolioUrl}`,profile.linkedinUrl && `LinkedIn: ${profile.linkedinUrl}`,profile.githubUrl && `GitHub: ${profile.githubUrl}`].filter(Boolean).join('\n');
    const summary = clean(profile.experienceSummary || profile.sections?.summary);
    const experience = section('PROFESSIONAL EXPERIENCE',profile.sections?.experience), projects = section('PROJECTS / PORTFOLIO HIGHLIGHTS',profile.sections?.projects), creativeFirst = ['Creative Professional','Freelance-focused','Design/Marketing-focused'].includes(tone);
    return [
      clean(profile.fullName) || 'Missing — add full name manually',
      clean(targetRole || profile.targetRole) || 'Missing — add target role manually',
      contact || 'Missing — add email, phone, and location manually',
      links || 'Missing — add portfolio, LinkedIn, or GitHub manually',
      '',section('PROFESSIONAL SUMMARY',summary),
      '',section('CORE SKILLS',(profile.skills || []).join(', ')),
      '',section('TOOLS',(profile.tools || []).join(', ')),
      '',...(creativeFirst?[projects,experience]:[experience,projects]),
      '',section('EDUCATION',profile.sections?.education),
      '',section('CERTIFICATIONS',profile.sections?.certifications),
      '',section('ADDITIONAL SKILLS',(profile.additionalSkills || []).join(', '))
    ].join('\n').replace(/\n{3,}/g,'\n\n');
  }
  function fieldValue(id) { return root.document?.querySelector(`#${id}`)?.value?.trim() || ''; }
  function mergeProfileForm(profile = {}) {
    const roles = unique(fieldValue('completeTargetRoles').split(','));
    const merged = { ...profile, email:fieldValue('completeEmail') || profile.email || '',phone:fieldValue('completePhone') || profile.phone || '',location:fieldValue('completeLocationPrimary') || profile.location || '',roles:roles.length ? roles : profile.roles || [],tools:unique(fieldValue('completeTools').split(',')),linkedinUrl:safeUrl(fieldValue('completeLinkedIn')),githubUrl:safeUrl(fieldValue('completeGitHub')),experienceSummary:fieldValue('completeExperienceSummary'),remotePreference:fieldValue('completeRemotePreference'),expectedCompensation:fieldValue('completeCompensation') };
    for (const key of ['email','phone','location','roles','tools','linkedinUrl','githubUrl','experienceSummary','remotePreference','expectedCompensation']) if (merged[key] && (!Array.isArray(merged[key]) || merged[key].length)) merged.confidence = { ...(merged.confidence || {}), [key]:'User-added' };
    return merged;
  }
  function enhanceProfileView(profile) {
    if (!root.document || !profile) return; const form = root.document.querySelector('.completion-form'), fit = root.document.querySelector('.profile-fit strong'), fitLabel = root.document.querySelector('.profile-fit small'); if (!form || root.document.querySelector('#completeEmail')) return;
    const escape = value => root.ScopeSecurity?.escapeHtml ? root.ScopeSecurity.escapeHtml(value || '') : clean(value).replace(/[<>&"]/g,''); const completeness = profileCompleteness(profile); if (fit) fit.textContent = completeness.percent; if (fitLabel) fitLabel.textContent = '% complete';
    const fields = root.document.createElement('div'); fields.className='extended-profile-fields'; fields.innerHTML=`<label>Email<input id="completeEmail" type="email" value="${escape(profile.email)}" placeholder="you@example.com"></label><label>Phone<input id="completePhone" value="${escape(profile.phone)}" placeholder="Verified phone number"></label><label>Current location<input id="completeLocationPrimary" value="${escape(profile.location)}" placeholder="City, country"></label><label>Additional target roles<textarea id="completeTargetRoles" placeholder="Comma-separated roles">${escape((profile.roles||[]).join(', '))}</textarea></label><label>Tools<textarea id="completeTools" placeholder="Comma-separated tools">${escape((profile.tools||[]).join(', '))}</textarea></label><label>LinkedIn URL<input id="completeLinkedIn" type="url" value="${escape(profile.linkedinUrl)}" placeholder="https://linkedin.com/in/..."></label><label>GitHub URL<input id="completeGitHub" type="url" value="${escape(profile.githubUrl)}" placeholder="https://github.com/..."></label><label>Remote preference<select id="completeRemotePreference"><option value="">Not specified</option><option ${profile.remotePreference==='Remote only'?'selected':''}>Remote only</option><option ${profile.remotePreference==='Hybrid'?'selected':''}>Hybrid</option><option ${profile.remotePreference==='On-site'?'selected':''}>On-site</option><option ${profile.remotePreference==='Flexible'?'selected':''}>Flexible</option></select></label><label>Expected salary / freelance rate<input id="completeCompensation" value="${escape(profile.expectedCompensation||profile.minRate)}" placeholder="Only if you choose to provide it"></label><label class="profile-wide">Experience summary<textarea id="completeExperienceSummary" placeholder="Verified professional summary">${escape(profile.experienceSummary)}</textarea></label>`; form.append(...fields.children);
    const status = root.document.createElement('div'); status.className='profile-confidence'; status.innerHTML=`<div><b>${completeness.percent}% complete</b><span>${completeness.missing.length?`Missing: ${escape(completeness.missing.join(', '))}`:'All core profile fields are complete.'}</span></div>${Object.entries(profile.confidence||{}).filter(([,value])=>typeof value==='string').slice(0,10).map(([key,value])=>`<span class="confidence-${value.toLowerCase().replace(/\W+/g,'-')}"><b>${escape(key.replace(/([A-Z])/g,' $1'))}</b>${escape(value)}</span>`).join('')}`;
    form.parentElement.insertBefore(status,form);
  }
  function initBuilder() {
    if (!root.document) return; const original=root.document.querySelector('#atsOriginal'); if (!original) return;
    let current=null; const render=()=>{if(!current)return;root.document.querySelector('#atsScore').textContent=current.analysis.score;root.document.querySelector('#atsScoreLabel').textContent=current.analysis.score>=80?'Strong':current.analysis.score>=60?'Review':'Needs work';root.document.querySelector('#atsSmartConfidence').textContent=`${current.analysis.confidence||(current.analysis.score>=80?'High':current.analysis.score>=60?'Medium':'Low')} confidence`;root.document.querySelector('#atsSectionScores').innerHTML=Object.entries(current.analysis.factors).map(([key,value])=>`<span><b>${value}/${current.analysis.max[key]}</b>${key.replace(/([A-Z])/g,' $1')}</span>`).join('');root.document.querySelector('#atsIssues').innerHTML=current.analysis.issues.length?current.analysis.issues.map(issue=>`<li>${root.ScopeSecurity.escapeHtml(issue)}</li>`).join(''):'<li>No major rule-based issues detected. Manual review is still required.</li>';const missing=[...(current.analysis.missingFields||[]),...(current.analysis.missingKeywords||[])];root.document.querySelector('#atsMissingKeywords').textContent=missing.length?`Missing or reduced score: ${missing.join(', ')}`:'No critical missing fields were detected.';root.document.querySelector('#atsImproved').value=current.generated;const warnings=current.analysis.truthWarnings||[];root.document.querySelector('#atsTruthWarning').textContent=warnings.length?`Some details are missing. Add them manually before using this resume. ${warnings.join(' ')}`:'Smart Draft Mode used only confirmed profile data. Manual review is still required.'};
    const analyze=()=>{const text=original.value.trim();if(text.length<80){root.toast('Paste more resume content before analysis');return}const smart=root.RoleDeskSmartEngine,review=smart?.analyzeResumeText(text,currentProfile(),fieldValue('atsTargetRole')),extracted=review?.extracted||extractProfile(text,currentProfile()),target=fieldValue('atsTargetRole')||extracted.targetRole,tone=fieldValue('atsTone')||'Corporate',analysis=analyzeAtsV6(text,extracted,target),generated=smart?.generateATSResume(extracted,{tone,targetRole:target})||generateAtsResume(extracted,tone,target);analysis.truthWarnings=[...(analysis.truthWarnings||[]),...(smart?.detectTruthWarnings(extracted,generated)||[])];current={extracted,analysis,generated,originalText:text,targetRole:target,tone};root.document.querySelector('#atsBuilderStatus').textContent='Analysis complete with transparent weighted scoring. Review every extracted field and warning.';root.RoleDeskAnalytics?.track?.('resume_analysis_completed',{page:'ats',metadata:{score:analysis.score,target_role:target,issues:analysis.issues.length}});root.RoleDeskMvp?.mark?.('ats');render()};
    root.document.querySelector('#atsAnalyze').onclick=()=>{root.document.querySelector('#atsBuilderStatus').textContent='Analyzing locally...';root.setTimeout(analyze,0)};
    root.document.querySelector('#atsImportProfile').onclick=()=>{const profile=currentProfile();original.value=profile.rawText||profile.text||'';root.document.querySelector('#atsTargetRole').value=profile.targetRole||'';root.toast(original.value?'Current profile imported':'Add a resume in My Profile first')};
    root.document.querySelector('#atsSyncProfile').onclick=()=>{if(!current)return root.toast('Analyze a resume first');root.RoleDeskState?.setProfile?.({...currentProfile(),...current.extracted,fileName:current.extracted.fileName||currentProfile().fileName||'ATS resume source',targetRole:current.targetRole,updatedAt:new Date().toISOString()});root.RoleDeskState?.save?.();root.RoleDeskState?.render?.();root.toast('Extracted fields imported for review')};
    const reviewedText=()=>root.document.querySelector('#atsImproved').value;
    root.document.querySelector('#atsEdit').onclick=()=>{root.document.querySelector('#atsImproved').focus();root.toast('ATS draft is ready for your edits')};
    root.document.querySelector('#atsCopy').onclick=()=>{if(!current)return root.toast('Generate a resume first');root.navigator.clipboard?.writeText(reviewedText());root.toast('ATS resume copied')};
    const download=(ext,type)=>{if(!current)return root.toast('Generate a resume first');const a=root.document.createElement('a');a.href=URL.createObjectURL(new Blob([reviewedText()],{type}));a.download=`roledesk-resume.${ext}`;a.click();URL.revokeObjectURL(a.href)};
    root.document.querySelector('#atsExportText').onclick=()=>download('txt','text/plain');root.document.querySelector('#atsExportMarkdown').onclick=()=>download('md','text/markdown');
    root.document.querySelector('#atsSaveVersion').onclick=async()=>{if(!current)return root.toast('Generate a resume first');const cloud=root.RoleDeskResumeCloud;if(!cloud?.isSignedIn())return root.toast('Sign in to save resume versions');try{const result=await cloud.saveVersion({versionName:fieldValue('atsVersionName')||`Resume ${new Date().toLocaleDateString()}`,originalText:current.originalText,extractedData:current.extracted,atsScore:current.analysis.score,issues:current.analysis,generatedText:reviewedText(),tone:current.tone,targetRole:current.targetRole});if(result){root.RoleDeskAnalytics?.track?.('resume_tailored',{page:'ats',metadata:{score:current.analysis.score,target_role:current.targetRole}});root.toast('Resume version saved');loadVersions()}else root.toast('Resume version could not be saved')}catch(error){root.RoleDeskAnalytics?.error?.(error,{page:'ats',severity:'warning'});root.toast(error?.message?.includes('column')?'Apply migration 003 before saving cloud versions':'Resume version could not be saved')}};
    async function loadVersions(){const node=root.document.querySelector('#atsVersions');let list=[];try{list=await root.RoleDeskResumeCloud?.listVersions?.()||[]}catch(error){node.innerHTML='<div class="ats-empty">Cloud resume versions need migration 003.</div>';return}node.innerHTML=list.length?list.map(item=>`<button type="button" data-resume-id="${item.id}"><b>${root.ScopeSecurity.escapeHtml(item.version_name||'Resume version')}</b><span>${item.ats_score??'-'} ATS · ${root.ScopeSecurity.escapeHtml(item.tone||'')}</span></button>`).join(''):'<div class="ats-empty">No saved cloud versions yet.</div>';node.querySelectorAll('[data-resume-id]').forEach(button=>button.onclick=()=>{const item=list.find(row=>row.id===button.dataset.resumeId);if(!item)return;const originalText=item.original_text||item.extracted_text||'',extracted={...currentProfile(),...(item.extracted_data||{})},targetRole=item.target_role||'',tone=item.tone||'Corporate';current={originalText,extracted,targetRole,tone,generated:item.generated_text||generateAtsResume(extracted,tone,targetRole),analysis:analyzeAtsV6(originalText,extracted,targetRole)};original.value=originalText;root.document.querySelector('#atsTargetRole').value=targetRole;root.document.querySelector('#atsTone').value=tone;render();root.toast('Saved version loaded')})}
    root.document.addEventListener('roledesk:cloud-ready',loadVersions);loadVersions();
  }
  const api={extractName,extractProfile,profileCompleteness,analyzeAts:analyzeAtsV6,generateAtsResume,mergeProfileForm,enhanceProfileView,initBuilder};
  if (root.document) root.addEventListener('DOMContentLoaded',()=>{const profile=currentProfile();if(profile.rawText||profile.text){const refreshed=extractProfile(profile.rawText||profile.text,profile);root.RoleDeskState?.setProfile?.(refreshed);root.RoleDeskState?.save?.();root.RoleDeskState?.render?.()}initBuilder()});
  return api;
});
