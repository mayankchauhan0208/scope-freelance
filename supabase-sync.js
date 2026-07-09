(function () {
  const config = window.SCOPE_SUPABASE_CONFIG;
  const sdk = window.supabase;
  if (!config?.url || !config?.publishableKey || !sdk?.createClient) {
    document.documentElement.classList.add('signed-out-mode');
    document.documentElement.classList.remove('auth-pending');
    return;
  }

  const LEGACY_BACKUP_KEY = 'scope-legacy-recovery-v1';
  const CACHE_OWNER_KEY = 'scope-cache-owner-v1';
  const cloud = sdk.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
  });
  window.scopeCloud = cloud;

  const accountDialog = document.querySelector('#accountDialog');
  const accountButton = document.querySelector('#cloudAccount');
  const accountEmail = document.querySelector('#accountEmail');
  const password = document.querySelector('#accountPassword');
  const status = document.querySelector('#accountStatus');
  const signedOut = document.querySelector('#signedOutAccount');
  const signedIn = document.querySelector('#signedInAccount');
  const passwordRecovery = document.querySelector('#passwordRecovery');
  const legacyRecovery = document.querySelector('#legacyRecovery');
  let session = null;
  let activeUserId = null;
  let syncing = false;
  let syncTimer = null;
  let emailDraftTimer = null;
  let pendingEmailDraft = null;
  let currentEmailDraftId = null;
  const authParams = new URLSearchParams(window.location.search);
  const invalidResetLink = authParams.get('error') === 'access_denied' || /otp_expired|expired|invalid/i.test(authParams.get('error_code') || authParams.get('error_description') || '');
  const resetLinkMessage = 'This reset link is expired or invalid. Request a new reset link.';
  const LIVE_REDIRECT_URL = 'https://mayankchauhan0208.github.io/scope-freelance/';
  function authRedirectUrl() {
    return window.location.hostname.endsWith('github.io') ? LIVE_REDIRECT_URL : window.location.origin + window.location.pathname;
  }

  const localPersist = persist;
  const localSaveProfile = saveProfile;

  function setStatus(message, isError = false) {
    status.textContent = message || '';
    status.classList.toggle('error', isError);
  }

  async function withAuthBusy(button, busyLabel, action) {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;
    try {
      return await action();
    } catch (error) {
      setStatus(friendlyAuthError(error, 'Unable to connect right now. Try again.'), true);
      return null;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  function friendlyAuthError(error, fallback) {
    const message = String(error?.message || error || '');
    if (/refresh token|jwt|session.*expired|token.*expired/i.test(message)) return 'Your session expired. Please sign in again.';
    if (/invalid login|invalid credentials|email.*password/i.test(message)) return 'Email or password is incorrect. Try again.';
    if (/email not confirmed/i.test(message)) return 'Confirm your email before signing in.';
    if (/rate limit|too many requests|email.*limit/i.test(message)) return 'Too many emails requested. Please wait before requesting another reset link.';
    if (/network|fetch|timeout|connection/i.test(message)) return 'Unable to connect right now. Try again.';
    return fallback;
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function isDemoOpportunity(item) {
    return item?.isDemo === true || seed.some(demo => demo.id === item.id && demo.title === item.title);
  }

  function snapshotLegacyData() {
    return {
      capturedAt: new Date().toISOString(),
      profile: safeParse(localStorage.getItem(PROFILE_KEY), null),
      opportunities: safeParse(localStorage.getItem(STORAGE_KEY), []).filter(item => !isDemoOpportunity(item)),
      workEmail: localStorage.getItem(WORK_EMAIL_KEY) || ''
    };
  }

  function captureLegacyRecovery() {
    if (localStorage.getItem(LEGACY_BACKUP_KEY) || localStorage.getItem(CACHE_OWNER_KEY)) return;
    const snapshot = snapshotLegacyData();
    if (snapshot.profile || snapshot.opportunities.length || snapshot.workEmail) {
      localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify(snapshot));
    }
  }

  function clearActiveBrowserCache() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(WORK_EMAIL_KEY);
    localStorage.removeItem(CACHE_OWNER_KEY);
    currentEmailDraftId = null;
    opportunities = [];
    resumeProfile = null;
    liveJobs = [];
    allLiveJobs = [];
    liveSearchStats = { fetched:0, duplicates:0, reviewable:0, hidden:0 };
    selectedLiveJobId = null;
    for (const selector of ['#workEmail','#emailFrom','#emailTo','#emailSubject','#emailBody','#proposalOutput','#resumeText','#liveSearchQuery']) {
      const field = document.querySelector(selector);
      if (field) field.value = '';
    }
    document.querySelector('#approveEmail').checked = false;
    document.querySelector('#openGmailDraft').disabled = true;
    renderProfile();
    renderDashboard();
    renderLiveJobs();
    updateSearchMetrics();
  }

  function showLegacyRecovery() {
    const importedKey = session?.user ? `scope-legacy-imported-v1:${session.user.id}` : '';
    legacyRecovery.hidden = !session?.user || !localStorage.getItem(LEGACY_BACKUP_KEY) || Boolean(localStorage.getItem(importedKey));
  }

  function renderAccount() {
    const connected = Boolean(session?.user);
    document.documentElement.classList.toggle('signed-in-mode', connected);
    document.documentElement.classList.toggle('signed-out-mode', !connected);
    signedOut.hidden = connected;
    signedIn.hidden = !connected;
    if (!passwordRecovery.hidden) {
      signedOut.hidden = true;
      signedIn.hidden = true;
    }
    accountButton.classList.toggle('connected', connected);
    accountButton.querySelector('span').textContent = connected ? 'Private cloud connected' : 'Connect private cloud';
    if (connected) document.querySelector('#signedInEmail').textContent = session.user.email;
    showLegacyRecovery();
    document.dispatchEvent(new CustomEvent('roledesk:auth-changed', { detail: { connected } }));
  }

  function requireEmail() {
    const email = accountEmail.value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus('Enter a valid email address.', true);
      return '';
    }
    return email;
  }

  function cloudOpportunity(item, userId) {
    const publicUrl = window.ScopeSecurity.safeHttpUrl(item.url);
    const followup = item.followup || {};
    return {
      user_id: userId,
      source: item.platform || 'RoleDesk',
      source_id: String(item.id),
      source_url: publicUrl || `scope://local/${item.id}`,
      title: window.ScopeSecurity.boundedText(item.title, 500),
      company: window.ScopeSecurity.boundedText(item.client, 500) || null,
      description: window.ScopeSecurity.boundedText(item.brief, 50000) || null,
      contact_email: item.verifiedEmail || item.email || item.contactEmail || null,
      status: (item.status || 'Saved').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      match_score: Number.isFinite(item.skill) ? Math.max(0, Math.min(100, Math.round(item.skill))) : null,
      quality_score: Number.isFinite(item.qualityScore) ? Math.max(0, Math.min(100, Math.round(item.qualityScore))) : null,
      readiness_score: Number.isFinite(item.readinessScore) ? Math.max(0, Math.min(100, Math.round(item.readinessScore))) : null,
      trust_score: Number.isFinite(item.trustScore) ? Math.max(0, Math.min(100, Math.round(item.trustScore))) : null,
      verification_status: ['official_company','verified_by_feed','needs_verification','user_verified'].includes(item.verificationStatus) ? item.verificationStatus : 'needs_verification',
      expiry_status: ['active','recently_posted','possibly_stale','expired','closed','needs_verification'].includes(String(item.expiryStatus||'').toLowerCase().replaceAll(' ','_')) ? String(item.expiryStatus).toLowerCase().replaceAll(' ','_') : 'needs_verification',
      last_checked_at: item.lastCheckedAt || null,
      source_reliability: Number.isFinite(item.sourceReliability) ? Math.max(0, Math.min(100, Math.round(item.sourceReliability))) : null,
      all_source_links: (item.allSourceLinks || []).map(window.ScopeSecurity.safeHttpUrl).filter(Boolean).slice(0, 20),
      check_failures: Math.max(0, Math.min(20, Number(item.checkFailures)||0)),
      company_careers_url: window.ScopeSecurity.safeHttpUrl(item.companyCareersUrl) || null,
      work_mode: ['remote','hybrid','onsite','unknown'].includes(item.workMode) ? item.workMode : 'unknown',
      experience_level: window.ScopeSecurity.boundedText(item.experienceLevel, 100) || null,
      salary_text: window.ScopeSecurity.boundedText(item.salary, 500) || null,
      application_method: window.ScopeSecurity.boundedText(item.applicationMethod, 100) || null,
      application_deadline: /^\d{4}-\d{2}-\d{2}$/.test(item.deadlineText || '') ? item.deadlineText : null,
      contact_name: window.ScopeSecurity.boundedText(item.recipientName, 300) || null,
      contact_email_verified: Boolean(item.contactEmailVerified || item.verifiedEmail),
      contact_source_url: window.ScopeSecurity.safeHttpUrl(item.emailSourceUrl || item.contactSourceUrl) || null,
      contact_confidence: window.ScopeSecurity.boundedText(item.contactConfidence, 100) || null,
      contact_last_checked_at: item.contactLastCheckedAt || null,
      next_followup_at: followup.nextAt || item.communication?.followUpDate || null,
      followup_reason: window.ScopeSecurity.boundedText(followup.reason, 500) || null,
      followup_status: ['scheduled','completed','snoozed'].includes(followup.status) ? followup.status : null,
      last_contacted_at: item.lastContactedAt || null,
      reply_received_at: item.replyReceivedAt || null,
      followup_notes: window.ScopeSecurity.boundedText(followup.notes || item.communication?.notes, 5000) || null,
      communication_status: item.communication?.status ? item.communication.status.toLowerCase().replaceAll(' ', '_').replace('follow-up','follow_up') : null,
      pipeline_value: window.RoleDeskTracker?.amount(item) || null,
      currency: window.RoleDeskTracker?.amount(item) ? window.RoleDeskTracker.currency(item) : null,
      analysis: { scope_record: { ...item, url: publicUrl }, synced_from: 'scope-web' },
      updated_at: new Date().toISOString()
    };
  }

  function localOpportunity(row, index) {
    const saved = row.analysis?.scope_record || {};
    return {
      ...saved,
      id: Number(saved.id) || Date.now() + index,
      title: saved.title || row.title,
      client: saved.client || row.company || 'Unknown',
      brief: saved.brief || row.description || '',
      url: window.ScopeSecurity.safeHttpUrl(saved.url || row.source_url),
      platform: saved.platform || row.source,
      status: saved.status || 'Saved',
      skill: Number.isFinite(saved.skill) ? saved.skill : Number.isFinite(row.match_score) ? row.match_score : 0,
      pipelineValue: saved.pipelineValue || row.pipeline_value || saved.budget || 0,
      currency: saved.currency || row.currency || 'USD',
      lastContactedAt: saved.lastContactedAt || row.last_contacted_at || '',
      replyReceivedAt: saved.replyReceivedAt || row.reply_received_at || '',
      followup: saved.followup || { nextAt:row.next_followup_at || '', reason:row.followup_reason || '', status:row.followup_status || '', notes:row.followup_notes || '' },
      communication: saved.communication || (row.communication_status ? { status:row.communication_status.split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '), followUpDate:String(row.next_followup_at||'').slice(0,10), notes:row.followup_notes || '', verification:'user_reported', providerConfirmed:false } : undefined)
      ,qualityScore: Number.isFinite(saved.qualityScore) ? saved.qualityScore : row.quality_score
      ,readinessScore: Number.isFinite(saved.readinessScore) ? saved.readinessScore : row.readiness_score
      ,trustScore: Number.isFinite(saved.trustScore) ? saved.trustScore : row.trust_score
      ,verificationStatus: saved.verificationStatus || row.verification_status || 'needs_verification'
      ,expiryStatus: saved.expiryStatus || String(row.expiry_status||'needs_verification').split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')
      ,lastCheckedAt: saved.lastCheckedAt || row.last_checked_at || ''
      ,sourceReliability: Number.isFinite(saved.sourceReliability) ? saved.sourceReliability : row.source_reliability
      ,allSourceLinks: saved.allSourceLinks || row.all_source_links || []
      ,checkFailures: Number.isFinite(saved.checkFailures) ? saved.checkFailures : row.check_failures || 0
      ,companyCareersUrl: saved.companyCareersUrl || row.company_careers_url || ''
      ,workMode: saved.workMode || row.work_mode || 'unknown'
      ,experienceLevel: saved.experienceLevel || row.experience_level || ''
      ,salary: saved.salary || row.salary_text || ''
      ,applicationMethod: saved.applicationMethod || row.application_method || ''
      ,recipientName: saved.recipientName || row.contact_name || ''
      ,email: saved.email || row.contact_email || ''
      ,contactEmailVerified: saved.contactEmailVerified ?? row.contact_email_verified ?? false
      ,emailSourceUrl: saved.emailSourceUrl || row.contact_source_url || ''
      ,contactConfidence: saved.contactConfidence || row.contact_confidence || ''
      ,contactLastCheckedAt: saved.contactLastCheckedAt || row.contact_last_checked_at || ''
    };
  }

  async function syncNow(options = {}) {
    if (!session?.user || syncing) return false;
    syncing = true;
    setStatus('Syncing your private workspace…');
    try {
      const userId = session.user.id;
      if (resumeProfile) {
        const portfolio = resumeProfile.portfolioUrl ? [window.ScopeSecurity.safeHttpUrl(resumeProfile.portfolioUrl)].filter(Boolean) : [];
        const preferences = { ...resumeProfile };
        delete preferences.text;
        const { error } = await cloud.from('profiles').upsert({
          user_id: userId,
          display_name: resumeProfile.fullName || resumeProfile.displayName || session.user.user_metadata?.full_name || null,
          work_email: localStorage.getItem(WORK_EMAIL_KEY) || session.user.email,
          resume_text: window.ScopeSecurity.boundedText(resumeProfile.text, 30000) || null,
          portfolio_urls: portfolio,
          preferences,
          updated_at: new Date().toISOString()
        });
        if (error) throw error;
      }
      const records = opportunities.filter(item => !isDemoOpportunity(item)).map(item => cloudOpportunity(item, userId));
      if (records.length) {
        const { error } = await cloud.from('opportunities').upsert(records, { onConflict: 'user_id,source_url' });
        if (error) throw error;
      }
      const contactItems = opportunities.filter(item => !isDemoOpportunity(item) && (item.verifiedEmail || item.email || item.possibleEmail));
      if (contactItems.length) {
        const sourceUrls = contactItems.map(item => window.ScopeSecurity.safeHttpUrl(item.url) || `scope://local/${item.id}`);
        const { data:ownedRows, error:ownedError } = await cloud.from('opportunities').select('id,source_url').eq('user_id',userId).in('source_url',sourceUrls);
        if (ownedError) throw ownedError;
        const ids = new Map((ownedRows || []).map(row => [row.source_url,row.id]));
        const contacts = contactItems.map(item => {
          const sourceUrl = window.ScopeSecurity.safeHttpUrl(item.url) || `scope://local/${item.id}`;
          return {
            user_id:userId,
            opportunity_id:ids.get(sourceUrl),
            contact_type:'recruiter',
            contact_name:window.ScopeSecurity.boundedText(item.recipientName,300) || null,
            verified_email:item.contactEmailVerified ? (item.verifiedEmail || item.email || null) : null,
            possible_email:item.contactEmailVerified ? null : (item.possibleEmail || item.email || null),
            email_verified:Boolean(item.contactEmailVerified),
            source_url:window.ScopeSecurity.safeHttpUrl(item.emailSourceUrl) || null,
            confidence:item.contactEmailVerified ? 'public_source' : 'unverified',
            last_checked_at:item.contactLastCheckedAt || null,
            metadata:{ verification:item.contactEmailVerified?'user_confirmed_public_source':'unverified', provider_confirmed:false }
          };
        }).filter(item => item.opportunity_id);
        if (contacts.length) {
          const { error:contactError } = await cloud.from('opportunity_contacts').upsert(contacts,{ onConflict:'user_id,opportunity_id,contact_type' });
          if (contactError) throw contactError;
        }
      }
      localStorage.setItem(CACHE_OWNER_KEY, userId);
      const timestamp = new Date();
      document.querySelector('#lastCloudSync').textContent = `Last synced ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setStatus('Private cloud sync complete.');
      if (!options.silent) toast('Private cloud synced');
      return true;
    } catch (error) {
      setStatus('Unable to sync right now. Try again.', true);
      if (!options.silent) toast('Unable to sync right now. Try again.');
      return false;
    } finally {
      syncing = false;
    }
  }

  async function loadCloudCanonical() {
    if (!session?.user) return;
    const userId = session.user.id;
    let recoveredProfileName = false;
    try {
      const [{ data: profile, error: profileError }, { data: cloudItems, error: itemsError }] = await Promise.all([
        cloud.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        cloud.from('opportunities').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      ]);
      if (profileError) throw profileError;
      if (itemsError) throw itemsError;

      resumeProfile = profile ? {
        ...(profile.preferences || {}),
        fullName: profile.display_name || profile.preferences?.fullName || '',
        displayName: profile.display_name || '',
        email: profile.preferences?.email || session.user.email || '',
        text: profile.resume_text || '',
        portfolioUrl: window.ScopeSecurity.safeHttpUrl(profile.portfolio_urls?.[0] || profile.preferences?.portfolioUrl || '')
      } : null;
      if (resumeProfile?.text && window.RoleDeskResume?.extractProfile) {
        const previousName = resumeProfile.fullName || resumeProfile.displayName || '';
        const previousNameMissing = !previousName || /^\[?your name\]?$/i.test(previousName) || previousName === 'Needs review';
        resumeProfile = window.RoleDeskResume.extractProfile(resumeProfile.text, resumeProfile);
        recoveredProfileName = previousNameMissing && Boolean(resumeProfile.fullName) && resumeProfile.fullName !== 'Needs review';
      }
      opportunities = (cloudItems || []).map(localOpportunity).filter(item => !isDemoOpportunity(item));

      localStorage.setItem(CACHE_OWNER_KEY, userId);
      const activeEmail = profile?.work_email || session.user.email || '';
      if (activeEmail) localStorage.setItem(WORK_EMAIL_KEY, activeEmail);
      document.querySelector('#workEmail').value = activeEmail;
      document.querySelector('#emailFrom').value = activeEmail;
      if (resumeProfile) localSaveProfile(); else localStorage.removeItem(PROFILE_KEY);
      localPersist();
      renderProfile();
      updateIdentityWarnings();
      renderDashboard();
      if (recoveredProfileName) await syncNow({ silent: true });
      setStatus('Supabase is the source of truth for this signed-in workspace.');
      document.dispatchEvent(new CustomEvent('roledesk:cloud-ready'));
    } catch (error) {
      setStatus(friendlyAuthError(error, 'Unable to sync right now. Try again.'), true);
    }
  }

  async function importLegacyData() {
    if (!session?.user) return;
    const backup = safeParse(localStorage.getItem(LEGACY_BACKUP_KEY), null);
    if (!backup) return setStatus('No legacy recovery data was found.', true);
    setStatus('Importing the selected legacy recovery copy…');
    try {
      if (backup.profile) {
        const profile = backup.profile;
        const preferences = { ...profile };
        delete preferences.text;
        const { error } = await cloud.from('profiles').upsert({
          user_id: session.user.id,
          display_name: profile.fullName || profile.displayName || session.user.user_metadata?.full_name || null,
          work_email: backup.workEmail || session.user.email,
          resume_text: window.ScopeSecurity.boundedText(profile.text, 30000) || null,
          portfolio_urls: [window.ScopeSecurity.safeHttpUrl(profile.portfolioUrl)].filter(Boolean),
          preferences,
          updated_at: new Date().toISOString()
        });
        if (error) throw error;
      }
      const rows = (backup.opportunities || []).map(item => cloudOpportunity(item, session.user.id));
      if (rows.length) {
        const { error } = await cloud.from('opportunities').upsert(rows, { onConflict: 'user_id,source_url' });
        if (error) throw error;
      }
      localStorage.setItem(`scope-legacy-imported-v1:${session.user.id}`, new Date().toISOString());
      showLegacyRecovery();
      await loadCloudCanonical();
      toast('Legacy browser data imported');
    } catch (error) {
      setStatus(friendlyAuthError(error, 'Unable to import legacy browser data right now. Try again.'), true);
    }
  }

  function scheduleSync() {
    if (!session?.user) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow({ silent: true }), 900);
  }

  persist = function () { localPersist(); scheduleSync(); };
  saveProfile = function () { localSaveProfile(); scheduleSync(); };
  window.ScopeCloudSync = Object.freeze({ syncNow: () => syncNow() });

  window.ScopeTrackerCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    recordEvent: async (opportunity, eventType, metadata = {}) => {
      if (!session?.user || !opportunity) return null;
      await syncNow({ silent: true });
      const sourceUrl = window.ScopeSecurity.safeHttpUrl(opportunity.url) || `scope://local/${opportunity.id}`;
      const { data, error } = await cloud.rpc('record_tracker_client_event', { p_source_url: sourceUrl, p_event_type: eventType, p_metadata: metadata });
      if (error) throw error;
      return data;
    }
  });

  window.RoleDeskResumeCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    saveOriginal: async payload => {
      if (!session?.user) return null;
      const { rawText, text, ...facts } = payload.extractedData || {};
      const { data, error } = await cloud.from('resumes').insert({
        user_id: session.user.id,
        file_name: window.ScopeSecurity.boundedText(payload.fileName, 255) || 'Imported resume',
        mime_type: 'text/plain',
        extracted_text: window.ScopeSecurity.boundedText(payload.originalText, 50000),
        original_text: window.ScopeSecurity.boundedText(payload.originalText, 50000),
        extracted_data: facts,
        status: 'reviewed',
        metadata: { source: 'profile-import', ai_used: false }
      }).select('*').single();
      if (error) throw error;
      document.dispatchEvent(new CustomEvent('roledesk:cloud-ready'));
      return data;
    },
    saveVersion: async payload => {
      if (!session?.user) return null;
      const { rawText, text, ...facts } = payload.extractedData || {};
      const record = {
        user_id: session.user.id,
        file_name: window.ScopeSecurity.boundedText(payload.versionName, 255) || 'RoleDesk resume',
        version_name: window.ScopeSecurity.boundedText(payload.versionName, 255) || 'RoleDesk resume',
        mime_type: 'text/markdown',
        extracted_text: window.ScopeSecurity.boundedText(payload.originalText, 50000),
        original_text: window.ScopeSecurity.boundedText(payload.originalText, 50000),
        extracted_data: facts,
        ats_score: Number.isFinite(payload.atsScore) ? Math.max(0, Math.min(100, Math.round(payload.atsScore))) : null,
        issues: payload.issues || {},
        generated_text: window.ScopeSecurity.boundedText(payload.generatedText, 50000),
        tone: payload.tone || 'Corporate',
        target_role: window.ScopeSecurity.boundedText(payload.targetRole, 300) || null,
        status: 'reviewed',
        metadata: { generator: 'local-rule-based-v1', ai_used: false }
      };
      const { data, error } = await cloud.from('resumes').insert(record).select('*').single();
      if (error) throw error;
      return data;
    },
    listVersions: async () => {
      if (!session?.user) return [];
      const { data, error } = await cloud.from('resumes')
        .select('id,version_name,original_text,extracted_text,extracted_data,ats_score,issues,generated_text,tone,target_role,created_at,updated_at')
        .eq('user_id', session.user.id)
        .not('version_name', 'is', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  window.RoleDeskSmartDraftCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    save: async payload => {
      if (!session?.user) return null;
      const allowedKinds = ['proposal','email','form','reply','negotiation'];
      const kind = allowedKinds.includes(payload.kind) ? payload.kind : 'proposal';
      const body = window.ScopeSecurity.boundedText(payload.body, 50000);
      const subject = window.ScopeSecurity.boundedText(payload.subject, 1000);
      const { data, error } = await cloud.from('drafts').insert({
        user_id: session.user.id,
        kind,
        subject,
        body,
        destination: {},
        content: {
          subject,
          body,
          mode: 'smart-draft-local',
          warnings: Array.isArray(payload.warnings) ? payload.warnings.slice(0, 20) : [],
          confidence: window.ScopeSecurity.boundedText(payload.confidenceText, 100)
        }
      }).select('*').single();
      if (error) throw error;
      return data;
    }
  });

  window.ScopeApplicationCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    markApplied: async (opportunity, details = {}) => {
      if (!session?.user || !opportunity) return null;
      await syncNow({ silent: true });
      const sourceUrl = window.ScopeSecurity.safeHttpUrl(opportunity.url) || `scope://local/${opportunity.id}`;
      const { data, error } = await cloud.rpc('mark_application_applied', {
        p_source_url: sourceUrl,
        p_application_method: details.method || null,
        p_followup_at: details.followUpAt || null,
        p_notes: window.ScopeSecurity.boundedText(details.notes, 5000) || null
      });
      if (error) throw error;
      return data;
    }
  });

  async function careerOpportunityId(opportunity) {
    if (!session?.user || !opportunity) return null;
    const sourceUrl = window.ScopeSecurity.safeHttpUrl(opportunity.url) || `scope://local/${opportunity.id}`;
    const { data } = await cloud.from('opportunities').select('id').eq('user_id', session.user.id).eq('source_url', sourceUrl).maybeSingle();
    return data?.id || null;
  }

  window.RoleDeskJobTrustCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    report: async (opportunity, reportType) => {
      if (!session?.user || !opportunity) return null;
      await syncNow({ silent: true });
      const opportunityId = await careerOpportunityId(opportunity);
      if (!opportunityId) return null;
      const allowed = ['closed','wrong_details','fake_job','already_filled'];
      if (!allowed.includes(reportType)) throw new Error('Unsupported job report type.');
      const { data, error } = await cloud.from('job_reports').insert({ user_id: session.user.id, opportunity_id: opportunityId, report_type: reportType, status: 'open' }).select('*').single();
      if (error) throw error;
      return data;
    }
  });

  window.RoleDeskApplicationKitCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    saveKit: async kit => {
      if (!session?.user || !kit) return null;
      await syncNow({ silent: true });
      const opportunity = opportunities.find(item => String(item.id) === String(kit.opportunityId));
      const opportunityId = await careerOpportunityId(opportunity || { id: kit.opportunityId, url: kit.route?.applicationUrl });
      const kitRecord = {
        user_id: session.user.id,
        opportunity_id: opportunityId,
        title: window.ScopeSecurity.boundedText(kit.opportunityTitle, 500),
        target_role: window.ScopeSecurity.boundedText(kit.targetRole, 300),
        tone: window.ScopeSecurity.boundedText(kit.tone, 80),
        status: 'draft',
        scores: kit.scores || {},
        checklist: kit.checklist || [],
        suggestions: kit.suggestions || [],
        truth_warnings: kit.truthWarnings || []
      };
      const { data, error } = await cloud.from('application_kits').insert(kitRecord).select('*').single();
      if (error) throw error;
      const assetMap = { tailoredResume:'tailored_resume', coverLetter:'cover_letter', recruiterEmail:'recruiter_email', linkedInMessage:'linkedin_message', followUpEmail:'follow_up_email', freelanceProposal:'freelance_proposal' };
      const rows = Object.entries(kit.assets || {}).map(([key, value]) => ({
        user_id: session.user.id,
        application_kit_id: data.id,
        opportunity_id: opportunityId,
        asset_type: assetMap[key] || 'other',
        title: window.ScopeSecurity.boundedText(key.replace(/([A-Z])/g, ' $1'), 200),
        content: window.ScopeSecurity.boundedText(value, 100000),
        quality_score: kit.assetQuality?.[key]?.score ?? null,
        truth_warnings: kit.assetQuality?.[key]?.fixes || []
      }));
      if (rows.length) {
        const { error: assetError } = await cloud.from('application_assets').insert(rows);
        if (assetError) throw assetError;
        const scoreRows = rows.map(row => ({
          user_id: session.user.id,
          application_kit_id: data.id,
          asset_type: row.asset_type,
          score: row.quality_score,
          fixes: row.truth_warnings || []
        })).filter(row => Number.isFinite(row.score));
        if (scoreRows.length) {
          const { error: scoreError } = await cloud.from('content_quality_scores').insert(scoreRows);
          if (scoreError) throw scoreError;
        }
      }
      return data;
    },
    recordExport: async (kit, assetType, format) => {
      if (!session?.user || !kit) return null;
      const { data, error } = await cloud.from('export_history').insert({
        user_id: session.user.id,
        asset_type: window.ScopeSecurity.boundedText(assetType, 80),
        export_format: window.ScopeSecurity.boundedText(format, 20),
        metadata: { local_kit_id: kit.id, opportunity_title: kit.opportunityTitle }
      }).select('*').single();
      if (error) throw error;
      return data;
    }
  });

  window.RoleDeskCareerCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    load: async () => {
      if (!session?.user) return { target: null, variants: [], feedback: [], settings: null, plan: null };
      const today = new Date().toISOString().slice(0, 10);
      const [target, variants, feedback, settings, plan] = await Promise.all([
        cloud.from('career_targets').select('*').eq('user_id', session.user.id).maybeSingle(),
        cloud.from('resume_variants').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false }).limit(50),
        cloud.from('opportunity_feedback').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(200),
        cloud.from('reminder_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
        cloud.from('daily_plans').select('plan_date,completed_action_keys').eq('user_id', session.user.id).eq('plan_date', today).maybeSingle()
      ]);
      const failure = [target, variants, feedback, settings, plan].find(result => result.error);
      if (failure) throw failure.error;
      return {
        target: target.data ? { targetRoles: target.data.target_roles || [], locations: target.data.preferred_locations || [], workMode: target.data.work_mode || '', minimumSalary: target.data.minimum_salary, expectedSalary: target.data.expected_salary, experienceLevel: target.data.experience_level || '', industries: target.data.industries || [], boards: target.data.preferred_job_boards || [] } : null,
        variants: variants.data || [], feedback: feedback.data || [],
        settings: settings.data ? { email: settings.data.email_notifications, dashboard: settings.data.dashboard_notifications, followups: settings.data.followup_reminders, frequency: settings.data.daily_plan_frequency } : null,
        plan: plan.data || null
      };
    },
    saveTarget: async target => {
      if (!session?.user) return null;
      const payload = { user_id: session.user.id, target_roles: target.targetRoles || [], preferred_locations: target.locations || [], work_mode: target.workMode || null, minimum_salary: target.minimumSalary, expected_salary: target.expectedSalary, experience_level: window.ScopeSecurity.boundedText(target.experienceLevel, 200) || null, industries: target.industries || [], preferred_job_boards: target.boards || [] };
      const { data, error } = await cloud.from('career_targets').upsert(payload, { onConflict: 'user_id' }).select('*').single();
      if (error) throw error; return data;
    },
    savePlan: async plan => {
      if (!session?.user) return null;
      const actions = (plan.actions || []).slice(0, 7).map(action => ({ type: action.type, title: window.ScopeSecurity.boundedText(action.title, 500), detail: window.ScopeSecurity.boundedText(action.detail, 2000), view: action.view, opportunity_ref: action.opportunityId || null }));
      const { data, error } = await cloud.from('daily_plans').upsert({ user_id: session.user.id, plan_date: plan.date, actions, completed_action_keys: (plan.completedActionKeys || []).slice(0, 20), generated_by: 'local_explainable_v1', generated_at: new Date().toISOString() }, { onConflict: 'user_id,plan_date' }).select('*').single();
      if (error) throw error; return data;
    },
    saveVariant: async variant => {
      if (!session?.user) return null;
      const payload = { user_id: session.user.id, name: window.ScopeSecurity.boundedText(variant.name, 300), target_role: window.ScopeSecurity.boundedText(variant.targetRole, 300), summary: window.ScopeSecurity.boundedText(variant.summary, 5000), skills: (variant.skills || []).slice(0, 100), content: { mode: 'truthful-reorder-v1', true_data_only: true }, truth_reviewed: false };
      const { data, error } = await cloud.from('resume_variants').insert(payload).select('*').single();
      if (error) throw error; return data;
    },
    saveFeedback: async (item, opportunity) => {
      if (!session?.user) return null;
      const opportunityId = await careerOpportunityId(opportunity);
      const payload = { user_id: session.user.id, opportunity_id: opportunityId, resume_variant_id: item.resume_variant_id || null, outcome: item.outcome, role_type: window.ScopeSecurity.boundedText(item.role_type, 500), source: window.ScopeSecurity.boundedText(item.source, 200), metadata: { verification: 'user_reported' } };
      const { data, error } = await cloud.from('opportunity_feedback').insert(payload).select('*').single();
      if (error) throw error;
      if (opportunityId && item.resume_variant_id) {
        const { error: applicationError } = await cloud.from('applications').update({ resume_variant_id: item.resume_variant_id }).eq('user_id', session.user.id).eq('opportunity_id', opportunityId);
        if (applicationError) throw applicationError;
      }
      return data;
    },
    saveSettings: async settings => {
      if (!session?.user) return null;
      const { data, error } = await cloud.from('reminder_settings').upsert({ user_id: session.user.id, email_notifications: Boolean(settings.email), dashboard_notifications: Boolean(settings.dashboard), followup_reminders: Boolean(settings.followups), daily_plan_frequency: settings.frequency || 'daily', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }, { onConflict: 'user_id' }).select('*').single();
      if (error) throw error; return data;
    }
  });

  window.RoleDeskFeedbackCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    submit: async payload => {
      const record = {
        user_id: session?.user?.id || null,
        email: window.ScopeSecurity.boundedText(payload.email || session?.user?.email, 320) || null,
        feedback_type: payload.feedbackType,
        page: window.ScopeSecurity.boundedText(payload.page, 200) || null,
        message: window.ScopeSecurity.boundedText(payload.message, 5000),
        browser_info: payload.browserInfo || {},
        device_info: payload.deviceInfo || {}
      };
      let { error } = await cloud.from('feedback').insert(record);
      if (error && /browser_info|device_info|column/i.test(error.message || '')) {
        const fallback = { ...record };
        delete fallback.browser_info;
        delete fallback.device_info;
        ({ error } = await cloud.from('feedback').insert(fallback));
      }
      if (error) throw error;
      window.RoleDeskAnalytics?.track?.('feedback_submitted', { page: record.page, metadata:{ type: record.feedback_type } });
      return true;
    }
  });

  window.RoleDeskAnalyticsCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    recordEvents: async events => {
      const rows = (events || []).slice(0, 100).map(event => ({
        user_id: session?.user?.id || null,
        event_name: window.ScopeSecurity.boundedText(event.eventName || event.event, 120),
        page: window.ScopeSecurity.boundedText(event.page, 120) || null,
        entity_type: window.ScopeSecurity.boundedText(event.entityType, 80) || null,
        entity_id: event.entityId || null,
        severity: window.ScopeSecurity.boundedText(event.severity, 40) || 'info',
        message: window.ScopeSecurity.boundedText(event.message, 500) || null,
        metadata: event.metadata || {},
        created_at: event.createdAt || new Date().toISOString()
      })).filter(row => row.event_name);
      if (!rows.length) return true;
      const { error } = await cloud.from('analytics_events').insert(rows);
      if (error) throw error;
      const errorRows = rows.filter(row => row.event_name === 'error_encountered').map(row => ({
        user_id: row.user_id,
        error_type: window.ScopeSecurity.boundedText(row.metadata?.name || 'frontend', 120),
        severity: row.severity || 'error',
        page: row.page,
        message: row.message || 'Frontend error',
        metadata: row.metadata || {}
      }));
      if (errorRows.length) await cloud.from('error_logs').insert(errorRows);
      return true;
    },
    recordSourceHealth: async health => {
      if (!session?.user) return null;
      const rows = (health || []).slice(0, 20).map(item => ({
        user_id: session.user.id,
        source: window.ScopeSecurity.boundedText(item.id || item.source, 80),
        source_id: window.ScopeSecurity.boundedText(item.id, 80),
        source_name: window.ScopeSecurity.boundedText(item.name, 200),
        status: window.ScopeSecurity.boundedText(item.status, 60),
        reliability_score: Number(item.reliability || item.reliabilityScore || 0),
        fetched: Number(item.jobsFetched || item.fetched || 0),
        jobs_fetched: Number(item.jobsFetched || item.fetched || 0),
        duplicates: Number(item.duplicates || 0),
        failed_requests: Number(item.failedRequests || 0),
        duplicate_jobs: Number(item.duplicates || 0),
        trust_average: Number.isFinite(item.trustAverage) ? item.trustAverage : null,
        last_error: window.ScopeSecurity.boundedText(item.error, 500) || null,
        error_message: window.ScopeSecurity.boundedText(item.error, 500) || null,
        checked_at: item.lastSyncAt || new Date().toISOString()
      })).filter(row => row.source_id);
      if (!rows.length) return true;
      const { error } = await cloud.from('source_health_logs').insert(rows);
      if (error) throw error;
      return true;
    }
  });

  window.RoleDeskBillingCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    getStatus: async () => {
      if (!session?.user) return null;
      const { data, error } = await cloud.rpc('get_billing_status');
      if (error) throw error;
      return {
        plan: data?.plan || 'free',
        billingStatus: data?.billing_status || 'manual',
        trialEndsAt: data?.trial_ends_at || null,
        trialPlan: data?.trial_plan || null,
        renewalDate: data?.renewal_date || null,
        provider: data?.payment_provider || 'not_configured',
        usagePeriod: data?.usage_period || new Date().toISOString().slice(0, 7),
        usage: data?.usage || {}
      };
    },
    recordUsage: async (usageKey, amount = 1) => {
      if (!session?.user) return null;
      const { data, error } = await cloud.rpc('record_usage_event', { p_usage_key: usageKey, p_amount: amount });
      if (error) throw error;
      return data;
    },
    createCheckout: async planId => {
      if (!session?.user) return null;
      const { data, error } = await cloud.rpc('create_checkout_placeholder', { p_plan: planId });
      if (error) throw error;
      return data;
    },
    adminDashboard: async () => {
      const { data, error } = await cloud.rpc('admin_billing_dashboard');
      if (error) throw error;
      return data;
    },
    adminAssignPlan: async payload => {
      const { data, error } = await cloud.rpc('admin_assign_user_plan', {
        p_email: payload.email,
        p_plan: payload.plan,
        p_billing_status: payload.billingStatus || 'manual',
        p_trial_days: Number(payload.trialDays || 0),
        p_note: payload.note || null
      });
      if (error) throw error;
      return data;
    },
    adminResetUsage: async email => {
      const { data, error } = await cloud.rpc('admin_reset_user_usage', { p_email: email });
      if (error) throw error;
      return data;
    }
  });

  async function initializeSession(nextSession) {
    session = nextSession;
    if (!session?.user) {
      activeUserId = null;
      captureLegacyRecovery();
      clearActiveBrowserCache();
      renderAccount();
      document.documentElement.classList.remove('auth-pending');
      return;
    }
    if (activeUserId === session.user.id) return;
    activeUserId = session.user.id;
    currentEmailDraftId = null;
    accountEmail.value = session.user.email || '';
    renderAccount();
    await loadCloudCanonical();
    document.documentElement.classList.remove('auth-pending');
  }

  async function writeEmailDraft(fields) {
    if (!session?.user) return null;
    const payload = {
      kind: 'email',
      recipient: window.ScopeSecurity.boundedText(fields.recipient, 500),
      subject: window.ScopeSecurity.boundedText(fields.subject, 1000),
      body: window.ScopeSecurity.boundedText(fields.body, 50000),
      destination: { recipient: window.ScopeSecurity.boundedText(fields.recipient, 500) },
      content: {
        subject: window.ScopeSecurity.boundedText(fields.subject, 1000),
        body: window.ScopeSecurity.boundedText(fields.body, 50000),
        recipient_name: window.ScopeSecurity.boundedText(fields.recipientName, 300),
        company: window.ScopeSecurity.boundedText(fields.company, 500),
        local_opportunity_id: fields.opportunityRef || null,
        warnings: Array.isArray(fields.warnings) ? fields.warnings.slice(0, 20) : [],
        confidence_score: Number.isFinite(fields.confidenceScore) ? fields.confidenceScore : null,
        mode: 'manual-gmail-compose'
      }
    };
    const query = currentEmailDraftId
      ? cloud.from('drafts').update(payload).eq('id', currentEmailDraftId).select('*').single()
      : cloud.from('drafts').insert({ ...payload, user_id: session.user.id }).select('*').single();
    const { data, error } = await query;
    if (error) throw error;
    currentEmailDraftId = data.id;
    return data;
  }

  function queueEmailDraft(fields) {
    pendingEmailDraft = fields;
    clearTimeout(emailDraftTimer);
    emailDraftTimer = setTimeout(() => {
      const queued = pendingEmailDraft;
      pendingEmailDraft = null;
      writeEmailDraft(queued).catch(error => setStatus(friendlyAuthError(error, 'Draft saved locally. Sign in to sync.'), true));
    }, 450);
    return Promise.resolve(true);
  }

  async function flushEmailDraft(fields) {
    clearTimeout(emailDraftTimer);
    pendingEmailDraft = null;
    return writeEmailDraft(fields);
  }

  window.ScopeCloudApproval = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    beginEmailDraft: () => { currentEmailDraftId = null; },
    saveEmailDraft: queueEmailDraft,
    saveEmailDraftNow: flushEmailDraft,
    approveEmailDraft: async fields => {
      const draft = await flushEmailDraft(fields);
      if (!draft) return null;
      const { data, error } = await cloud.rpc('approve_draft', { p_draft_id: draft.id });
      if (error) throw error;
      return data;
    },
    revokeEmailDraft: async reason => {
      if (!session?.user || !currentEmailDraftId) return null;
      const { data, error } = await cloud.rpc('revoke_draft_approval', { p_draft_id: currentEmailDraftId, p_reason: reason || 'user_revoked' });
      if (error) throw error;
      return data;
    },
    verifyEmailDraft: async fields => {
      const draft = await flushEmailDraft(fields);
      if (!draft) return false;
      const { data, error } = await cloud.from('drafts').select('recipient,subject,body,approval_state,content_hash').eq('id', draft.id).single();
      if (error) throw error;
      return data.approval_state === 'user_approved' && Boolean(data.content_hash) && data.recipient === fields.recipient && data.subject === fields.subject && data.body === fields.body;
    },
    recordEmailEvent: async (eventType, metadata = {}) => {
      if (!session?.user || !currentEmailDraftId) return null;
      const { data, error } = await cloud.rpc('record_email_client_event', { p_draft_id: currentEmailDraftId, p_event_type: eventType, p_metadata: metadata });
      if (error) throw error;
      return data;
    },
    logComposeOpened: async () => {
      if (!session?.user || !currentEmailDraftId) return null;
      const { data, error } = await cloud.rpc('record_email_client_event', { p_draft_id: currentEmailDraftId, p_event_type: 'email.compose_opened', p_metadata: { compose_opened: true } });
      if (error) throw error;
      return data;
    },
    listEmailDrafts: async () => {
      if (!session?.user) return [];
      const { data, error } = await cloud.from('drafts').select('id,recipient,subject,body,content,approval_state,created_at,updated_at').eq('user_id', session.user.id).eq('kind','email').order('updated_at',{ ascending:false }).limit(30);
      if (error) throw error;
      return data || [];
    },
    loadEmailDraft: async id => {
      if (!session?.user) return null;
      const { data, error } = await cloud.from('drafts').select('id,recipient,subject,body,content,approval_state,created_at,updated_at').eq('user_id', session.user.id).eq('id',id).eq('kind','email').single();
      if (error) throw error;
      currentEmailDraftId = data.id;
      return data;
    }
  });

  accountButton.addEventListener('click', () => accountDialog.showModal());
  document.querySelector('#createAccount').addEventListener('click', async event => {
    const email = requireEmail();
    if (!email) return;
    if (password.value.length < 8) return setStatus('Choose a password with at least 8 characters.', true);
    await withAuthBusy(event.currentTarget, 'Creating account…', async () => {
      setStatus('Requesting account…');
      const { error } = await cloud.auth.signUp({ email, password: password.value, options: { emailRedirectTo: authRedirectUrl() } });
      password.value = '';
      if (error) return setStatus(friendlyAuthError(error, 'Unable to create the account right now. Try again.'), true);
      window.RoleDeskAnalytics?.track?.('signup_started', { page:'account' });
      setStatus('Account created. Open the confirmation email, then return and sign in.');
    });
  });

  document.querySelector('#signInAccount').addEventListener('click', async event => {
    const email = requireEmail();
    if (!email) return;
    if (!password.value) return setStatus('Enter your password.', true);
    await withAuthBusy(event.currentTarget, 'Signing in…', async () => {
      setStatus('Signing in…');
      const { data, error } = await cloud.auth.signInWithPassword({ email, password: password.value });
      password.value = '';
      if (error) return setStatus(friendlyAuthError(error, 'Unable to sign in right now. Try again.'), true);
      window.RoleDeskAnalytics?.track?.('login', { page:'account' });
      await initializeSession(data.session);
    });
  });

  document.querySelector('#resetPassword').addEventListener('click', async event => {
    const email = requireEmail();
    if (!email) return;
    await withAuthBusy(event.currentTarget, 'Requesting…', async () => {
      const { error } = await cloud.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
      setStatus(error ? friendlyAuthError(error, 'Unable to request a password reset right now. Try again.') : 'Password reset email requested. Check your inbox.', Boolean(error));
    });
  });

  document.querySelector('#resendConfirmation').addEventListener('click', async event => {
    const email = requireEmail();
    if (!email) return;
    await withAuthBusy(event.currentTarget, 'Resending…', async () => {
      setStatus('Requesting a new verification email…');
      const { error } = await cloud.auth.resend({ type:'signup', email, options:{ emailRedirectTo:authRedirectUrl() } });
      setStatus(error ? friendlyAuthError(error, 'Email failed to send. Please try again.') : 'Verification email sent. Check your inbox and spam folder.', Boolean(error));
    });
  });

  document.querySelector('#updateRecoveredPassword').addEventListener('click', async event => {
    const nextPassword = document.querySelector('#recoveryPassword').value;
    if (nextPassword.length < 8) return setStatus('Choose a password with at least 8 characters.', true);
    await withAuthBusy(event.currentTarget, 'Updating…', async () => {
      const { error } = await cloud.auth.updateUser({ password: nextPassword });
      if (error) return setStatus(friendlyAuthError(error, 'Unable to update the password right now. Request a new reset link.'), true);
      document.querySelector('#recoveryPassword').value = '';
      passwordRecovery.hidden = true;
      setStatus('Password updated.');
      renderAccount();
    });
  });

  document.querySelector('#signOutAccount').addEventListener('click', async event => {
    await withAuthBusy(event.currentTarget, 'Signing out…', async () => {
      await syncNow({ silent: true });
      const { error } = await cloud.auth.signOut();
      if (error) return setStatus(friendlyAuthError(error, 'Unable to sign out right now. Try again.'), true);
      session = null;
      activeUserId = null;
      clearActiveBrowserCache();
      renderAccount();
      setStatus('Signed out. The account cache was cleared from this browser.');
    });
  });
  document.querySelector('#syncCloudNow').addEventListener('click', () => syncNow());
  document.querySelector('#importLegacyData').addEventListener('click', importLegacyData);

  cloud.auth.onAuthStateChange((event, nextSession) => {
    if (event === 'PASSWORD_RECOVERY') {
      session = nextSession;
      passwordRecovery.hidden = false;
      renderAccount();
      accountDialog.showModal();
      document.documentElement.classList.remove('auth-pending');
      return;
    }
    if (event === 'SIGNED_OUT' && session?.user) setStatus('Your session expired. Please sign in again.', true);
    setTimeout(() => initializeSession(nextSession), 0);
  });

  captureLegacyRecovery();
  cloud.auth.getSession().then(async ({ data }) => {
    await initializeSession(data.session);
    if (invalidResetLink) {
      passwordRecovery.hidden = true;
      renderAccount();
      setStatus(resetLinkMessage, true);
      if (!accountDialog.open) accountDialog.showModal();
      history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }).catch(error => {
    setStatus(friendlyAuthError(error, 'Authentication could not initialize.'), true);
    document.documentElement.classList.remove('auth-pending');
  });
})();
