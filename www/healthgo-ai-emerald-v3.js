/* HealthGo AI 3.0 — progressive UI enhancement.
 * Does not intercept AI requests or overwrite chat persistence.
 * Existing askAI(), mode buttons, image uploads and history remain authoritative.
 */
(function(){
 'use strict';
 const page=document.getElementById('ai');
 const shell=document.getElementById('aiChatShell');
 const chatTop=page?.querySelector('.ai-chat-top');
 const tools=document.getElementById('aiHistoryPanel');
 const history=document.getElementById('aiHistory');
 const messages=document.getElementById('aiMessages');
 if(!page||!shell||!chatTop||!tools||!history||!messages)return;
 if(shell.dataset.healthgoAiEmerald==='1')return;
 shell.dataset.healthgoAiEmerald='1';

 // Improve the existing header without removing IDs read by aiSetMode().
 const label=chatTop.querySelector('div > #aiModeTitle')?.parentElement;
 if(label && label.parentElement===chatTop){
  const group=document.createElement('div');
  group.className='hga-chat-brand';
  const mark=document.createElement('span');
  mark.className='hga-chat-avatar';
  mark.textContent='✦';
  mark.setAttribute('aria-hidden','true');
  label.classList.add('hga-chat-brand-copy');
  chatTop.insertBefore(group,label);
  group.append(mark,label);
 }
 for(const [id,text] of [
  ['aiNewTopBtn','Nowa rozmowa'],
  ['aiHistoryToggle','Pokaż lub ukryj historię rozmów'],
  ['aiSendBtn','Wyślij wiadomość'],
  ['aiPhotoInput','Załącz zdjęcie do wiadomości'],
  ['aiInput','Wiadomość do HealthGo AI']
 ]){
  const target=document.getElementById(id);
  if(target)target.setAttribute('aria-label',text);
 }
 const name=document.getElementById('aiModeTitle');
 const subtitle=document.getElementById('aiModeSub');
 if(name && name.textContent.trim()==='HealthGo AI')name.textContent='HealthGo AI';
 if(subtitle && !subtitle.textContent.trim())subtitle.textContent='Twój inteligentny asystent';

 // Search is applied to the real per-user conversation history created by
 // the existing persistence module; no extra copy of private messages.
 const heading=document.createElement('div');
 heading.className='hga-history-heading';
 const headingIcon=document.createElement('span');
 headingIcon.className='hga-history-symbol';
 headingIcon.textContent='✦';
 headingIcon.setAttribute('aria-hidden','true');
 const headingText=document.createElement('div');
 const headingTitle=document.createElement('b');
 headingTitle.textContent='Twoje rozmowy';
 const headingSub=document.createElement('span');
 headingSub.textContent='Historia HealthGo AI';
 headingText.append(headingTitle,headingSub);
 heading.append(headingIcon,headingText);
 tools.insertBefore(heading,tools.firstChild);

 const searchWrap=document.createElement('label');
 searchWrap.className='hga-history-search';
 const searchIcon=document.createElement('span');
 searchIcon.setAttribute('aria-hidden','true');
 searchIcon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>';
 const search=document.createElement('input');
 search.type='search';
 search.id='hgaHistorySearch';
 search.placeholder='Szukaj rozmów…';
 search.autocomplete='off';
 search.setAttribute('aria-label','Szukaj w zapisanych rozmowach');
 searchWrap.append(searchIcon,search);
 tools.insertBefore(searchWrap,history);

 const noResults=document.createElement('p');
 noResults.className='hga-no-results';
 noResults.hidden=true;
 noResults.textContent='Nie znaleziono rozmów.';
 history.insertAdjacentElement('afterend',noResults);

 const privacyNote=document.createElement('p');
 privacyNote.className='hga-history-footnote';
 privacyNote.textContent='Historia jest przechowywana lokalnie dla tego konta, jeżeli zapis rozmów jest włączony.';
 tools.appendChild(privacyNote);

 function normalize(s){
  return String(s||'').toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 }
 function filterHistory(){
  const query=normalize(search.value.trim());
  const items=[...history.querySelectorAll('.ai-history-item')];
  let visible=0;
  for(const item of items){
   const match=!query||normalize(item.textContent).includes(query);
   item.hidden=!match;
   // The legacy CSS uses display:block; explicitly hide filtered entries.
   item.style.display=match?'':'none';
   if(match)visible++;
  }
  noResults.hidden=!query||visible!==0||items.length===0;
 }
 search.addEventListener('input',filterHistory);
 const historyObserver=new MutationObserver(filterHistory);
 historyObserver.observe(history,{childList:true});
 filterHistory();

 // Copy only assistant-generated text, excluding progress/error placeholders.
 // The observer also handles chats loaded from local history.
 async function copy(text,button){
  const value=String(text||'').trim();
  if(!value)return;
  const previous=button.textContent;
  button.disabled=true;
  try{
   if(!navigator.clipboard?.writeText)throw new Error('CLIPBOARD_UNAVAILABLE');
   await navigator.clipboard.writeText(value);
   button.textContent='✓ Skopiowano';
  }catch(_){
   button.textContent='Nie można skopiować';
  }
  window.setTimeout(()=>{
   if(button.isConnected){button.textContent=previous;button.disabled=false;}
  },1700);
 }
 function decorateReplies(){
  const rows=messages.querySelectorAll('.ai-msg.assistant');
  rows.forEach(row=>{
   if(row.classList.contains('ai-system-message')||row.querySelector('.ai-typing')||row.querySelector('.hga-copy'))return;
   const bubble=row.querySelector('.ai-bubble');
   if(!bubble||!bubble.textContent.trim())return;
   const action=document.createElement('button');
   action.type='button';
   action.className='hga-copy';
   action.textContent='⧉ Kopiuj odpowiedź';
   action.setAttribute('aria-label','Kopiuj odpowiedź AI');
   action.addEventListener('click',()=>copy(bubble.textContent,action));
   row.appendChild(action);
  });
 }
 const messageObserver=new MutationObserver(decorateReplies);
 messageObserver.observe(messages,{childList:true,subtree:true});
 decorateReplies();

 // History is a sheet on phones. Escape and selection can close it.
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && shell.classList.contains('history-open')){
   if(typeof window.aiToggleHistory==='function'){
    window.aiToggleHistory(false);
    document.getElementById('aiHistoryToggle')?.focus();
   }
  }
 });
 const historyToggle=document.getElementById('aiHistoryToggle');
 historyToggle?.addEventListener('click',()=>{
  if(shell.classList.contains('history-open'))search.value='';
  filterHistory();
 });
})();
