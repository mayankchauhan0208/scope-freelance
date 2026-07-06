(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RoleDeskTracker=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const statuses=Object.freeze(['Discovered','Recommended','Shortlisted','Resume Ready','Cover Letter Ready','Applied','Follow-Up Needed','Interview Scheduled','Offer','Rejected','Closed / Not Relevant']);
  const reminderStates=Object.freeze(['No follow-up set','Follow-up scheduled','Due today','Overdue','Completed','Snoozed']);
  const communicationStatuses=Object.freeze(['Draft Prepared','Reviewed','Sent Manually','Reply Received','Follow-up Needed','No Response','Closed']);
  const oldStatusMap=Object.freeze({'Saved':'Shortlisted','Draft Prepared':'Cover Letter Ready','Ready to Apply':'Resume Ready','Proposal Sent':'Applied','Email Sent':'Applied','Client Replied':'Follow-Up Needed','Interview':'Interview Scheduled','Negotiation':'Interview Scheduled','Hired':'Offer','Completed':'Offer','Payment Received':'Offer','No Response':'Follow-Up Needed','Archived':'Closed / Not Relevant','Proposal Drafted':'Cover Letter Ready','Client Lost':'Rejected','In Progress':'Offer','Submitted':'Applied','Revision Requested':'Follow-Up Needed','Skipped':'Closed / Not Relevant'});
  const dateOnly=value=>String(value||'').slice(0,10);
  const todayValue=now=>dateOnly((now instanceof Date?now:new Date(now||Date.now())).toISOString());
  const numeric=value=>Number.isFinite(Number(value))?Number(value):0;
  function statusOf(item){return statuses.includes(item?.status)?item.status:(oldStatusMap[item?.status]||'Discovered')}
  function followUpState(item,now=new Date()){
    const follow=item?.followup||{},status=follow.status||'';
    if(status==='completed')return'Completed';
    if(status==='snoozed')return'Snoozed';
    const due=dateOnly(follow.nextAt||item?.communication?.followUpDate);
    if(!due)return'No follow-up set';
    const today=todayValue(now);
    return due<today?'Overdue':due===today?'Due today':'Follow-up scheduled';
  }
  function matchScore(item){return Math.max(0,Math.min(100,Math.round(numeric(item?.matchScore??item?.skill))))}
  function amount(item){const value=numeric(item?.pipelineValue??item?.budget);return value>0?value:0}
  function currency(item){return String(item?.currency||'USD').toUpperCase()}
  function timeline(item){return Array.isArray(item?.timeline)?item.timeline:[]}
  function addTimeline(item,type,label,metadata={},at=new Date().toISOString()){
    const event={id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,type,label,at,metadata:{...metadata,verification:'user_reported'}};
    return{...item,timeline:[event,...timeline(item)].slice(0,100),updatedAt:at};
  }
  function update(item,patch,eventLabel,eventType='tracker.status_changed'){
    let next={...item,...patch,updatedAt:new Date().toISOString()};
    if(eventLabel)next=addTimeline(next,eventType,eventLabel,patch,next.updatedAt);
    return next;
  }
  function conversion(numerator,denominator){return denominator?Math.round(numerator/denominator*100):null}
  function analytics(items=[],now=new Date()){
    const list=items.filter(item=>statusOf(item)!=='Archived'),count=predicate=>list.filter(predicate).length;
    const saved=list.length;
    const drafted=count(item=>!['Discovered','Recommended','Shortlisted','Closed / Not Relevant'].includes(statusOf(item))||item.draftStatus);
    const sent=count(item=>['Applied','Follow-Up Needed','Interview Scheduled','Offer','Rejected'].includes(statusOf(item)));
    const replies=count(item=>['Follow-Up Needed','Interview Scheduled','Offer'].includes(statusOf(item))||item.communication?.status==='Reply Received');
    const interviews=count(item=>['Interview Scheduled','Offer'].includes(statusOf(item)));
    const wins=count(item=>statusOf(item)==='Offer');
    const due=count(item=>['Due today','Overdue'].includes(followUpState(item,now)));
    const overdue=count(item=>followUpState(item,now)==='Overdue');
    const values={},valueByStatus={};let missingBudget=0;
    list.forEach(item=>{const value=amount(item);if(!value){missingBudget++;return}const key=currency(item),status=statusOf(item);values[key]=(values[key]||0)+value;valueByStatus[status]=valueByStatus[status]||{};valueByStatus[status][key]=(valueByStatus[status][key]||0)+value});
    const sourceRows={};list.forEach(item=>{const source=item.platform||item.source||'Unknown',row=sourceRows[source]||{source,saved:0,replies:0,scoreTotal:0};row.saved++;if(item.communication?.status==='Reply Received'||['Client Replied','Interview','Negotiation','Hired','Completed','Payment Received'].includes(statusOf(item)))row.replies++;row.scoreTotal+=matchScore(item);sourceRows[source]=row});
    const sources=Object.values(sourceRows).map(row=>({...row,averageScore:row.saved?Math.round(row.scoreTotal/row.saved):0}));
    const methodCounts={guided:0,live:0,manual:0};list.forEach(item=>{const method=String(item.sourceMethod||'').toLowerCase();if(method.includes('live'))methodCounts.live++;else if(method.includes('manual'))methodCounts.manual++;else methodCounts.guided++});
    return{total:items.length,saved,drafted,sent,applications:count(item=>['Applied','Follow-Up Needed','Interview Scheduled','Offer','Rejected'].includes(statusOf(item))),emails:count(item=>item.communication?.status==='Sent Manually'),replies,interviews,negotiations:count(item=>statusOf(item)==='Interview Scheduled'),wins,rejected:count(item=>statusOf(item)==='Rejected'),due,overdue,missingBudget,values,valueByStatus,sources,methodCounts,rates:{savedToDrafted:conversion(drafted,saved),draftedToSent:conversion(sent,drafted),sentToReply:conversion(replies,sent),replyToInterview:conversion(interviews,replies),win:conversion(wins,sent)}};
  }
  function filterAndSort(items=[],filters={},sort='updated'){
    const now=filters.now||new Date();let result=items.filter(item=>{
      const state=followUpState(item,now),score=matchScore(item),hasBudget=amount(item)>0;
      if(filters.status&&filters.status!=='all'&&statusOf(item)!==filters.status)return false;
      if(filters.source&&filters.source!=='all'&&(item.platform||item.source)!==filters.source)return false;
      if(filters.type&&filters.type!=='all'&&item.type!==filters.type)return false;
      if(filters.communication&&filters.communication!=='all'&&(item.communication?.status||'')!==filters.communication)return false;
      if(filters.followup==='due'&&!['Due today','Overdue'].includes(state))return false;
      if(filters.followup==='overdue'&&state!=='Overdue')return false;
      if(filters.budget==='present'&&!hasBudget||filters.budget==='missing'&&hasBudget)return false;
      if(filters.minScore&&score<numeric(filters.minScore))return false;
      const country=String(item.country||item.location||'').toLowerCase(),remote=item.workMode==='remote'||numeric(item.remote)>=80||country.includes('remote');
      if(filters.location==='remote'&&!remote)return false;
      if(filters.location==='india'&&!country.includes('india'))return false;
      if(filters.location==='international'&&(country.includes('india')||country.includes('unknown')||!country))return false;
      if(filters.savedDays&&filters.savedDays!=='all'){
        const savedAt=new Date(item.createdAt||item.created_at||0),cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-numeric(filters.savedDays));if(!savedAt.getTime()||savedAt<cutoff)return false;
      }
      return true;
    });
    const due=item=>dateOnly(item.followup?.nextAt||item.communication?.followUpDate)||'9999-12-31',updated=item=>item.updatedAt||item.communication?.updatedAt||item.createdAt||'';
    result.sort((a,b)=>sort==='score'?matchScore(b)-matchScore(a):sort==='followup'?due(a).localeCompare(due(b)):sort==='overdue'?(followUpState(a,now)==='Overdue'?-1:1)-(followUpState(b,now)==='Overdue'?-1:1):sort==='source'?String(a.platform).localeCompare(String(b.platform)):sort==='status'?statusOf(a).localeCompare(statusOf(b)):sort==='budget'?amount(b)-amount(a):updated(b).localeCompare(updated(a)));
    return result;
  }
  return Object.freeze({statuses,reminderStates,communicationStatuses,statusOf,followUpState,matchScore,amount,currency,timeline,addTimeline,update,analytics,filterAndSort,dateOnly});
});
