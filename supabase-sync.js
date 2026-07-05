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
      contact_email: item.contactEmail || null,
      status: (item.status || 'Saved').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      match_score: Number.isFinite(item.skill) ? Math.max(0, Math.min(100, Math.round(item.skill))) : null,
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

  window.RoleDeskFeedbackCloud = Object.freeze({
    isSignedIn: () => Boolean(session?.user),
    submit: async payload => {
      const record = {
        user_id: session?.user?.id || null,
        email: window.ScopeSecurity.boundedText(payload.email || session?.user?.email, 320) || null,
        feedback_type: payload.feedbackType,
        page: window.ScopeSecurity.boundedText(payload.page, 200) || null,
        message: window.ScopeSecurity.boundedText(payload.message, 5000)
      };
      const { error } = await cloud.from('feedback').insert(record);
      if (error) throw error;
      return true;
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
  document.querySelector('#createAccount').addEventListener('click', async () => {
    const email = requireEmail();
    if (!email) return;
    if (password.value.length < 8) return setStatus('Choose a password with at least 8 characters.', true);
    setStatus('Requesting beta account…');
    const { error } = await cloud.auth.signUp({ email, password: password.value, options: { emailRedirectTo: authRedirectUrl() } });
    password.value = '';
    if (error) {
      return setStatus(friendlyAuthError(error, 'Unable to create the account right now. Try again.'), true);
    }
    setStatus('Account created. Open the confirmation email, then return and sign in.');
  });

  document.querySelector('#signInAccount').addEventListener('click', async () => {
    const email = requireEmail();
    if (!email) return;
    if (!password.value) return setStatus('Enter your password.', true);
    setStatus('Signing in…');
    const { data, error } = await cloud.auth.signInWithPassword({ email, password: password.value });
    password.value = '';
    if (error) return setStatus(friendlyAuthError(error, 'Unable to sign in right now. Try again.'), true);
    await initializeSession(data.session);
  });

  document.querySelector('#resetPassword').addEventListener('click', async () => {
    const email = requireEmail();
    if (!email) return;
    const { error } = await cloud.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
    setStatus(error ? friendlyAuthError(error, 'Unable to request a password reset right now. Try again.') : 'Password reset email requested. Check your inbox.', Boolean(error));
  });

  document.querySelector('#updateRecoveredPassword').addEventListener('click', async () => {
    const nextPassword = document.querySelector('#recoveryPassword').value;
    if (nextPassword.length < 8) return setStatus('Choose a password with at least 8 characters.', true);
    const { error } = await cloud.auth.updateUser({ password: nextPassword });
    if (error) return setStatus(friendlyAuthError(error, 'Unable to update the password right now. Request a new reset link.'), true);
    document.querySelector('#recoveryPassword').value = '';
    passwordRecovery.hidden = true;
    setStatus('Password updated.');
    renderAccount();
  });

  document.querySelector('#signOutAccount').addEventListener('click', async () => {
    await syncNow({ silent: true });
    await cloud.auth.signOut();
    session = null;
    activeUserId = null;
    clearActiveBrowserCache();
    renderAccount();
    setStatus('Signed out. The account cache was cleared from this browser.');
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
