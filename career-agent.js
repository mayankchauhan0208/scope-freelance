(function(root){
  'use strict';
  const DAY=86400000;
  const clean=value=>String(value??'').trim();
  const lower=value=>clean(value).toLowerCase();
  const clamp=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
  const list=value=>Array.isArray(value)?value.filter(Boolean):clean(value).split(/[,\n]/).map(clean).filter(Boolean);
  const dateValue=value=>{const time=new Date(value||0).getTime();return Number.isFinite(time)?time:0};
  const daysSince=value=>dateValue(value)?Math.max(0,Math.floor((Date.now()-dateValue(value))/DAY)):999;
  const statusOf=o=>lower(o.status).replace(/[\s/-]+/g,'_');
  const matchOf=o=>clamp(o.match_score??o.skill??o.score);
  const qualityOf=o=>clamp(o.quality_score??o.qualityScore??60);
  const readinessOf=o=>clamp(o.readiness_score??o.readinessScore??50);
  const sourceOf=o=>clean(o.platform||o.source||'Manual');
  const titleOf=o=>clean(o.title||o.role||'Opportunity');
  const companyOf=o=>clean(o.client||o.company||'Unknown company');
  const targetRoles=profile=>list(profile?.targetRoles||profile?.roles||profile?.targetRole);
  const skills=profile=>list(profile?.skills).map(lower);
  const active=o=>!['offer','rejected','closed_not_relevant','closed','archived','skipped','completed'].includes(statusOf(o));
  const alreadyApplied=o=>['applied','submitted','email_sent','client_replied','interview','interview_scheduled','negotiation','offer','rejected','no_response'].includes(statusOf(o));
  const feedbackPenalty=(o,feedback=[])=>feedback.reduce((sum,item)=>{
    const sameRole=lower(item.role_type||item.metadata?.role_type)===lower(titleOf(o));
    const sameSource=lower(item.source||item.metadata?.source)===lower(sourceOf(o));
    const outcome=lower(item.outcome);
    return sum+((['wrong_role','not_interested','fake_job'].includes(outcome)&&sameRole)?12:0)+((['fake_job','already_filled'].includes(outcome)&&sameSource)?10:0);
  },0);
  function priority(o,profile={},feedback=[]){
    const age=daysSince(o.published_at||o.createdAt||o.created_at);
    const freshness=age<=2?100:age<=7?80:age<=14?55:25;
    const roles=targetRoles(profile).map(lower);
    const roleFit=roles.length?(roles.some(role=>lower(titleOf(o)).includes(role)||role.includes(lower(titleOf(o))))?100:50):60;
    const preferred=lower(profile.workPreference||profile.work_mode||profile.remotePreference);
    const mode=lower(o.workMode||o.work_mode||(o.remote?'remote':''));
    const locationFit=!preferred||!mode?60:(preferred.includes(mode)||mode.includes(preferred)?100:35);
    const salary=Number(o.pipeline_value??o.budget??o.salary_min??0),minimum=Number(profile.minimumSalary||profile.minSalary||0);
    const salaryFit=!minimum||!salary?60:(salary>=minimum?100:Math.max(20,Math.round(salary/minimum*100)));
    const expectedLevel=lower(profile.experienceLevel||profile.seniority),jobLevel=lower(o.experienceLevel||o.experience_level);
    const seniorityFit=!expectedLevel||!jobLevel||jobLevel==='unknown'?60:(jobLevel.includes(expectedLevel)||expectedLevel.includes(jobLevel)?100:40);
    const contact=o.email||o.contact_email_verified||o.contactEmailVerified?100:45;
    const deadline=o.application_deadline||o.deadlineDate;
    const deadlineDays=deadline?Math.ceil((dateValue(deadline)-Date.now())/DAY):null;
    const deadlineScore=deadlineDays===null?60:deadlineDays<0?0:deadlineDays<=3?100:75;
    const applied=alreadyApplied(o);
    const followUpDue=applied&&dateValue(o.followup?.nextAt||o.next_followup_at||o.followUpDate)<=Date.now()&&dateValue(o.followup?.nextAt||o.next_followup_at||o.followUpDate)>0;
    let score=.24*matchOf(o)+.16*qualityOf(o)+.14*readinessOf(o)+.09*freshness+.09*roleFit+.06*locationFit+.06*salaryFit+.05*seniorityFit+.04*contact+.04*deadlineScore+.03*(active(o)?80:10)-feedbackPenalty(o,feedback);
    if(applied&&!followUpDue)score-=20;
    if(followUpDue)score+=15;
    if(qualityOf(o)<35)score-=30;
    score=clamp(score);
    let label='Low Priority';
    if(qualityOf(o)<35||statusOf(o)==='closed_not_relevant')label='Avoid / Not Relevant';
    else if(followUpDue)label='Follow Up Today';
    else if(!applied&&score>=78&&readinessOf(o)>=65)label='Apply Today';
    else if(!applied&&matchOf(o)>=75&&readinessOf(o)<65)label='Prepare Resume First';
    else if(score>=72)label='Strong Match';
    else if(score>=55)label='Good Backup';
    return {score,label,reasons:[`Resume match ${matchOf(o)}%`,`Readiness ${readinessOf(o)}%`,`Quality ${qualityOf(o)}%`,minimum?(salary?`Salary fit ${salaryFit}%`:'Salary not stated'):'Salary preference not set',expectedLevel?`Seniority fit ${seniorityFit}%`:'Experience target not set',age<999?`Saved ${age} day${age===1?'':'s'} ago`:'Freshness unknown',contact===100?'Verified contact available':'Use official application route'],followUpDue};
  }
  function followUp(o){
    if(!alreadyApplied(o))return null;
    const appliedAt=o.submitted_at||o.appliedAt||o.updatedAt||o.updated_at;
    const age=daysSince(appliedAt),count=Number(o.followup_count||o.followup?.count||0);
    if(['client_replied','interview','interview_scheduled','negotiation','offer','rejected'].includes(statusOf(o)))return null;
    if(count>=2)return {action:'Stop following up',reason:'Two follow-ups are already recorded with no response.',worthSending:false};
    if(age>=21)return {action:'Close as stale',reason:`Applied ${age} days ago with no recorded response.`,worthSending:false};
    if(age>=5)return {action:'Follow up today',reason:`Applied ${age} days ago and no reply is recorded.`,worthSending:true,channel:o.email?'Email':'Official portal or verified LinkedIn contact'};
    return {action:'Wait before following up',reason:`Applied ${age} day${age===1?'':'s'} ago.`,worthSending:false};
  }
  function resumeGaps(profile={},opportunities=[]){
    const owned=new Set(skills(profile));
    const relevant=opportunities.filter(o=>qualityOf(o)>=60&&matchOf(o)>=55).slice(0,20);
    const words=new Map();
    relevant.forEach(o=>list(o.skills||o.missingKeywords||o.missing_keywords).forEach(item=>{const key=lower(item);if(key.length>1&&!owned.has(key))words.set(key,(words.get(key)||0)+1)}));
    const gaps=[...words.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([skill,count])=>({skill,count,action:`If you genuinely have ${skill}, add evidence to your resume. Otherwise, learn it or build a small project before claiming it.`}));
    const text=clean(profile.text||profile.summary||profile.bio);
    if(relevant.length&&!clean(profile.portfolioUrl))gaps.push({skill:'portfolio proof',count:relevant.length,action:'Add a real portfolio or case-study link before roles that ask for work samples.'});
    if(relevant.length&&!/\b\d+(?:%|x|k|m|\+)?\b/i.test(text))gaps.push({skill:'measurable impact',count:relevant.length,action:'Add verified numbers to achievements where you can prove them; never invent metrics.'});
    return gaps.slice(0,8);
  }
  function dailyPlan(profile={},opportunities=[],feedback=[]){
    const ranked=opportunities.filter(active).map(o=>({opportunity:o,priority:priority(o,profile,feedback)})).sort((a,b)=>b.priority.score-a.priority.score);
    const actions=[];
    ranked.filter(x=>x.priority.label==='Follow Up Today').slice(0,2).forEach(x=>actions.push({type:'followup',title:`Follow up: ${titleOf(x.opportunity)}`,detail:followUp(x.opportunity)?.reason||x.priority.reasons[0],opportunityId:x.opportunity.id,view:'tracker'}));
    ranked.filter(x=>x.priority.label==='Apply Today').slice(0,3).forEach(x=>actions.push({type:'apply',title:`Review and apply: ${titleOf(x.opportunity)}`,detail:`${companyOf(x.opportunity)} · ${x.priority.score}/100 priority. You submit manually.`,opportunityId:x.opportunity.id,view:'coverage'}));
    ranked.filter(x=>x.priority.label==='Prepare Resume First').slice(0,1).forEach(x=>actions.push({type:'resume',title:`Prepare a resume variant for ${titleOf(x.opportunity)}`,detail:'Strong fit, but the application packet is not ready.',opportunityId:x.opportunity.id,view:'agent'}));
    opportunities.filter(o=>['interview','interview_scheduled'].includes(statusOf(o))).slice(0,1).forEach(o=>actions.push({type:'interview',title:`Prepare for interview: ${titleOf(o)}`,detail:`Review relevant proof, questions, and salary notes for ${companyOf(o)}.`,opportunityId:o.id,view:'agent'}));
    const gaps=resumeGaps(profile,opportunities);
    if(actions.length<3&&gaps[0])actions.push({type:'gap',title:`Review evidence for ${gaps[0].skill}`,detail:gaps[0].action,view:'ats'});
    if(actions.length<3&&!targetRoles(profile).length)actions.push({type:'profile',title:'Set your target roles',detail:'Career targets make job priorities specific to your goals.',view:'agent'});
    if(actions.length<3&&!opportunities.length)actions.push({type:'search',title:'Run a resume-based Smart Search',detail:'Add real opportunities before RoleDesk can prioritize your day.',view:'smart'});
    return {date:new Date().toISOString().slice(0,10),actions:actions.slice(0,7),ranked};
  }
  function variant(profile={},role='Target role'){
    const roleWords=new Set(lower(role).split(/\W+/).filter(Boolean));
    const ordered=list(profile.skills).sort((a,b)=>Number(roleWords.has(lower(b)))-Number(roleWords.has(lower(a))));
    const summary=clean(profile.summary||profile.bio);
    return {name:`${role} Resume`,targetRole:role,summary:summary||`[Write a truthful summary focused on ${role}.]`,skills:ordered,trueDataOnly:true,createdAt:new Date().toISOString()};
  }
  function analytics(opportunities=[],variants=[],feedback=[]){
    const count=statuses=>opportunities.filter(o=>statuses.includes(statusOf(o))).length;
    const applied=count(['applied','submitted','email_sent','client_replied','interview','interview_scheduled','negotiation','offer','rejected','no_response']);
    const replies=count(['client_replied','interview','interview_scheduled','negotiation','offer']);
    const interviews=count(['interview','interview_scheduled','offer']);
    const scored=opportunities.map(matchOf).filter(Boolean);
    const outcomes=feedback.reduce((map,f)=>{const key=clean(f.resume_variant_id||f.variantName||'Unassigned');map[key]=(map[key]||0)+(['replied','interview','offer'].includes(lower(f.outcome))?1:0);return map},{});
    const bestVariantKey=Object.entries(outcomes).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const bestVariant=bestVariantKey?(variants.find(v=>String(v.id)===String(bestVariantKey))?.name||bestVariantKey):'Not enough outcome data';
    const positive=feedback.filter(f=>['replied','interview','offer'].includes(lower(f.outcome)));
    const top=value=>Object.entries(positive.reduce((map,f)=>{const key=clean(f[value]||f.metadata?.[value]||'');if(key)map[key]=(map[key]||0)+1;return map},{})).sort((a,b)=>b[1]-a[1])[0]?.[0]||'Not enough outcome data';
    return {discovered:opportunities.length,shortlisted:count(['shortlisted','resume_ready','cover_letter_ready']),applied,replies,interviews,rejections:count(['rejected']),offers:count(['offer']),averageMatch:scored.length?Math.round(scored.reduce((a,b)=>a+b,0)/scored.length):0,replyRate:applied?Math.round(replies/applied*100):0,interviewRate:replies?Math.round(interviews/replies*100):0,bestVariant,bestRole:top('role_type'),bestSource:top('source'),variants:variants.length};
  }
  function notifications(opportunities=[],settings={}){
    if(settings.dashboard===false)return [];
    const rows=[];
    opportunities.forEach(o=>{const follow=followUp(o);if(settings.followups!==false&&follow?.action==='Follow up today')rows.push({type:'followup_due',title:`Follow-up due: ${titleOf(o)}`,message:follow.reason,view:'tracker'});const deadline=o.application_deadline||o.deadlineDate;if(deadline){const days=Math.ceil((dateValue(deadline)-Date.now())/DAY);if(days>=0&&days<=3)rows.push({type:'deadline_near',title:`Deadline near: ${titleOf(o)}`,message:`Application deadline is in ${days} day${days===1?'':'s'}.`,view:'coverage'})}if(['interview','interview_scheduled'].includes(statusOf(o)))rows.push({type:'interview_upcoming',title:`Interview preparation: ${titleOf(o)}`,message:'Review job-specific questions and verified talking points.',view:'agent'})});
    return rows.slice(0,8);
  }
  function interviewPrep(o,profile={}){
    const evidence=list(profile.projects||profile.experience||profile.skills).slice(0,4);
    return {title:titleOf(o),company:companyOf(o),questions:[`How would you approach the first 30 days in this ${titleOf(o)} role?`,`Which past project best proves the requirements in this role?`,`How do you measure successful work?`],talkingPoints:evidence.length?evidence:['Add two verified examples from your resume.'],weakAreas:list(o.missingKeywords||o.missing_keywords).slice(0,4),ask:[`What outcomes define success in the first 90 days?`,`What is the interview process and expected timeline?`],salary:'Use your reviewed salary range; do not invent market data.'};
  }
  root.RoleDeskCareerAgent=Object.freeze({priority,dailyPlan,resumeGaps,variant,analytics,followUp,interviewPrep,notifications,targetRoles});
})(window);
