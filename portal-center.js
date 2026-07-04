(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RoleDeskPortals = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const designTerms = ['Graphic Designer','Visual Designer','Brand Designer','Marketing Designer','Creative Designer','Digital Designer','Social Media Designer','Campaign Designer','Motion Designer','Video Editor','UI Visual Designer','Freelance Designer','Remote Designer'];
  const portalRegistry = Object.freeze([
    {id:'remotive',name:'Remotive',category:'Remote jobs',status:'Live API',method:'Permitted public API',search:true,apply:'Official listing',api:false,oauth:false,note:'Public job API; applications stay on the official listing.'},
    {id:'arbeitnow',name:'Arbeitnow',category:'Jobs / remote',status:'Live API',method:'Permitted public API',search:true,apply:'Official listing',api:false,oauth:false,note:'Public job-board API; no form automation.'},
    {id:'linkedin',name:'LinkedIn',category:'Jobs',status:'Guided Search',method:'Official search link',search:true,apply:'Manual only',api:true,oauth:true,note:'RoleDesk does not scrape, sign in, or apply.'},
    {id:'naukri',name:'Naukri',category:'Jobs',status:'Guided Search',method:'Official search link',search:true,apply:'Manual only',api:true,oauth:true,note:'Search opens Naukri; no direct connection is claimed.'},
    {id:'indeed',name:'Indeed',category:'Jobs',status:'Guided Search',method:'Official search link',search:true,apply:'Manual only',api:true,oauth:false,note:'Official search page only; no scraping.'},
    {id:'upwork',name:'Upwork',category:'Freelance',status:'Guided Search',method:'Official search link',search:true,apply:'Manual bid only',api:true,oauth:true,note:'RoleDesk never bids or messages clients.'},
    {id:'contra',name:'Contra',category:'Freelance',status:'Guided Search',method:'Official opportunity link',search:true,apply:'Manual only',api:true,oauth:true,note:'Guided browsing only.'},
    {id:'fiverr',name:'Fiverr',category:'Freelance',status:'Guided Search',method:'Official category/search',search:true,apply:'Manual only',api:true,oauth:true,note:'No buyer messaging or account automation.'},
    {id:'freelancer',name:'Freelancer',category:'Freelance',status:'Guided Search',method:'Official search link',search:true,apply:'Manual bid only',api:true,oauth:true,note:'No automatic bidding or form submission.'},
    {id:'behance',name:'Behance Jobs',category:'Portfolio / jobs',status:'Guided Search',method:'Official jobs page',search:true,apply:'Manual only',api:true,oauth:true,note:'RoleDesk opens the official jobs page.'},
    {id:'dribbble',name:'Dribbble Jobs',category:'Portfolio / jobs',status:'Guided Search',method:'Official jobs page',search:true,apply:'Manual only',api:true,oauth:false,note:'RoleDesk opens the official jobs page.'},
    {id:'company',name:'Company career page',category:'Company careers',status:'Manual Import',method:'Paste public details',search:false,apply:'Official career page',api:false,oauth:false,note:'Paste the public URL and description; RoleDesk does not fetch restricted pages.'},
    {id:'job-url',name:'Job post URL',category:'Jobs',status:'Manual Import',method:'Paste URL + description',search:false,apply:'Manual only',api:false,oauth:false,note:'URLs are validated; page content is not scraped.'},
    {id:'client-brief',name:'Client brief URL',category:'Freelance',status:'Manual Import',method:'Paste URL + brief',search:false,apply:'Manual only',api:false,oauth:false,note:'Use public information you are allowed to save.'},
    {id:'lead-url',name:'Freelance lead URL',category:'Freelance',status:'Manual Import',method:'Paste URL + notes',search:false,apply:'Manual outreach only',api:false,oauth:false,note:'No automatic contact or outreach.'}
  ]);

  const clean = value => String(value || '').trim();
  const normalize = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const unique = values => [...new Set(values.map(clean).filter(Boolean))];

  function expandedSearchTerms(profile = {}, query = '') {
    const base = clean(query || profile.targetRole || profile.roles?.[0] || 'Graphic Designer');
    const profileText = `${base} ${profile.targetRole || ''} ${(profile.roles || []).join(' ')} ${(profile.skills || []).join(' ')} ${(profile.tools || []).join(' ')} ${(profile.industries || []).join(' ')}`;
    const terms = [base, ...(profile.roles || []), ...(profile.skills || []).slice(0,5), ...(profile.tools || []).slice(0,4)];
    if (/design|creative|brand|visual|motion|video|figma|photoshop|illustrat/i.test(profileText)) terms.push(...designTerms);
    return unique(terms);
  }

  function guidedSearchUrl(provider, query = 'Graphic Designer') {
    const q = encodeURIComponent(clean(query) || 'Graphic Designer'), slug = encodeURIComponent(clean(query).toLowerCase().replace(/\s+/g,'-'));
    const urls = {
      linkedin:`https://www.linkedin.com/jobs/search/?keywords=${q}&location=Worldwide&f_WT=2`,
      naukri:`https://www.naukri.com/${slug}-jobs`,
      indeed:`https://www.indeed.com/jobs?q=${q}`,
      upwork:`https://www.upwork.com/nx/search/jobs/?q=${q}`,
      contra:`https://contra.com/opportunities?query=${q}`,
      fiverr:`https://www.fiverr.com/search/gigs?query=${q}`,
      freelancer:`https://www.freelancer.com/jobs/?keyword=${q}`,
      behance:'https://www.behance.net/joblist',
      dribbble:`https://dribbble.com/jobs?query=${q}`
    };
    return urls[provider] || '';
  }

  function dedupeOpportunities(items = []) {
    const seenUrls = new Set(), seenComposite = new Set(), output = [], duplicates = [];
    for (const item of items) {
      const url = clean(item.url).toLowerCase().replace(/\/$/,'');
      const composite = [item.title,item.company || item.client,item.location || item.country].map(normalize).join('|');
      if ((url && seenUrls.has(url)) || (composite !== '||' && seenComposite.has(composite))) { duplicates.push(item); continue; }
      if (url) seenUrls.add(url); if (composite !== '||') seenComposite.add(composite); output.push(item);
    }
    return { items:output, duplicates, removed:duplicates.length };
  }

  function renderPortalCenter() {
    if (!root.document) return;
    const grid = root.document.querySelector('#portalGrid'), count = root.document.querySelector('#portalSummary');
    if (!grid) return;
    const escape = value => root.ScopeSecurity?.escapeHtml ? root.ScopeSecurity.escapeHtml(value) : clean(value);
    const query = root.document.querySelector('#liveSearchQuery')?.value || 'Graphic Designer';
    grid.innerHTML = portalRegistry.map(portal => {
      const guided = portal.status === 'Guided Search', manual = portal.status === 'Manual Import', href = guided ? guidedSearchUrl(portal.id,query) : '';
      return `<article class="portal-card"><div class="portal-card-top"><div><span class="portal-category">${escape(portal.category)}</span><h3>${escape(portal.name)}</h3></div><span class="portal-status status-${portal.status.toLowerCase().replace(/\W+/g,'-')}">${escape(portal.status)}</span></div><dl><div><dt>Method</dt><dd>${escape(portal.method)}</dd></div><div><dt>Search</dt><dd>${portal.search?'Supported':'Manual details'}</dd></div><div><dt>Apply</dt><dd>${escape(portal.apply)}</dd></div><div><dt>API / OAuth</dt><dd>${portal.api?'Official access required':'Not required'} · ${portal.oauth?'OAuth required for future connection':'No OAuth'}</dd></div></dl><p>${escape(portal.note)}</p><small>Last checked: current app session</small>${guided?`<a class="button secondary" href="${href}" target="_blank" rel="noopener">Open guided search ↗</a>`:manual?'<button class="button secondary portal-import" type="button">Import opportunity</button>':'<button class="button secondary portal-live" type="button">Open Smart Search</button>'}</article>`;
    }).join('');
    if (count) count.textContent = `${portalRegistry.filter(item=>item.status==='Live API').length} live · ${portalRegistry.filter(item=>item.status==='Guided Search').length} guided · ${portalRegistry.filter(item=>item.status==='Manual Import').length} manual`;
    grid.querySelectorAll('.portal-import').forEach(button => button.addEventListener('click',()=>root.document.querySelector('#opportunityDialog')?.showModal()));
    grid.querySelectorAll('.portal-live').forEach(button => button.addEventListener('click',()=>root.document.querySelector('button[data-view="smart"]')?.click()));
  }

  return Object.freeze({ portalRegistry, designTerms, expandedSearchTerms, guidedSearchUrl, dedupeOpportunities, renderPortalCenter });
});
