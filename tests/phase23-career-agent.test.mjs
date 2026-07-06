import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{},Date,console};vm.createContext(context);vm.runInContext(fs.readFileSync('career-agent.js','utf8'),context);
const agent=context.window.RoleDeskCareerAgent;
const profile={targetRole:'Product Designer',skills:['Figma','Research'],workPreference:'remote',summary:'Designer with verified product work.'};
const jobs=[
  {id:1,title:'Product Designer',client:'Acme',skill:91,qualityScore:88,readinessScore:82,workMode:'remote',status:'shortlisted',skills:['Figma','Research','Design systems'],createdAt:new Date().toISOString()},
  {id:2,title:'Designer',client:'Beta',skill:70,qualityScore:70,readinessScore:45,status:'shortlisted',skills:['Figma','Prototyping'],createdAt:new Date().toISOString()},
  {id:3,title:'Old role',skill:50,qualityScore:20,readinessScore:30,status:'shortlisted',createdAt:new Date().toISOString()}
];
assert.equal(agent.priority(jobs[0],profile).label,'Apply Today');
assert.equal(agent.priority(jobs[2],profile).label,'Avoid / Not Relevant');
const plan=agent.dailyPlan(profile,jobs,[]);assert.ok(plan.actions.length>=1&&plan.actions.length<=7);assert.ok(plan.ranked[0].priority.score>=plan.ranked[1].priority.score);
const gaps=agent.resumeGaps(profile,jobs);assert.ok(gaps.some(item=>item.skill==='design systems'));assert.ok(gaps.every(item=>/genuinely|learn|real|verified|never invent/i.test(item.action)));
const variant=agent.variant(profile,'Product Designer');assert.equal(variant.trueDataOnly,true);assert.deepEqual(Array.from(variant.skills).sort(),profile.skills.sort());
const stats=agent.analytics([...jobs,{status:'applied',skill:80},{status:'client_replied',skill:85}],[],[]);assert.equal(stats.applied,2);assert.equal(stats.replies,1);assert.equal(stats.replyRate,50);
const follow=agent.followUp({status:'applied',appliedAt:new Date(Date.now()-7*86400000).toISOString(),followup:{count:0}});assert.equal(follow.action,'Follow up today');
const stop=agent.followUp({status:'applied',appliedAt:new Date(Date.now()-10*86400000).toISOString(),followup:{count:2}});assert.equal(stop.worthSending,false);
const notices=agent.notifications([{title:'Due role',status:'applied',appliedAt:new Date(Date.now()-7*86400000).toISOString(),followup:{count:0}}],{dashboard:true,followups:true});assert.equal(notices[0].type,'followup_due');
console.log('Phase 23 career agent checks passed');
