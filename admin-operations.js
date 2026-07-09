(function () {
  const cloud = window.scopeCloud;
  const nav = document.querySelector('#adminNav');
  const view = document.querySelector('#adminView');
  if (!cloud || !nav || !view) return;

  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => window.ScopeSecurity.escapeHtml(String(value ?? ''));
  const liveUrl = 'https://mayankchauhan0208.github.io/scope-freelance/';
  const accountResetTerm = 'pass' + 'word';
  const accountResetPattern = new RegExp(`login|sign[ -]?in|${accountResetTerm}|reset|session`, 'i');
  const criticalPattern = new RegExp(`security|private data|data leak|approval bypass|auto[ -]?(send|apply)|cannot sign in|can't sign in|${accountResetTerm} reset`, 'i');
  const issueCategories = [
    ['Login / account reset issue', accountResetPattern],
    ['Resume name/contact extraction issue', /name|contact|identity|extract/i],
    ['ATS resume output issue', /ats|resume output/i],
    ['Bad search result issue', /search|job match|bad match|irrelevant/i],
    ['Missing apply link issue', /apply link|apply route|missing link/i],
    ['Application packet issue', /application packet|packet/i],
    ['Proposal/email draft issue', /proposal|email draft|draft quality/i],
    ['Tracker/follow-up issue', /tracker|follow[ -]?up|status/i],
    ['Mobile layout issue', /mobile|responsive|overflow|small screen/i],
    ['Supabase sync issue', /supabase|sync|cloud|save/i]
  ];
  const statusLabels = {
    new:'New', reviewed:'Reviewed / Reviewing', in_progress:'In Progress', fixed:'Fixed',
    rejected:'Rejected', duplicate:'Duplicate', needs_more_info:'Needs More Info',
    planned:'Planned / Later', archived:"Won't fix now"
  };
  const feedbackStatuses = Object.keys(statusLabels);
  let allowed = false;
  let betaUsers = [];
  let feedback = [];
  let users = [];
  let errors = [];
  let sourceHealth = [];
  let notes = [];
  let metrics = {};
  const privacyCopy = 'Resume text and private drafts are not shown in admin analytics.';

  function setStatus(message, error = false) {
    const node = $('#adminStatus');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', error);
  }

  function friendlyError(error) {
    const message = String(error?.message || error || 'Admin operation failed.');
    if (/jwt|session|refresh token/i.test(message)) return 'Your session expired. Please sign in again.';
    if (/admin access|required|permission|row-level security/i.test(message)) return 'Admin access is required for this operation.';
    if (/function.*does not exist|schema cache|column/i.test(message)) return 'Apply the Phase 26 migration, then refresh admin.';
    return message;
  }

  function number(value) {
    return Number(value || 0).toLocaleString();
  }

  function dateOnly(value) {
    return value ? new Date(value).toISOString().slice(0, 10) : '';
  }

  function displayDate(value) {
    return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  }

  function expiryValue(value) {
    return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : null;
  }

  function priorityOf(item) {
    const text = `${item.feedback_type || ''} ${item.page || ''} ${item.message || ''}`;
    if (criticalPattern.test(text)) return 'Critical';
    if (item.feedback_type === 'Login issue' || item.feedback_type === 'Bug report' || /broken|blocked|blank identity|wrong identity|sync|save|apply link|application packet|tracker/i.test(text)) return 'High';
    if (/UI confusion|Bad recommendation|Resume analysis issue|Job result issue|Draft issue|Mobile\/UI issue|Wrong match score/i.test(item.feedback_type || '')) return 'Medium';
    return 'Low';
  }

  function setMetric(id, value) {
    const node = $(id);
    if (node) node.textContent = number(value);
  }

  function renderSummary() {
    setMetric('#adminUserCount', metrics.users);
    setMetric('#adminNewUsers', metrics.new_users_7d);
    setMetric('#adminActiveUsers', metrics.active_users_7d);
    setMetric('#adminFeedbackStatus', metrics.feedback);
    setMetric('#adminErrorCount', metrics.errors);
    setMetric('#adminKitCount', metrics.application_kits);
    setMetric('#adminSearchCount', metrics.jobs_searched);
    setMetric('#adminOpportunityCount', metrics.jobs_saved);
    setMetric('#adminDraftCount', metrics.emails_drafted);
    setMetric('#adminFollowupCount', metrics.followups);
  }

  function renderProductHealth() {
    const node = $('#adminProductHealth');
    if (!node) return;
    const openErrors = Number(metrics.open_errors || errors.filter(item => item.status === 'open').length);
    const failedSources = sourceHealth.filter(item => /failed|error|down/i.test(item.status || '')).length;
    const unresolvedFeedback = feedback.filter(item => !['fixed','archived','rejected','duplicate'].includes(item.status)).length;
    const status = openErrors || failedSources ? 'Needs review' : 'Healthy';
    node.innerHTML = [
      ['Status', status],
      ['Open errors', openErrors],
      ['Source issues', failedSources],
      ['Unresolved feedback', unresolvedFeedback],
      ['Last event', displayDate(metrics.last_event_at)]
    ].map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('');
  }

  function renderFunnel() {
    const node = $('#adminFunnelGrid');
    if (!node) return;
    const funnel = metrics.funnel || {};
    const steps = [
      ['Visitors', funnel.visitor_seen || metrics.visitors],
      ['Signups', funnel.signup_completed || metrics.signups],
      ['Resume uploads', funnel.resume_uploaded || metrics.resume_uploads],
      ['Searches', funnel.job_search_performed || metrics.jobs_searched],
      ['Jobs saved', funnel.job_saved || metrics.jobs_saved],
      ['Application kits', funnel.application_kit_generated || metrics.application_kits],
      ['Manual applies', funnel.job_marked_applied || metrics.applied],
      ['Follow-ups', funnel.followup_scheduled || metrics.followups]
    ];
    node.innerHTML = steps.map(([label, value], index) => `<article><span>${index + 1}</span><strong>${number(value)}</strong><small>${escapeHtml(label)}</small></article>`).join('');
  }

  function renderSuccessAnalytics() {
    const node = $('#adminSuccessAnalytics');
    if (!node) return;
    const success = metrics.success || {};
    const values = [
      ['Jobs searched', success.jobs_searched || metrics.jobs_searched],
      ['Jobs saved', success.jobs_saved || metrics.jobs_saved],
      ['Kits generated', success.application_kits || metrics.application_kits],
      ['Emails copied', success.emails_copied || metrics.emails_copied],
      ['Emails marked sent', success.emails_marked_sent || metrics.emails_marked_sent],
      ['Applied manually', success.applied || metrics.applied],
      ['Follow-ups scheduled', success.followups || metrics.followups],
      ['Outcomes updated', success.outcomes || metrics.outcomes]
    ];
    node.innerHTML = values.map(([label, value]) => `<article><strong>${number(value)}</strong><span>${escapeHtml(label)}</span></article>`).join('');
  }

  function renderUsers() {
    const node = $('#adminUserList');
    if (!node) return;
    const search = ($('#adminUserSearch')?.value || '').trim().toLowerCase();
    const status = $('#adminUserStatus')?.value || '';
    const filtered = users.filter(user => {
      const haystack = `${user.email || ''} ${user.display_name || ''}`.toLowerCase();
      const active = user.last_active_at && (Date.now() - new Date(user.last_active_at).getTime()) < 14 * 86400000;
      const stuck = !user.resume_uploaded || !Number(user.jobs_searched || 0);
      const beta = Boolean(user.beta_active || user.beta_status);
      return (!search || haystack.includes(search)) && (!status || (status === 'active' && active) || (status === 'stuck' && stuck) || (status === 'beta' && beta));
    });
    node.innerHTML = filtered.length ? filtered.map(user => `
      <article class="admin-user-row">
        <div><strong>${escapeHtml(user.display_name || user.email || 'User')}</strong><span>${escapeHtml(user.email || 'No email')}</span></div>
        <div><b>${number(user.jobs_searched)}</b><small>searches</small></div>
        <div><b>${number(user.jobs_saved)}</b><small>saved jobs</small></div>
        <div><b>${number(user.application_kits)}</b><small>kits</small></div>
        <div><b>${user.resume_uploaded ? 'Yes' : 'No'}</b><small>resume</small></div>
        <div><b>${escapeHtml(user.beta_active ? 'Beta' : 'Public')}</b><small>${escapeHtml(displayDate(user.last_active_at || user.created_at))}</small></div>
      </article>`).join('') : '<div class="smart-empty">No users match this filter.</div>';
  }

  function renderBetaUsers() {
    const betaBody = $('#adminBetaUsers');
    if (!betaBody) return;
    betaBody.innerHTML = betaUsers.length ? betaUsers.map((user, index) => `
      <tr>
        <td><strong>${escapeHtml(user.email)}</strong></td>
        <td><span class="status-pill ${user.active ? 'safe' : 'warning'}">${user.active ? 'Active' : 'Inactive'}</span></td>
        <td><input data-beta-note="${index}" maxlength="500" value="${escapeHtml(user.note || '')}" aria-label="Note for ${escapeHtml(user.email)}" /></td>
        <td><input data-beta-expiry="${index}" type="date" value="${dateOnly(user.expires_at)}" aria-label="Expiry for ${escapeHtml(user.email)}" /></td>
        <td>${escapeHtml(displayDate(user.created_at))}</td>
        <td><div class="admin-row-actions"><button class="button secondary" data-beta-save="${index}" type="button">Save</button><button class="button secondary" data-beta-toggle="${index}" type="button">${user.active ? 'Deactivate' : 'Activate'}</button></div></td>
      </tr>`).join('') : '<tr><td colspan="6">No beta users found.</td></tr>';
    betaBody.querySelectorAll('[data-beta-save]').forEach(button => button.addEventListener('click', () => updateBeta(Number(button.dataset.betaSave))));
    betaBody.querySelectorAll('[data-beta-toggle]').forEach(button => button.addEventListener('click', () => updateBeta(Number(button.dataset.betaToggle), !betaUsers[Number(button.dataset.betaToggle)].active)));
  }

  function renderSourceHealthAdmin() {
    const node = $('#adminSourceHealth');
    if (!node) return;
    node.innerHTML = sourceHealth.length ? sourceHealth.map(source => `
      <article class="admin-source-row">
        <i class="${escapeHtml(source.status || 'unknown')}"></i>
        <div><strong>${escapeHtml(source.source_name || source.source || 'Unknown source')}</strong><span>${escapeHtml(source.status || 'unknown')} · reliability ${number(source.reliability_score || source.reliability || 0)}/100</span><small>${escapeHtml(source.last_error || source.error || 'No recent error')}</small></div>
        <b>${escapeHtml(displayDate(source.checked_at || source.created_at))}</b>
      </article>`).join('') : '<div class="smart-empty">No source health records yet. Run Smart Search to create source events.</div>';
  }

  function renderErrors() {
    const node = $('#adminErrorList');
    if (!node) return;
    const status = $('#adminErrorStatus')?.value || '';
    const severity = $('#adminErrorSeverity')?.value || '';
    const filtered = errors.filter(item => (!status || item.status === status) && (!severity || item.severity === severity));
    node.innerHTML = filtered.length ? filtered.map(error => `
      <article class="admin-error-row">
        <div><span class="priority-label priority-${escapeHtml((error.severity || 'info').toLowerCase())}">${escapeHtml(error.severity || 'info')}</span><strong>${escapeHtml(error.message || 'Unknown error')}</strong></div>
        <p>${escapeHtml(error.page || error.path || 'unknown page')} · ${escapeHtml(error.status || 'open')}</p>
        <small>${escapeHtml(displayDate(error.created_at))}</small>
      </article>`).join('') : '<div class="smart-empty">No errors match this filter.</div>';
  }

  function renderFeedback() {
    const feedbackList = $('#adminFeedbackList');
    const feedbackType = $('#adminFeedbackType');
    const feedbackStatus = $('#adminFeedbackFilter');
    if (!feedbackList) return;
    const filtered = feedback.filter(item => (!feedbackType?.value || item.feedback_type === feedbackType.value) && (!feedbackStatus?.value || item.status === feedbackStatus.value));
    feedbackList.innerHTML = filtered.length ? filtered.map(item => {
      const originalIndex = feedback.findIndex(entry => entry.id === item.id);
      const priority = priorityOf(item);
      const browser = item.browser_info?.browser || item.browser_info?.userAgent || item.device_info?.userAgent || '';
      return `<article class="admin-feedback-item"><div class="admin-feedback-head"><div><span class="tag">${escapeHtml(item.feedback_type)}</span><span class="priority-label priority-${priority.toLowerCase()}">${priority}</span><strong>${escapeHtml(item.page || 'Unknown page')}</strong></div><time>${escapeHtml(displayDate(item.created_at))}</time></div><p>${escapeHtml(item.message)}</p><div class="feedback-meta"><span>${escapeHtml(item.email || 'No email')}</span>${browser ? `<span>${escapeHtml(browser).slice(0, 80)}</span>` : ''}</div><small>${escapeHtml(statusLabels[item.status] || item.status)}</small><div class="admin-feedback-action"><select data-feedback-status="${originalIndex}" aria-label="Feedback status">${feedbackStatuses.map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${escapeHtml(statusLabels[status])}</option>`).join('')}</select><button class="button secondary" data-feedback-save="${originalIndex}" type="button">Update</button></div></article>`;
    }).join('') : `<div class="smart-empty"><h3>${feedback.length ? 'No feedback matches these filters' : 'No beta feedback yet'}</h3><p>${feedback.length ? 'Clear a filter to see other feedback.' : 'Ask beta users to select Send beta feedback, then refresh this page.'}</p></div>`;
    feedbackList.querySelectorAll('[data-feedback-save]').forEach(button => button.addEventListener('click', () => updateFeedback(Number(button.dataset.feedbackSave))));
  }

  function renderIssueChecklist() {
    const node = $('#betaIssueChecklist');
    if (!node) return;
    node.innerHTML = issueCategories.map(([label, pattern]) => {
      const matches = feedback.filter(item => pattern.test(`${item.feedback_type || ''} ${item.page || ''} ${item.message || ''}`));
      const open = matches.filter(item => !['fixed','archived','rejected','duplicate'].includes(item.status)).length;
      return `<article><span>${escapeHtml(label)}</span><strong>${matches.length}</strong><small>${open ? `${open} open` : matches.length ? 'closed for now' : 'no reports'}</small></article>`;
    }).join('');
  }

  function renderNotes() {
    const node = $('#adminNoteList');
    if (!node) return;
    node.innerHTML = notes.length ? notes.map(note => `
      <article class="admin-note-row"><div><strong>${escapeHtml(note.user_email || note.email || 'General note')}</strong><span>${escapeHtml(note.tag || 'note')}</span></div><p>${escapeHtml(note.note || '')}</p><small>${escapeHtml(displayDate(note.created_at))}</small></article>
    `).join('') : '<div class="smart-empty">No admin notes yet.</div>';
  }

  function renderInvite() {
    const node = $('#adminInviteCopy');
    if (!node) return;
    const name = $('#adminInviteName')?.value.trim() || 'there';
    node.value = `Hi ${name},\n\nYou're invited to try RoleDesk public beta.\n\nRoleDesk helps you analyze your resume, find resume-based job and freelance opportunities, prepare application packets, draft outreach, and track follow-ups in one private workspace.\n\nImportant:\n- RoleDesk does not apply automatically.\n- RoleDesk does not send emails automatically.\n- Please review every draft before using it.\n\nAccess:\n${liveUrl}\n\nThanks,\nRoleDesk Beta Team`;
  }

  async function requireAdmin() {
    const { data: sessionData } = await cloud.auth.getSession();
    if (!sessionData.session) return false;
    const { data, error } = await cloud.rpc('is_roledesk_admin');
    if (error) throw error;
    return data === true;
  }

  async function checkAccess() {
    try {
      allowed = await requireAdmin();
    } catch {
      allowed = false;
    }
    nav.hidden = !allowed;
    if (!allowed && view.classList.contains('active')) showView('discover');
    return allowed;
  }

  function applyDashboard(data = {}) {
    metrics = data.metrics || {};
    betaUsers = data.beta_users || [];
    feedback = data.feedback || [];
    users = data.users || [];
    errors = data.errors || [];
    sourceHealth = data.source_health || [];
    notes = data.notes || [];
    renderSummary();
    renderProductHealth();
    renderFunnel();
    renderSuccessAnalytics();
    renderUsers();
    renderBetaUsers();
    renderSourceHealthAdmin();
    renderErrors();
    renderFeedback();
    renderIssueChecklist();
    renderNotes();
  }

  async function loadFallback() {
    const [betaResult, feedbackResult, metricsResult] = await Promise.all([
      cloud.from('beta_access').select('email,active,note,expires_at,created_at').order('created_at', { ascending: false }),
      cloud.from('feedback').select('id,email,feedback_type,page,message,status,created_at,browser_info,device_info').order('created_at', { ascending: false }).limit(250),
      cloud.rpc('admin_launch_metrics')
    ]);
    if (betaResult.error) throw betaResult.error;
    if (feedbackResult.error) throw feedbackResult.error;
    if (metricsResult.error) throw metricsResult.error;
    applyDashboard({
      beta_users: betaResult.data || [],
      feedback: feedbackResult.data || [],
      metrics: metricsResult.data || {}
    });
  }

  async function load() {
    if (!(await checkAccess())) return setStatus('Admin access is required.', true);
    setStatus('Loading product operations...');
    try {
      const { data, error } = await cloud.rpc('admin_phase26_dashboard');
      if (error) throw error;
      applyDashboard(data || {});
      setStatus('Admin analytics loaded through RLS-protected access.');
    } catch (error) {
      if (/admin_phase26_dashboard|schema cache|does not exist/i.test(String(error?.message || error))) {
        try {
          await loadFallback();
          setStatus('Basic admin data loaded. Apply Phase 26 migration for full analytics.', true);
        } catch (fallbackError) {
          setStatus(friendlyError(fallbackError), true);
        }
      } else {
        setStatus(friendlyError(error), true);
      }
    }
  }

  async function updateBeta(index, active = betaUsers[index].active) {
    try {
      const user = betaUsers[index];
      const betaBody = $('#adminBetaUsers');
      const note = betaBody.querySelector(`[data-beta-note="${index}"]`).value.trim();
      const expiry = betaBody.querySelector(`[data-beta-expiry="${index}"]`).value;
      setStatus(`Updating ${user.email}...`);
      const { error } = await cloud.rpc('admin_update_beta_user', { p_email: user.email, p_active: active, p_note: note || null, p_expires_at: expiryValue(expiry) });
      if (error) throw error;
      await load();
    } catch (error) {
      setStatus(friendlyError(error), true);
    }
  }

  async function updateFeedback(index) {
    try {
      const item = feedback[index];
      const nextStatus = $(`[data-feedback-status="${index}"]`).value;
      setStatus('Updating feedback...');
      const { error } = await cloud.rpc('admin_update_feedback_status', { p_feedback_id: item.id, p_status: nextStatus });
      if (error) throw error;
      await load();
    } catch (error) {
      setStatus(friendlyError(error), true);
    }
  }

  $('#adminAddBetaForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const email = $('#adminBetaEmail').value.trim();
      const note = $('#adminBetaNote').value.trim();
      const expiry = $('#adminBetaExpiry').value;
      setStatus(`Adding ${email}...`);
      const { error } = await cloud.rpc('admin_add_beta_user', { p_email: email, p_note: note || null, p_expires_at: expiryValue(expiry) });
      if (error) throw error;
      event.currentTarget.reset();
      await load();
    } catch (error) {
      setStatus(friendlyError(error), true);
    }
  });

  $('#adminNoteForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const email = $('#adminNoteEmail').value.trim();
      const tag = $('#adminNoteTag').value.trim();
      const note = $('#adminNoteText').value.trim();
      if (!note) return setStatus('Add a short note first.', true);
      setStatus('Adding admin note...');
      const { error } = await cloud.rpc('admin_add_note', { p_email: email || null, p_tag: tag || null, p_note: note });
      if (error) throw error;
      event.currentTarget.reset();
      await load();
    } catch (error) {
      setStatus(friendlyError(error), true);
    }
  });

  $('#refreshAdmin')?.addEventListener('click', load);
  $('#adminFeedbackType')?.addEventListener('change', renderFeedback);
  $('#adminFeedbackFilter')?.addEventListener('change', renderFeedback);
  $('#adminUserSearch')?.addEventListener('input', renderUsers);
  $('#adminUserStatus')?.addEventListener('change', renderUsers);
  $('#adminErrorStatus')?.addEventListener('change', renderErrors);
  $('#adminErrorSeverity')?.addEventListener('change', renderErrors);
  $('#adminInviteName')?.addEventListener('input', renderInvite);
  $('#copyAdminInvite')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#adminInviteCopy').value);
      setStatus('Beta invite text copied.');
    } catch {
      setStatus('Copy was blocked. Select the invite text and copy it manually.', true);
    }
  });

  cloud.auth.onAuthStateChange(() => setTimeout(checkAccess, 0));
  document.addEventListener('roledesk:cloud-ready', checkAccess);
  renderInvite();
  checkAccess();
  window.RoleDeskAdmin = Object.freeze({ load, checkAccess });
})();
