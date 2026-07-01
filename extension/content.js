(function(){
  if(globalThis.__SCOPE_COMPANION_LOADED__)return;
  globalThis.__SCOPE_COMPANION_LOADED__=true;

  function visibleField(element){
    const style=getComputedStyle(element);
    const blocked=['hidden','password','file','submit','button','reset','image'];
    return style.display!=='none'&&style.visibility!=='hidden'&&!blocked.includes(element.type);
  }

  function fieldQuestion(element){
    const id=element.id;
    const label=id?document.querySelector(`label[for="${CSS.escape(id)}"]`):element.closest('label');
    return(label?.innerText||element.getAttribute('aria-label')||element.placeholder||element.name||'Unlabelled field').replace(/\s+/g,' ').trim().slice(0,500);
  }

  function stableHash(value){
    let hash=2166136261;
    for(let index=0;index<value.length;index++){
      hash^=value.charCodeAt(index);
      hash=Math.imul(hash,16777619);
    }
    return(hash>>>0).toString(36);
  }

  function fieldIdentity(element){
    const form=element.form;
    const identity=[
      location.origin,
      form?.getAttribute('action')||location.pathname,
      element.id||'',
      element.name||'',
      element.getAttribute('autocomplete')||'',
      element.tagName,
      element.type||'',
      fieldQuestion(element)
    ].join('|');
    return `field-${stableHash(identity)}`;
  }

  function scanForm(){
    return[...document.querySelectorAll('input, textarea, select')].filter(visibleField).map(el=>({
      key:fieldIdentity(el),
      question:fieldQuestion(el),
      name:el.name||'',
      type:el.tagName==='SELECT'?'select':el.type||el.tagName.toLowerCase(),
      required:el.required,
      options:el.tagName==='SELECT'?[...el.options].map(o=>o.text.trim()).filter(Boolean):[]
    }));
  }

  function fillDraft(answers){
    const fields=[...document.querySelectorAll('input, textarea, select')].filter(visibleField);
    const byKey=new Map(fields.map(el=>[fieldIdentity(el),el]));
    let filled=0;
    const mismatches=[];
    for(const answer of answers){
      if(!answer.reviewed||answer.value==null)continue;
      const el=byKey.get(answer.key);
      if(!el||fieldQuestion(el)!==answer.question||(el.tagName==='SELECT'?'select':el.type||el.tagName.toLowerCase())!==answer.type){
        mismatches.push(answer.question);
        continue;
      }
      if(['checkbox','radio'].includes(el.type)){
        mismatches.push(answer.question);
        continue;
      }
      if(el.tagName==='SELECT'){
        const option=[...el.options].find(o=>o.value===answer.value||o.text.trim().toLowerCase()===String(answer.value).trim().toLowerCase());
        if(!option){mismatches.push(answer.question);continue}
        el.value=option.value;
      }else{
        el.value=String(answer.value).slice(0,50000);
      }
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      el.style.outline='2px solid #ff6b4a';
      filled++;
    }
    return{filled,mismatches};
  }

  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    if(message.type==='SCOPE_SCAN')sendResponse({fields:scanForm(),url:location.href,title:document.title});
    if(message.type==='SCOPE_FILL')sendResponse(fillDraft(message.answers||[]));
    return true;
  });
})();
