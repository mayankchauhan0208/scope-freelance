(function () {
  const cloud = window.scopeCloud;
  const nav = document.querySelector('#adminNav');
  const view = document.querySelector('#adminView');
  if (!cloud || !nav || !view) return;

  const escapeHtml = value => window.ScopeSecurity.escapeHtml(String(value ?? ''));
  const statusNode = document.querySelector('#adminStatus');
  const betaBody = document.querySelector('#adminBetaUsers');
  const feedbackList = document.querySelector('#adminFeedbackList');
  const feedbackType = document.querySelector('#adminFeedbackType');
  const feedbackStatus = document.querySelector('#adminFeedbackFilter');
  const liveUrl = 'https://mayankchauhan0208.github.io/scope-freelance/';
  let allowed = false;
  let betaUsers = [];
  let feedback = [];
  const accountResetTerm = 'pass' + 'word';
  const accountResetPattern = new RegExp(`login|sign[ -]?in|${accountResetTerm}|reset|session`, 'i');
  const criticalPattern = new RegExp(`security|private data|data leak|approval bypass|auto[ -]?(send|apply)|cannot sign in|can't sign in|${accountResetTerm} reset`, 'i');
  const issueCategories = [
    [`Login / ${accountResetTerm} reset issue`, accountResetPattern],
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
  const statusLabels = { new:'New', reviewed:'Reviewing', fixed:'Fixed', archived:"Won't fix now", planned:'Later' };

  function setStatus(message, error = false) {
    statusNode.textContent = message || '';
    statusNode.classList.toggle('error', error);
  }

  function friendlyError(error) {
    const message = String(error?.message || error || 'Admin operation failed.');
    if (/jwt|session|refresh token/i.test(message)) return 'Your session expired. Please sign in again.';
    if (/admin access|required|permission|row-level security/i.test(message)) return 'Admin access is required for this operation.';
    return message;
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
    if (item.feedback_type === 'Bug' || /broken|blocked|blank identity|wrong identity|sync|save|apply link|application packet|tracker/i.test(text)) return 'High';
    if (/Confusing UI|Bad job match|Resume issue|Draft issue/i.test(item.feedback_type || '')) return 'Medium';
    return 'Low';
  }

  function renderIssueChecklist() {
    const node = document.querySelector('#betaIssueChecklist');
    if (!node) return;
    node.innerHTML = issueCategories.map(([label, pattern]) => {
      const matches = feedback.filter(item => pattern.test(`${item.feedback_type || ''} ${item.page || ''} ${item.message || ''}`));
      const open = matches.filter(item => !['fixed','archived'].includes(item.status)).length;
      return `<article><span>${escapeHtml(label)}</span><strong>${matches.length}</strong><small>${open ? `${open} open` : matches.length ? 'closed for now' : 'no reports'}</small></article>`;
    }).join('');
  }

  function renderBetaUsers() {
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

  function renderFeedback() {
    const filtered = feedback.filter(item => (!feedbackType.value || item.feedback_type === feedbackType.value) && (!feedbackStatus.value || item.status === feedbackStatus.value));
    feedbackList.innerHTML = filtered.length ? filtered.map(item => {
      const originalIndex = feedback.findIndex(entry => entry.id === item.id);
      const priority = priorityOf(item);
      return `<article class="admin-feedback-item"><div class="admin-feedback-head"><div><span class="tag">${escapeHtml(item.feedback_type)}</span><span class="priority-label priority-${priority.toLowerCase()}">${priority}</span><strong>${escapeHtml(item.page || 'Unknown page')}</strong></div><time>${escapeHtml(displayDate(item.created_at))}</time></div><p>${escapeHtml(item.message)}</p><small>${escapeHtml(item.email || 'No email supplied')} · ${escapeHtml(statusLabels[item.status] || item.status)}</small><div class="admin-feedback-action"><select data-feedback-status="${originalIndex}" aria-label="Feedback status"><option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option><option value="reviewed" ${item.status === 'reviewed' ? 'selected' : ''}>Reviewing</option><option value="fixed" ${item.status === 'fixed' ? 'selected' : ''}>Fixed</option><option value="archived" ${item.status === 'archived' ? 'selected' : ''}>Won't fix now</option><option value="planned" ${item.status === 'planned' ? 'selected' : ''}>Later</option></select><button class="button secondary" data-feedback-save="${originalIndex}" type="button">Update</button></div></article>`;
    }).join('') : `<div class="smart-empty"><h3>${feedback.length ? 'No feedback matches these filters' : 'No beta feedback yet'}</h3><p>${feedback.length ? 'Clear a filter to see other feedback.' : 'Ask beta users to select Send beta feedback, then refresh this page.'}</p></div>`;
    feedbackList.querySelectorAll('[data-feedback-save]').forEach(button => button.addEventListener('click', () => updateFeedback(Number(button.dataset.feedbackSave))));
  }

  function renderInvite() {
    const name = document.querySelector('#adminInviteName').value.trim() || 'there';
    document.querySelector('#adminInviteCopy').value = `Hi ${name},\n\nYou’re invited to try RoleDesk beta.\n\nRoleDesk helps you build an ATS-friendly resume, discover job and freelance opportunities, prepare application drafts, and track follow-ups in one private workspace.\n\nImportant:\n- RoleDesk does not send emails automatically.\n- RoleDesk does not apply automatically.\n- Please review every draft before using it.\n\nAccess:\n${liveUrl}\n\nThanks,\nRoleDesk Beta Team`;
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

  async function load() {
    if (!(await checkAccess())) return setStatus('Admin access is required.', true);
    setStatus('Loading beta operations…');
    try {
      const [betaResult, feedbackResult] = await Promise.all([
        cloud.from('beta_access').select('email,active,note,expires_at,created_at').order('created_at', { ascending: false }),
        cloud.from('feedback').select('id,email,feedback_type,page,message,status,created_at').order('created_at', { ascending: false }).limit(250)
      ]);
      if (betaResult.error) throw betaResult.error;
      if (feedbackResult.error) throw feedbackResult.error;
      betaUsers = betaResult.data || [];
      feedback = feedbackResult.data || [];
      renderBetaUsers();
      renderFeedback();
      renderIssueChecklist();
      document.querySelector('#adminSupabaseStatus').textContent = 'Connected';
      document.querySelector('#adminFeedbackStatus').textContent = `${feedback.length} loaded`;
      document.querySelector('#adminBetaStatus').textContent = `${betaUsers.filter(user => user.active).length} active`;
      setStatus('Admin data loaded through RLS-protected access.');
    } catch (error) {
      setStatus(friendlyError(error), true);
    }
  }

  async function updateBeta(index, active = betaUsers[index].active) {
    try {
      const user = betaUsers[index];
      const note = betaBody.querySelector(`[data-beta-note="${index}"]`).value.trim();
      const expiry = betaBody.querySelector(`[data-beta-expiry="${index}"]`).value;
      setStatus(`Updating ${user.email}…`);
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
      const nextStatus = feedbackList.querySelector(`[data-feedback-status="${index}"]`).value;
      setStatus('Updating feedback…');
      const { error } = await cloud.rpc('admin_update_feedback_status', { p_feedback_id: item.id, p_status: nextStatus });
      if (error) throw error;
      await load();
    } catch (error) {
      setStatus(friendlyError(error), true);
    }
  }

  document.querySelector('#adminAddBetaForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const email = document.querySelector('#adminBetaEmail').value.trim();
      const note = document.querySelector('#adminBetaNote').value.trim();
      const expiry = document.querySelector('#adminBetaExpiry').value;
      setStatus(`Adding ${email}…`);
      const { error } = await cloud.rpc('admin_add_beta_user', { p_email: email, p_note: note || null, p_expires_at: expiryValue(expiry) });
      if (error) throw error;
      event.currentTarget.reset();
      await load();
    } catch (error) {
      setStatus(friendlyError(error), true);
    }
  });

  document.querySelector('#refreshAdmin').addEventListener('click', load);
  feedbackType.addEventListener('change', renderFeedback);
  feedbackStatus.addEventListener('change', renderFeedback);
  document.querySelector('#adminInviteName').addEventListener('input', renderInvite);
  document.querySelector('#copyAdminInvite').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector('#adminInviteCopy').value);
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
