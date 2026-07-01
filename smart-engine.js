(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RoleDeskSmartEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const designRoles = ['graphic designer','visual designer','brand designer','creative designer','marketing designer','campaign designer','social media designer','motion designer','video editor','ui visual designer'];
  const wrongDesignRoles = ['product manager','engineer','developer','backend','frontend','office assistant','sales','accounting','unrelated admin'];
  const requiredFields = [['full name','fullName'],['email','email'],['phone','phone'],['location','location'],['target role','targetRole'],['skills','skills'],['tools','tools'],['portfolio','portfolioUrl'],['LinkedIn','linkedinUrl'],['experience summary','experienceSummary']];
  const clean = value => String(value || '').trim();
  const unique = values => [...new Set(values.map(value => clean(value)).filter(Boolean))];
  const list = value => Array.isArray(value) ? value : clean(value).split(',').map(item => item.trim()).filter(Boolean);
  const tokens = value => unique(clean(value).toLowerCase().split(/[^a-z0-9+#]+/).filter(token => token.length > 2));
  const clamp = value => Math.max(0, Math.min(100, Math.round(value)));
  const resumeApi = () => root?.RoleDeskResume || {};

  function detectMissingProfileFields(profile = {}) {
    return requiredFields.filter(([,key]) => {
      const value = profile[key] || (key === 'targetRole' ? list(profile.roles)[0] : '');
      return Array.isArray(value) ? !value.length : !clean(value);
    }).map(([label]) => label);
  }

  function scoreATSResume(resumeText, profile = {}, targetRole = '') {
    const api = resumeApi();
    if (api.analyzeAts) return api.analyzeAts(resumeText, profile, targetRole);
    const text = clean(resumeText), lower = text.toLowerCase(), skills = list(profile.skills), tools = list(profile.tools), role = clean(targetRole || profile.targetRole || list(profile.roles)[0]);
    const factors = {
      contact: profile.email && profile.phone ? 12 : profile.email || profile.phone ? 6 : 0,
      role: role ? 10 : 0,
      summary: clean(profile.experienceSummary).length >= 50 ? 10 : 0,
      skills: Math.min(12, skills.length * 2),
      tools: Math.min(8, tools.length * 2),
      experience: /experience|employment|work history/i.test(text) ? 14 : 0,
      achievements: /\b\d+(?:\.\d+)?%|\b\d+\+/i.test(text) ? 10 : 0,
      links: profile.portfolioUrl && profile.linkedinUrl ? 6 : profile.portfolioUrl || profile.linkedinUrl || profile.githubUrl ? 3 : 0,
      formatting: /\t|\|{2,}|<table/i.test(text) ? 0 : 5,
      keywords: role && tokens(role).some(token => lower.includes(token)) ? 8 : 2,
      readability: text.length >= 250 && text.split('\n').filter(Boolean).length >= 6 ? 5 : 2
    };
    const score = Math.round(Object.values(factors).reduce((sum,value) => sum + value, 0) / 5) * 5;
    const issues = [];
    if (factors.contact < 12) issues.push('Add a clear email and phone number.');
    if (!factors.role) issues.push('Add a specific target role.');
    if (!factors.summary) issues.push('Add a concise, verified professional summary.');
    if (factors.skills < 8) issues.push('Add relevant skills that you can verify.');
    if (!factors.experience) issues.push('Add a structured experience section.');
    return { score:clamp(score), factors, max:{contact:12,role:10,summary:10,skills:12,tools:8,experience:14,achievements:10,links:6,formatting:5,keywords:8,readability:5}, issues, missingKeywords:tokens(role).filter(token => !lower.includes(token)), truthWarnings:[] };
  }

  function analyzeResumeText(resumeText, profile = {}, targetRole = '') {
    const api = resumeApi();
    const extracted = api.extractProfile ? api.extractProfile(resumeText, profile) : { ...profile, rawText:clean(resumeText), text:clean(resumeText) };
    if (targetRole) extracted.targetRole = targetRole;
    const ats = scoreATSResume(resumeText, extracted, targetRole || extracted.targetRole);
    const missingFields = detectMissingProfileFields(extracted);
    return { extracted, missingFields, confidence:extracted.confidence || {}, atsIssues:ats.issues, improvementSuggestions:unique([...ats.issues, ...missingFields.map(field => `Review missing ${field}.`)]), ats };
  }

  function generateATSResume(profile = {}, options = {}) {
    const api = resumeApi(), targetRole = options.targetRole || profile.targetRole || list(profile.roles)[0] || '', tone = options.tone || 'Corporate';
    if (api.generateAtsResume) return api.generateAtsResume(profile, tone, targetRole).replace(/Missing\s+[—-]\s+[^\n]+/g, '[Add details]');
    const section = (title,value) => `${title}\n${clean(value) || '[Add details]'}`;
    return [clean(profile.fullName)||'[Add details]',clean(targetRole)||'[Add details]',[profile.email,profile.phone,profile.location].filter(Boolean).join(' | ')||'[Add details]',section('PROFESSIONAL SUMMARY',profile.experienceSummary),section('CORE SKILLS',list(profile.skills).join(', ')),section('TOOLS',list(profile.tools).join(', ')),section('PROFESSIONAL EXPERIENCE',profile.sections?.experience),section('PROJECTS / PORTFOLIO HIGHLIGHTS',profile.sections?.projects),section('EDUCATION',profile.sections?.education),section('CERTIFICATIONS',profile.sections?.certifications),section('ADDITIONAL SKILLS',list(profile.additionalSkills).join(', '))].join('\n\n');
  }

  function rankOpportunity(profile = {}, opportunity = {}) {
    const title = clean(opportunity.title).toLowerCase(), description = clean(opportunity.description || opportunity.brief).toLowerCase(), text = `${title} ${description} ${list(opportunity.skills || opportunity.tags).join(' ')}`.toLowerCase();
    const profileSkills = unique([...list(profile.skills), ...list(profile.tools)]), profileTokens = tokens(profileSkills.join(' ')), roleText = `${profile.targetRole || ''} ${list(profile.roles).join(' ')}`.toLowerCase(), roleTokens = tokens(roleText);
    const matchedKeywords = unique([...profileSkills.filter(skill => text.includes(skill.toLowerCase())), ...roleTokens.filter(token => text.includes(token))]).slice(0,10);
    const missingKeywords = profileSkills.filter(skill => !text.includes(skill.toLowerCase())).slice(0,8);
    const designProfile = /design|creative|brand|visual|motion|video|figma|photoshop/i.test(`${roleText} ${profileSkills.join(' ')}`);
    const roleBoost = designProfile ? designRoles.filter(role => title.includes(role)).length * 25 : roleTokens.filter(token => title.includes(token)).length * 10;
    const wrongRoles = designProfile ? wrongDesignRoles.filter(role => title.includes(role)) : [];
    const titleRelevance = Math.min(35, roleBoost + roleTokens.filter(token => title.includes(token)).length * 7);
    const skillMatch = Math.min(28, matchedKeywords.length * 6);
    const toolMatch = Math.min(8, list(profile.tools).filter(tool => text.includes(tool.toLowerCase())).length * 3);
    const industryMatch = Math.min(5, list(profile.industries).filter(industry => text.includes(industry.toLowerCase())).length * 3);
    const remoteMatch = opportunity.remote && /remote|flexible/i.test(`${profile.remotePreference || ''} ${profile.preferredLocation || ''}`) ? 7 : opportunity.remote ? 4 : 0;
    const locationMatch = profile.preferredLocation && text.includes(clean(profile.preferredLocation).toLowerCase()) ? 4 : 0;
    const experienceMatch = profile.years && new RegExp(`\\b${profile.years}\\+?\\s*years?`,'i').test(description) ? 5 : 0;
    const budgetPresence = opportunity.salary || opportunity.budget ? 4 : 0;
    const missingPenalty = Math.min(12, missingKeywords.length * 1.5), wrongRolePenalty = wrongRoles.length ? 45 : 0;
    const riskFlags = [];
    if (wrongRoles.length) riskFlags.push(`Unrelated role signal: ${wrongRoles.join(', ')}.`);
    if (/unpaid|free trial|commission only|telegram|whatsapp/i.test(description)) riskFlags.push('Possible unpaid-work or off-platform contact risk.');
    if (!opportunity.salary && !opportunity.budget) riskFlags.push('Compensation is not stated.');
    const score = clamp(titleRelevance + skillMatch + toolMatch + industryMatch + remoteMatch + locationMatch + experienceMatch + budgetPresence - missingPenalty - wrongRolePenalty);
    const confidenceScore = clamp(35 + (title ? 15 : 0) + (description.length > 120 ? 20 : 0) + matchedKeywords.length * 5 + (opportunity.salary || opportunity.budget ? 10 : 0));
    return { score, confidenceScore, matchedKeywords, missingKeywords, reason:matchedKeywords.length ? `Matched ${matchedKeywords.slice(0,4).join(', ')}.` : 'Little direct evidence matched the reviewed profile.', riskFlags, breakdown:{titleRelevance,skillMatch,toolMatch,industryMatch,remoteMatch,locationMatch,experienceMatch,budgetPresence,missingPenalty,wrongRolePenalty} };
  }

  function draftFacts(profile = {}, opportunity = {}) {
    const name = clean(profile.fullName || profile.displayName) || '[Your name]', company = clean(opportunity.client || opportunity.company), contactName = clean(opportunity.contactName || opportunity.recipientName), title = clean(opportunity.title) || '[opportunity]', opportunityText = `${title} ${opportunity.description || opportunity.brief || ''} ${list(opportunity.skills).join(' ')}`.toLowerCase();
    const skills = list(profile.skills).filter(skill => opportunityText.includes(skill.toLowerCase())).slice(0,3), strengths = skills.length ? skills : list(profile.skills).slice(0,3), tools = list(profile.tools).filter(tool => opportunityText.includes(tool.toLowerCase())).slice(0,2), portfolio = clean(profile.portfolioUrl), availability = clean(profile.availability);
    const warnings = [];
    if (name === '[Your name]') warnings.push('Missing name — add it before using this draft.');
    if (!strengths.length) warnings.push('Missing relevant strengths — add verified skills.');
    if (!portfolio) warnings.push('Missing portfolio — no link was invented.');
    if (!profile.email && !profile.phone) warnings.push('Missing contact details.');
    return { name, company, title, strengths, tools, portfolio, availability, warnings, greeting:contactName ? `Hi ${contactName},` : 'Hi team,' };
  }

  function detectTruthWarnings(profile = {}, generatedText = '') {
    const source = `${profile.rawText || profile.text || ''} ${profile.sections ? Object.values(profile.sections).join(' ') : ''} ${profile.years ? `${profile.years} years` : ''}`;
    const warnings = detectMissingProfileFields(profile).filter(field => ['full name','portfolio','email','phone'].includes(field)).map(field => `Missing ${field}.`);
    const claimedYears = [...clean(generatedText).matchAll(/\b(\d{1,2})\+?\s+years?\b/gi)].map(match => match[1]);
    if (claimedYears.some(year => !new RegExp(`\\b${year}\\+?\\s+(?:years?|yrs?)\\b`,'i').test(source))) warnings.push('Possible unsupported years-of-experience claim.');
    const metrics = [...clean(generatedText).matchAll(/\b\d+(?:\.\d+)?%/g)].map(match => match[0]);
    if (metrics.some(metric => !source.includes(metric))) warnings.push('Possible unsupported metric.');
    const organizations = [...clean(generatedText).matchAll(/\b(?:at|with)\s+([A-Z][A-Za-z&.-]+(?:\s+[A-Z][A-Za-z&.-]+){0,3})/g)].map(match => match[1]);
    if (organizations.some(name => !source.toLowerCase().includes(name.toLowerCase()))) warnings.push('Possible unsupported company or client name.');
    if (/world[- ]class|guaranteed results|industry[- ]leading|expert in/i.test(generatedText)) warnings.push('Possible generic claim or overclaim.');
    if (/\[(?:your name|add|missing)/i.test(generatedText)) warnings.push('Resolve all placeholders before use.');
    return unique(warnings);
  }

  function generateProposalDraft(profile = {}, opportunity = {}, tone = 'Professional') {
    const facts = draftFacts(profile, opportunity), strengths = facts.strengths.length ? facts.strengths.join(', ') : '[Add 2–3 verified strengths]', tools = facts.tools.length ? ` I also use ${facts.tools.join(' and ')} where relevant.` : '', proof = facts.portfolio ? `Portfolio: ${facts.portfolio}` : '[Add a verified portfolio link or example]', availability = facts.availability ? `My reviewed availability is ${facts.availability}.` : 'I can confirm timing after reviewing the final scope.';
    const text = `${facts.greeting}\n\nI reviewed the ${facts.title} opportunity. My relevant strengths include ${strengths}.${tools}\n\n${proof}\n\nI would start by confirming the priority outcome and deliverables, then share a focused first direction for review. ${availability}\n\nWould it be useful to align on the first milestone and success criteria?\n\nBest,\n${facts.name}`;
    const warnings = unique([...facts.warnings, ...detectTruthWarnings(profile,text)]);
    return { text, warnings, confidenceScore:Math.max(20, clamp(90 - warnings.length * 12)), mode:'Smart Draft Mode', tone };
  }

  function generateEmailDraft(profile = {}, opportunity = {}, tone = 'Concise') {
    const proposal = generateProposalDraft(profile, opportunity, tone), title = clean(opportunity.title) || 'opportunity';
    return { ...proposal, subject:`Interest in ${title}`, text:proposal.text, confidenceScore:clamp(proposal.confidenceScore + 2) };
  }

  function generateFollowUpDraft(profile = {}, opportunity = {}) {
    const facts = draftFacts(profile, opportunity), text = `${facts.greeting}\n\nI’m following up on the ${facts.title} opportunity. I’m still interested and can confirm a focused first-step plan once the scope and timing are clear.\n\nHas anything changed in the priorities or timeline?\n\nBest,\n${facts.name}`;
    const warnings = unique([...facts.warnings, ...detectTruthWarnings(profile,text)]);
    return { text, warnings, confidenceScore:Math.max(20, clamp(88 - warnings.length * 12)), mode:'Smart Draft Mode' };
  }

  return Object.freeze({ analyzeResumeText, generateATSResume, scoreATSResume, rankOpportunity, generateProposalDraft, generateEmailDraft, generateFollowUpDraft, detectMissingProfileFields, detectTruthWarnings });
});
