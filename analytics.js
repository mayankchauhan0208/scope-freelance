(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RoleDeskAnalytics = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const KEY = 'roledesk-analytics-queue-v1';
  const REDACTED_EMAIL = '[email]';
  const REDACTED_PHONE = '[phone]';
  const clean = value => String(value || '').trim();
  const allowed = new Set([
    'visitor_seen','signup_started','signup_completed','login','resume_uploaded','resume_parsed',
    'resume_analysis_completed','job_search_performed','job_saved','job_moved_pipeline',
    'application_kit_generated','resume_tailored','cover_letter_generated','email_draft_generated',
    'email_copied','email_marked_sent','followup_scheduled','job_marked_applied','job_outcome_updated',
    'feedback_submitted','error_encountered','source_health_checked','export_created',
    'upgrade_attempted','usage_limit_hit'
  ]);
  const read = () => {
    try { return JSON.parse(root.localStorage?.getItem(KEY) || '[]') || []; }
    catch { return []; }
  };
  const write = queue => root.localStorage?.setItem(KEY, JSON.stringify(queue.slice(-250)));
  const context = () => ({
    page: root.document?.querySelector?.('.view.active')?.id || root.location?.hash?.replace('#','') || 'unknown',
    path: root.location?.pathname || '',
    userAgent: root.navigator?.userAgent || '',
    language: root.navigator?.language || '',
    screen: root.screen ? `${root.screen.width}x${root.screen.height}` : ''
  });
  const scrub = value => {
    const text = clean(value);
    return text
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED_EMAIL)
      .replace(/\+?\d[\d\s().-]{8,}\d/g, REDACTED_PHONE)
      .slice(0, 500);
  };
  function normalize(eventName, payload = {}) {
    const name = allowed.has(eventName) ? eventName : 'error_encountered';
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      eventName:name,
      event:name,
      page: clean(payload.page || context().page).slice(0, 120),
      entityType: clean(payload.entityType || payload.entity_type || '').slice(0, 80),
      entityId: payload.entityId || payload.entity_id || null,
      severity: clean(payload.severity || 'info').slice(0, 40),
      metadata: { ...context(), ...(payload.metadata || {}) },
      message: scrub(payload.message || ''),
      createdAt: new Date().toISOString()
    };
  }
  async function flush() {
    const queue = read();
    if (!queue.length || !root.RoleDeskAnalyticsCloud?.recordEvents) return false;
    const sent = await root.RoleDeskAnalyticsCloud.recordEvents(queue).catch(() => false);
    if (sent) write([]);
    return Boolean(sent);
  }
  function track(eventName, payload = {}) {
    const item = normalize(eventName, payload);
    write([...read(), item]);
    setTimeout(flush, 0);
    return item;
  }
  function error(error, payload = {}) {
    const message = scrub(error?.message || error || payload.message || 'Unknown error');
    return track('error_encountered', { ...payload, message, severity: payload.severity || 'error', metadata:{ ...(payload.metadata || {}), name:error?.name || '' } });
  }
  if (root.addEventListener) {
    root.addEventListener('error', event => error(event.error || event.message, { page:'global', metadata:{ filename:event.filename, line:event.lineno } }));
    root.addEventListener('unhandledrejection', event => error(event.reason, { page:'promise' }));
    root.addEventListener('DOMContentLoaded', () => track('visitor_seen'));
  }
  return Object.freeze({ track, error, flush, read, normalize, allowed:[...allowed] });
});
