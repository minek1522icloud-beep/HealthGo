/* HealthGo 4.4 — honest versioned notes and in-app update messages.
 * A live installed build is identified by the deployment-stamped SHA, not a mock version.
 * Reading announcements never enrolls a user in background push. */
(function(){
 'use strict';
 const w=window,d=w.document,S=w.HealthGoServices;
 if(!d||!S)return;
 const RELEASE='4.4',KEY='healthgo.release-notes.last-build.v1',RELEASE_KEY='healthgo.release-notes.last-release.v1';
 const NOTES=[
  {id:'4.4',title:'Aktywność PRO i aktualizacje — poprawione',date:'2026-10-13',
   tags:['AKTYWNOŚĆ','STATYSTYKI','WIADOMOŚCI','AKTUALIZACJE'],
   sections:[
    {title:'Aktywność PRO 4.4',items:[
     'Nowy ekran z kalendarzem dni, wykresami i pierścieniami prawdziwych pomiarów.',
     'Szczegóły kroków, dystansu, czasu aktywności, tętna i snu można otwierać oddzielnie.',
     'Dodano dobrowolne cele i lokalną historię spacerów, biegania oraz jazdy na rowerze.',
     'GPS działa tylko po Twoim włączeniu. Zmiana aplikacji na ekranie wstrzymuje sesję; w tle nie obiecujemy śledzenia.'
    ]},
    {title:'Dziennik zmian i wiadomości',items:[
     'Karta aktualizacji wyświetla bieżącą wersję, zamiast starego opisu wydania 3.2.',
     'Komunikat pokazuje się tylko raz na wydanie dla danego konta, a historię można otworzyć ponownie.',
     'Centrum powiadomień otrzymuje wiadomość o wydaniu oraz wykrytej nowej kompilacji.',
     'Powiadomienia systemowe wymagają zgody i zgodnego telefonu; wysyłanie push przy zamkniętej aplikacji wymaga osobnej usługi serwerowej.'
    ]}
   ]},
  {id:'4.3',title:'Wyzwania 3.0 i XP 3.0',date:'2026-10-13',tags:['MISJE','XP'],
   sections:[{title:'Wyzwania i poziomy',items:[
    'Dodano przypinanie trzech wyzwań, podgląd serii i misji sezonowych.',
    'Poziom XP, historia punktów i animacje awansu korzystają z rzeczywistych zapisanych zdarzeń.',
    'Nagrody 3D oraz istniejący system XP pozostały bez zmian.'
   ]}]},
  {id:'4.2',title:'Prędkościomierz, ustawienia i profil',date:'2026-10-13',tags:['MAPA','PROFIL'],
   sections:[{title:'Usprawnienia',items:[
    'Rozpoznawanie limitu prędkości uwzględnia geometrię drogi i dokładność GPS.',
    'Uproszczono dostęp do ustawień oraz edycji zdjęcia profilowego.'
   ]}]},
  {id:'4.1',title:'Poszukiwacz Skarbów i nagrody',date:'2026-10-13',tags:['SKARBY','SKLEP'],
   sections:[{title:'Poprawki',items:[
    'Mapa odkrywania świata działa również bez dostępnych skarbów w pobliżu.',
    'Wycofano pięć przykładowych nagród ze sklepu HealthGo Point, nie usuwając zapisanych punktów.'
   ]}]},
  {id:'3.2',title:'Poprawki odznak z planszy',date:'2026-10-11',tags:['ODZNAKI'],
   sections:[{title:'Archiwum wersji 3.2',items:[
    'Dopracowano wyświetlanie oryginalnych grafik odznak z przesłanej planszy.',
    'Wygląd odznak nie zmienia XP ani rzeczywistych osiągnięć.'
   ]}]}
 ];
 let scheduled=false,focusBefore=null,shownInSession=new Set(),pendingRemote=null,owner='',modalId='4.4';
 const $=id=>d.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const build=()=>d.querySelector('meta[name="healthgo-build"]')?.getAttribute('content')||'';
 const knownBuild=()=>/^[a-f0-9]{40}$/i.test(build());
 const account=()=>String(S.state?.uid||'');
 const keyFor=(type)=>'healthgo.updates44.'+type+'.'+encodeURIComponent(account());
 function read(type){
  if(!account())return {};
  try{const obj=JSON.parse(w.localStorage?.getItem(keyFor(type))||'{}');return obj&&typeof obj==='object'?obj:{};}
  catch(_){return {};}
 }
 function save(type,obj){
  if(!account())return false;
  try{w.localStorage?.setItem(keyFor(type),JSON.stringify(obj));return true;}catch(_){return false;}
 }
 function releaseSeen(){
  const r=read('seen');return !!r[RELEASE]||shownInSession.has(account()+':'+RELEASE);
 }
 function markRead(id){
  const seen=read('seen');seen[id]=true;save('seen',seen);shownInSession.add(account()+':'+id);
  if(id===RELEASE){
   try{w.localStorage?.setItem(KEY,build());w.localStorage?.setItem(RELEASE_KEY,RELEASE);}catch(_){}
  }
  inbox();
 }
 function isRemote(v){return /^[a-f0-9]{40}$/i.test(String(v||''));}
 function unreadCount(){
  const seen=read('seen'),pending=read('pending');
  return (seen[RELEASE]?0:1)+(pending.version&&pending.version!==build()&&!pending.read?1:0);
 }
 function notifyCount(){
  const text=String(unreadCount());
  const badge=$('hguUpdateBadge');
  if(badge){badge.textContent=text;badge.hidden=unreadCount()===0;}
 }
 function sectionHtml(s){
  return '<section class="hgu-section"><h3>'+esc(s.title)+'</h3><ul>'+s.items.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul></section>';
 }
 function openDetails(id){
  const note=NOTES.find(n=>n.id===id)||NOTES[0];
  modalId=note.id;
  let root=$('hguReleaseOverlay');
  if(root)return true;
  root=d.createElement('div');root.id='hguReleaseOverlay';root.className='hgu-overlay';root.setAttribute('role','presentation');
  focusBefore=d.activeElement;
  const link=knownBuild()?'https://github.com/minek1522icloud-beep/HealthGo/commit/'+build():
   'https://github.com/minek1522icloud-beep/HealthGo/commits/main';
  root.innerHTML='<div class="hgu-modal" role="dialog" aria-modal="true" aria-labelledby="hguReleaseHeading">'+
   '<header class="hgu-hero"><span class="hgu-overline">HEALTHGO · DZIENNIK AKTUALIZACJI</span>'+
   '<div class="hgu-version">AKTUALIZACJA '+esc(note.id)+'</div>'+
   '<h2 id="hguReleaseHeading">'+esc(note.title)+'</h2>'+
   '<p>Najważniejsze zmiany bez nieaktualnych opisów starszej wersji.</p>'+
   '<div class="hgu-tags">'+note.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div></header>'+
   '<div class="hgu-body">'+(note.sections[0]?sectionHtml(note.sections[0]):'')+
   (note.sections.length>1?'<details class="hgu-more-details"><summary>Pełna lista zmian</summary>'+
    note.sections.slice(1).map(sectionHtml).join('')+'</details>':'')+
   '<details class="hgu-more-details"><summary>Historia wersji</summary>'+
   '<div class="hgu-version-history">'+NOTES.map(n=>'<button type="button" data-hgu-release="'+esc(n.id)+'">Wersja '+esc(n.id)+' · '+esc(n.title)+'</button>').join('')+'</div></details>'+
   '<div class="hgu-footer-note">Informacje dotyczą tej wersji interfejsu. '+(knownBuild()?'Kompilacja '+esc(build().slice(0,8))+'. ':'')+
   '<a href="'+link+'" target="_blank" rel="noopener noreferrer">Zobacz historię kodu na GitHubie</a>.</div></div>'+
   '<footer class="hgu-actions"><span>HealthGo '+esc(note.id)+'</span>'+
   '<button type="button" id="hguCloseNotes">Zaczynamy!</button></footer></div>';
  root.addEventListener('click',ev=>{
   const option=ev.target?.closest?.('[data-hgu-release]');
   if(option){const id=option.getAttribute('data-hgu-release');root.remove();openDetails(id);return;}
   if(ev.target===root||ev.target?.closest?.('#hguCloseNotes'))close();
  });
  root.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();close();}});
  d.body.appendChild(root);d.body.classList.add('hgu-notes-open');
  root.querySelector('#hguCloseNotes')?.focus?.({preventScroll:true});
  return true;
 }
 function close(){
  const root=$('hguReleaseOverlay');if(!root)return;
  root.remove();d.body.classList.remove('hgu-notes-open');
  markRead(modalId);
  focusBefore?.focus?.({preventScroll:true});focusBefore=null;
 }
 function setupButton(){
  const help=$('settingsHelp');
  if(!help)return;
  if(!$('hguOpenNotes')){
   const b=d.createElement('button');b.id='hguOpenNotes';b.type='button';b.className='btn secondary hgu-settings-button';
   b.textContent='Co nowego w HealthGo?';b.addEventListener('click',()=>openDetails(RELEASE));help.appendChild(b);
  }
  if(!$('hguOpenInbox')){
   const b=d.createElement('button');b.id='hguOpenInbox';b.type='button';b.className='btn secondary hgu-settings-button';
   b.textContent='Wiadomości o aktualizacjach';
   const badge=d.createElement('span');badge.id='hguUpdateBadge';badge.className='hgu-unread-badge';badge.hidden=true;
   b.appendChild(badge);
   b.addEventListener('click',()=>{
    if(typeof w.mobileGo==='function')w.mobileGo('notifications');else w.go?.('notifications');
    inbox();
   });help.appendChild(b);
  }
 }
 function addPending(remote){
  if(!account()||!isRemote(remote)||remote===build())return;
  const old=read('pending');
  if(old.version===remote)return;
  save('pending',{version:remote,read:false,at:new Date().toISOString()});
  pendingRemote=remote;inbox();
  // Show a foreground device notification only when the user has previously
  // granted permission and the installed service worker supports it.
  try{
   if(w.Notification?.permission==='granted'&&w.navigator?.serviceWorker?.getRegistration){
    w.navigator.serviceWorker.getRegistration().then(reg=>{
     if(reg?.showNotification)return reg.showNotification('Nowa aktualizacja HealthGo',{
      body:'Wersja '+remote.slice(0,8)+' jest dostępna. Otwórz HealthGo, aby ją pobrać.',
      tag:'healthgo-update-'+remote.slice(0,12),renotify:false
     });
    }).catch(()=>{});
   }
  }catch(_){}

 }
 function inbox(){
  notifyCount();
  const page=$('notifications');if(!page||!account())return;
  let root=$('hguInbox');
  if(!root){root=d.createElement('section');root.id='hguInbox';root.className='hgu-inbox';page.insertBefore?.(root,page.firstChild);}
  root.replaceChildren();
  const heading=d.createElement('div');heading.className='hgu-inbox-heading';
  const title=d.createElement('h3');title.textContent='Wiadomości HealthGo';
  const meta=d.createElement('span');meta.textContent=unreadCount()+' nieprzeczytanych';
  heading.append(title,meta);root.appendChild(heading);
  const desc=d.createElement('p');desc.className='hgu-inbox-help';
  desc.textContent='Nowości pojawiają się po wykryciu opublikowanej kompilacji. To wiadomości wewnątrz aplikacji, nie usługa push w tle.';
  root.appendChild(desc);
  const pending=read('pending'),seen=read('seen');
  function row(titleText,body,isUnread,onOpen,mark){
   const item=d.createElement('article');item.className='hgu-inbox-row'+(isUnread?' unread':'');
   const col=d.createElement('div'),head=d.createElement('strong'),copy=d.createElement('p');
   head.textContent=titleText;copy.textContent=body;col.append(head,copy);item.appendChild(col);
   const actions=d.createElement('div');actions.className='hgu-inbox-actions';
   const open=d.createElement('button');open.type='button';open.textContent='Zobacz';open.addEventListener('click',onOpen);actions.appendChild(open);
   if(isUnread){
    const read=d.createElement('button');read.type='button';read.textContent='Przeczytane';
    read.addEventListener('click',mark);actions.appendChild(read);
   }
   item.appendChild(actions);root.appendChild(item);
  }
  if(pending.version&&pending.version!==build()){
   row('Dostępna nowa kompilacja HealthGo','Wersja '+pending.version.slice(0,8)+' czeka na pobranie w Ustawieniach.',!pending.read,
    ()=>{const p=read('pending');p.read=true;save('pending',p);inbox();
      if(typeof w.mobileGo==='function')w.mobileGo('settings');else w.go?.('settings');$('healthgoUpdateStatus')?.scrollIntoView?.({behavior:'smooth'});},
    ()=>{const p=read('pending');p.read=true;save('pending',p);inbox();});
  }
  row('HealthGo '+RELEASE+' · '+NOTES[0].title,'Aktualizacja aktywności, powiadomień i dziennika zmian.',
   !seen[RELEASE],()=>openDetails(RELEASE),()=>markRead(RELEASE));
  for(const n of NOTES.slice(1)){
   row('Archiwum · '+n.id,'Wcześniejsze wydanie: '+n.title,false,()=>openDetails(n.id),()=>{});
  }
 }
 function maybeShow(){
  if(!knownBuild()||!account()||S.state?.loading||releaseSeen())return;
  if(d.querySelector('.app')?.classList.contains('auth-hidden'))return;
  if($('accountSetup')?.classList.contains('show'))return;
  openDetails(RELEASE);
 }
 function schedule(){
  setupButton();
  if(scheduled)return;
  scheduled=true;w.setTimeout?.(()=>{scheduled=false;inbox();maybeShow();},950);
 }
 S.subscribe?.(s=>{if(String(s.uid||'')!==owner){owner=String(s.uid||'');pendingRemote=null;}
  setupButton();if(s.uid&&!s.loading)schedule();});
 w.addEventListener?.('healthgo:update-available',e=>addPending(e?.detail?.version));
 w.addEventListener?.('pageshow',schedule);
 const setup=$('accountSetup');
 if(setup&&typeof w.MutationObserver==='function')new w.MutationObserver(()=>{
  if(!setup.classList.contains('show'))schedule();
 }).observe(setup,{attributes:true,attributeFilter:['class']});
 w.HealthGoWhatsNew=Object.freeze({show:()=>openDetails(RELEASE),maybeShow,release:RELEASE,
  inbox,unreadCount,addPending});
 schedule();
})();
