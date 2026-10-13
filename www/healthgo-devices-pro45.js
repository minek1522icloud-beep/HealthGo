/* HealthGo Devices PRO 4.5.
 * Account-scoped, truthful presentation of live BLE and cloud-synced records.
 * Pairing is delegated only to existing real BLE/native implementation.
 * Browser pages cannot read HealthKit or Health Connect directly.
 */
(function(w){
'use strict';
const d=w.document,S=w.HealthGoServices;
if(!d||!S)return;
const $=id=>d.getElementById(id);
const node=(tag,cls,value)=>{
 const e=d.createElement(tag);if(cls)e.className=cls;
 if(value!==undefined)e.textContent=String(value);return e;
};
const btn=(label,action,secondary=false)=>{
 const e=node('button','hg45-btn'+(secondary?' secondary':''),label);e.type='button';
 e.addEventListener('click',action);return e;
};
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const format=value=>number(value)===null?'—':value.toLocaleString('pl-PL',{maximumFractionDigits:1});
const date=value=>{
 if(!value)return 'brak danych';
 const t=new Date(value);return Number.isFinite(t.getTime())?
 t.toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}):'brak danych';
};
const platform=()=>/iPhone|iPad|iPod/i.test(w.navigator?.userAgent||'')?'ios':
 /Android/i.test(w.navigator?.userAgent||'')?'android':'desktop';
const methods=[
 {id:'apple',title:'Apple Watch / Apple Health',icon:'⌚',
  explanation:'Na iPhonie potrzebna jest natywna aplikacja HealthGo i zgoda na odczyt z Apple Health. Zwykła strona nie może korzystać z HealthKit.',
  hint:'Najpierw sparuj Apple Watch w aplikacji Watch. Następnie otwórz natywne HealthGo, zaloguj się tym samym kontem i wybierz połączenie z Apple Health.',
  action:'Jak połączyć Apple Health'},
 {id:'android',title:'Health Connect / Android',icon:'📱',
  explanation:'Na Androidzie dane mogą być udostępnione przez Health Connect i zgodną natywną aplikację HealthGo. Sama strona nie ma dostępu do Health Connect.',
  hint:'Połącz zegarek z aplikacją producenta. W Health Connect sprawdź, czy dane są udostępniane i zezwól natywnemu HealthGo na ich odczyt.',
  action:'Instrukcja synchronizacji Android'},
 {id:'ble',title:'Zegarek z Bluetooth LE',icon:'ᛒ',
  explanation:'Obsługiwane są standardowe usługi BLE (np. bateria i aktualne tętno), jeśli urządzenie je udostępnia. Nie oznacza to dostępu do kroków i snu.',
  hint:'Włącz Bluetooth i tryb parowania zegarka. Wybierz go z systemowego okna. Na iPhonie wymagany jest natywny moduł HealthGo.',
  action:'Wybierz zegarek Bluetooth'},
 {id:'manufacturer',title:'Garmin, Xiaomi, Samsung i inne',icon:'🛰',
  explanation:'Część producentów stosuje własne protokoły i konta. HealthGo nie może obiecać bezpośredniego odczytu z każdego modelu.',
  hint:'Synchronizuj zegarek w oficjalnej aplikacji producenta. Jeżeli udostępnia ona pomiary do Apple Health albo Health Connect, sprawdź je w aplikacji systemowej.',
  action:'Sprawdź możliwości'}
];
let chosen='ble',owner=null,message='',busy=false,helpOpen=false;
function api(){return w.HealthGoDevices||null;}
function records(){return Array.isArray(S.state?.devices)?S.state.devices.filter(x=>x&&typeof x==='object').slice(0,50):[];}
function currentDevice(){const a=api();return a?.connected&&a.activeDevice?a.activeDevice:null;}
function source(){
 const h=S.state?.health;
 if(!h||!S.state?.uid)return null;
 const values=['steps','distanceKm','activeMinutes','heartRate','sleepMinutes'].some(k=>number(h[k])!==null);
 return values?h:null;
}
function deviceConnected(row){
 const lastA=Date.parse(row?.lastConnectedAt||''),lastB=Date.parse(row?.lastDisconnectedAt||'');
 return Number.isFinite(lastA)&&(!Number.isFinite(lastB)||lastA>lastB);
}
function setMessage(text){
 message=String(text||'').slice(0,360);
 const item=$('hg45Message');if(item)item.textContent=message;
}
function card(className){return node('section','hg45-card '+(className||''));}
function fact(label,value,desc){
 const box=node('div','hg45-fact');box.append(node('span','',label),node('strong','',value),node('small','',desc));return box;
}
function showMissing(root){
 root.appendChild(node('p','hg45-empty','Jeszcze nie ma zapisanych urządzeń na tym koncie. Możesz wybrać metodę połączenia poniżej.'));
}
function renderHeader(root){
 const hero=node('header','hg45-hero');
 const info=node('div','hg45-hero-copy');
 info.append(node('span','hg45-kicker','HEALTHGO 4.5 · CENTRUM URZĄDZEŃ'),
  node('h2','','Twoje urządzenia'),
  node('p','','Bezpieczne połączenia, realne pomiary i pełna kontrola. Nie pokazujemy fikcyjnych danych.'));
 const mark=node('div','hg45-emblem','⌚');mark.setAttribute('aria-hidden','true');
 hero.append(info,mark);root.appendChild(hero);
}
function renderOverview(root){
 const list=records(),active=currentDevice(),health=source();
 const summary=card('hg45-overview');
 summary.appendChild(node('h3','','Stan połączeń'));
 const stats=node('div','hg45-stats');
 stats.append(
  fact('Na koncie',String(list.length),'Zapisane źródła'),
  fact('Bluetooth teraz',active?'Połączono':'Niepołączono','Wyłącznie bieżąca sesja'),
  fact('Dane zdrowotne',health?'Dostępne':'Brak danych','Ostatni zapis synchronizacji')
 );
 summary.appendChild(stats);
 if(active){
  const live=node('div','hg45-live');
  const device=node('div','hg45-live-copy');
  device.append(node('strong','','● '+String(active.name||'Urządzenie BLE').slice(0,85)),
   node('span','','Aktywne połączenie Bluetooth w tej sesji'));
  live.appendChild(device);
  const a=api(),readings=node('div','hg45-live-readings');
  readings.append(fact('Bateria',number(a?.batteryLevel)===null?'—':format(a.batteryLevel)+'%','Odczyt BLE'),
   fact('Tętno',number(a?.heartRate)===null?'—':format(a.heartRate)+' bpm','Odczyt BLE (na żywo)'));
  live.appendChild(readings);summary.appendChild(live);
 }
 root.appendChild(summary);
}
function renderSources(root){
 const panel=card('hg45-sources');
 panel.appendChild(node('h3','','Ostatnie dane zdrowotne'));
 const h=source();
 if(!h){
  panel.appendChild(node('p','hg45-empty','Brak dostępnych odczytów. Po synchronizacji ze zgodnym źródłem zobaczysz rzeczywiste wartości i datę.'));
 }else{
  const items=[
   ['👣 Kroki',h.steps,'kroków'],
   ['📍 Dystans',h.distanceKm,'km'],
   ['⏱ Czas aktywności',h.activeMinutes,'min'],
   ['❤️ Tętno',h.heartRate,'bpm'],
   ['🌙 Sen',h.sleepMinutes,'min']
  ];
  const metrics=node('div','hg45-metrics');
  for(const [label,val,unit] of items){
   metrics.appendChild(fact(label,number(val)!==null?format(val)+' '+unit:'—',
    number(val)===null?'Brak odczytu':'Dane ze źródła zdrowotnego'));
  }
  panel.appendChild(metrics);
  panel.appendChild(node('p','hg45-caption',
   'Źródło: '+String(h.source||'Nieznane').slice(0,100)+' · zapis: '+date(h.updatedAt||h.timestamp)));
 }
 panel.appendChild(node('p','hg45-caption','Tętno z BLE widoczne podczas połączenia nie jest automatycznie zapisywane jako historia zdrowia.'));
 root.appendChild(panel);
}
function renderList(root){
 const panel=card('hg45-roster');panel.appendChild(node('h3','','Urządzenia zapisane na koncie'));
 const list=records(),current=currentDevice();
 if(!list.length)showMissing(panel);
 for(const item of list){
  const active=!!(current&&item.externalId&&item.externalId===current.id);
  const row=node('article','hg45-device-row');
  const icon=node('div','hg45-device-icon',/wear|watch|healthkit|healthconnect/i.test((item.deviceType||'')+' '+(item.connectionType||''))?'⌚':'ᛒ');
  const copy=node('div','hg45-device-copy');
  copy.append(node('strong','',String(item.name||'Zapisane urządzenie').slice(0,92)),
   node('span','','System: '+String(item.platform||'nieznany').slice(0,42)+' · typ: '+String(item.connectionType||'inne').slice(0,30)),
   node('small','','Ostatnia synchronizacja: '+date(item.lastSyncAt)));
  const badge=node('span','hg45-device-badge',active?'Połączono teraz':
   deviceConnected(item)?'Ostatnio połączone':'Zapisane');
  if(!active)badge.title='Nie potwierdzono aktywnego połączenia w bieżącej sesji';
  row.append(icon,copy,badge);panel.appendChild(row);
 }
 root.appendChild(panel);
}
async function refreshAll(){
 if(busy)return;busy=true;setMessage('Odświeżam zapisane urządzenia i dane zdrowotne…');
 const uid=S.state?.uid;
 try{
  if(!uid)throw new Error('Najpierw zaloguj się do HealthGo.');
  if(typeof S.refreshDevices!=='function'||typeof S.refreshHealth!=='function')throw new Error('Synchronizacja jest niedostępna.');
  const [a,b]=await Promise.allSettled([S.refreshDevices(),S.refreshHealth()]);
  if(uid!==S.state?.uid)return;
  setMessage(a.status==='fulfilled'&&b.status==='fulfilled'?
   'Odświeżono listę urządzeń i pomiary z konta.':
   'Nie udało się odświeżyć wszystkich danych. Sprawdź internet i uprawnienia.');
 }catch(e){setMessage(String(e?.message||'Synchronizacja nie powiodła się.'));}
 finally{busy=false;}
}
async function invoke(){
 if(busy)return;
 if(!S.state?.uid){setMessage('Najpierw zaloguj się do HealthGo.');return;}
 const a=api(),platformId=platform();
 if(chosen==='manufacturer'){
  setMessage('To połączenie zależy od aplikacji producenta i jej integracji z Apple Health lub Health Connect. Nie ma uniwersalnego skanera.');
  return;
 }
 if(chosen==='apple'&&platformId!=='ios'){
  setMessage('Apple Health działa na iPhonie. Wybierz metodę zgodną z Twoim telefonem.');return;
 }
 if(chosen==='android'&&platformId!=='android'){
  setMessage('Health Connect jest dostępny na kompatybilnych telefonach z Androidem.');return;
 }
 if(chosen==='apple'&&platformId==='ios'){
  setMessage('Wersja HealthGo z ekranu początkowego działa przez Safari i nie ma dostępu do Apple Health. Najpierw sparuj zegarek w aplikacji Watch, a odczyty sprawdź w Zdrowiu. Synchronizacja z HealthGo wymaga osobno zainstalowanej natywnej aplikacji z HealthKit. Ten przycisk nie uruchamia parowania w przeglądarce.');
  return;
 }
 if(chosen==='android'){
  if(typeof a?.openHealth==='function'){
   setMessage('Jeśli natywne HealthGo jest zainstalowane, telefon spróbuje otworzyć jego moduł zdrowia. Sama strona nie odczytuje danych systemowych.');
   a.openHealth();
  }else setMessage('Otwórz natywną aplikację HealthGo i udziel zgody w Apple Health lub Health Connect.');
  return;
 }
 if(chosen==='ble'&&platformId==='ios'){
  setMessage('Safari na iPhonie nie udostępnia Web Bluetooth. Sparuj zegarek w systemowej aplikacji Watch lub aplikacji producenta. Do bezpośredniego odczytu BLE przez HealthGo potrzebna jest osobno zainstalowana aplikacja natywna. Sam skrót strony nie wystarcza.');
  return;
 }
 if(typeof a?.connect!=='function'){
  setMessage('Moduł Bluetooth nie jest dostępny w tej wersji.');return;
 }
 // Keep the browser's Bluetooth prompt within the direct user gesture.
 setMessage(platformId==='ios'?
  'Jeśli natywne HealthGo jest zainstalowane, telefon spróbuje je otworzyć. Safari nie obsługuje Web Bluetooth.':
  'Otwieram systemowy wybór Bluetooth; urządzenie może wymagać własnej aplikacji.');
 try{
  await a.connect();
  if(platformId!=='ios'){
   if(a.connected)setMessage('Połączono z '+String(a.activeDevice?.name||'urządzeniem').slice(0,85)+'.');
   else{
    const legacy=$('hgRealDeviceStatus')?.textContent;
    if(legacy)setMessage(legacy);
   }
  }
 }catch(e){setMessage('Połączenie nie powiodło się: '+String(e?.message||'spróbuj ponownie'));}
}
function renderPairing(root){
 const panel=card('hg45-pairing');panel.appendChild(node('span','hg45-kicker','DODAJ URZĄDZENIE'));
 panel.appendChild(node('h3','','Wybierz sposób połączenia'));
 panel.appendChild(node('p','hg45-caption','Dobierz integrację do swojego zegarka. Nie wszystkie modele udostępniają standardowy Bluetooth i dane zdrowotne.'));
 const options=node('div','hg45-options');
 for(const m of methods){
  const b=btn(m.icon+' '+m.title,()=>{chosen=m.id;render();},m.id!==chosen);
  b.setAttribute('aria-pressed',String(chosen===m.id));options.appendChild(b);
 }
 panel.appendChild(options);
 const selected=methods.find(m=>m.id===chosen)||methods[2];
 const explanation=node('div','hg45-pairing-info');
 explanation.append(node('strong','',selected.title),node('p','',selected.explanation),
  node('p','',selected.hint));panel.appendChild(explanation);
 if(platform()==='ios'&&(chosen==='apple'||chosen==='ble')){
  const warning=node('section','hg45-native-warning');
  warning.setAttribute('role','note');
  warning.append(
   node('strong','','Dlaczego iPhone nie może połączyć się tutaj?'),
   node('p','','Korzystasz z internetowej wersji HealthGo. Ikona na ekranie głównym nie daje Safari uprawnień Apple Health ani CoreBluetooth. Próba otwarcia adresu healthgo:// bez natywnej aplikacji powoduje błąd „nieprawidłowy adres”.'),
   node('p','','Co możesz zrobić: sparuj zegarek w aplikacji Watch (lub aplikacji producenta), sprawdź jego pomiary w aplikacji Zdrowie. Aby zsynchronizować te dane z HealthGo, potrzebna jest osobna natywna aplikacja HealthGo, zainstalowana i zalogowana na to samo konto. Jeśli jej nie masz, połączenie z tego skrótu jest obecnie niedostępne.')
  );
  panel.appendChild(warning);
 }
 const actions=node('div','hg45-actions');
 actions.append(btn(platform()==='ios'&&chosen==='ble'?'Jak podłączyć zegarek na iPhonie':selected.action,invoke));
 if(currentDevice())actions.append(btn('Rozłącz Bluetooth',async()=>{
  if(!api()?.disconnect)return;
  setMessage('Rozłączam bieżące urządzenie…');
  try{await api().disconnect();setMessage('Rozłączono lokalne połączenie Bluetooth. Historia konta pozostaje zapisana.');}
  catch(_){setMessage('Nie udało się rozłączyć.');}
 },true));
 actions.append(btn('Odśwież pomiary i urządzenia',refreshAll,true));
 panel.appendChild(actions);
 const notice=node('p','hg45-message',message);notice.id='hg45Message';notice.setAttribute('role','status');
 panel.appendChild(notice);root.appendChild(panel);
}
function renderHelp(root){
 const panel=node('details','hg45-card hg45-help');
 panel.open=helpOpen;
 const title=node('summary','','Zgodność, uprawnienia i rozwiązywanie problemów');
 title.addEventListener('click',()=>{helpOpen=!panel.open;});
 panel.appendChild(title);
 const text=[
  ['Brak wykrytych urządzeń','Włącz Bluetooth i tryb parowania. Na iPhonie połączenia BLE wymagają natywnej aplikacji HealthGo, a w przeglądarce Androida Web Bluetooth musi być obsługiwane.'],
  ['Zegarek jest zapisany, ale niepołączony','Zapis w bazie nie oznacza aktywnego połączenia. Skorzystaj z przycisku łączenia albo uruchom synchronizację w natywnej aplikacji.'],
  ['Brak kroków, snu lub tętna','Nie każdy zegarek obsługuje te pomiary przez BLE. Użyj Apple Health, Health Connect albo aplikacji producenta, jeśli obsługują udostępnianie.'],
  ['Prywatność','Połączenie BLE i dostęp do danych zdrowotnych wymagają osobnej zgody. Nie udostępniamy lokalizacji i nie przypisujemy pomiarów innym kontom.'],
  ['Odłączenie','Przycisk Rozłącz zatrzymuje aktywne Bluetooth. Nie kasuje historii konta ani uprawnień ustawionych w systemie operacyjnym.']
 ];
 for(const [name,copy] of text){
  const item=node('div','hg45-faq');item.append(node('strong','',name),node('p','',copy));panel.appendChild(item);
 }
 root.appendChild(panel);
}
function render(){
 const page=$('devices');if(!page)return;
 let root=$('hg45Devices');
 if(!root){
  root=node('div','hg45-root');root.id='hg45Devices';
  const hero=page.querySelector?.('.hero');
  if(hero?.insertAdjacentElement)hero.insertAdjacentElement('afterend',root);
  else page.prepend?.(root);
 }
 d.body?.classList?.add?.('hg45-ready');
 if(owner!==String(S.state?.uid||'')){
  owner=String(S.state?.uid||'');chosen=platform()==='ios'?'apple':platform()==='android'?'android':'ble';message='';
 }
 root.replaceChildren();
 renderHeader(root);renderOverview(root);renderSources(root);renderList(root);
 renderPairing(root);renderHelp(root);
}
S.subscribe?.(render);
w.addEventListener?.('healthgo:device-connection',render);
w.addEventListener?.('pageshow',render);
w.HealthGoDevicesPro45=Object.freeze({render,refresh:refreshAll,getState:()=>({owner,chosen,connected:!!currentDevice()})});
render();
})(window);
