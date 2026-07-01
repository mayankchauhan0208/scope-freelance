let scanned=[];
const $=selector=>document.querySelector(selector);
const esc=value=>String(value||'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

async function activeTab(){return(await chrome.tabs.query({active:true,currentWindow:true}))[0]}

async function enableForCurrentPage(tab){
  if(!tab?.id||!/^https?:\/\//i.test(tab.url||''))throw new Error('Open a normal http or https application page first.');
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
}

$('#scan').onclick=async()=>{
  const tab=await activeTab();
  try{
    await enableForCurrentPage(tab);
    const result=await chrome.tabs.sendMessage(tab.id,{type:'SCOPE_SCAN'});
    scanned=result.fields||[];
    $('#fields').innerHTML=scanned.map(field=>`<div class="field" data-field-key="${esc(field.key)}"><b>${esc(field.question)} ${field.required?'*':''}</b><small>${esc(field.type)}${field.options.length?` · ${esc(field.options.join(' / '))}`:''}</small><textarea data-answer placeholder="Paste or review the answer draft"></textarea><label class="review"><input type="checkbox" data-reviewed /> I reviewed this answer for this exact field</label></div>`).join('');
    document.querySelectorAll('[data-answer]').forEach(input=>input.addEventListener('input',()=>{input.closest('.field').querySelector('[data-reviewed]').checked=false}));
    $('#fill').disabled=!scanned.length;
    $('#status').textContent=`Found ${scanned.length} visible fields. Review and check each answer before filling.`;
  }catch(error){
    scanned=[];
    $('#status').textContent=error.message||'This page could not be inspected. Reload it and try again.';
  }
};

$('#fill').onclick=async()=>{
  const tab=await activeTab();
  const answers=scanned.map(field=>{
    const card=document.querySelector(`[data-field-key="${CSS.escape(field.key)}"]`);
    return{key:field.key,question:field.question,type:field.type,value:card?.querySelector('[data-answer]')?.value.trim()||'',reviewed:Boolean(card?.querySelector('[data-reviewed]')?.checked)};
  }).filter(answer=>answer.value&&answer.reviewed);
  if(!answers.length){$('#status').textContent='Review and check at least one answer first.';return}
  try{
    await enableForCurrentPage(tab);
    const result=await chrome.tabs.sendMessage(tab.id,{type:'SCOPE_FILL',answers});
    const warning=result.mismatches?.length?` ${result.mismatches.length} changed fields were skipped for safety.`:'';
    $('#status').textContent=`Filled ${result.filled} reviewed fields.${warning} Check the page carefully—nothing was submitted.`;
  }catch(error){
    $('#status').textContent=error.message||'The reviewed fields could not be filled.';
  }
};
