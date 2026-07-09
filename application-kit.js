(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RoleDeskApplicationKit = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const KIT_KEY = 'roledesk-application-kits-v1';
  const clean = value => String(value || '').replace(/\r/g, '').trim();
  const list = value => Array.isArray(value) ? value.filter(Boolean) : clean(value).split(/[,;\n]/).map(item => item.trim()).filter(Boolean);
  const unique = values => [...new Set(values.map(value => clean(value)).filter(Boolean))];
  const clamp = value => Math.max(0, Math.min(100, Math.round(value || 0)));
  const esc = value => root.ScopeSecurity?.escapeHtml ? root.ScopeSecurity.escapeHtml(value) : clean(value).replace(/[<>&"]/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[char]));
  const safeUrl = value => root.ScopeSecurity?.safeHttpUrl ? root.ScopeSecurity.safeHttpUrl(value) : (/^https?:\/\//i.test(clean(value)) ? clean(value) : '');
  const today = () => new Date().toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
  const profile = () => root.RoleDeskState?.getProfile?.() || {};
  const opportunities = () => root.RoleDeskState?.getOpportunities?.() || [];
  const opportunityText = opportunity => `${opportunity?.title || ''} ${opportunity?.client || opportunity?.company || ''} ${opportunity?.brief || opportunity?.description || ''} ${list(opportunity?.skills || opportunity?.tags).join(' ')}`;
  const tokens = value => unique(clean(value).toLowerCase().split(/[^a-z0-9+#.]+/).filter(token => token.length > 2));
  const download = (filename, content, type = 'text/plain') => {
    const document = root.document;
    if (!document) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  function loadKits() {
    try { return JSON.parse(root.localStorage?.getItem(KIT_KEY) || '[]') || []; }
    catch { return []; }
  }
  function saveKits(kits) {
    root.localStorage?.setItem(KIT_KEY, JSON.stringify(kits.slice(0, 100)));
  }
  function saveLocalKit(kit) {
    const kits = loadKits().filter(item => item.id !== kit.id);
    kits.unshift({ ...kit, updatedAt: new Date().toISOString() });
    saveKits(kits);
    return kit;
  }

  function compare(profileData = {}, opportunity = {}) {
    const resumeText = `${profileData.rawText || profileData.text || ''} ${profileData.experienceSummary || ''} ${Object.values(profileData.sections || {}).join(' ')}`.toLowerCase();
    const jobTokens = tokens(opportunityText(opportunity)).filter(token => !['remote','role','work','team','company','using','with','this','that','from','will','job'].includes(token));
    const profileSkills = unique([...list(profileData.skills), ...list(profileData.tools)]);
    const supported = unique(profileSkills.filter(skill => opportunityText(opportunity).toLowerCase().includes(skill.toLowerCase())));
    const addedKeywords = unique(jobTokens.filter(token => resumeText.includes(token))).slice(0, 12);
    const missingSkills = unique(profileSkills.length ? jobTokens.filter(token => !resumeText.includes(token)).slice(0, 10) : jobTokens.slice(0, 10));
    const originalScore = root.RoleDeskSmartEngine?.rankOpportunity?.(profileData, opportunity)?.score
      || root.RoleDeskTracker?.matchScore?.(opportunity)
      || 0;
    const readiness = root.RoleDeskOpportunityEngine?.readiness?.(profileData, opportunity)?.score || originalScore;
    const improvedScore = clamp(originalScore + Math.min(18, supported.length * 3 + addedKeywords.length));
    const warnings = [
      ...missingSkills.slice(0, 5).map(skill => `This skill or keyword was requested by the job but not found clearly in your resume: ${skill}. Add it only if true.`)
    ];
    if (!profileData.portfolioUrl && /portfolio|design|project|github|case study/i.test(opportunityText(opportunity))) warnings.push('Portfolio/project evidence is missing. Add a real link before applying if the role expects proof.');
    if (!profileData.email || !profileData.phone) warnings.push('Contact details are incomplete. Add real contact details before exporting.');
    return { originalScore:clamp(originalScore), improvedScore, readiness:clamp(readiness), supported, addedKeywords, missingSkills, warnings };
  }

  function contactLine(profileData = {}) {
    return [profileData.email, profileData.phone, profileData.location].filter(Boolean).join(' | ') || '[Add verified email, phone, and location]';
  }

  function buildTailoredResume(profileData = {}, opportunity = {}, analysis = compare(profileData, opportunity), targetRole = '') {
    const role = clean(targetRole || opportunity.title || profileData.targetRole || list(profileData.roles)[0]);
    const orderedSkills = unique([...analysis.supported, ...list(profileData.skills), ...list(profileData.tools)]).slice(0, 24);
    const summary = clean(profileData.experienceSummary || profileData.sections?.summary)
      || `Truthful ${role || 'candidate'} summary: add 2-3 lines based only on your real experience.`;
    return [
      clean(profileData.fullName || profileData.displayName) || '[Add your full name]',
      role || '[Add target role]',
      contactLine(profileData),
      [profileData.linkedinUrl && `LinkedIn: ${profileData.linkedinUrl}`, profileData.portfolioUrl && `Portfolio: ${profileData.portfolioUrl}`, profileData.githubUrl && `GitHub: ${profileData.githubUrl}`].filter(Boolean).join('\n'),
      '',
      'PROFESSIONAL SUMMARY',
      summary,
      '',
      'ROLE-FOCUSED SKILLS',
      orderedSkills.length ? orderedSkills.join(', ') : '[Add only skills you can genuinely support]',
      '',
      'PROFESSIONAL EXPERIENCE',
      clean(profileData.sections?.experience) || '[Add real roles, companies, dates, and truthful bullets]',
      '',
      'PROJECTS / PORTFOLIO',
      clean(profileData.sections?.projects) || '[Add relevant real projects or portfolio examples]',
      '',
      'EDUCATION',
      clean(profileData.sections?.education) || '[Add real education details]',
      '',
      'CERTIFICATIONS',
      clean(profileData.sections?.certifications) || '[Add only certifications present in your profile]'
    ].filter(line => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
  }

  function name(profileData = {}) {
    return clean(profileData.fullName || profileData.displayName) || '[Your name]';
  }
  function company(opportunity = {}) {
    return clean(opportunity.client || opportunity.company) || 'the hiring team';
  }
  function role(opportunity = {}) {
    return clean(opportunity.title) || 'the role';
  }

  function coverLetter(profileData = {}, opportunity = {}, tone = 'Professional', format = 'Full cover letter', analysis = compare(profileData, opportunity)) {
    const strengths = analysis.supported.slice(0, 4).join(', ') || '[Add 2-3 relevant verified strengths]';
    const portfolio = profileData.portfolioUrl ? `\n\nPortfolio: ${profileData.portfolioUrl}` : '\n\n[Add a verified portfolio/project link if relevant]';
    if (/short|note/i.test(format)) return `Hi ${company(opportunity)} team,\n\nI am interested in ${role(opportunity)}. My relevant strengths include ${strengths}. I can connect my resume and portfolio evidence to the requirements and would be glad to discuss fit.\n\nBest,\n${name(profileData)}`;
    if (/linkedin/i.test(format)) return `Hi, I saw the ${role(opportunity)} opportunity at ${company(opportunity)}. My background includes ${strengths}. Would it be okay if I shared my resume/portfolio for review?`;
    return `${today()}\n\nDear ${company(opportunity)} team,\n\nI am applying for ${role(opportunity)}. What stood out to me is the need for ${analysis.addedKeywords.slice(0, 3).join(', ') || 'a practical, role-aligned contribution'}.\n\nMy relevant experience includes ${strengths}. I have kept this application based only on the information present in my reviewed resume and profile, and I can provide examples or portfolio evidence where required.${portfolio}\n\nI would welcome the chance to discuss how I can contribute to this role.\n\nSincerely,\n${name(profileData)}`;
  }

  function recruiterEmail(profileData = {}, opportunity = {}, type = 'Initial application email', analysis = compare(profileData, opportunity)) {
    const strengths = analysis.supported.slice(0, 3).join(', ') || '[verified strengths]';
    const subject = type.includes('Follow-up') ? `Follow-up: ${role(opportunity)}` : `Application: ${role(opportunity)}`;
    const body = type.includes('thank') || type.includes('Thank')
      ? `Hi team,\n\nThank you for speaking with me about ${role(opportunity)}. I appreciated learning more about the opportunity and remain interested.\n\nBest,\n${name(profileData)}`
      : type.includes('Referral')
        ? `Hi,\n\nI noticed ${role(opportunity)} at ${company(opportunity)} and believe my background in ${strengths} may be relevant. If you feel comfortable, would you be open to pointing me toward the right person or referral route?\n\nBest,\n${name(profileData)}`
        : `Hi team,\n\nI am interested in ${role(opportunity)} at ${company(opportunity)}. My relevant strengths include ${strengths}.\n\nResume/portfolio: ${profileData.portfolioUrl || '[Add verified link if available]'}\n\nWould you be open to reviewing my application?\n\nBest,\n${name(profileData)}`;
    return { subject, body };
  }

  function linkedInMessages(profileData = {}, opportunity = {}, analysis = compare(profileData, opportunity)) {
    const strengths = analysis.supported.slice(0, 2).join(', ') || 'relevant experience';
    return {
      short: `Hi, I saw ${role(opportunity)} at ${company(opportunity)}. My background includes ${strengths}. Could I connect and share my resume?`,
      detailed: `Hi, I noticed the ${role(opportunity)} role at ${company(opportunity)}. I have relevant experience in ${strengths} and would appreciate the chance to share my resume/portfolio if useful.`,
      followUp: `Hi, just following up on ${role(opportunity)}. I am still interested and happy to share a concise resume/portfolio link for review.`
    };
  }

  function freelanceProposal(profileData = {}, opportunity = {}, analysis = compare(profileData, opportunity)) {
    const strengths = analysis.supported.slice(0, 3).join(', ') || '[verified strengths]';
    return `Hi,\n\nI reviewed the ${role(opportunity)} brief. My understanding is that you need help with ${analysis.addedKeywords.slice(0, 4).join(', ') || 'the listed deliverables'}.\n\nRelevant experience: ${strengths}.\n\nSuggested next step: confirm scope, timeline, success criteria, and any brand/product assets before I quote final pricing. I will not assume a rate until you confirm the budget and deliverables.\n\nQuestions:\n1. What is the most important outcome for the first milestone?\n2. Are examples, brand assets, or technical requirements already available?\n3. What timeline and review process should I plan around?\n\nBest,\n${name(profileData)}`;
  }

  function quality(text = '', analysis = {}, type = 'asset') {
    const words = clean(text).split(/\s+/).filter(Boolean).length;
    const warnings = [];
    if (words < 35) warnings.push('Too short for a complete application asset.');
    if (words > 650 && !/resume/i.test(type)) warnings.push('Consider shortening this draft.');
    if (/\[(?:add|your|verified|missing)/i.test(text)) warnings.push('Resolve placeholders before use.');
    if ((analysis.supported || []).length < 2) warnings.push('Add more profile-supported role evidence.');
    const truth = root.RoleDeskSmartEngine?.detectTruthWarnings?.(profile(), text) || [];
    return { score:clamp(88 - warnings.length * 12 - truth.length * 10 + Math.min(8, (analysis.supported || []).length * 2)), fixes:unique([...warnings, ...truth]) };
  }

  function buildKit(opportunityId, options = {}) {
    const profileData = profile();
    const opportunity = opportunities().find(item => String(item.id) === String(opportunityId)) || opportunities()[0] || {};
    const analysis = compare(profileData, opportunity);
    const targetRole = clean(options.targetRole || opportunity.title || profileData.targetRole);
    const tailoredResume = buildTailoredResume(profileData, opportunity, analysis, targetRole);
    const cover = coverLetter(profileData, opportunity, options.tone || 'Professional', options.coverFormat || 'Full cover letter', analysis);
    const email = recruiterEmail(profileData, opportunity, options.emailType || 'Initial application email', analysis);
    const linkedin = linkedInMessages(profileData, opportunity, analysis);
    const followUp = recruiterEmail(profileData, opportunity, 'Follow-up after no reply', analysis).body;
    const proposal = freelanceProposal(profileData, opportunity, analysis);
    const assets = { tailoredResume, coverLetter:cover, recruiterEmail:`Subject: ${email.subject}\n\n${email.body}`, linkedInMessage:`Short:\n${linkedin.short}\n\nDetailed:\n${linkedin.detailed}\n\nFollow-up:\n${linkedin.followUp}`, followUpEmail:followUp, freelanceProposal:proposal };
    const assetQuality = Object.fromEntries(Object.entries(assets).map(([key, text]) => [key, quality(text, analysis, key)]));
    const checklist = [
      ['Resume tailored', !/\[Add|\[Your|\[verified/i.test(tailoredResume)],
      ['Cover letter ready', !assetQuality.coverLetter.fixes.length],
      ['Portfolio link included', Boolean(profileData.portfolioUrl)],
      ['Correct email/application link available', Boolean(opportunity.email || opportunity.verifiedEmail || safeUrl(opportunity.applicationUrl || opportunity.url))],
      ['Recruiter email verified or official apply link available', Boolean(opportunity.verifiedEmail || safeUrl(opportunity.applicationUrl || opportunity.url))],
      ['Follow-up date selected', Boolean(opportunity.followup?.nextAt || opportunity.communication?.followUpDate)],
      ['Pipeline stage updated', Boolean(opportunity.status)],
      ['Salary/location fit checked', Boolean(opportunity.salary || opportunity.budget || opportunity.country || opportunity.location)],
      ['Missing skills reviewed', analysis.missingSkills.length < 1]
    ].map(([label, done]) => ({ label, done:Boolean(done) }));
    const suggestions = unique([
      !profileData.portfolioUrl && 'Add one verified portfolio/project link before applying.',
      analysis.missingSkills.length && `Review missing skills/keywords: ${analysis.missingSkills.slice(0, 4).join(', ')}. Add only if true.`,
      analysis.supported.length < 3 && 'Move the most relevant verified skills higher in the resume.',
      !(opportunity.verifiedEmail || opportunity.email) && 'No verified email found. Apply through the official listing link.',
      !/\d/.test(profileData.sections?.experience || profileData.rawText || '') && 'Your resume lacks measurable results. Add real numbers where possible.'
    ]).filter(Boolean);
    return {
      id:`kit-${Date.now()}`,
      opportunityId: opportunity.id || null,
      opportunityTitle: role(opportunity),
      company: company(opportunity),
      createdAt:new Date().toISOString(),
      targetRole, tone:options.tone || 'Professional',
      scores:{ resumeMatch:analysis.originalScore, improvedMatch:analysis.improvedScore, readiness:analysis.readiness, quality:root.RoleDeskOpportunityEngine?.quality?.(opportunity)?.score || opportunity.qualityScore || 0, trust:opportunity.trustScore || 0 },
      analysis, assets, assetQuality, checklist, suggestions,
      truthWarnings:unique([...analysis.warnings, ...Object.values(assetQuality).flatMap(item => item.fixes)]),
      route:{ applicationUrl:safeUrl(opportunity.applicationUrl || opportunity.url), verifiedEmail:opportunity.verifiedEmail || opportunity.email || '', status:opportunity.status || 'Discovered' }
    };
  }

  function render() {
    const document = root.document;
    const shell = document?.querySelector('#applicationKitRoot');
    if (!shell) return;
    const ops = opportunities();
    if (!ops.length) {
      shell.innerHTML = '<div class="smart-empty"><h3>No saved opportunity yet</h3><p>Run Smart Search or import an opportunity, then return here to build a complete application kit.</p></div>';
      return;
    }
    shell.innerHTML = `
      <div class="kit-controls">
        <label>Opportunity<select id="kitOpportunity">${ops.map(item => `<option value="${esc(item.id)}">${esc(item.title)} · ${esc(item.client || item.company || 'Company missing')}</option>`).join('')}</select></label>
        <label>Tone<select id="kitTone"><option>Professional</option><option>Confident</option><option>Short and direct</option><option>Warm and human</option><option>Senior-level</option><option>Creative role</option><option>Technical role</option></select></label>
        <label>Cover format<select id="kitCoverFormat"><option>Full cover letter</option><option>Short application note</option><option>Email body</option><option>LinkedIn message version</option></select></label>
        <button class="button primary" id="kitGenerate" type="button">Build Application Kit</button>
      </div>
      <div id="kitOutput"><div class="smart-empty"><h3>Ready when you are</h3><p>Choose a saved opportunity and generate a truthful, editable kit.</p></div></div>
      <section class="kit-history"><div class="section-heading"><div><span class="eyebrow">Saved locally</span><h3>Recent application kits</h3></div></div><div id="kitHistory"></div></section>`;
    const renderHistory = () => {
      const history = loadKits();
      const node = document.querySelector('#kitHistory');
      node.innerHTML = history.length ? history.slice(0, 8).map(kit => `<button type="button" data-kit-id="${esc(kit.id)}"><b>${esc(kit.opportunityTitle)}</b><span>${esc(kit.company)} · ${new Date(kit.createdAt).toLocaleDateString()}</span></button>`).join('') : '<div class="smart-empty">No saved kits yet.</div>';
      node.querySelectorAll('[data-kit-id]').forEach(button => button.onclick = () => renderKit(history.find(item => item.id === button.dataset.kitId)));
    };
    document.querySelector('#kitGenerate').onclick = () => {
      if (root.RoleDeskBilling && !root.RoleDeskBilling.consume('application_kit')) return;
      const kit = buildKit(document.querySelector('#kitOpportunity').value, { tone:document.querySelector('#kitTone').value, coverFormat:document.querySelector('#kitCoverFormat').value });
      root.RoleDeskAnalytics?.track?.('application_kit_generated', { page:'kit', metadata:{ opportunity_id:String(kit.opportunityId || ''), readiness:kit.scores.readiness, trust:kit.scores.trust } });
      root.RoleDeskAnalytics?.track?.('resume_tailored', { page:'kit', metadata:{ opportunity_id:String(kit.opportunityId || ''), score:kit.scores.improvedMatch } });
      root.RoleDeskAnalytics?.track?.('cover_letter_generated', { page:'kit', metadata:{ opportunity_id:String(kit.opportunityId || ''), quality:kit.assetQuality.coverLetter?.score } });
      root.RoleDeskAnalytics?.track?.('email_draft_generated', { page:'kit', metadata:{ opportunity_id:String(kit.opportunityId || ''), draft_type:'recruiter_email', quality:kit.assetQuality.recruiterEmail?.score } });
      renderKit(kit);
    };
    renderHistory();
  }

  function renderKit(kit) {
    const document = root.document;
    const output = document?.querySelector('#kitOutput');
    if (!output || !kit) return;
    const assetLabels = { tailoredResume:'Tailored resume', coverLetter:'Cover letter', recruiterEmail:'Recruiter email', linkedInMessage:'LinkedIn message', followUpEmail:'Follow-up email', freelanceProposal:'Freelance proposal' };
    output.innerHTML = `
      <article class="application-kit-card">
        <div class="kit-head"><div><span class="eyebrow coral">Application Kit</span><h2>${esc(kit.opportunityTitle)}</h2><p>${esc(kit.company)} · Draft-first, review-required workflow</p></div><span class="kit-status">Not sent · Not applied</span></div>
        <div class="kit-score-grid">
          <span><b>${kit.scores.resumeMatch}</b>Original match</span><span><b>${kit.scores.improvedMatch}</b>Tailored match</span><span><b>${kit.scores.readiness}</b>Readiness</span><span><b>${kit.scores.quality}</b>Quality</span><span><b>${kit.scores.trust}</b>Trust</span>
        </div>
        <div class="kit-warning"><strong>Truth guardrails</strong><ul>${(kit.truthWarnings.length ? kit.truthWarnings : ['No unsupported claim detected by local checks. Manual review is still required.']).map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>
        <div class="kit-layout">
          <aside><h3>Checklist</h3>${kit.checklist.map(item => `<label class="kit-check ${item.done ? 'done' : ''}"><input type="checkbox" ${item.done ? 'checked' : ''}> ${esc(item.label)}</label>`).join('')}<h3>Suggestions</h3><ul class="kit-suggestions">${kit.suggestions.map(item => `<li>${esc(item)}</li>`).join('')}</ul></aside>
          <section class="kit-assets">${Object.entries(kit.assets).map(([key, value]) => `<article><div class="kit-asset-head"><div><span class="eyebrow">${esc(assetLabels[key])}</span><strong>${kit.assetQuality[key].score}/100 quality</strong></div><div><button class="text-button" data-copy-asset="${key}" type="button">Copy</button><button class="text-button" data-export-asset="${key}" data-format="txt" type="button">TXT</button><button class="text-button" data-export-asset="${key}" data-format="doc" type="button">Word</button>${/resume|cover/i.test(key) ? `<button class="text-button" data-print-asset="${key}" type="button">PDF</button>` : ''}</div></div><textarea data-asset="${key}">${esc(value)}</textarea><ul>${(kit.assetQuality[key].fixes.length ? kit.assetQuality[key].fixes : ['Looks usable after manual review.']).map(item => `<li>${esc(item)}</li>`).join('')}</ul></article>`).join('')}</section>
        </div>
        <div class="kit-actions"><button class="button secondary" id="kitSave" type="button">Save kit</button><button class="button secondary" id="kitExportAll" type="button">Export all TXT</button><button class="button secondary" id="kitScheduleFollowup" type="button">Schedule follow-up</button><button class="button primary" id="kitMarkApplied" type="button">Mark applied manually</button></div>
        <p class="kit-safety">RoleDesk does not send, apply, submit forms, bid, sign, or contact anyone. You copy/export and submit only after review.</p>
      </article>`;
    const currentAssets = () => Object.fromEntries([...document.querySelectorAll('[data-asset]')].map(node => [node.dataset.asset, node.value]));
    output.querySelectorAll('[data-copy-asset]').forEach(button => button.onclick = () => { root.navigator?.clipboard?.writeText(currentAssets()[button.dataset.copyAsset]); root.RoleDeskAnalytics?.track?.(button.dataset.copyAsset === 'recruiterEmail' ? 'email_copied' : 'export_created', { page:'kit', metadata:{ action:'copy', asset:button.dataset.copyAsset } }); root.toast?.('Copied for review'); });
    output.querySelectorAll('[data-export-asset]').forEach(button => button.onclick = () => {
      if (root.RoleDeskBilling && !root.RoleDeskBilling.consume('export')) return;
      const assets = currentAssets(), key = button.dataset.exportAsset, ext = button.dataset.format === 'doc' ? 'doc' : 'txt';
      download(`roledesk-${key}.${ext}`, assets[key], ext === 'doc' ? 'application/msword' : 'text/plain');
      root.RoleDeskAnalytics?.track?.('export_created', { page:'kit', metadata:{ asset:key, format:ext } });
      root.RoleDeskApplicationKitCloud?.recordExport?.(kit, key, ext).catch(() => {});
    });
    output.querySelectorAll('[data-print-asset]').forEach(button => button.onclick = () => printAsset(button.dataset.printAsset, currentAssets()[button.dataset.printAsset]));
    document.querySelector('#kitExportAll').onclick = () => { if (root.RoleDeskBilling && !root.RoleDeskBilling.consume('export')) return; download(`roledesk-application-kit-${Date.now()}.txt`, Object.entries(currentAssets()).map(([key, text]) => `${assetLabels[key].toUpperCase()}\n${text}`).join('\n\n---\n\n')); root.RoleDeskAnalytics?.track?.('export_created', { page:'kit', metadata:{ asset:'application_kit', format:'txt' } }); };
    document.querySelector('#kitSave').onclick = async () => {
      kit.assets = currentAssets();
      saveLocalKit(kit);
      await root.RoleDeskApplicationKitCloud?.saveKit?.(kit).catch(() => null);
      root.RoleDeskMvp?.mark?.('packet');
      root.toast?.('Application kit saved');
      render();
    };
    document.querySelector('#kitMarkApplied').onclick = () => {
      if (!root.confirm?.('Mark this opportunity as applied manually? RoleDesk will not submit anything.')) return;
      root.RoleDeskState?.updateOpportunity?.(kit.opportunityId, { status:'Applied', appliedAt:new Date().toISOString(), applicationKitPrepared:true });
      root.RoleDeskAnalytics?.track?.('job_marked_applied', { page:'kit', metadata:{ opportunity_id:String(kit.opportunityId || '') } });
      root.toast?.('Marked applied manually');
    };
    document.querySelector('#kitScheduleFollowup').onclick = () => {
      const date = root.prompt?.('Follow-up date (YYYY-MM-DD)');
      if (!date) return;
      if (root.RoleDeskBilling && !root.RoleDeskBilling.consume('followup')) return;
      root.RoleDeskState?.updateOpportunity?.(kit.opportunityId, { status:'Follow-Up Needed', followup:{ nextAt:date, status:'scheduled', notes:'Scheduled from Application Kit' } });
      root.RoleDeskAnalytics?.track?.('followup_scheduled', { page:'kit', metadata:{ opportunity_id:String(kit.opportunityId || ''), date } });
      root.toast?.('Follow-up scheduled');
    };
  }

  function printAsset(key, text) {
    const win = root.open('', '_blank', 'noopener');
    if (!win) return root.toast?.('Popup blocked. Use TXT/Word export instead.');
    win.document.write(`<title>RoleDesk ${esc(key)}</title><style>body{font-family:Arial,sans-serif;line-height:1.5;padding:32px;white-space:pre-wrap;color:#111} @media print{button{display:none}}</style><button onclick="print()">Save as PDF / Print</button><main>${esc(text)}</main>`);
    win.document.close();
  }

  const api = Object.freeze({ compare, buildKit, render, loadKits, saveLocalKit, quality });
  if (root.document) root.addEventListener('DOMContentLoaded', render);
  return api;
});
