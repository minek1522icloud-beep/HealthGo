/* HealthGo Feature Center 2026
 * Progressive enhancements to SEVEN existing screens. Never invents health
 * samples, XP, family permissions, approved treasures, or reward availability.
 * The authoritative data sources remain Supabase RPC and HealthGoEngine.
 */
(function(w){
'use strict';
const S=w.HealthGoServices, Engine=w.HealthGoEngine;
if(!S||!Engine)return;
const d=w.document,$=id=>d.getElementById(id);
const format=n=>Number(n).toLocaleString('pl-PL',{maximumFractionDigits:1});
const isNum=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const date=x=>{
 if(!x)return 'Brak synchronizacji';
 const t=new Date(x);return Number.isNaN(t.getTime())?'Brak synchronizacji':
  t.toLocaleString('pl-PL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
};
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=(tag,cls,text)=>{
 const e=d.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;
};
const go=page=>{
 if(typeof w.mobileGo==='function')w.mobileGo(page);
 else if(typeof w.go==='function')w.go(page);
};
const action=(title,fn,kind='')=>{
 const b=el('button','hfc-action '+kind,title);b.type='button';b.addEventListener('click',fn);return b;
};
function mount(page,id,afterSelector){
 const parent=$(page);if(!parent)return null;
 let root=$(id);if(root)return root;
 root=el('section','hfc-root');root.id=id;root.setAttribute('aria-label','Centrum funkcji HealthGo');
 const target=afterSelector?parent.querySelector(afterSelector):parent.querySelector('.hero');
 if(target)target.insertAdjacentElement('afterend',root);
 else parent.prepend(root);
 return root;
}
function header(root,kicker,title,copy){
 root.replaceChildren();
 const titleNode=el('div','hfc-head');
 titleNode.append(el('span','hfc-kicker',kicker),el('h3','',title),el('p','',copy));
 root.appendChild(titleNode);
}
function badge(icon,title,value,sub){
 const card=el('div','hfc-stat');
 card.append(el('span','hfc-stat-icon',icon),el('span','hfc-stat-label',title),
  el('strong','',value),el('small','',sub||''));return card;
}
function grid(parent,items){
 const node=el('div','hfc-stats');
 for(const item of items)node.appendChild(badge(...item));
 parent.appendChild(node);return node;
}
function buttons(parent,items){
 const bar=el('div','hfc-actions');
 for(const row of items)bar.appendChild(action(...row));
 parent.appendChild(bar);return bar;
}
function message(parent,copy){
 const p=el('p','hfc-hint',copy);parent.appendChild(p);return p;
}
function level(engine){return engine?Engine.getLevel(engine.totalXp||0):null;}
function challenges(){
 const root=mount('challenges','hfcChallenges');
 if(!root)return;
 const state=S.state,engine=state.engine,progress=level(engine);
 header(root,'MISJE · POZIOMY · XP','Twoja droga w HealthGo',
  'Wyzwania zaliczamy na podstawie zapisanych zdarzeń. XP nie jest dodawane za samo otwarcie ekranu.');
 const defs=engine?Engine.viewChallenges(engine,new Date().toISOString()):[];
 const completed=defs.filter(x=>x.status==='completed');
 const active=defs.filter(x=>x.status==='active');
 const medals=engine?Engine.viewAchievements(engine).filter(x=>x.earned):[];
 grid(root,[
  ['✦','Twój poziom',progress?String(progress.level):'—','Poziom z historii XP'],
  ['✨','Łącznie XP',engine?format(engine.totalXp||0):'—','Potwierdzone zdarzenia'],
  ['🎯','Misje ukończone',engine?String(completed.length):'—',engine?active.length+' aktywnych':'Zaloguj się'],
  ['🛡️','Zdobyte odznaki',engine?String(medals.length):'—','W Plecaku HealthGo']
 ]);
 const progressBox=el('div','hfc-progress-card');
 progressBox.append(el('div','hfc-progress-top',progress?'Do kolejnego poziomu: '+format(progress.remaining||0)+' XP':'Po zalogowaniu pokażemy postęp poziomu'));
 const bar=el('div','hfc-progress-track'),fill=el('span','hfc-progress-fill');
 fill.style.width=progress?Math.min(100,Math.max(0,progress.percent||0))+'%':'0%';
 bar.appendChild(fill);progressBox.appendChild(bar);
 const caption=el('p','',progress?format(progress.xp||0)+' / '+(progress.needed?format(progress.needed):'MAX')+' XP w tym poziomie':'Postęp pobieramy z konta HealthGo.');
 progressBox.appendChild(caption);root.appendChild(progressBox);
 const trio=active.slice().sort((a,b)=>(b.percent||0)-(a.percent||0)).slice(0,3);
 const mini=el('div','hfc-mini-heading','Najbliższe cele');
 root.appendChild(mini);
 if(!engine)message(root,'Aby zobaczyć swoje wyzwania, zaloguj się i poczekaj na synchronizację.');
 else if(!trio.length)message(root,'Nie ma aktualnie rozpoczętych wyzwań. Zobacz pozostałe kategorie poniżej.');
 else{
  const list=el('div','hfc-quest-list');
  for(const item of trio){
   const row=el('div','hfc-quest');
   const text=el('div','hfc-quest-text');
   text.append(el('b','',item.name||item.title),el('small','',item.description||'Wykonaj opisany cel, aby zdobyć XP.'));
   const perc=Math.min(100,Math.max(0,Number(item.percent)||0));
   const track=el('div','hfc-quest-track'),indicator=el('span');indicator.style.width=perc+'%';
   track.append(indicator);text.appendChild(track);
   row.append(text,el('strong','',item.target==null?String(Math.round(perc))+'%':
    format(item.progress||0)+' / '+format(item.target)));
   list.appendChild(row);
  }
  root.appendChild(list);
 }
 buttons(root,[['🏃 Aktywność',()=>go('activity'),''],['⌚ Źródła danych',()=>go('devices'),'subtle'],
  ['🛡️ Zobacz Plecak',()=>go('backpack'),'subtle']]);
}
function localDate(dateStr){
 if(typeof dateStr!=='string'||!/^\d{4}-\d\d-\d\d$/.test(dateStr))return null;
 const d0=new Date(dateStr+'T12:00:00Z');return Number.isNaN(d0.getTime())?null:d0;
}
function localSevenDays(now=new Date()){
 const days=[];
 // Key by local calendar date, never by UTC midnight in another timezone.
 const base=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 for(let i=6;i>=0;i--){
  const day=new Date(base);day.setDate(base.getDate()-i);
  const y=day.getFullYear(),m=String(day.getMonth()+1).padStart(2,'0'),dd=String(day.getDate()).padStart(2,'0');
  days.push({key:y+'-'+m+'-'+dd,label:day.toLocaleDateString('pl-PL',{weekday:'short'}).replace('.',''),
   day:day.getDate()});
 }
 return days;
}
function weekly(days,now){
 const dates=localSevenDays(now);
 const rows=new Map((Array.isArray(days)?days:[]).filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
 return dates.map(x=>{
  const value=rows.get(x.key),steps=isNum(value?.steps)?value.steps:null,
   minutes=isNum(value?.activeMinutes)?value.activeMinutes:null;
  return {...x,steps,minutes,source:value?.source||null};
 });
}
function activity(){
 const root=mount('activity','hfcActivity');if(!root)return;
 header(root,'RUCH · BEZ PRESJI','Twoje ostatnie 7 dni',
  'Pokazujemy wyłącznie pomiary pochodzące z podłączonych źródeł — nie generujemy fikcyjnych kroków.');
 const state=S.state,days=weekly(state.healthDays||[]),measured=days.filter(x=>x.steps!==null);
 const steps=measured.reduce((sum,x)=>sum+x.steps,0);
 const totalMinutes=days.filter(x=>x.minutes!==null).reduce((sum,x)=>sum+x.minutes,0);
 grid(root,[['👣','Kroki z 7 dni',measured.length?format(steps):'—',measured.length+' z 7 dni ma odczyt'],
  ['⏱️','Minuty ruchu',days.some(x=>x.minutes!==null)?format(totalMinutes):'—','Zarejestrowane źródła'],
  ['⌚','Ostatnie źródło',state.health?.source||'Brak',state.health?'Odczyt':'Jeszcze nie połączono']]);
 const bars=el('div','hfc-week-chart');bars.setAttribute('aria-label','Wykres kroków z ostatnich 7 dni');
 const top=Math.max(1,...days.map(x=>x.steps||0));
 for(const x of days){
  const bucket=el('div','hfc-week-day'),container=el('div','hfc-bar-wrap'),bar=el('div','hfc-week-bar');
  bar.style.height=x.steps===null?'0%':Math.max(4,(x.steps/top)*100)+'%';
  if(x.steps===null)bar.classList.add('missing');
  container.appendChild(bar);bucket.append(el('small','hfc-bar-value',x.steps===null?'—':format(x.steps)),container,el('small','',x.label));
  bucket.title=x.key+': '+(x.steps===null?'brak pomiaru':format(x.steps)+' kroków');bars.appendChild(bucket);
 }
 root.appendChild(bars);
 const status=el('p','hfc-sync-state',state.health?
  'Ostatni zapis: '+date(state.health.updatedAt||state.health.timestamp)+'. Dane pochodzą ze źródła '+(state.health.source||'HealthGo')+'.':
  'Brak danych z urządzenia. Możesz korzystać z planu dnia i wyzwań, nawet gdy nie masz zegarka.');
 root.appendChild(status);
 const refresh=async()=>{
  status.textContent='Pobieram ostatnie prawdziwe pomiary…';
  try{
   await S.refreshHealth();
   status.textContent='Synchronizacja odświeżona z konta.';
  }catch(e){status.textContent='Nie udało się odświeżyć: '+(S.errorMessage?.(e)||'brak połączenia');}
 };
 buttons(root,[['↻ Odśwież pomiary',refresh,''],['⌚ Połącz urządzenie',()=>go('devices'),'subtle'],
  ['🎯 Wyzwania',()=>go('challenges'),'subtle']]);
}
function device(){
 const root=mount('devices','hfcDevices');if(!root)return;
 header(root,'POŁĄCZENIA · SYNCHRONIZACJA','Centrum urządzeń',
  'Połączenie Bluetooth i dostęp do kroków czy snu to różne uprawnienia. HealthGo nie odczyta ich bez obsługi danego źródła.');
 const list=S.state.devices||[],health=S.state.health||null;
 const capabilities=w.HealthGoDevices?.capabilities||[];
 grid(root,[['⌚','Zapisane urządzenia',String(list.length),'Zapisane na Twoim koncie'],
  ['📶','Bluetooth',w.HealthGoDevices?.connected?'Połączono':'Niepołączono','Stan bieżącej sesji'],
  ['❤️','Dane aktywności',health?'Dostępne':'Brak danych',health?health.source||'Źródło':'Wymagane połączenie']]);
 const info=el('div','hfc-checklist');
 const ios=/iPad|iPhone|iPod/i.test(w.navigator?.userAgent||'');
 const ble=!!w.navigator?.bluetooth?.requestDevice;
 const cases=[
  ['Bezpieczna witryna (HTTPS)',w.isSecureContext===true?'Dostępne':'Wymagane HTTPS',w.isSecureContext===true],
  ['Bluetooth w przeglądarce',ble?'Dostępne na żądanie':ios?'Safari na iPhonie nie udostępnia Web Bluetooth':'Niedostępne w tej przeglądarce',ble],
  ['Dostęp do danych zdrowotnych',health?'Odebrano dane: '+(health.source||'źródło'):'Brak zsynchronizowanego źródła',!!health],
  ['Usługi BLE urządzenia',capabilities.length?capabilities.join(' · '):'Nie wykryto usług',!!capabilities.length]
 ];
 for(const [title,copy,ok] of cases){
  const row=el('div','hfc-check');
  row.append(el('span',ok?'hfc-check-ok':'hfc-check-unknown',ok?'✓':'i'));
  const detail=el('div','');detail.append(el('strong','',title),el('small','',copy));row.appendChild(detail);
  info.appendChild(row);
 }
 root.appendChild(info);
 const detail=el('p','hfc-hint',ios?
  'Na iPhonie ta wersja uruchomiona z ekranu początkowego działa jak aplikacja internetowa. Nie uzyska automatycznie danych Apple Health ani połączenia ze wszystkimi zegarkami. Do tego potrzebny jest obsługiwany moduł natywny.':
  'Na Androidzie niektóre czujniki działają przez Web Bluetooth. Dane Health Connect wymagają odpowiedniej integracji natywnej.');
 root.appendChild(detail);
 const status=el('p','hfc-sync-state','Stan połączenia sprawdzony.');
 root.appendChild(status);
 buttons(root,[['⟳ Odśwież urządzenia',async()=>{
  status.textContent='Odświeżam listę zapisanych urządzeń…';
  try{await S.refreshDevices();status.textContent='Lista odświeżona.'}
  catch(e){status.textContent='Nie udało się odświeżyć: '+(S.errorMessage?.(e)||'błąd połączenia');}
 },''],['⌚ Połącz zegarek',()=>{
  if(w.HealthGoDevices?.connect)w.HealthGoDevices.connect();
  else status.textContent='Moduł łączenia jest niedostępny na tym urządzeniu.';
 },'subtle'],['❤️ Moja aktywność',()=>go('activity'),'subtle']]);
}
function family(){
 const root=mount('family','hfcFamily');if(!root)return;
 const state=S.state,profile=state.profile||{},f=state.family||{};
 header(root,'HEALTHGO FAMILY','Bliscy i prywatność',
  'Zaproszenia, kontrola dostępu i udostępnianie danych tylko za zgodą. Członkowie nie widzą automatycznie Twojego zdrowia ani lokalizacji.');
 const n=Array.isArray(f.members)?f.members.length:0,linked=!!f.id,mode=state.locationSettings?.mode||'off';
 grid(root,[['👥','Członkowie',linked?String(n):'—',linked?'Dołączone konta':'Rodzina niepołączona'],
  ['🔑','Twoja rola',profile.accountType==='guardian'?'Opiekun':profile.accountType==='child'?'Dziecko':'Użytkownik','Kontrola przez serwer'],
  ['📍','Lokalizacja',mode==='off'?'Wyłączona':mode==='precise'?'Dokładna':'Przybliżona','Nigdy bez zgody telefonu']]);
 const privacy=el('div','hfc-family-privacy');
 privacy.append(el('strong','','Twoja prywatność ma pierwszeństwo'),
  el('p','','Tylko osoby z zatwierdzonymi uprawnieniami mogą otrzymywać wybrane informacje. Lokalizacja jest udostępniana osobno, po Twojej decyzji.'));
 root.appendChild(privacy);
 const stateText=el('p','hfc-sync-state',linked?
  'Połączono z HealthGo Family. Uprawnienia członków zmieniaj w panelu poniżej.':
  'Nie połączono jeszcze z rodziną. Możesz utworzyć ją jako opiekun lub dołączyć kodem.');
 root.appendChild(stateText);
 buttons(root,[['↻ Odśwież rodzinę',async()=>{
  stateText.textContent='Odświeżam rodzinę…';
  try{await S.initialize();stateText.textContent='Dane rodziny odświeżone.';}
  catch(e){stateText.textContent='Brak połączenia z rodziną: '+(S.errorMessage?.(e)||'błąd');}
 },''],['🛡️ Prywatność',()=>{
  go('settings');
  w.setTimeout(()=>d.getElementById('settingsPrivacyPro')?.scrollIntoView({behavior:'smooth',block:'start'}),120);
 },'subtle']]);
}
function pointSummary(){
 const root=mount('points','hfcPoint');if(!root)return;
 const owner=!!S.state.uid,state=owner?w.HealthGoPoints?.getState?.():null;
 const loaded=state&&Array.isArray(state.catalog)&&state.catalog.length>0;
 header(root,'HEALTHGO POINT · BEZ GOTÓWKI','Droga do cyfrowej nagrody',
  'Odkrywaj zatwierdzone skarby i wymieniaj wirtualne punkty na elementy kolekcji.');
 const units=Number(state?.units||0),target=40; // 40 internal half-units = 20 HG.
 const have=owner&&loaded?Math.max(0,units):0;
 const card=el('div','hfc-points-card');
 const title=el('div','hfc-points-heading');
 title.append(el('span','','Przykładowy cel: 20 HG'),el('strong','',owner&&loaded?(have/2).toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1})+' / 20 HG':'— / 20 HG'));
 card.appendChild(title);
 const bar=el('div','hfc-progress-track'),fill=el('span','hfc-progress-fill');fill.style.width=(owner&&loaded?Math.min(100,have/target*100):0)+'%';bar.appendChild(fill);card.appendChild(bar);
 card.append(el('p','','1 zatwierdzony skarb = 0,5 HG. 20 HG to orientacyjny cel kolekcjonerski, nie kupon na prawdziwy produkt.'));
 root.appendChild(card);
 const sites=owner&&loaded&&Array.isArray(state.sites)?state.sites:[];
 grid(root,[['💚','Saldo',owner&&loaded?(have/2).toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1})+' HG':'—','Zweryfikowany portfel'],
  ['🧭','Odkryte miejsca',owner&&loaded?String(sites.filter(x=>x.claimed).length):'—','Zatwierdzone odkrycia'],
  ['🎁','Przedmioty cyfrowe',owner&&loaded?String((state.inventory||[]).length):'—','Twoja kolekcja']]);
 buttons(root,[['🧭 Odkrywaj skarby',()=>go('explore'),''],['👥 Wymiana',()=>{
  const selector=$('hptFriend');if(selector)selector.focus();
  const tab=d.querySelector('#hgPointCenter [data-hpt-tab="friends"]');tab?.click?.();
 },'subtle']]);
}
let huntMap=null,huntMarkers=null,huntVisible=false;
function allowedSites(){
 if(!S.state.uid)return [];
 return (w.HealthGoPoints?.getState?.()?.sites||[]).filter(x=>
  typeof x?.id==='string'&&Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lon))&&
  Math.abs(Number(x.lat))<=90&&Math.abs(Number(x.lon))<=180).slice(0,150);
}
function removeMap(){
 if(huntMap){try{huntMap.remove()}catch(_){}}
 huntMap=null;huntMarkers=null;huntVisible=false;
}
function treasure(){
 const root=mount('explore','hfcTreasure');if(!root)return;
 const sites=allowedSites(),found=sites.filter(x=>x.claimed).length;
 header(root,'MAPA WYPRAW','Skarby na mapie',
  'Widzisz wyłącznie bezpieczne, zatwierdzone miejsca publiczne. GPS uruchamia się tylko po Twojej zgodzie.');
 grid(root,[['📍','Dostępne miejsca',String(sites.length),'Zatwierdzone przez administratora'],
  ['🧭','Znalezione',String(found),'Odkrycia powiązane z kontem'],
  ['💎','Za odkrycie','0,5 HG','Wirtualne HealthGo Point']]);
 const box=el('div','hfc-map-area');
 const mapEl=el('div','hfc-map-canvas');mapEl.id='hfcTreasureMap';mapEl.hidden=!huntVisible;
 const cover=el('div','hfc-map-empty');
 cover.append(el('span','','🗺️'),el('strong','',sites.length?'Gotowe do wyświetlenia zatwierdzonych skarbów':'Mapa czeka na pierwsze zatwierdzone miejsca'),
  el('p','',sites.length?'Otwórz mapę, aby zobaczyć punkty. Twój GPS nie będzie pobierany automatycznie.':'Nie tworzymy fikcyjnych lokalizacji. Nowe skarby pojawią się dopiero po ich sprawdzeniu.'));
 box.append(mapEl,cover);root.appendChild(box);
 const status=el('p','hfc-sync-state',sites.length?'Mapa dostępna na żądanie.':'Na razie brak zatwierdzonych miejsc na koncie.');
 root.appendChild(status);
 buttons(root,[['🗺️ '+(huntVisible?'Ukryj mapę':'Pokaż mapę skarbów'),()=>toggleTreasureMap(),''],
  ['✦ Portfel HG',()=>go('points'),'subtle']]);
 if(huntVisible){
  cover.hidden=true;
  if(huntMap){
   // DOM was recreated: Leaflet instances hold old containers; recreate safely.
   try{huntMap.remove()}catch(_){}
   huntMap=null;huntMarkers=null;
  }
  w.setTimeout(drawTreasureMap,30);
 }
}
function drawTreasureMap(){
 const container=$('hfcTreasureMap');
 const sites=allowedSites();
 if(!huntVisible||!container||!sites.length||!w.L?.map)return false;
 if(huntMap){try{huntMap.remove()}catch(_){}}
 try{
  huntMap=w.L.map(container,{zoomControl:true,scrollWheelZoom:false,attributionControl:true});
  w.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
   attribution:'© OpenStreetMap contributors',maxZoom:18
  }).addTo(huntMap);
  const group=w.L.featureGroup();
  for(const site of sites){
   const marker=w.L.marker([Number(site.lat),Number(site.lon)]).addTo(group);
   const card=el('div','hfc-pin-popup');
   card.append(el('strong','',site.name||'Skarb'),el('p','',site.description||'Odwiedź to bezpieczne miejsce.'));
   const btn=action(site.claimed?'✓ Odkryto':'🧭 Nawiguj do skarbu',()=>{
    if(site.claimed)return;
    if(w.HealthGoMapV2?.selectDestination){
     go('map');w.HealthGoMapV2.selectDestination(site.name,Number(site.lat),Number(site.lon));
    }
   });btn.disabled=!!site.claimed;card.appendChild(btn);
   marker.bindPopup(card);
  }
  group.addTo(huntMap);huntMarkers=group;
  huntMap.fitBounds(group.getBounds(),{padding:[28,28],maxZoom:14});
  w.setTimeout(()=>huntMap?.invalidateSize?.(),90);return true;
 }catch(_){
  removeMap();
  const s=d.querySelector('#hfcTreasure .hfc-sync-state');if(s)s.textContent='Mapa nie mogła się uruchomić. Lista skarbów poniżej nadal jest dostępna.';
  return false;
 }
}
function toggleTreasureMap(){
 if(!allowedSites().length)return;
 huntVisible=!huntVisible;
 if(!huntVisible)removeMap();
 treasure();
}
function settings(){
 const root=mount('settings','hfcSettings');if(!root)return;
 header(root,'BEZPIECZEŃSTWO · KONTO','Szybkie ustawienia',
  'Wszystkie ustawienia w jednym miejscu, bez konieczności szukania ich w długiej liście.');
 const links=[
  ['🛡️','Prywatność','Lokalizacja, uprawnienia i synchronizacja','settingsPrivacyPro'],
  ['🔔','Powiadomienia','Kontrola przypomnień','settingsNotificationsPro'],
  ['🎨','Wygląd','Motyw i wygląd aplikacji','settingsAppearance'],
  ['🔐','Bezpieczeństwo','Logowanie i weryfikacja konta','settingsSecurityPro'],
  ['👨‍👩‍👧','Rodzina','Dostęp bliskich do danych','family']
 ];
 const nav=el('div','hfc-settings-links');
 for(const [icon,title,description,target] of links){
  const row=action('',()=>jump(target));
  row.classList.add('hfc-setting-link');
  row.replaceChildren(el('span','hfc-settings-icon',icon));
  const copy=el('span','hfc-setting-copy');copy.append(
   el('strong','',title),el('small','',description));
  row.append(copy,el('span','hfc-chevron','›'));nav.appendChild(row);
 }
 root.appendChild(nav);
 const data=S.state;
 message(root,'Konto: '+(data.profile?.nickname||'—')+' · '+(data.online?'Online':'Offline')+
  '. Uprawnienia lokalizacji i zdrowia są kontrolowane również przez iPhone’a / Androida.');
}
function jump(target){
 if(target==='family'){go('family');return}
 const section=$(target);
 if(section)section.scrollIntoView({behavior:'smooth',block:'start'});
 else{
  const basics={settingsPrivacyPro:'settingsPrivacy',settingsNotificationsPro:'settingsHelp',
   settingsSecurityPro:'settingsAccount'};
  $(basics[target]||'settingsAccount')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
}
let queued=false,session='';
function render(){
 const owner=String(S.state.uid||'');
 if(owner!==session){
  session=owner;removeMap();
 }
 challenges();activity();device();family();treasure();pointSummary();settings();
}
function schedule(){
 if(queued)return;queued=true;
 const task=()=>{queued=false;render();};
 if(typeof w.requestAnimationFrame==='function')w.requestAnimationFrame(task);
 else w.setTimeout(task,0);
}
S.subscribe(schedule);
w.addEventListener?.('healthgo:points-updated',schedule);
w.addEventListener?.('pageshow',schedule);
w.HealthGoFeatureCenter=Object.freeze({
 render,schedule,weekly,localSevenDays,
 getApprovedSites:allowedSites,
 showTreasureMap:()=>{if(!huntVisible)toggleTreasureMap()},
 hideTreasureMap:removeMap
});
schedule();
})(window);