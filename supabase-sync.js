(function () {
  const config = window.SCOPE_SUPABASE_CONFIG;
  const sdk = window.supabase;
  const ownerEmail = 'connect.mayankchauhan@gmail.com';
  if (!config?.url || !config?.publishableKey || !sdk?.createClient) return;

  const cloud = sdk.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.scopeCloud = cloud;

  const accountDialog = document.querySelector('#accountDialog');
  const accountButton = document.querySelector('#cloudAccount');
  const status = document.querySelector('#accountStatus');
  const signedOut = document.querySelector('#signedOutAccount');
  const signedIn = document.querySelector('#signedInAccount');
  const password = document.querySelector('#accountPassword');
  let session = null;
  let syncing = false;
  let syncTimer = null;

  function setStatus(message, isError = false) {
    status.textContent = message || '';
    status.classList.toggle('error', isError);
  }

  function renderAccount() {
    const connected = Boolean(session?.user);
    signedOut.hidden = connected;
    signedIn.hidden = !connected;
    accountButton.classList.toggle('connected', connected);
    accountButton.querySelector('span').textContent = connected ? 'Private cloud connected' : 'Connect private cloud';
    if (connected) document.querySelector('#signedInEmail').textContent = session.user.email;
  }

  function isDemoOpportunity(item) {
    return seed.some(demo => demo.id === item.id && demo.title === item.title && demo.url === item.url);
  }

  function cloudOpportunity(item, userId) {
    return {
      user_id: userId,
      source: item.platform || 'Scope',
      source_id: String(item.id),
      source_url: item.url || `scope://local/${item.id}`,
      title: item.title,
      company: item.client || null,
      description: item.brief || null,
      contact_email: item.contactEmail || null,
      status: (item.status || 'Saved').toLowerCase().replaceAll(' ', '_'),
      match_score: Number.isFinite(item.skill) ? Math.max(0, Math.min(100, Math.round(item.skill))) : null,
      analysis: { scope_record: item, synced_from: 'scope-web' }
    };
  }

  async function syncNow(options = {}) {
    if (!session?.user || syncing) return;
    syncing = true;
    setStatus('Syncing your private workspace…');
    try {
      const userId = session.user.id;
      if (resumeProfile) {
        const portfolio = resumeProfile.portfolioUrl ? [resumeProfile.portfolioUrl] : [];
        const preferences = { ...resumeProfile };
        delete preferences.text;
        const { error } = await cloud.from('profiles').upsert({
          user_id: userId,
          display_name: 'Mayank Chauhan',
          work_email: ownerEmail,
          resume_text: resumeProfile.text || null,
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
      const timestamp = new Date();
      document.querySelector('#lastCloudSync').textContent = `Last synced ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setStatus('Private cloud sync complete.');
      if (!options.silent) toast('Private cloud synced');
    } catch (error) {
      setStatus(error.message || 'Cloud sync failed.', true);
      if (!options.silent) toast('Cloud sync needs attention');
    } finally {
      syncing = false;
    }
  }

  async function loadCloud() {
    if (!session?.user) return;
    try {
      const userId = session.user.id;
      const [{ data: profile, error: profileError }, { data: cloudItems, error: itemsError }] = await Promise.all([
        cloud.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        cloud.from('opportunities').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      ]);
      if (profileError) throw profileError;
      if (itemsError) throw itemsError;
      if (profile) {
        resumeProfile = { ...(profile.preferences || {}), text: profile.resume_text || '', portfolioUrl: profile.portfolio_urls?.[0] || profile.preferences?.portfolioUrl || '' };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(resumeProfile));
        renderProfile();
      }
      if (cloudItems?.length) {
        const existingUrls = new Set(opportunities.map(item => item.url).filter(Boolean));
        const restored = cloudItems.map((row, index) => {
          const saved = row.analysis?.scope_record || {};
          return { ...saved, id: Number(saved.id) || Date.now() + index, title: saved.title || row.title, client: saved.client || row.company || 'Unknown', brief: saved.brief || row.description || '', url: saved.url || row.source_url, platform: saved.platform || row.source, status: saved.status || 'Saved', skill: Number.isFinite(saved.skill) ? saved.skill : row.match_score || 60 };
        }).filter(item => !existingUrls.has(item.url));
        if (restored.length) {
          opportunities = [...restored, ...opportunities];
          persist();
          renderDashboard();
        }
      }
      setStatus('Your private cloud workspace is connected.');
    } catch (error) {
      setStatus(error.message || 'Could not load cloud data.', true);
    }
  }

  function scheduleSync() {
    if (!session?.user) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow({ silent: true }), 900);
  }

  const localPersist = persist;
  persist = function () { localPersist(); scheduleSync(); };
  const localSaveProfile = saveProfile;
  saveProfile = function () { localSaveProfile(); scheduleSync(); };

  accountButton.addEventListener('click', () => accountDialog.showModal());
  document.querySelector('#createAccount').addEventListener('click', async () => {
    if (password.value.length < 8) return setStatus('Choose a password with at least 8 characters.', true);
    setStatus('Creating your private account…');
    const { error } = await cloud.auth.signUp({ email: ownerEmail, password: password.value, options: { emailRedirectTo: `${location.origin}${location.pathname}` } });
    if (error) return setStatus(error.message, true);
    password.value = '';
    setStatus('Account created. Open the Supabase confirmation email, then return and sign in.');
  });
  document.querySelector('#signInAccount').addEventListener('click', async () => {
    if (!password.value) return setStatus('Enter your private Scope password.', true);
    setStatus('Signing in…');
    const { data, error } = await cloud.auth.signInWithPassword({ email: ownerEmail, password: password.value });
    if (error) return setStatus(error.message, true);
    password.value = '';
    session = data.session;
    renderAccount();
    await loadCloud();
    await syncNow({ silent: true });
  });
  document.querySelector('#signOutAccount').addEventListener('click', async () => {
    await cloud.auth.signOut();
    session = null;
    renderAccount();
    setStatus('Signed out. Local browser data remains available.');
  });
  document.querySelector('#syncCloudNow').addEventListener('click', () => syncNow());

  cloud.auth.onAuthStateChange((_event, nextSession) => {
    const wasDisconnected = !session?.user;
    session = nextSession;
    renderAccount();
    if (wasDisconnected && session?.user) setTimeout(() => loadCloud(), 0);
  });
  cloud.auth.getSession().then(({ data }) => {
    session = data.session;
    renderAccount();
    if (session?.user) loadCloud();
  });
})();
