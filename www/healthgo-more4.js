/* HealthGo More 4.0 — account-scoped UI for existing, verified services.
 * Does not grant XP, claim wearable access, send emergency calls automatically,
 * or expose private health data to other users. Existing map and badges untouched.
 */
(function(w){
'use strict';
const d=w.document,S=w.HealthGoServices,Engine=w.HealthGoEngine;
if(!d||!S||!Engine)return;
const $=id=>d.getElementById(id);
const node=(tag,cls,txt)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n;};
const safeNumber=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:0;
const number=n=>safeNumber(n).toLocaleString('pl-PL');
const date=x=>{const t=new Date(x);return Number.isFinite(t.getTime())?t.toLocaleString('pl-PL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Brak daty';};
const go=page=>{if(typeof w.mobileGo==='function')w.mobileGo(page);else if(typeof w.go==='function')w.go(page);};
function jump(page,id){go(page);w.setTimeout?.(()=>$(id)?.scrollIntoView?.({behavior:'smooth',block:'start'}),120);}
function button(label,click,secondary=false){const b=node('button','hg4-button'+(secondary?' subtle':''),label);b.type='button';b.addEventListener('click',click);return b;}
function section(parent,id,title,description){
 if(!parent)return null;
 let root=$(id);if(!root){root=node('section','hg4-panel');root.id=id;parent.appendChild(root);}
 root.replaceChildren();root.append(node('h3','hg4-title',title),node('p','hg4-description',description));return root;
}
function actions(root,items){const row=node('div','hg4-actions');for(const [label,fn,sub] of items)row.appendChild(button(label,fn,sub));root.appendChild(row);}
function stat(root,items){const wrap=node('div','hg4-stats');for(const [label,value,desc] of items){const box=node('div','hg4-stat');box.append(node('small','',label),node('strong','',value),node('span','',desc));wrap.appendChild(box);}root.appendChild(wrap);}
function empty(root,text){root.appendChild(node('p','hg4-empty',text));}
function engine(){return S.state?.uid&&S.state?.engine?S.state.engine:null;}
function history(){const h=engine()?.history;return Array.isArray(h)?h.filter(x=>x&&typeof x==='object'&&typeof x.type==='string'):[];}
function prefsKey(){const id=String(S.state?.uid||'');return id?'healthgo.more4.prefs.'+encodeURIComponent(id):null;}
function preferences(){
 const key=prefsKey();if(!key)return {xp:true,missions:true,reminders:true,accent:'mint',quiet:false,contrast:false,density:'comfortable'};
 try{const value=JSON.parse(w.localStorage?.getItem(key)||'{}');
  return {xp:value.xp!==false,missions:value.missions!==false,reminders:value.reminders!==false,
   accent:['mint','blue','violet'].includes(value.accent)?value.accent:'mint',quiet:value.quiet===true,
   contrast:value.contrast===true,density:value.density==='compact'?'compact':'comfortable'};
 }catch(_){return {xp:true,missions:true,reminders:true,accent:'mint',quiet:false,contrast:false,density:'comfortable'};}
}
function savePrefs(changes){const key=prefsKey();if(!key)return false;const next={...preferences(),...changes};
 try{w.localStorage?.setItem(key,JSON.stringify(next));return true;}catch(_){return false;}}
function applyPrefs(){
 const p=preferences();d.body?.setAttribute?.('data-hg4-accent',p.accent);
 d.body?.classList?.toggle?.('hg4-quiet',p.quiet);
 d.body?.classList?.toggle?.('hg4-contrast',p.contrast);
 d.body?.classList?.toggle?.('hg4-compact',p.density==='compact');
}
function eventsOf(type){return history().filter(e=>e.type===type);}
function xpRows(){return eventsOf('XP_GAINED').filter(e=>safeNumber(e.payload?.xp)>0).slice(-200);}
function downloadCsv(name,rows){
 if(typeof w.Blob!=='function'||!w.URL?.createObjectURL)return false;
 const escapeCell=value=>'"'+String(value??'').replace(/"/g,'""').replace(/^[=+\-@\t\r]/,'\'$&')+'"';
 const csv='\uFEFF'+rows.map(row=>row.map(escapeCell).join(';')).join('\r\n');
 const url=w.URL.createObjectURL(new w.Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=node('a');a.href=url;a.download=name;d.body.appendChild(a);a.click();a.remove();
 w.setTimeout?.(()=>w.URL.revokeObjectURL(url),1500);return true;
}
function xpDashboard(){
 const root=section($('challenges'),'hg4XpDashboard','⚡ XP i nagrody 2.0',
  'Wyniki pochodzą z historii potwierdzonych działań na Twoim koncie. Otwieranie kart nie dodaje XP.');
 if(!root)return;
 const e=engine(),l=e?Engine.getLevel(safeNumber(e.totalXp)):null;
 stat(root,[['Poziom',l?String(l.level):'—','Z zapisanych XP'],['Łącznie XP',e?number(e.totalXp):'—','Potwierdzone punkty'],
  ['Do awansu',l?number(l.remaining)+' XP':'—','W tym poziomie']]);
 const track=node('div','hg4-track');const fill=node('div','hg4-fill');fill.style.width=l?Math.min(100,l.percent)+'%':'0%';
 track.appendChild(fill);track.setAttribute('role','progressbar');track.setAttribute('aria-label','Postęp poziomu XP');
 track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
 track.setAttribute('aria-valuenow',String(l?Math.round(l.percent):0));
 root.appendChild(track);
 if(l)root.appendChild(node('p','hg4-footnote',number(l.xp)+' / '+number(l.needed)+' XP na tym poziomie. Nagrody przyznaje wyłącznie silnik potwierdzonych zdarzeń.'));
 const timeline=node('div','hg4-events');timeline.appendChild(node('h4','','Historia XP'));
 const data=xpRows().slice(-8).reverse();
 if(!e)empty(timeline,'Zaloguj się, aby zobaczyć swoje XP.');
 else if(!data.length)empty(timeline,'Brak nowych zapisów XP. Starsze nagrody mogły zostać przeniesione bez dat.');
 else for(const row of data){const item=node('div','hg4-event');item.append(node('strong','', '+'+number(row.payload.xp)+' XP'),node('span','',date(row.occurredAt)));timeline.appendChild(item);}
 root.appendChild(timeline);
 actions(root,[['Historia XP CSV',()=>{
  if(!e)return;
  downloadCsv('healthgo-historia-xp.csv',[['Data','Zdarzenie','XP'],...xpRows().map(x=>[x.occurredAt,x.type,x.payload.xp])]);
 },true],['Sklep nagród HG',()=>go('points'),false],['Odznaki',()=>go('backpack'),true]]);
 root.appendChild(node('p','hg4-footnote','HealthGo Point (HG) jest istniejącą walutą cyfrowych nagród. Nie tworzymy drugiego, niespójnego salda „HealthCoins”.'));
}
let period='all',missionStatus='all',missionSearch='';
function missionDestination(item){
 if(item?.confirmationRequired)return 'plan';
 const metric=String(item?.requirement?.type||'');
 if(/plan|focus|rest|relax|learn|habit/i.test(metric))return 'plan';
 if(/step|heart|distance|sleep|health|device/i.test(metric))return 'devices';
 if(/map|explore|treasure|route/i.test(metric))return 'map';
 return 'activity';
}
function missions(){
 const root=section($('challenges'),'hg4MissionPeriods','🎯 Centrum misji',
  'Misje dzienne, tygodniowe, miesięczne i specjalne — wyłącznie z katalogu HealthGo.');
 if(!root)return;
 const e=engine();if(!e){empty(root,'Zaloguj się, aby zobaczyć swoje misje.');return;}
 let defs=[];try{defs=Engine.viewChallenges(e,new Date().toISOString())||[];}catch(_){}
 const completed=defs.filter(x=>x.status==='completed').length;
 stat(root,[['Misje',number(defs.length),'Z katalogu'],['Ukończone',number(completed),'Potwierdzone'],['W toku',number(defs.filter(x=>x.status==='active').length),'Bez presji']]);
 const tools=node('div','hg4-mission-tools');
 const search=node('input','hg4-search');search.type='search';search.value=missionSearch;
 search.placeholder='Szukaj wyzwania';search.setAttribute('aria-label','Szukaj wyzwania po nazwie');
 const status=node('select','hg4-select');status.setAttribute('aria-label','Stan misji');
 for(const [key,label] of [['all','Każdy stan'],['active','W toku'],['completed','Ukończone']]){
  const opt=node('option','',label);opt.value=key;status.appendChild(opt);
 }
 status.value=missionStatus;tools.append(search,status);
 const tabs=node('div','hg4-tabs');const list=node('div','hg4-mission-list'),count=node('p','hg4-footnote');
 const groups=[['all','Wszystkie'],['daily','Dzienne'],['weekly','Tygodniowe'],['monthly','Miesięczne'],['special','Specjalne']];
 const draw=()=>{
  tabs.replaceChildren();list.replaceChildren();
  for(const [value,label] of groups){const b=button(label,()=>{period=value;draw()},period!==value);b.setAttribute('aria-pressed',String(period===value));tabs.appendChild(b);}
  const filtered=defs.filter(x=>
   (period==='all'||(period==='special'?['event','seasonal','special'].includes(x.period):x.period===period))&&
   (missionStatus==='all'||x.status===missionStatus)&&
   (String(x.name||'')+' '+String(x.description||'')).toLocaleLowerCase('pl').includes(missionSearch.toLocaleLowerCase('pl')));
  count.textContent='Znaleziono '+number(filtered.length)+' misji';
  if(!filtered.length){empty(list,'Brak misji w tej kategorii. Możesz przełączyć filtr.');return;}
  for(const x of filtered.slice(0,30)){
   const card=node('article','hg4-mission');
   const title=node('div','hg4-mission-top');
   title.append(node('strong','',(x.icon||'🎯')+' '+String(x.name||'Wyzwanie').slice(0,100)),node('small','',x.status==='completed'?'Ukończone':x.status==='active'?'Aktywne':'Niedostępne'));
   card.append(title,node('p','',String(x.description||'').slice(0,240)));
   const track=node('div','hg4-track'),fill=node('span','hg4-fill');fill.style.width=Math.min(100,Math.max(0,safeNumber(x.percent)))+'%';
   track.setAttribute('role','progressbar');track.setAttribute('aria-label','Postęp misji: '+String(x.name||''));
   track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
   track.setAttribute('aria-valuenow',String(Math.min(100,Math.round(safeNumber(x.percent)))));track.appendChild(fill);
   card.append(track,node('small','',Math.round(safeNumber(x.percent))+'% · '+number(x.xpReward||0)+' XP po rzeczywistym wykonaniu'));
   card.appendChild(node('p','hg4-footnote','Źródło: '+String(x.source||'Historia HealthGo').slice(0,140)));
   if(x.status==='active')card.appendChild(button('Przejdź do zadania →',()=>go(missionDestination(x)),true));
   list.appendChild(card);
  }
 };
 search.addEventListener('input',()=>{missionSearch=String(search.value).slice(0,100);draw();});
 status.addEventListener('change',()=>{missionStatus=status.value;draw();});
 root.append(tools,tabs,count,list);draw();
}
function healthDays(){
 const arr=S.state?.healthDays;return Array.isArray(arr)?arr.filter(x=>x&&typeof x.id==='string'):[];}
let statsRange=7,statsMetric='steps';
function stats(){
 const root=section($('activity'),'hg4Stats','📊 Statystyki PRO',
  'Rzeczywiste dane urządzeń. Nieudostępniony pomiar oznaczamy kreską, nigdy zerem.');
 if(!root)return;
 const arr=healthDays(),byId=new Map(arr.map(x=>[x.id,x])),today=new Date(),items=[];
 for(let offset=statsRange-1;offset>=0;offset--){
  const day=new Date(today.getFullYear(),today.getMonth(),today.getDate()-offset,12);
  const id=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
  const record=byId.get(id);
  items.push({id,label:day.toLocaleDateString('pl-PL',{day:'numeric',month:'short'}),steps:record?.steps,minutes:record?.minutes});
 }
 const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 const steps=items.filter(x=>valid(x.steps)),minutes=items.filter(x=>valid(x.minutes));
 stat(root,[['Dni z danymi',number(steps.length)+' / '+statsRange,'Pomiary kroków'],
  ['Kroki',steps.length?number(steps.reduce((sum,x)=>sum+x.steps,0)):'—','Tylko z synchronizacji'],
  ['Minuty',minutes.length?number(minutes.reduce((sum,x)=>sum+x.minutes,0)):'—','Jeśli dostępne']]);
 const tools=node('div','hg4-stat-toolbar');
 for(const [period,label] of [[7,'7 dni'],[30,'30 dni']]){
  const btn=button(label,()=>{statsRange=period;stats();},statsRange!==period);
  btn.setAttribute('aria-pressed',String(statsRange===period));tools.appendChild(btn);
 }
 const choice=node('select','hg4-select');choice.setAttribute('aria-label','Dane wykresu');
 for(const [key,label] of [['steps','Kroki'],['minutes','Minuty aktywności']]){
  const opt=node('option','',label);opt.value=key;choice.appendChild(opt);
 }
 choice.value=statsMetric;choice.addEventListener('change',()=>{statsMetric=choice.value;stats();});tools.appendChild(choice);
 root.appendChild(tools);
 const chartScroll=node('div','hg4-chart-scroll'),chart=node('div','hg4-chart');
 chart.style.gridTemplateColumns='repeat('+statsRange+', minmax('+(statsRange===30?27:38)+'px, 1fr))';
 const max=Math.max(1,...items.map(x=>valid(x[statsMetric])?x[statsMetric]:0));
 for(const item of items){
  const cell=node('div','hg4-chart-cell'),wrap=node('div','hg4-chart-bar-wrap'),bar=node('div','hg4-chart-bar');
  const value=item[statsMetric],has=valid(value);
  bar.style.height=has?Math.max(2,value/max*100)+'%':'0%';
  bar.classList.toggle('missing',!has);
  bar.setAttribute('aria-label',item.id+': '+(has?number(value):'brak danych'));
  wrap.appendChild(bar);
  cell.append(node('small','',has?number(value):'—'),wrap,node('span','',item.label));
  chart.appendChild(cell);
 }
 chartScroll.appendChild(chart);root.appendChild(chartScroll);
 actions(root,[['Eksportuj dane CSV',()=>downloadCsv('healthgo-aktywnosc-'+statsRange+'-dni.csv',
  [['Data','Kroki','Minuty'],...items.map(x=>[x.id,x.steps??'',x.minutes??''])]),false],
 ['Odśwież pomiary',async()=>{
  const msg=$('hg4StatsStatus');if(msg)msg.textContent='Odświeżam…';
  try{if(typeof S.refreshHealth!=='function')throw Error('NO_SYNC');
   await S.refreshHealth();if(msg)msg.textContent='Synchronizacja zakończona.';
  }catch(_){if(msg)msg.textContent='Nie udało się zsynchronizować danych.';}
 },true]]);
 const status=node('p','hg4-footnote','Eksport jest pobierany wyłącznie po Twoim kliknięciu.');
 status.id='hg4StatsStatus';status.setAttribute('role','status');root.appendChild(status);
}
function devices(){
 const root=section($('devices'),'hg4Devices','⌚ Urządzenia i synchronizacja',
  'Wszystkie informacje dotyczą faktycznie zapisanych lub aktualnie połączonych urządzeń.');
 if(!root)return;
 const devices=Array.isArray(S.state?.devices)?S.state.devices:[],api=w.HealthGoDevices;
 stat(root,[['Zapisane',String(devices.length),'Na Twoim koncie'],['Połączenie',api?.connected?'Aktywne':'Nieaktywne','Ta sesja'],
  ['Bateria',api?.activeDevice&&Number.isFinite(api?.batteryLevel)?String(api.batteryLevel)+'%':'—','Tylko z BLE']]);
 const saved=node('div','hg4-device-list');saved.appendChild(node('h4','','Zapisane urządzenia'));
 if(!devices.length)empty(saved,'Nie masz jeszcze zapisanych urządzeń. Możesz dodać zgodne urządzenie poniżej.');
 for(const device of devices.slice(0,20)){
  const row=node('div','hg4-device-row'),copy=node('div','hg4-device-copy');
  copy.append(node('strong','',String(device.name||'Urządzenie').slice(0,75)),
   node('small','','System: '+String(device.platform||'nieznany').slice(0,36)+
    ' · Synchronizacja: '+date(device.lastSyncAt)));
  const isCurrent=!!(api?.connected&&api?.activeDevice&&device.externalId&&api.activeDevice.id===device.externalId);
  row.append(copy,node('span','hg4-device-status',isCurrent?'Połączono teraz':'Zapisane'));
  saved.appendChild(row);
 }
 root.appendChild(saved);
 actions(root,[['Połącz urządzenie',()=>{
  if(typeof api?.connect==='function')api.connect();
  else{const msg=$('hg4DeviceStatus');if(msg)msg.textContent='Moduł połączenia jest niedostępny.';}
 },false],
  ['Odśwież urządzenia',async()=>{const label=$('hg4DeviceStatus');if(label)label.textContent='Sprawdzam urządzenia…';
   try{if(typeof S.refreshDevices!=='function')throw Error('UNAVAILABLE');await S.refreshDevices();if(label)label.textContent='Odświeżono listę.';}
   catch(_){if(label)label.textContent='Nie udało się odświeżyć listy.';}},true]]);
 const status=node('p','hg4-footnote',
  'Safari na iPhonie nie udostępnia stronie Web Bluetooth ani Apple Health. '+
  'Odczyty tętna, snu i baterii wymagają rzeczywiście obsługiwanego połączenia i zgody.');
 status.id='hg4DeviceStatus';status.setAttribute('role','status');root.appendChild(status);
 const details=node('details','hg4-lesson'),heading=node('summary','','Pomoc z połączeniem');
 details.append(heading,node('p','','1. Sprawdź Bluetooth i zgodność zegarka. '+
 '2. Jeśli nie ma przycisku łączenia w przeglądarce, użyj aplikacji producenta. '+
 '3. Odśwież listę po synchronizacji; brak danych oznacza brak dostępu, nie zero pomiaru.'));
 root.appendChild(details);
}
function family(){
 const root=section($('family'),'hg4FamilyExtras','👥 Rodzina i znajomi',
  'Wspólne funkcje wymagają zaakceptowanego zaproszenia. Dane zdrowotne i lokalizacja nigdy nie stają się automatycznie publiczne.');
 if(!root)return;
 const f=S.state?.family,friend=w.HealthGoFriends?.getState?.(),existing=Array.isArray(f?.members)?f.members.length:0;
 stat(root,[['Rodzina',f?.id?String(existing):'—','Tylko powiązane konta'],
  ['Zaproszenia',friend?'Dostępne':'—','Po otwarciu panelu znajomych']]);
 actions(root,[['Zarządzaj znajomymi',()=>jump('settings','hgFriendsPanel'),false],
  ['Prywatność rodziny',()=>jump('settings','settingsPrivacy'),true],
  ['Wyzwania',()=>go('challenges'),true]]);
}
const allowedEvents={XP_GAINED:['xp','Zdobyto XP'],LEVEL_UP:['xp','Nowy poziom'],REWARD_GRANTED:['missions','Nowa nagroda'],
 CHALLENGE_COMPLETED:['missions','Ukończono misję'],ACHIEVEMENT_EARNED:['missions','Zdobyto osiągnięcie']};
function notices(){
 const opts=preferences();
 return history().filter(x=>allowedEvents[x.type]&&opts[allowedEvents[x.type][0]]!==false)
  .slice(-25).reverse();
}
function notifications(root){
 const p=preferences();
 const n=section(root,'hg4Notifications','🔔 Centrum powiadomień',
  'Historia zdarzeń HealthGo z konta. Powiadomienia systemowe zależą od uprawnień telefonu.');
 if(!n)return;
 const state=node('p','hg4-footnote','Powiadomienia systemowe: '+(w.Notification?.permission||'niedostępne'));state.id='hg4NotificationStatus';n.appendChild(state);
 actions(n,[['Sprawdź zgodę systemu',async()=>{
  const result=$('hg4NotificationStatus');
  if(!w.Notification?.requestPermission){if(result)result.textContent='Ta wersja przeglądarki nie obsługuje prośby o powiadomienia.';return;}
  try{const permission=await w.Notification.requestPermission();if(result)result.textContent='Zgoda systemowa: '+permission+'. Działanie w tle wymaga osobnej obsługi push.';}
  catch(_){if(result)result.textContent='Nie udało się uzyskać zgody.';}},true]]);
 const toggleRoot=node('div','hg4-toggle-list');
 for(const [key,label] of [['xp','XP i poziomy'],['missions','Wyzwania i nagrody']]){
  const labelNode=node('label','hg4-toggle'),control=node('input');control.type='checkbox';control.checked=p[key]!==false;
  control.addEventListener('change',()=>{savePrefs({[key]:control.checked});notifications(root);});
  labelNode.append(node('span','',label),control);toggleRoot.appendChild(labelNode);}
 n.appendChild(toggleRoot);
 actions(n,[['Przypomnienia planu dnia',()=>go('plan'),true]]);
 const feed=node('div','hg4-events');feed.appendChild(node('h4','','Ostatnie zdarzenia'));
 const list=notices();if(!list.length)empty(feed,'Brak zapisanych zdarzeń dla wybranych kategorii.');
 for(const ev of list.slice(0,12)){const row=node('div','hg4-event');
  const text=ev.type==='XP_GAINED'?'Zdobyto '+number(ev.payload?.xp)+' XP':allowedEvents[ev.type][1];
  row.append(node('strong','',text),node('span','',date(ev.occurredAt)));feed.appendChild(row);}
 n.appendChild(feed);
 n.appendChild(node('p','hg4-footnote','Te filtry dotyczą Centrum powiadomień. Przypomnienia planu konfiguruje się osobno w Planie Dnia. Nie aktywują same z siebie powiadomień push ani pracy w tle.'));
}
function security(root){
 const panel=section(root,'hg4Security','🛡️ Bezpieczeństwo i SOS',
  'Szybki dostęp do pomocy. HealthGo nie wysyła automatycznie zgłoszeń alarmowych.');
 if(!panel)return;
 const warn=node('div','hg4-sos-card');
 warn.append(node('strong','','112 — numer alarmowy w Polsce'),node('p','','W sytuacji zagrożenia zdrowia lub życia skorzystaj z numeru 112. Nie używaj telefonu podczas prowadzenia pojazdu.'));
 const tel=button('Otwórz połączenie 112',()=>{
  if(typeof w.confirm==='function'&&!w.confirm('Otworzyć aplikację telefonu z numerem alarmowym 112?'))return;
  w.location.href='tel:112';},false);tel.setAttribute('aria-label','Potwierdź i otwórz numer 112');
 warn.appendChild(tel);panel.appendChild(warn);
 actions(panel,[['Prywatność konta',()=>jump('settings','settingsPrivacy'),true],
  ['Ustawienia bezpieczeństwa',()=>jump('settings','settingsAccount'),true]]);
 panel.appendChild(node('p','hg4-footnote','Wybór numeru telefonu nie oznacza połączenia ze służbami. HealthGo nie śledzi rozmowy ani nie wysyła zgłoszenia.'));
}
function academy(root){
 const panel=section(root,'hg4Academy','🎓 Akademia HealthGo','Krótkie lekcje bez zdobywania niepotwierdzonego XP.');
 if(!panel)return;
 const lessons=[['Odpoczynek','Regularne przerwy są ważną częścią dbania o siebie.'],
 ['Nawodnienie','Pij odpowiednio do potrzeb organizmu i warunków, nie według rywalizacji.'],
 ['Bezpieczeństwo','W nagłym zagrożeniu życia lub zdrowia w Polsce skontaktuj się z 112.']];
 const list=node('div','hg4-academy-grid');
 for(const [title,copy] of lessons){const card=node('details','hg4-lesson'),sum=node('summary','',title);
  card.append(sum,node('p','',copy));list.appendChild(card);}panel.appendChild(list);
 const quiz=node('div','hg4-settings-card');
 quiz.appendChild(node('h4','','Mini quiz: odpoczynek'));
 quiz.appendChild(node('p','hg4-description','Kiedy warto zrobić przerwę od ekranu?'));
 const feedback=node('p','hg4-footnote','Wybierz odpowiedź. Quiz nie przyznaje XP.');
 feedback.setAttribute('role','status');
 actions(quiz,[['Gdy czuję zmęczenie',()=>{feedback.textContent='Dobrze. Przerwy warto robić, gdy ich potrzebujesz.';},false],
  ['Dopiero gdy skończy się bateria',()=>{feedback.textContent='Nie trzeba czekać na wyłączenie urządzenia. Odpoczynek jest ważny wcześniej.';},true]]);
 quiz.appendChild(feedback);panel.appendChild(quiz);
}
function settings(){
 const parent=d.querySelector?.('#settings .settings-content')||$('settings');
 if(!parent)return;
 const panel=section(parent,'hg4SettingsPro','⚙️ Ustawienia HealthGo 4.0',
  'Dodatkowe opcje na tym urządzeniu. Dane konta i ustawienia prywatności pozostają w istniejącym systemie.');
 if(!panel)return;
 const p=preferences();
 const appearance=node('div','hg4-settings-card');
 appearance.appendChild(node('h4','','HealthGo Studio — akcenty'));
 const palettes=node('div','hg4-actions');
 for(const [key,label] of [['mint','Miętowy'],['blue','Niebieski'],['violet','Fioletowy']]){
  const b=button(label,()=>{savePrefs({accent:key});applyPrefs();settings()},p.accent!==key);
  b.setAttribute('aria-pressed',String(p.accent===key));palettes.appendChild(b);}
 appearance.appendChild(palettes);
 appearance.appendChild(node('p','hg4-footnote','Kolor zmienia akcenty nowych kart „Więcej”. Pozostałe ekrany zachowują spójny motyw aplikacji.'));
 const quiet=node('label','hg4-toggle'),input=node('input');input.type='checkbox';input.checked=p.quiet===true;
 input.addEventListener('change',()=>{savePrefs({quiet:input.checked});applyPrefs();});
 quiet.append(node('span','','Ogranicz animacje nowych paneli'),input);appearance.appendChild(quiet);
 const contrast=node('label','hg4-toggle'),contrastInput=node('input');
 contrastInput.type='checkbox';contrastInput.checked=p.contrast===true;
 contrastInput.addEventListener('change',()=>{savePrefs({contrast:contrastInput.checked});applyPrefs();});
 contrast.append(node('span','','Zwiększony kontrast kart „Więcej”'),contrastInput);appearance.appendChild(contrast);
 const density=node('label','hg4-toggle'),denseInput=node('input');
 denseInput.type='checkbox';denseInput.checked=p.density==='compact';
 denseInput.addEventListener('change',()=>{savePrefs({density:denseInput.checked?'compact':'comfortable'});applyPrefs();});
 density.append(node('span','','Kompaktowe odstępy w kartach'),denseInput);appearance.appendChild(density);
 panel.appendChild(appearance);
 const shortcuts=node('div','hg4-settings-card');shortcuts.appendChild(node('h4','','Szybkie zarządzanie'));
 actions(shortcuts,[['Konto',()=>jump('settings','settingsAccount'),true],
  ['Prywatność',()=>jump('settings','settingsPrivacy'),true],
  ['Wygląd',()=>jump('settings','settingsAppearance'),true],
  ['Urządzenia',()=>go('devices'),true],
  ['Powiadomienia',()=>jump('settings','hg4Notifications'),true],
  ['SOS i bezpieczeństwo',()=>jump('settings','hg4Security'),true],
  ['Akademia',()=>jump('settings','hg4Academy'),true]]);
 panel.appendChild(shortcuts);
 notifications(parent);security(parent);academy(parent);
 const info=section(parent,'hg4Info','🔬 HealthGo Labs i pomoc',
  'Eksperymentuj wyłącznie z ustawieniami interfejsu. Moduły beta wymagające integracji nie są automatycznie uruchamiane.');
 if(info){actions(info,[['Samouczek',()=>{if(typeof w.startTutorial==='function')w.startTutorial();},true],
  ['Sprawdź aktualizację',async()=>{const out=$('hg4UpdateState');if(out)out.textContent='Sprawdzam…';
   try{if(typeof w.healthGoCheckMobileUpdate!=='function')throw Error('NO_UPDATE');
    await w.healthGoCheckMobileUpdate(true);
    if(out)out.textContent='Sprawdzenie zakończone — dostępna aktualizacja pojawi się w aplikacji.';
   }catch(_){if(out)out.textContent='Sprawdzenie niedostępne. Spróbuj później.';}},false]]);
  const msg=node('p','hg4-footnote','Bez nowego trybu offline; ustawienia istniejącej aplikacji pozostają bez zmian.');msg.id='hg4UpdateState';info.appendChild(msg);}
}
let oldOwner=null,scheduled=false;
function render(){const owner=String(S.state?.uid||'');if(owner!==oldOwner){oldOwner=owner;period='all';missionStatus='all';missionSearch='';statsRange=7;statsMetric='steps';}
 applyPrefs();xpDashboard();missions();stats();devices();family();settings();}
function schedule(){if(scheduled)return;scheduled=true;
 const invoke=()=>{scheduled=false;render();};
 if(typeof w.requestAnimationFrame==='function')w.requestAnimationFrame(invoke);else w.setTimeout(invoke,0);}
S.subscribe(schedule);
d.addEventListener?.('click',event=>{
 const target=event.target?.closest?.('[data-hg4-open]');if(!target)return;
 const id=target.getAttribute('data-hg4-open');
 if(id==='hg4Notifications'||id==='hg4Security')jump('settings',id);
});
w.addEventListener?.('pageshow',schedule);
w.HealthGoMore4=Object.freeze({render,schedule,preferences,notices,downloadCsv,history});
schedule();
})(window);
