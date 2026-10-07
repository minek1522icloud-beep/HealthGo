(function(){
'use strict';
const Services=window.HealthGoServices;
if(!Services)return;

const DEFAULTS={
 version:1,
 theme:'system',
 compact:false,
 goals:{movement:true,sleepRoutine:true,screenBreaks:true},
 notifications:{activity:true,sleep:true,family:true,device:true,weekly:true},
 privacy:{cloudSync:true,offlineCache:true},
 ai:{history:true}
};
let currentUid=null;
let suite=clone(DEFAULTS);
let renderQueued=false;

function clone(value){return JSON.parse(JSON.stringify(value));}
function deepMerge(base,extra){
 const out=clone(base);
 if(!extra||typeof extra!=='object')return out;
 Object.keys(extra).forEach(function(key){
  if(extra[key]&&typeof extra[key]==='object'&&!Array.isArray(extra[key])&&out[key]&&typeof out[key]==='object')out[key]=deepMerge(out[key],extra[key]);
  else out[key]=extra[key];
 });
 return out;
}
function uid(){return Services.state&&Services.state.uid||null;}
function localKey(){return 'healthgo_mobile_suite_v1_'+(uid()||'signed-out');}
function emergencyKey(){return 'healthgo_emergency_contact_v1_'+(uid()||'signed-out');}
function aiKey(){return 'healthgo_ai_conversations_v2_'+(uid()||'signed-out');}
function readLocal(){
 try{return JSON.parse(localStorage.getItem(localKey())||'null')||{};}catch(_){return{};}
}
function readEmergency(){
 try{return JSON.parse(localStorage.getItem(emergencyKey())||'null')||{};}catch(_){return{};}
}
function writeEmergency(value){
 if(!uid())return;
 try{localStorage.setItem(emergencyKey(),JSON.stringify(value||{}));}catch(_){}
}
function loadSuite(){
 const cloud=Services.state&&Services.state.settings&&Services.state.settings.mobileSuite||{};
 suite=deepMerge(DEFAULTS,deepMerge(cloud,readLocal()));
 applyAppearance();
 return suite;
}
async function persistSuite(){
 if(!uid())return;
 try{localStorage.setItem(localKey(),JSON.stringify(suite));}catch(_){}
 const base=Object.assign({},Services.state.settings||{});
 base.mobileSuite=clone(suite);
 base.cloudSync=suite.privacy.cloudSync!==false;
 try{localStorage.setItem('healthgo_settings_v3_uid_'+uid(),JSON.stringify(base));}catch(_){}
 try{await Services.call('updateSettings',{settings:base});}catch(_){}
}
function setPath(group,key,value){
 if(!suite[group]||typeof suite[group]!=='object')suite[group]={};
 suite[group][key]=value;
 persistSuite();
 scheduleRender();
}
function applyAppearance(){
 const pref=suite.theme||'system';
 const dark=pref==='dark'||(pref==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
 document.body.dataset.dark=dark?'1':'0';
 document.body.classList.toggle('hg-compact',!!suite.compact);
}
function el(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined&&text!==null)node.textContent=String(text);
 return node;
}
function button(text,fn,secondary){
 const b=el('button',secondary?'secondary':'',text);b.type='button';b.addEventListener('click',fn);return b;
}
function statusPill(text,online){
 const p=el('span','hg-mobile-status'),d=el('span','hg-mobile-status-dot'+(online===false?' offline':''));p.append(d,document.createTextNode(text));return p;
}
function toggleRow(title,copy,value,onChange,disabled){
 const row=el('div','hg-mobile-toggle-row'),c=el('div','hg-mobile-toggle-copy'),lab=el('label','hg-switch'),input=document.createElement('input'),slider=el('span');
 c.append(el('b','',title),el('small','',copy));input.type='checkbox';input.checked=!!value;input.disabled=!!disabled;input.addEventListener('change',function(){onChange(input.checked);});
 lab.append(input,slider);row.append(c,lab);return row;
}
function ensureSection(id,title,description,navLabel){
 const content=document.querySelector('.settings-content'),menu=document.querySelector('.settings-menu');if(!content||!menu)return null;
 let section=document.getElementById(id);
 if(!section){
  section=el('section','settings-section hg2-card');section.id=id;
  const h=el('h3','',title),p=el('p','',description),body=el('div');body.id=id+'Body';section.append(h,p,body);content.appendChild(section);
 }
 if(menu&&!menu.querySelector('[data-mobile-suite-target="'+id+'"]')){
  const b=el('button','',navLabel||title);b.type='button';b.dataset.mobileSuiteTarget=id;b.addEventListener('click',function(){section.scrollIntoView({behavior:'smooth',block:'start'});});menu.appendChild(b);
 }
 return document.getElementById(id+'Body');
}
function accountLabel(type){return type==='guardian'?'Rodzic / opiekun':type==='child'?'Konto dziecka':'Konto standardowe';}
function familyRole(role){return role==='guardian'?'Rodzic / opiekun':role==='child'?'Dziecko':role==='member'?'Członek':'Brak';}

function renderChildAccount(){
 const body=ensureSection('settingsChildPro','Konto dziecka i rodzina','Profesjonalny profil rodzinny oparty na prawdziwych rolach i uprawnieniach backendu.','Konto dziecka');
 if(!body)return;body.replaceChildren();
 const s=Services.state,profile=s.profile||{},family=s.family||{},type=profile.accountType||'standard',role=family.callerRole||(type==='guardian'?'guardian':type==='child'?'child':'member');
 const summary=el('div','hg-mobile-grid');
 const a=el('div','hg-mobile-card');a.append(el('p','','Typ konta'),el('div','hg-mobile-kpi',accountLabel(type)),el('div','hg-mobile-sub','Rola w Family: '+familyRole(role)));
 const b=el('div','hg-mobile-card');b.append(el('p','','HealthGo Family'),el('div','hg-mobile-kpi',family.id?'Połączono':'Niepołączono'),el('div','hg-mobile-sub',(family.members||[]).length+' członków'));
 summary.append(a,b);body.appendChild(summary);
 const note=el('div','hg-mobile-note');
 if(type==='child'){
  note.textContent='Konto dziecka nie może samodzielnie tworzyć rodziny ani rozszerzać dostępu do danych innych osób. Udostępnianie statystyk jest egzekwowane przez HealthGo Family i backend.';
 }else if(type==='guardian'){
  const childCount=(family.members||[]).filter(function(m){return m.role==='child';}).length;
  note.textContent='Konto opiekuna może zarządzać członkami i zakresem danych udostępnianych w rodzinie. Kont dzieci w tej rodzinie: '+childCount+'.';
 }else{
  note.textContent='Konto standardowe może dołączyć do HealthGo Family kodem zaproszenia. Typ konta jest blokowany po pierwszej konfiguracji.';
 }
 body.appendChild(note);
 const actions=el('div','hg-mobile-actions');actions.append(button('Otwórz HealthGo Family',function(){if(window.go)window.go('family');},false));body.appendChild(actions);
}

function metricSum(rows,key){
 return rows.reduce(function(sum,row){const n=Number(row&&row[key]);return Number.isFinite(n)?sum+n:sum;},0);
}
function renderWeekChart(parent,rows){
 const wrap=el('div','hg-mobile-week'),values=rows.map(function(x){return Number(x&&x.steps)||0;}),max=Math.max(1,...values);
 const labels=['D1','D2','D3','D4','D5','D6','D7'];
 rows.forEach(function(row,i){
  const w=el('div','hg-mobile-bar-wrap'),bar=el('div','hg-mobile-bar'),lab=el('div','hg-mobile-bar-label',labels[i]||'');
  bar.style.height=Math.max(4,Math.round((Number(row&&row.steps)||0)/max*62))+'px';bar.title=(Number(row&&row.steps)||0)+' kroków';
  w.append(bar,lab);wrap.appendChild(w);
 });
 parent.appendChild(wrap);
}
function renderGoals(){
 const body=ensureSection('settingsGoalsPro','Cele i podsumowanie','Cele bez presji na wagę, kalorie lub wygląd — skupione na zdrowych nawykach i regularności.','Cele');
 if(!body)return;body.replaceChildren();
 body.append(
  toggleRow('Codzienny ruch','Przypominaj o krótkiej, swobodnej aktywności bez narzucania liczby kroków.',suite.goals.movement,function(v){setPath('goals','movement',v);}),
  toggleRow('Rutyna snu','Pomagaj pamiętać o stałej porze wyciszenia.',suite.goals.sleepRoutine,function(v){setPath('goals','sleepRoutine',v);}),
  toggleRow('Przerwy od ekranu','Delikatne przypomnienia o odpoczynku od ekranu.',suite.goals.screenBreaks,function(v){setPath('goals','screenBreaks',v);})
 );
 const days=(Services.state.healthDays||[]).slice(0,14),current=days.slice(0,7),previous=days.slice(7,14);
 const card=el('div','hg-mobile-card');card.style.marginTop='12px';card.append(el('h4','','Ostatnie 7 dni'));
 if(!current.length){card.appendChild(el('p','','Brak zsynchronizowanych danych do podsumowania.'));body.appendChild(card);return;}
 const steps=metricSum(current,'steps'),active=metricSum(current,'activeMinutes'),prevSteps=metricSum(previous,'steps');
 const info=el('div','hg-mobile-grid'),c1=el('div',''),c2=el('div','');
 c1.append(el('p','','Zapisane kroki'),el('div','hg-mobile-kpi',steps?steps.toLocaleString('pl-PL'):'Brak danych'));
 c2.append(el('p','','Aktywne minuty'),el('div','hg-mobile-kpi',active?Math.round(active)+' min':'Brak danych'));
 info.append(c1,c2);card.appendChild(info);
 if(prevSteps>0&&steps>0){const diff=Math.round((steps-prevSteps)/prevSteps*100);card.appendChild(el('div','hg-mobile-sub','Zmiana względem wcześniejszych 7 dni: '+(diff>0?'+':'')+diff+'%. To tylko porównanie danych, nie ocena wyniku.'));}
 renderWeekChart(card,current.slice().reverse());body.appendChild(card);
}

function renderNotifications(){
 const body=ensureSection('settingsNotificationsPro','Powiadomienia','Wybierz, jakie przypomnienia i informacje HealthGo może pokazywać.','Powiadomienia');
 if(!body)return;body.replaceChildren();
 const child=Services.state.profile&&Services.state.profile.accountType==='child';
 body.append(
  toggleRow('Aktywność','Łagodne przypomnienie o ruchu lub krótkiej przerwie.',suite.notifications.activity,function(v){setPath('notifications','activity',v);}),
  toggleRow('Rutyna snu','Przypomnienie o wyciszeniu przed snem.',suite.notifications.sleep,function(v){setPath('notifications','sleep',v);}),
  toggleRow('Zmiany rodzinne','Zaproszenia, uprawnienia i ważne zmiany w HealthGo Family.',suite.notifications.family,function(v){setPath('notifications','family',v);},child),
  toggleRow('Synchronizacja urządzeń','Informacja, gdy urządzenie długo się nie synchronizuje.',suite.notifications.device,function(v){setPath('notifications','device',v);}),
  toggleRow('Podsumowanie tygodnia','Neutralne podsumowanie zapisanych danych z ostatnich dni.',suite.notifications.weekly,function(v){setPath('notifications','weekly',v);})
 );
 const actions=el('div','hg-mobile-actions');
 actions.append(button('Włącz powiadomienia systemowe',async function(){if(typeof window.enableHealthGoNotifications==='function')await window.enableHealthGoNotifications();renderNotifications();},false));
 const permission='Notification' in window?Notification.permission:'niedostępne';actions.append(statusPill('System: '+permission,permission==='granted'));body.appendChild(actions);
}

function downloadJson(name,data){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
}
function renderPrivacy(){
 const body=ensureSection('settingsPrivacyPro','Prywatność i dane','Kontrola synchronizacji, lokalizacji, eksportu danych i trybu offline.','Prywatność');
 if(!body)return;body.replaceChildren();
 const child=Services.state.profile&&Services.state.profile.accountType==='child';
 body.append(
  toggleRow('Synchronizacja z chmurą','Zapisuj ustawienia i wspierane dane konta w HealthGo Cloud.',suite.privacy.cloudSync,function(v){setPath('privacy','cloudSync',v);},child),
  toggleRow('Pamięć offline','Pozwól aplikacji przechować statyczne pliki aplikacji, aby mogła otworzyć się bez internetu.',suite.privacy.offlineCache,function(v){setPath('privacy','offlineCache',v);})
 );
 const location=Services.state.locationSettings||{},note=el('div','hg-mobile-note','Lokalizacja: '+(location.enabled?(location.mode==='precise'?'dokładna':'przybliżona'):'wyłączona')+'. Uprawnienia lokalizacji nadal kontroluje system telefonu.');
 body.appendChild(note);
 const actions=el('div','hg-mobile-actions');
 actions.append(button('Eksportuj moje dane',async function(){try{const data=await Services.call('exportOwnData',{});downloadJson('healthgo-export-'+new Date().toISOString().slice(0,10)+'.json',data);}catch(_){alert('Nie udało się przygotować eksportu.');}},false));
 actions.append(button('Ustawienia rodziny',function(){if(window.go)window.go('family');},true));body.appendChild(actions);
}

async function renderSecurity(){
 const body=ensureSection('settingsSecurityPro','Ochrona konta','Logowanie dwuetapowe konfigurujesz tutaj — HealthGo nie proponuje go automatycznie po zalogowaniu.','Ochrona konta');
 if(!body)return;body.replaceChildren();
 const session=Services.state.session||{},providers=(session.providers||[]).map(function(x){return String(x).replace('.com','');}).join(', ')||'e-mail';
 const grid=el('div','hg-mobile-grid'),a=el('div','hg-mobile-card'),b=el('div','hg-mobile-card');
 a.append(el('p','','Metoda logowania'),el('div','hg-mobile-kpi',providers));
 b.append(el('p','','2FA'),el('div','hg-mobile-kpi','Sprawdzam…'));grid.append(a,b);body.appendChild(grid);
 const api=window.HealthGoMFASettings;
 if(!api){b.querySelector('.hg-mobile-kpi').textContent='Niedostępne';return;}
 try{
  const st=await api.status();if(!document.body.contains(body))return;
  b.querySelector('.hg-mobile-kpi').textContent=st.enabled?'Włączone':'Wyłączone';
  b.appendChild(el('div','hg-mobile-sub',st.enabled?st.count+' aktywny czynnik TOTP':'Brak skonfigurowanego TOTP'));
  const actions=el('div','hg-mobile-actions');
  if(st.enabled){
   actions.append(button('Wyłącz 2FA',async function(){if(!confirm('Wyłączyć logowanie dwuetapowe dla tego konta?'))return;await api.disable();await renderSecurity();},true));
  }else{
   actions.append(button('Włącz 2FA',async function(){const ok=await api.enable();if(ok)await renderSecurity();},false));
  }
  body.appendChild(actions);
 }catch(_){b.querySelector('.hg-mobile-kpi').textContent='Błąd odczytu';}
}

function renderAppearance(){
 const body=ensureSection('settingsAppearancePro','Wygląd aplikacji','HealthGo dopasowuje się do telefonu i ustawień systemowych.','Wygląd');
 if(!body)return;body.replaceChildren();
 const field=el('div','hg-mobile-field'),label=el('label','','Motyw'),select=el('select','hg-mobile-select');
 [['system','Zgodny z telefonem'],['light','Jasny'],['dark','Ciemny']].forEach(function(item){const o=el('option','',item[1]);o.value=item[0];if(suite.theme===item[0])o.selected=true;select.appendChild(o);});
 select.addEventListener('change',function(){suite.theme=select.value;applyAppearance();persistSuite();});
 field.append(label,select);body.append(field,toggleRow('Kompaktowy układ','Mniejsze odstępy na małych ekranach.',suite.compact,function(v){suite.compact=v;applyAppearance();persistSuite();}));
}

function renderEmergency(){
 const body=ensureSection('settingsEmergencyPro','Kontakt awaryjny','Opcjonalny kontakt zapisany tylko na tym urządzeniu. HealthGo nie wysyła go do chmury.','Kontakt awaryjny');
 if(!body)return;body.replaceChildren();
 const data=readEmergency(),grid=el('div','hg-mobile-grid');
 function field(title,value,type){const wrap=el('div','hg-mobile-field'),lab=el('label','',title),input=el('input','hg-mobile-input');input.type=type||'text';input.value=value||'';wrap.append(lab,input);return{wrap,input};}
 const name=field('Imię lub nazwa kontaktu',data.name),phone=field('Telefon',data.phone,'tel');grid.append(name.wrap,phone.wrap);body.appendChild(grid);
 const actions=el('div','hg-mobile-actions');actions.append(button('Zapisz na tym urządzeniu',function(){writeEmergency({name:name.input.value.trim(),phone:phone.input.value.trim()});alert('Kontakt zapisany lokalnie na tym urządzeniu.');},false));actions.append(button('Wyczyść',function(){writeEmergency({});renderEmergency();},true));body.appendChild(actions);
}

async function renderOffline(){
 const body=ensureSection('settingsOfflinePro','Tryb offline i synchronizacja','Podstawowy interfejs może uruchomić się z pamięci telefonu, a dane synchronizują się po odzyskaniu internetu.','Offline');
 if(!body)return;body.replaceChildren();
 const grid=el('div','hg-mobile-grid'),net=el('div','hg-mobile-card'),sw=el('div','hg-mobile-card');
 net.append(el('p','','Połączenie'),statusPill(navigator.onLine?'Online':'Offline',navigator.onLine));
 let swText='Niedostępny';
 try{if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();swText=reg?'Gotowy':'Nieaktywny';}}catch(_){}
 sw.append(el('p','','Pamięć aplikacji'),el('div','hg-mobile-kpi',swText));grid.append(net,sw);body.appendChild(grid);
 const latest=Services.state.health&&(Services.state.health.updatedAt||Services.state.health.timestamp);
 body.appendChild(el('div','hg-mobile-sub',latest?'Ostatnie dane zdrowotne: '+new Date(latest).toLocaleString('pl-PL'):'Brak ostatniej synchronizacji danych.'));
 const actions=el('div','hg-mobile-actions');actions.append(button('Odśwież teraz',async function(){await Services.initialize();},false));body.appendChild(actions);
}

function shouldPersistAIHistory(){return suite.ai.history!==false;}
window.healthGoShouldPersistAIHistory=shouldPersistAIHistory;
function renderAISettings(){
 const body=ensureSection('settingsAIPro','HealthGo AI','Historia, tryby odpowiedzi i prywatność rozmów na telefonie.','AI');
 if(!body)return;body.replaceChildren();
 body.append(toggleRow('Historia rozmów','Zapisuj listę rozmów lokalnie na tym urządzeniu.',suite.ai.history,function(v){setPath('ai','history',v);}));
 const note=el('div','hg-mobile-note','Tryby AI: Przeciętny, Średni i Wysoki. Historia jest przypisywana do zalogowanego konta na tym urządzeniu.');
 body.appendChild(note);
 const actions=el('div','hg-mobile-actions');
 actions.append(button('Nowa rozmowa',function(){if(window.aiNewChat)window.aiNewChat();if(window.go)window.go('ai');},false));
 actions.append(button('Usuń lokalną historię',function(){if(!confirm('Usunąć lokalną historię rozmów AI na tym urządzeniu?'))return;try{localStorage.removeItem(aiKey());}catch(_){};if(window.aiNewChat)window.aiNewChat();},true));
 body.appendChild(actions);
}

function renderMore(){
 const body=ensureSection('settingsMorePro','Więcej funkcji','Szybki dostęp do pozostałych części HealthGo na telefonie.','Więcej');
 if(!body)return;body.replaceChildren();
 const grid=el('div','hg-mobile-quick-grid');
 [['🗺️','Mapa','map'],['📅','Plan','plan'],['🎯','Wyzwania','challenges'],['🎒','Plecak','backpack'],['⌚','Urządzenia','devices'],['🎮','Minigry','games'],['👨‍👩‍👧','Rodzina','family'],['🤖','AI','ai']].forEach(function(item){
  const b=el('button','hg-mobile-quick');b.type='button';b.append(el('span','',item[0]),document.createTextNode(item[1]));b.addEventListener('click',function(){if(window.mobileGo)window.mobileGo(item[2]);else if(window.go)window.go(item[2]);});grid.appendChild(b);
 });
 body.appendChild(grid);
}

function renderHome(){
 const page=document.getElementById('start');if(!page||!uid())return;
 let root=document.getElementById('hgMobileHomeEnhancements');
 if(!root){root=el('section','hg-mobile-home');root.id='hgMobileHomeEnhancements';const hero=page.querySelector('.dashboard-hero');if(hero&&hero.nextSibling)page.insertBefore(root,hero.nextSibling);else page.prepend(root);}
 root.replaceChildren();
 const head=el('div','hg-mobile-home-head'),copy=el('div');copy.append(el('b','','Status HealthGo'),el('div','hg-mobile-sub','Telefon, chmura i ostatnia synchronizacja'));head.append(copy,statusPill(navigator.onLine?'Online':'Offline',navigator.onLine));root.appendChild(head);
 const days=(Services.state.healthDays||[]).slice(0,7),grid=el('div','hg-mobile-grid'),week=el('div','hg-mobile-card'),device=el('div','hg-mobile-card');
 const steps=metricSum(days,'steps'),sources=[...new Set(days.map(function(d){return d&&d.source;}).filter(Boolean))];
 week.append(el('p','','Ostatnie 7 dni'),el('div','hg-mobile-kpi',steps?steps.toLocaleString('pl-PL')+' kroków':'Brak danych'),el('div','hg-mobile-sub','Neutralne podsumowanie zapisanych danych'));
 const devices=Services.state.devices||[],latest=devices[0];
 device.append(el('p','','Urządzenia'),el('div','hg-mobile-kpi',devices.length?devices.length+' połączonych':'Brak urządzeń'),el('div','hg-mobile-sub',latest&&latest.lastSyncAt?'Ostatnia synchronizacja: '+new Date(latest.lastSyncAt).toLocaleString('pl-PL'):sources.length?'Źródło: '+sources.join(', '):'Brak synchronizacji'));
 grid.append(week,device);root.appendChild(grid);
}

function setupMobileNav(){
 const nav=document.getElementById('mobileNav');if(!nav||nav.dataset.mobileSuite==='1')return;
 nav.dataset.mobileSuite='1';nav.replaceChildren();
 [['start','🏠','Start'],['family','👨‍👩‍👧','Rodzina'],['ai','🤖','AI'],['activity','❤️','Aktywność'],['settings','profile','Profil']].forEach(function(item,index){
  const b=el('button');b.type='button';b.dataset.mobilePage=item[0];if(index===0)b.classList.add('active');
  const icon=item[1]==='profile'?el('span','mobile-nav-icon hg-mobile-profile-icon','H'):el('span','mobile-nav-icon',item[1]);
  const label=el('span','mobile-nav-label',item[2]);b.append(icon,label);b.addEventListener('click',function(){if(window.mobileGo)window.mobileGo(item[0]);else if(window.go)window.go(item[0]);});nav.appendChild(b);
 });
 updateProfileIcon();
}
function updateProfileIcon(){
 const icon=document.querySelector('#mobileNav [data-mobile-page="settings"] .hg-mobile-profile-icon');if(!icon)return;
 const source=document.getElementById('topAvatar')||document.getElementById('sidebarAvatar');icon.textContent=(source&&source.textContent||Services.state.profile&&Services.state.profile.nickname||'H').trim().slice(0,1).toUpperCase()||'H';
}
function renderAll(){
 if(!uid())return;
 if(currentUid!==uid()){currentUid=uid();loadSuite();}
 ensureSection('settingsSecurityPro','Ochrona konta','Logowanie dwuetapowe konfigurujesz tutaj.','Ochrona konta');
 renderChildAccount();renderGoals();renderNotifications();renderPrivacy();renderAppearance();renderEmergency();renderOffline();renderAISettings();renderMore();renderSecurity();renderHome();setupMobileNav();updateProfileIcon();
}
function scheduleRender(){
 if(renderQueued)return;renderQueued=true;queueMicrotask(function(){renderQueued=false;renderAll();});
}
Services.subscribe(function(state){
 if(!state||!state.uid){currentUid=null;return;}
 if(currentUid!==state.uid){currentUid=state.uid;loadSuite();}
 scheduleRender();
});
window.addEventListener('online',scheduleRender);window.addEventListener('offline',scheduleRender);
if(window.matchMedia){const media=window.matchMedia('(prefers-color-scheme: dark)');if(media.addEventListener)media.addEventListener('change',function(){if(suite.theme==='system')applyAppearance();});}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')scheduleRender();});
setTimeout(scheduleRender,200);
})();
