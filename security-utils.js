(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ScopeSecurity = api;
  if (root?.document) root.document.documentElement.classList.add('auth-pending');
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function safeHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const parsed = new URL(value.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      if (parsed.username || parsed.password) return '';
      return parsed.href;
    } catch {
      return '';
    }
  }

  function isSafeHttpUrl(value) {
    return Boolean(safeHttpUrl(value));
  }

  function boundedText(value, maximum = 50000) {
    return String(value ?? '').replace(/\u0000/g, '').slice(0, maximum);
  }

  return Object.freeze({ escapeHtml, safeHttpUrl, isSafeHttpUrl, boundedText });
});
