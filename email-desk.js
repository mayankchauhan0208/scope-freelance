(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RoleDeskEmail = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const communicationStatuses = Object.freeze(['Draft Prepared','Reviewed','Sent Manually','Reply Received','Follow-up Needed','No Response','Closed']);
  const followUpTypes = Object.freeze(['First follow-up','Polite reminder','Reply after interest','Negotiation follow-up','Thank-you after interview/call']);
  const clean = value => String(value || '').trim();
  const validEmail = value => /^\S+@\S+\.\S+$/.test(clean(value));
  const bounded = (value,max) => clean(value).slice(0,max);

  function validateDraft(fields = {}, profile = {}) {
    const warnings = [], errors = [];
    if (!clean(fields.recipientName)) warnings.push('Recipient name is missing. Use “Hi team,” unless you verify a name.');
    if (!clean(fields.recipient)) errors.push('Recipient email is missing. Add it before sending.');
    else if (!validEmail(fields.recipient)) errors.push('Recipient email is invalid.');
    if (!clean(fields.subject)) errors.push('Subject is missing. Add it before approval.');
    if (!clean(fields.body)) errors.push('Message body is missing. Add it before approval.');
    if (!clean(profile.fullName || profile.displayName)) warnings.push('Your name is missing. “[Your name]” remains in the draft.');
    if (/\[(?:your name|add|missing)/i.test(fields.body || '')) warnings.push('Resolve all placeholders before approval.');
    return { warnings, errors, canApprove:errors.length === 0 && !warnings.some(item=>/Your name is missing|placeholders/i.test(item)) };
  }

  function buildGmailComposeUrl(fields = {}, from = '') {
    if (!validEmail(fields.recipient) || !clean(fields.subject) || !clean(fields.body)) return '';
    const params = new URLSearchParams({ view:'cm', fs:'1', to:bounded(fields.recipient,500), su:bounded(fields.subject,1000), body:bounded(fields.body,50000) });
    if (validEmail(from)) params.set('authuser',clean(from));
    return `https://mail.google.com/mail/u/?${params.toString()}`;
  }

  function defaultCommunication(opportunity = {}) {
    return { status:opportunity.communication?.status || 'Draft Prepared', followUpDate:opportunity.communication?.followUpDate || '', notes:opportunity.communication?.notes || '', updatedAt:opportunity.communication?.updatedAt || '' };
  }

  function updateCommunication(opportunity = {}, patch = {}) {
    const current = defaultCommunication(opportunity), status = communicationStatuses.includes(patch.status) ? patch.status : current.status;
    return { ...opportunity, communication:{ ...current, ...patch, status, notes:bounded(patch.notes ?? current.notes,5000), updatedAt:new Date().toISOString(), providerConfirmed:false, verification:'user_reported' } };
  }

  function generateFollowUp(profile = {}, opportunity = {}, type = 'First follow-up', priorDraft = '') {
    const name = clean(profile.fullName || profile.displayName) || '[Your name]', title = clean(opportunity.title) || '[opportunity]', company = clean(opportunity.client || opportunity.company), greeting = clean(opportunity.recipientName) ? `Hi ${clean(opportunity.recipientName)},` : 'Hi team,';
    const messages = {
      'First follow-up':`I’m following up on the ${title} opportunity. I’m still interested and can confirm a focused first step once the scope and timing are clear.`,
      'Polite reminder':`Just a polite reminder about my note regarding the ${title} opportunity. I’d be glad to answer any questions or clarify the proposed next step.`,
      'Reply after interest':`Thank you for your interest regarding the ${title} opportunity. I’d be happy to discuss the priority deliverables, timing, and a practical first milestone.`,
      'Negotiation follow-up':`I’m following up on our discussion about the ${title} opportunity. I’m open to aligning scope, timing, and budget while keeping the agreed outcome clear.`,
      'Thank-you after interview/call':`Thank you for the conversation about the ${title} opportunity. I appreciated learning more about the priorities and would be glad to provide any additional information.`
    };
    const text = `${greeting}\n\n${messages[type] || messages['First follow-up']}\n\nBest,\n${name}`;
    const warnings = [];
    if (!clean(priorDraft)) warnings.push('No previous email is available. Verify the context before using this follow-up.');
    if (!company) warnings.push('Company or client name is missing.');
    if (name === '[Your name]') warnings.push('Your name is missing. Add it before using this follow-up.');
    if (type === 'Reply after interest' && !clean(priorDraft)) warnings.push('No client reply is recorded; do not imply that interest was received.');
    return { text, warnings, confidenceScore:Math.max(20,90-warnings.length*20), type };
  }

  return Object.freeze({ communicationStatuses, followUpTypes, validateDraft, buildGmailComposeUrl, defaultCommunication, updateCommunication, generateFollowUp, validEmail });
});
