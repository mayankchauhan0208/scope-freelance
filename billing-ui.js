(function () {
  const plans = window.RoleDeskPlans;
  if (!plans) return;
  const $ = selector => document.querySelector(selector);
  const esc = value => window.ScopeSecurity.escapeHtml(String(value ?? ''));
  const key = 'roledesk-billing-local-v1';
  const nowPeriod = () => new Date().toISOString().slice(0, 7);
  const defaultState = () => ({
    plan:'free', billingStatus:'manual', trialEndsAt:null, renewalDate:null,
    provider:'not_configured', usagePeriod:nowPeriod(), usage:{}, source:'local_fallback'
  });
  let state = defaultState();

  function readLocal() {
    try { return { ...defaultState(), ...(JSON.parse(localStorage.getItem(key) || 'null') || {}) }; }
    catch { return defaultState(); }
  }
  function writeLocal(next) {
    localStorage.setItem(key, JSON.stringify(next));
  }
  function resetIfNeeded(next) {
    if (next.usagePeriod !== nowPeriod()) return { ...next, usagePeriod:nowPeriod(), usage:{} };
    return next;
  }
  function effectivePlan() {
    if (state.trialEndsAt && new Date(state.trialEndsAt) > new Date()) return state.trialPlan || state.plan || 'free';
    return state.plan || 'free';
  }
  function usageFor(feature) {
    const usageKey = plans.featureMap[feature] || feature;
    const used = Number(state.usage?.[usageKey] || 0);
    const limit = plans.limit(effectivePlan(), usageKey);
    return { usageKey, used, limit, left:limit === plans.UNLIMITED ? plans.UNLIMITED : Math.max(0, limit - used) };
  }
  function limitMessage(feature) {
    const usage = usageFor(feature);
    const label = plans.labels[usage.usageKey] || feature;
    if (usage.limit === plans.UNLIMITED) return `${label}: unlimited on ${plans.plan(effectivePlan()).name}.`;
    if (usage.left <= 0) return `You reached your ${plans.plan(effectivePlan()).name} ${label.toLowerCase()} limit. Upgrade to continue.`;
    return `${usage.left} ${label.toLowerCase()} left this month.`;
  }
  function showUpgrade(feature, message) {
    const node = $('#billingPrompt');
    if (node) {
      node.hidden = false;
      node.innerHTML = `<strong>${esc(message || limitMessage(feature))}</strong><span>Upgrade when you need more usage. Payment integration is not active yet, so contact admin for beta/pro access.</span><button class="button secondary" type="button" id="billingPromptPlans">View plans</button>`;
      $('#billingPromptPlans')?.addEventListener('click', () => window.RoleDeskState?.openView?.('plans'));
    }
    window.toast?.(message || limitMessage(feature));
    window.RoleDeskAnalytics?.track?.('usage_limit_hit', { page:'billing', metadata:{ feature, plan:effectivePlan() } });
  }
  function canUse(feature) {
    const usage = usageFor(feature);
    return usage.limit === plans.UNLIMITED || usage.used < usage.limit;
  }
  function consume(feature, amount = 1) {
    state = resetIfNeeded(readLocal());
    const usage = usageFor(feature);
    if (usage.limit !== plans.UNLIMITED && usage.used + amount > usage.limit) {
      showUpgrade(feature);
      return false;
    }
    const nextUsage = { ...(state.usage || {}), [usage.usageKey]: usage.used + amount };
    state = { ...state, usage:nextUsage };
    writeLocal(state);
    window.RoleDeskBillingCloud?.recordUsage?.(usage.usageKey, amount).catch(() => {});
    render();
    return true;
  }
  function priceLine(plan) {
    if (plan.monthlyPrice === null) return '<strong>Custom</strong><small>Admin-managed</small>';
    if (!plan.monthlyPrice) return '<strong>Free</strong><small>No card required</small>';
    return `<strong>₹${Number(plan.monthlyPrice).toLocaleString('en-IN')}</strong><small>/ month</small>`;
  }
  function progress(used, limit) {
    if (limit === plans.UNLIMITED) return '<div class="usage-bar"><i style="width:100%"></i></div><small>Unlimited</small>';
    const percent = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
    return `<div class="usage-bar"><i style="width:${percent}%"></i></div><small>${used} / ${limit}</small>`;
  }
  function renderPlans() {
    const node = $('#plansGrid');
    if (!node) return;
    node.innerHTML = plans.visiblePlans().map(plan => `
      <article class="plan-card ${plan.recommended ? 'recommended' : ''}">
        <div><span class="eyebrow">${esc(plan.badge || (plan.recommended ? 'Recommended' : plan.name))}</span><h3>${esc(plan.name)}</h3><p>${esc(plan.description)}</p></div>
        <div class="plan-price">${priceLine(plan)}</div>
        <ul>${(plan.features || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul>
        <div class="plan-limits">${['resume_analyses','job_searches','application_kits','exports','verified_job_checks'].map(key => {
          const value = plan.limits[key];
          return `<span>${esc(plans.labels[key])}: <b>${value === plans.UNLIMITED ? 'Unlimited' : value}</b></span>`;
        }).join('')}</div>
        <button class="button ${plan.recommended ? 'primary' : 'secondary'}" data-plan-select="${esc(plan.id)}" type="button">${esc(plan.cta)}</button>
      </article>`).join('');
    node.querySelectorAll('[data-plan-select]').forEach(button => button.addEventListener('click', () => startCheckout(button.dataset.planSelect)));
  }
  function renderBilling() {
    const summary = $('#billingSummary');
    const usageNode = $('#billingUsageGrid');
    if (!summary || !usageNode) return;
    const plan = plans.plan(effectivePlan());
    const trialDays = state.trialEndsAt ? Math.ceil((new Date(state.trialEndsAt) - new Date()) / 86400000) : null;
    summary.innerHTML = `
      <article><span>Current plan</span><strong>${esc(plan.name)}</strong><small>${esc(state.source === 'cloud' ? 'Synced from Supabase' : 'Local estimate until billing migration is applied')}</small></article>
      <article><span>Billing status</span><strong>${esc(state.billingStatus || 'manual')}</strong><small>${esc(state.provider === 'not_configured' ? 'Managed by admin until payments are active' : state.provider)}</small></article>
      <article><span>Trial</span><strong>${trialDays && trialDays > 0 ? `${trialDays} days left` : 'No active trial'}</strong><small>${esc(state.trialEndsAt || '—')}</small></article>
      <article><span>Renewal</span><strong>${esc(state.renewalDate || 'Not scheduled')}</strong><small>Payment provider not active yet</small></article>`;
    const important = ['resume_analyses','job_searches','application_kits','resume_variants','exports','recruiter_emails','followup_reminders','verified_job_checks'];
    usageNode.innerHTML = important.map(key => {
      const used = Number(state.usage?.[key] || 0);
      const limit = plans.limit(plan.id, key);
      return `<article><div><span>${esc(plans.labels[key])}</span><strong>${limit === plans.UNLIMITED ? `${used} used` : `${Math.max(0, limit - used)} left`}</strong></div>${progress(used, limit)}</article>`;
    }).join('');
  }
  function renderComparison() {
    const node = $('#planComparison');
    if (!node) return;
    const visible = plans.visiblePlans();
    const rows = ['resume_analyses','job_searches','saved_jobs','application_kits','resume_variants','exports','followup_reminders','verified_job_checks'];
    node.innerHTML = `<table class="plan-table"><thead><tr><th>Feature</th>${visible.map(plan => `<th>${esc(plan.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(key => `<tr><td>${esc(plans.labels[key])}</td>${visible.map(plan => `<td>${plan.limits[key] === plans.UNLIMITED ? 'Unlimited' : esc(plan.limits[key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  async function startCheckout(planId) {
    const plan = plans.plan(planId);
    window.RoleDeskAnalytics?.track?.('upgrade_attempted', { page:'plans', metadata:{ plan:plan.id } });
    const result = await window.RoleDeskBillingCloud?.createCheckout?.(plan.id).catch(() => null);
    if (result?.checkoutUrl && window.ScopeSecurity.safeHttpUrl(result.checkoutUrl)) {
      window.open(result.checkoutUrl, '_blank', 'noopener');
      return;
    }
    const node = $('#checkoutNotice');
    if (node) {
      node.hidden = false;
      node.innerHTML = `<strong>Payment integration is not active yet.</strong><span>Contact admin for beta/pro access. No fake payment success state was created.</span>`;
    }
    window.toast?.('Payment integration is not active yet. Contact admin for beta/pro access.');
  }
  async function load() {
    state = resetIfNeeded(readLocal());
    const cloudState = await window.RoleDeskBillingCloud?.getStatus?.().catch(() => null);
    if (cloudState) {
      state = resetIfNeeded({ ...state, ...cloudState, source:'cloud', usage:{ ...(state.usage || {}), ...(cloudState.usage || {}) } });
      writeLocal(state);
    }
    render();
  }
  function render() {
    renderPlans();
    renderBilling();
    renderComparison();
  }
  document.addEventListener('DOMContentLoaded', () => {
    render();
    $('#refreshBilling')?.addEventListener('click', load);
    $('#billingContactAdmin')?.addEventListener('click', () => window.RoleDeskState?.openView?.('admin'));
    document.addEventListener('roledesk:cloud-ready', load);
    document.addEventListener('roledesk:auth-changed', load);
    load();
  });
  window.RoleDeskBilling = Object.freeze({ load, render, canUse, consume, usageFor, limitMessage, effectivePlan, startCheckout, state:() => state });
})();
