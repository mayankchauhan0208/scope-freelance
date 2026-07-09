(function () {
  const root = window;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => root.ScopeSecurity.escapeHtml(String(value ?? ''));
  const GOALS_KEY = 'roledesk-career-goals-v1';
  const PREFS_KEY = 'roledesk-notification-preferences-v1';
  const STATE_KEY = 'roledesk-onboarding-state-v1';
  let step = 0;
  const steps = ['welcome','profile','resume','goals','sources','notifications','success'];
  const defaultPrefs = { followups:true, dailyPlan:false, strongMatches:true, emailDelivery:false, interviews:true, productUpdates:false };

  function ownerKey(base) {
    return `${base}:${localStorage.getItem('scope-cache-owner-v1') || 'local'}`;
  }
  function read(key, fallback = {}) {
    try { return JSON.parse(localStorage.getItem(ownerKey(key)) || 'null') || fallback; }
    catch { return fallback; }
  }
  function write(key, value) {
    localStorage.setItem(ownerKey(key), JSON.stringify(value));
  }
  function state() {
    return read(STATE_KEY, { started:false, completed:false, skipped:false, currentStep:0, events:[] });
  }
  function goals() {
    return read(GOALS_KEY, {});
  }
  function prefs() {
    return read(PREFS_KEY, defaultPrefs);
  }
  function opportunities() {
    return root.RoleDeskState?.getOpportunities?.() || [];
  }
  function profile() {
    return root.RoleDeskState?.getProfile?.() || null;
  }
  function progress() {
    const p = profile(), g = goals(), opps = opportunities();
    let coverageEvents = [];
    try { coverageEvents = JSON.parse(localStorage.getItem('roledesk-coverage-v1') || '{}').events || []; } catch {}
    const checks = [
      ['profile', Boolean(p?.fullName || p?.displayName || g.fullName)],
      ['resume', Boolean(p?.rawText || p?.text)],
      ['resumeAnalysis', Boolean(p?.skills?.length || p?.targetRole)],
      ['careerTarget', Boolean(g.primaryRole || p?.targetRole)],
      ['preferences', Boolean(g.remotePreference || g.preferredLocations)],
      ['searched', Boolean((root.RoleDeskMvp?.progress?.() || {}).search || root.RoleDeskSourceHealth)],
      ['savedJob', opportunities().length > 0],
      ['kit', coverageEvents.some(event => event.type === 'packet_generated') || Boolean((root.RoleDeskMvp?.progress?.() || {}).packet)],
      ['applied', opps.some(item => /Applied|Interview|Offer|Rejected/i.test(item.status || ''))],
      ['followup', opps.some(item => item.followup?.nextAt || item.communication?.followUpDate)]
    ];
    const done = checks.filter(([, ok]) => ok).length;
    return { checks, done, total:checks.length, percent:Math.round(done / checks.length * 100) };
  }
  function track(eventName, metadata = {}) {
    const next = state();
    next.events = [{ eventName, at:new Date().toISOString(), metadata }, ...(next.events || [])].slice(0, 100);
    next.currentStep = step;
    if (eventName === 'onboarding_started') next.started = true;
    if (eventName === 'onboarding_completed') next.completed = true;
    if (eventName === 'onboarding_skipped') next.skipped = true;
    write(STATE_KEY, next);
    root.RoleDeskAnalytics?.track?.(eventName, { page:'onboarding', metadata });
    root.RoleDeskOnboardingCloud?.recordEvent?.(eventName, metadata).catch(() => {});
  }
  function qualityIssues() {
    const p = profile(), text = `${p?.rawText || p?.text || ''}`;
    const issues = [];
    if (!p?.portfolioUrl) issues.push('Add a portfolio, LinkedIn, GitHub, or Behance link if relevant.');
    if (!/\d+%|\d+x|₹|\$|increased|reduced|saved|grew/i.test(text)) issues.push('Add 1-2 measurable results where true.');
    if (!p?.targetRole) issues.push('Set a primary target role to improve matches.');
    if (!(p?.skills || []).length) issues.push('Add verified tools and skills from your resume.');
    if (!/experience|work history|projects/i.test(text)) issues.push('Clarify experience or project sections.');
    return issues.slice(0, 5);
  }
  function nextActions() {
    const p = profile(), g = goals(), opps = opportunities(), issues = qualityIssues();
    const actions = [];
    if (!p?.rawText && !p?.text) actions.push(['Upload your resume', 'Start matching jobs from real experience.', 'profile']);
    else if (!p?.targetRole && !g.primaryRole) actions.push(['Set your target role', 'RoleDesk can rank opportunities more accurately.', 'profile']);
    else if (issues.length) actions.push(['Fix one resume gap', issues[0], 'ats']);
    if (!root.RoleDeskSourceHealth) actions.push(['Run Smart Search', 'Find your first 10 resume-based jobs.', 'smart']);
    if (!opps.length) actions.push(['Save one opportunity', 'Build your tracker and first application kit.', 'smart']);
    else if (!opps.some(item => /Applied|Interview|Offer|Rejected/i.test(item.status || ''))) actions.push(['Generate an application kit', 'Prepare a truthful resume, cover letter, and outreach draft.', 'kit']);
    if (opps.length && !opps.some(item => item.followup?.nextAt || item.communication?.followUpDate)) actions.push(['Schedule a follow-up', 'Keep one real application moving.', 'tracker']);
    if (!g.portfolioUrl && /design|creative|brand|ui|ux/i.test(`${p?.targetRole || ''} ${(p?.skills || []).join(' ')}`)) actions.push(['Add your portfolio link', 'Design roles need proof before outreach.', 'profile']);
    return actions.slice(0, 3);
  }
  function renderDashboard() {
    const panel = $('#onboardingPanel');
    if (!panel) return;
    const score = progress(), actions = nextActions(), s = state();
    panel.innerHTML = `<div class="onboarding-panel-head"><div><span class="eyebrow coral">User success</span><h3>${s.completed ? 'Your daily action plan' : 'Finish setup and get your first win'}</h3><p>${s.completed ? 'Focus on the next real application action.' : 'RoleDesk guides you from resume to first application kit without sending or applying for you.'}</p></div><div class="activation-score"><strong>${score.percent}%</strong><span>setup complete</span></div></div><div class="next-action-grid">${actions.length ? actions.map(([title, note, view]) => `<button class="next-action-card" data-next-view="${esc(view)}" type="button"><strong>${esc(title)}</strong><p>${esc(note)}</p></button>`).join('') : '<div class="smart-empty"><h3>Setup complete</h3><p>Check your tracker for follow-ups and pipeline next steps.</p></div>'}</div><div class="success-microcopy"><span title="Match score compares your reviewed profile against the opportunity.">Match score = resume fit</span><span title="Readiness score checks whether your application assets and route are ready.">Readiness = apply prep</span><span title="Trust score checks source quality, expiry, and verification signals.">Trust = source confidence</span><span title="Follow-ups are reminders only; RoleDesk never contacts anyone.">Follow-ups stay manual</span></div><div class="onboarding-actions"><button class="button primary" id="openOnboarding" type="button">${s.completed ? 'Review setup' : 'Start guided setup'}</button><button class="button secondary" id="quickStartOnboarding" type="button">Quick start</button></div>`;
    $$('#onboardingPanel [data-next-view]').forEach(button => button.onclick = () => root.RoleDeskState?.openView?.(button.dataset.nextView));
    $('#openOnboarding').onclick = () => open(0);
    $('#quickStartOnboarding').onclick = () => open(2);
  }
  function saveStep() {
    if (steps[step] === 'profile') {
      const next = { ...goals(), fullName:$('#onboardName').value.trim(), experienceLevel:$('#onboardExperience').value, expectedSalary:$('#onboardExpectedSalary').value.trim(), noticePeriod:$('#onboardNotice').value.trim(), workAuthorization:$('#onboardWorkAuth').value.trim() };
      write(GOALS_KEY, next); track('profile_step_completed');
    }
    if (steps[step] === 'resume') {
      const text = $('#onboardResumeText').value.trim();
      if (text && $('#resumeText')) $('#resumeText').value = text;
      track('resume_analyzed', { has_paste:Boolean(text) });
    }
    if (steps[step] === 'goals') {
      const next = { ...goals(), primaryRole:$('#onboardPrimaryRole').value.trim(), secondaryRoles:$('#onboardSecondaryRoles').value.trim(), preferredLocations:$('#onboardLocations').value.trim(), remotePreference:$('#onboardRemote').value, jobType:$('#onboardJobType').value, industries:$('#onboardIndustries').value.trim(), minSalary:$('#onboardMinSalary').value.trim(), preferredApplicationMethod:$('#onboardApplyMethod').value, portfolioUrl:root.ScopeSecurity.safeHttpUrl($('#onboardPortfolio').value.trim()) };
      write(GOALS_KEY, next); track('career_target_set', { has_primary:Boolean(next.primaryRole), remote:next.remotePreference });
    }
    if (steps[step] === 'sources') {
      write(GOALS_KEY, { ...goals(), sourcePreference:$('#onboardSources').value, firstSearchGoal:$('#onboardSearchGoal').value.trim() });
      track('onboarding_source_preferences_saved');
    }
    if (steps[step] === 'notifications') {
      const next = Object.fromEntries($$('#onboardingPrefs input[type="checkbox"]').map(input => [input.name, input.checked]));
      write(PREFS_KEY, next); track('notification_preferences_saved');
    }
    root.RoleDeskOnboardingCloud?.saveProgress?.({ step:steps[step], state:state(), goals:goals(), preferences:prefs(), activation:progress() }).catch(() => {});
  }
  function renderStep() {
    const dialog = $('#onboardingDialog');
    if (!dialog) return;
    const p = profile(), g = goals(), pref = prefs(), score = progress(), issueItems = qualityIssues();
    const html = {
      welcome:`<h3>Welcome to RoleDesk</h3><p>In a few minutes, set your career target, resume, and first search goal. You can skip anything and finish later.</p><div class="success-microcopy"><span>No auto-send</span><span>No auto-apply</span><span>Drafts stay editable</span><span>Your data stays private</span></div>`,
      profile:`<h3>Basic profile</h3><p>Only add what you know. Blank is better than invented.</p><div class="onboarding-grid"><label>Name<input id="onboardName" value="${esc(g.fullName || p?.fullName || p?.displayName || '')}" placeholder="Your name"></label><label>Experience level<select id="onboardExperience"><option></option>${['Entry','Junior','Mid-level','Senior','Lead','Freelance/Consultant'].map(x=>`<option ${g.experienceLevel===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Expected salary/rate<input id="onboardExpectedSalary" value="${esc(g.expectedSalary || '')}" placeholder="e.g. ₹12 LPA or $25/hr"></label><label>Notice period<input id="onboardNotice" value="${esc(g.noticePeriod || '')}" placeholder="Immediate / 30 days"></label><label>Work authorization<input id="onboardWorkAuth" value="${esc(g.workAuthorization || '')}" placeholder="e.g. India, open to remote"></label></div>`,
      resume:`<h3>Resume upload</h3><p>Upload from My Profile or paste text here. If parsing fails, pasted text keeps you moving.</p><div class="resume-drop-mini"><button class="button secondary" id="onboardOpenProfile" type="button">Open resume upload</button><label>Paste resume text<textarea id="onboardResumeText" placeholder="Paste resume text if upload fails...">${esc(p?.rawText || p?.text || '')}</textarea></label></div><ul class="quality-list">${(issueItems.length?issueItems:['Resume looks ready for the next step.']).map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`,
      goals:`<h3>Career target</h3><p>This guides search, match scores, and daily actions.</p><div class="onboarding-grid"><label>Primary role<input id="onboardPrimaryRole" value="${esc(g.primaryRole || p?.targetRole || '')}" placeholder="e.g. Product Designer"></label><label>Secondary roles<input id="onboardSecondaryRoles" value="${esc(g.secondaryRoles || '')}" placeholder="Comma-separated"></label><label>Preferred locations<input id="onboardLocations" value="${esc(g.preferredLocations || p?.preferredLocation || '')}" placeholder="Remote, Bengaluru, US remote"></label><label>Remote preference<select id="onboardRemote">${['Remote preferred','Remote only','Hybrid','On-site','Open'].map(x=>`<option ${g.remotePreference===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Job type<select id="onboardJobType">${['Full-time','Contract','Freelance','Internship','Any'].map(x=>`<option ${g.jobType===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Industries<input id="onboardIndustries" value="${esc(g.industries || '')}" placeholder="SaaS, fintech, design, AI"></label><label>Minimum salary/rate<input id="onboardMinSalary" value="${esc(g.minSalary || p?.minRate || '')}" placeholder="Your floor"></label><label>Application method<select id="onboardApplyMethod">${['Company website','Recruiter email','LinkedIn guided','Freelance proposal','Any verified route'].map(x=>`<option ${g.preferredApplicationMethod===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Portfolio / LinkedIn / GitHub<input id="onboardPortfolio" value="${esc(g.portfolioUrl || p?.portfolioUrl || '')}" placeholder="https://..."></label></div>`,
      sources:`<h3>First search goal</h3><p>Pick where RoleDesk should guide you first. Restricted platforms remain manual/guided.</p><div class="onboarding-grid"><label>Preferred source<select id="onboardSources">${['Permitted live feeds','Company career pages','LinkedIn guided','Naukri guided','Freelance platforms','Manual import'].map(x=>`<option ${g.sourcePreference===x?'selected':''}>${x}</option>`).join('')}</select></label><label>First job-search goal<input id="onboardSearchGoal" value="${esc(g.firstSearchGoal || '')}" placeholder="Find 10 remote product designer roles"></label></div>`,
      notifications:`<h3>Reminder preferences</h3><p>Keep defaults calm. You can change them later.</p><div class="preference-chips" id="onboardingPrefs">${[['followups','Follow-up reminders'],['dailyPlan','Daily plan reminders'],['strongMatches','Strong job match alerts'],['emailDelivery','Email delivery alerts'],['interviews','Interview reminders'],['productUpdates','Product updates']].map(([name,label])=>`<label><input type="checkbox" name="${name}" ${pref[name]?'checked':''}> ${label}</label>`).join('')}</div>`,
      success:`<h3>Your setup is ${score.percent}% complete</h3><p>${nextActions()[0]?.[1] || 'You are ready to use RoleDesk daily.'}</p><div class="next-action-grid">${nextActions().map(([title,note,view])=>`<button class="next-action-card" data-next-view="${esc(view)}" type="button"><strong>${esc(title)}</strong><p>${esc(note)}</p></button>`).join('')}</div>`
    }[steps[step]];
    $('#onboardingStep').innerHTML = html;
    $('#onboardingStepName').textContent = `${step + 1} / ${steps.length}`;
    $('#onboardingBar').style.width = `${Math.round((step + 1) / steps.length * 100)}%`;
    $('#onboardingBack').disabled = step === 0;
    $('#onboardingNext').textContent = step === steps.length - 1 ? 'Finish onboarding' : 'Continue';
    $('#onboardingSkip').textContent = step === 0 ? 'Skip for now' : 'Finish later';
    $('#onboardOpenProfile')?.addEventListener('click', () => { dialog.close(); root.RoleDeskState?.openView?.('profile'); });
    $$('#onboardingStep [data-next-view]').forEach(button => button.onclick = () => { complete(); dialog.close(); root.RoleDeskState?.openView?.(button.dataset.nextView); });
  }
  function open(start = null) {
    if (Number.isFinite(start)) step = Math.max(0, Math.min(steps.length - 1, start));
    else step = Number(state().currentStep || 0);
    track('onboarding_started', { step:steps[step] });
    renderStep();
    $('#onboardingDialog')?.showModal();
  }
  function complete() {
    saveStep();
    track('onboarding_completed', { activation:progress().percent });
    renderDashboard();
  }
  function bind() {
    $('#onboardingBack')?.addEventListener('click', () => { saveStep(); step = Math.max(0, step - 1); renderStep(); });
    $('#onboardingNext')?.addEventListener('click', () => { saveStep(); if (step >= steps.length - 1) { complete(); $('#onboardingDialog')?.close(); } else { step += 1; renderStep(); } });
    $('#onboardingSkip')?.addEventListener('click', () => { track('onboarding_skipped', { step:steps[step] }); $('#onboardingDialog')?.close(); renderDashboard(); });
    $('#closeOnboarding')?.addEventListener('click', () => $('#onboardingDialog')?.close());
  }
  function maybeAutoOpen() {
    if (!document.documentElement.classList.contains('signed-in-mode')) return;
    const s = state();
    if (!s.started && !s.skipped && !s.completed && location.hash !== '#noOnboarding') setTimeout(() => open(0), 900);
  }
  document.addEventListener('DOMContentLoaded', () => { bind(); renderDashboard(); maybeAutoOpen(); });
  document.addEventListener('roledesk:auth-changed', () => { renderDashboard(); maybeAutoOpen(); });
  root.RoleDeskOnboarding = Object.freeze({ open, render:renderDashboard, progress, goals, prefs, nextActions, qualityIssues, track });
})();
