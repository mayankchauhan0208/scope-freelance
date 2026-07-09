(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RoleDeskPlans = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const UNLIMITED = -1;
  const usageKeys = [
    'resume_uploads','resume_analyses','job_searches','saved_jobs','application_kits',
    'resume_variants','cover_letters','recruiter_emails','linkedin_messages','freelance_proposals',
    'exports','followup_reminders','job_refreshes','ai_recommendations','daily_plans','verified_job_checks'
  ];
  const labels = {
    resume_uploads:'Resume uploads',
    resume_analyses:'Resume analyses',
    job_searches:'Job searches',
    saved_jobs:'Saved jobs',
    application_kits:'Application kits',
    resume_variants:'Resume variants',
    cover_letters:'Cover letters',
    recruiter_emails:'Recruiter emails',
    linkedin_messages:'LinkedIn messages',
    freelance_proposals:'Freelance proposals',
    exports:'PDF/DOCX exports',
    followup_reminders:'Follow-up reminders',
    job_refreshes:'Job refreshes',
    ai_recommendations:'AI recommendations',
    daily_plans:'Daily plans',
    verified_job_checks:'Verified job checks'
  };
  const featureMap = {
    resume_upload:'resume_uploads',
    resume_analysis:'resume_analyses',
    job_search:'job_searches',
    saved_job:'saved_jobs',
    application_kit:'application_kits',
    resume_variant:'resume_variants',
    cover_letter:'cover_letters',
    recruiter_email:'recruiter_emails',
    linkedin_message:'linkedin_messages',
    freelance_proposal:'freelance_proposals',
    export:'exports',
    followup:'followup_reminders',
    job_refresh:'job_refreshes',
    ai_recommendation:'ai_recommendations',
    daily_plan:'daily_plans',
    verified_job_check:'verified_job_checks'
  };
  const plans = {
    free: {
      id:'free', name:'Free', monthlyPrice:0, yearlyPrice:0, visible:true, cta:'Start free',
      description:'For trying RoleDesk with honest limits.',
      features:['ATS resume checks','Limited job search','Manual tracker','Draft-first safety'],
      limits:{ resume_uploads:2, resume_analyses:5, job_searches:10, saved_jobs:20, application_kits:2, resume_variants:2, cover_letters:3, recruiter_emails:5, linkedin_messages:3, freelance_proposals:3, exports:3, followup_reminders:5, job_refreshes:5, ai_recommendations:10, daily_plans:7, verified_job_checks:10 }
    },
    beta: {
      id:'beta', name:'Beta', monthlyPrice:0, yearlyPrice:0, visible:true, cta:'Request beta access',
      description:'Temporary Pro-style access while RoleDesk is improving.',
      badge:'Beta',
      features:['Pro limits during beta','Feedback priority','Application kits','Source quality checks'],
      limits:{ resume_uploads:10, resume_analyses:50, job_searches:150, saved_jobs:250, application_kits:40, resume_variants:25, cover_letters:60, recruiter_emails:80, linkedin_messages:60, freelance_proposals:60, exports:50, followup_reminders:80, job_refreshes:100, ai_recommendations:120, daily_plans:60, verified_job_checks:150 }
    },
    pro: {
      id:'pro', name:'Pro', monthlyPrice:999, yearlyPrice:9990, visible:true, recommended:true, cta:'Upgrade to Pro',
      description:'For active job seekers and freelancers applying every week.',
      features:['Higher search limits','Application kits','Resume variants','Email and proposal drafts','Follow-up planning'],
      limits:{ resume_uploads:20, resume_analyses:100, job_searches:300, saved_jobs:500, application_kits:100, resume_variants:60, cover_letters:150, recruiter_emails:200, linkedin_messages:150, freelance_proposals:150, exports:120, followup_reminders:200, job_refreshes:250, ai_recommendations:250, daily_plans:120, verified_job_checks:300 }
    },
    premium: {
      id:'premium', name:'Premium', monthlyPrice:1999, yearlyPrice:19990, visible:true, cta:'Upgrade to Premium',
      description:'For power users who want deeper tracking and heavier usage.',
      badge:'Best for power users',
      features:['Premium usage limits','Advanced analytics','More exports','More verified checks','Priority support path'],
      limits:Object.fromEntries(usageKeys.map(key => [key, UNLIMITED]))
    },
    admin: {
      id:'admin', name:'Admin', monthlyPrice:0, yearlyPrice:0, visible:false, cta:'Admin managed',
      description:'Internal product operations access.',
      limits:Object.fromEntries(usageKeys.map(key => [key, UNLIMITED]))
    },
    custom: {
      id:'custom', name:'Custom / Enterprise', monthlyPrice:null, yearlyPrice:null, visible:true, cta:'Contact admin',
      description:'For teams, placement partners, and custom workflows.',
      features:['Custom limits','Admin-managed setup','Team-ready billing foundation','Future enterprise support'],
      limits:Object.fromEntries(usageKeys.map(key => [key, UNLIMITED]))
    }
  };

  function plan(id = 'free') {
    return plans[id] || plans.free;
  }
  function limit(planId, key) {
    const value = plan(planId).limits?.[key];
    return Number.isFinite(value) ? value : 0;
  }
  function price(planId) {
    const value = plan(planId).monthlyPrice;
    if (value === null) return 'Custom';
    if (!value) return 'Free';
    return `₹${Number(value).toLocaleString('en-IN')}/mo`;
  }
  function visiblePlans() {
    return Object.values(plans).filter(item => item.visible);
  }
  return Object.freeze({ UNLIMITED, usageKeys, labels, featureMap, plans, plan, limit, price, visiblePlans });
});
