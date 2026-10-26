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
 // Use one consistent icon per control. Older CSS used :after glyphs,
 // which stacked extra + and up-arrows outside the composer on iPhone.
 function svgIcon(paths){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
 }
 const camera=page.querySelector('.ai-composer-tools button:first-child');
 if(camera){
  camera.innerHTML=svgIcon('<path d="M14.5 5h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5l-2-2Z"/><circle cx="12" cy="13.5" r="3.5"/>');
  camera.setAttribute('aria-label','Dodaj zdjęcie');
 }
 const suggestion=page.querySelector('.ai-composer-tools button:nth-child(2)');
 if(suggestion){
  suggestion.innerHTML=svgIcon('<path d="m12 3 1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3Z"/><path d="m19 18 .5 1.5L21 20l-1.5.5L19 22l-.5-1.5L17 20l1.5-.5L19 18Z"/>');
 }
 const sendButton=document.getElementById('aiSendBtn');
 if(sendButton){
  sendButton.innerHTML=svgIcon('<path d="m5 12 14-8-4 16-4.2-6-5.8-2Z"/><path d="m11 14 8-10"/>');
 }
 const name=document.getElementById('aiModeTitle');
 const subtitle=document.getElementById('aiModeSub');
 if(name && name.textContent.trim()==='HealthGo AI')name.textContent='HealthGo AI';
 if(subtitle && !subtitle.textContent.trim())subtitle.textContent='Twój inteligentny asystent';

 // Glossy voice companion: browser-native speech only; existing AI requests remain unchanged.
 const topicBar=page.querySelector('.ai-topic-bar');
 const voicePanel=document.createElement('section');
 voicePanel.className='hga-glossy-panel';
 voicePanel.dataset.state='idle';
 voicePanel.setAttribute('aria-label','Głosowy asystent HealthGo AI');
 const orb=document.createElement('span');
 orb.className='hga-glossy-orb';orb.setAttribute('aria-hidden','true');
 orb.appendChild(document.createElement('span'));
 const voiceCopy=document.createElement('div');voiceCopy.className='hga-glossy-copy';
 const voiceTitle=document.createElement('b');voiceTitle.textContent='Glossy · HealthGo AI';
 const voiceStatus=document.createElement('span');voiceStatus.id='hgaVoiceStatus';voiceStatus.textContent='Asystent tekstowy i głosowy';
 voiceCopy.append(voiceTitle,voiceStatus);
 const voiceControls=document.createElement('div');voiceControls.className='hga-glossy-controls';
 const micButton=document.createElement('button');micButton.type='button';micButton.id='hgaMicButton';micButton.textContent='🎙️ Mów do AI';micButton.setAttribute('aria-pressed','false');
 const speakButton=document.createElement('button');speakButton.type='button';speakButton.id='hgaSpeakButton';speakButton.textContent='🔊 Czytaj odpowiedzi';speakButton.setAttribute('aria-pressed','false');
 voiceControls.append(micButton,speakButton);voicePanel.append(orb,voiceCopy,voiceControls);
 if(topicBar)topicBar.insertAdjacentElement('afterend',voicePanel);
 else chatTop.insertAdjacentElement('afterend',voicePanel);

 const speechStoreKey='healthgo.ai.voiceOutput';
 let speakReplies=false,recognition=null,listening=false,speechTimer=null;
 try{speakReplies=localStorage.getItem(speechStoreKey)==='true'}catch(_){}
 function setVoiceState(state,message){
  voicePanel.dataset.state=state;
  if(message)voiceStatus.textContent=message;
 }
 function setSpeakReplies(enabled){
  speakReplies=!!enabled;
  speakButton.setAttribute('aria-pressed',String(speakReplies));
  speakButton.textContent=speakReplies?'🔊 Głos włączony':'🔊 Czytaj odpowiedzi';
  try{localStorage.setItem(speechStoreKey,String(speakReplies))}catch(_){}
  if(!speakReplies){
   if('speechSynthesis' in window)window.speechSynthesis.cancel();
   setVoiceState('idle','Odpowiedzi głosowe wyłączone');
  }else setVoiceState('idle','Odpowiedzi będą czytane na głos');
 }
 speakButton.addEventListener('click',()=>setSpeakReplies(!speakReplies));
 setSpeakReplies(speakReplies);
 const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(SpeechRecognition){
  recognition=new SpeechRecognition();
  recognition.lang='pl-PL';recognition.interimResults=false;recognition.continuous=false;recognition.maxAlternatives=1;
  recognition.onstart=()=>{listening=true;micButton.setAttribute('aria-pressed','true');micButton.textContent='■ Zatrzymaj';setVoiceState('listening','Słucham… Powiedz, co chcesz napisać.')};
  recognition.onresult=(event)=>{
   const transcript=String(event.results?.[0]?.[0]?.transcript||'').trim();
   const input=document.getElementById('aiInput');
   if(input&&transcript){
    input.value=(input.value.trim()?input.value.trim()+' ':'')+transcript;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();setVoiceState('idle','Rozpoznano mowę. Sprawdź tekst i naciśnij Wyślij.');
   }else setVoiceState('idle','Nie rozpoznano wypowiedzi. Spróbuj ponownie.');
  };
  recognition.onerror=(event)=>{
   listening=false;micButton.setAttribute('aria-pressed','false');micButton.textContent='🎙️ Mów do AI';
   setVoiceState('idle',event.error==='not-allowed'?'Brak zgody na mikrofon. Włącz ją w ustawieniach przeglądarki.':'Nie udało się rozpoznać mowy. Możesz napisać wiadomość.');
  };
  recognition.onend=()=>{listening=false;micButton.setAttribute('aria-pressed','false');micButton.textContent='🎙️ Mów do AI';if(voicePanel.dataset.state==='listening')setVoiceState('idle','Gotowe. Możesz mówić ponownie albo pisać.')};
  micButton.addEventListener('click',()=>{
   if(listening){recognition.stop();return}
   try{recognition.start()}catch(_){setVoiceState('idle','Mikrofon jest już uruchamiany. Spróbuj za chwilę.')}
  });
 }else{
  micButton.disabled=true;micButton.title='Ta przeglądarka nie obsługuje rozpoznawania mowy.';
  setVoiceState('idle','Ta przeglądarka nie obsługuje mikrofonu. Możesz nadal pisać.');
 }
 function speakLatestReply(){
  if(!speakReplies||!('speechSynthesis' in window)||window.healthGoAIRequestBusy)return;
  const rows=[...messages.querySelectorAll('.ai-msg.assistant')].filter(row=>!row.classList.contains('ai-system-message')&&!row.querySelector('.ai-typing'));
  const row=rows[rows.length-1],bubble=row?.querySelector('.ai-bubble');
  const text=String(bubble?.innerText||bubble?.textContent||'').trim();
  if(!text||row.dataset.hgaSpoken==='1')return;
  row.dataset.hgaSpoken='1';
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text.slice(0,6000));
  utterance.lang='pl-PL';utterance.rate=1;utterance.pitch=1.02;
  const polishVoice=window.speechSynthesis.getVoices().find(v=>/^pl(-|_)/i.test(v.lang));
  if(polishVoice)utterance.voice=polishVoice;
  utterance.onstart=()=>setVoiceState('speaking','Glossy mówi…');
  utterance.onend=()=>setVoiceState('idle','Odpowiedź przeczytana. Możesz zadać kolejne pytanie.');
  utterance.onerror=()=>setVoiceState('idle','Nie udało się odczytać odpowiedzi. Możesz przeczytać ją na ekranie.');
  window.speechSynthesis.speak(utterance);
 }
 function queueVoiceReply(){
  if(!speakReplies)return;
  if(speechTimer)window.clearTimeout(speechTimer);
  speechTimer=window.setTimeout(speakLatestReply,650);
 }


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
 function ensureWelcomeIfEmpty(){
  // Persisted chats with no visible messages must not show a blank full screen.
  // Never replace a pending AI message while generation is in progress.
  if(!messages.children.length && !window.healthGoAIRequestBusy &&
     typeof window.aiShowWelcome==='function'){
   window.aiShowWelcome();
  }
 }
 const messageObserver=new MutationObserver(()=>{
  decorateReplies();
  ensureWelcomeIfEmpty();
  queueVoiceReply();
 });
 messageObserver.observe(messages,{childList:true,subtree:true});
 decorateReplies();
 ensureWelcomeIfEmpty();

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
