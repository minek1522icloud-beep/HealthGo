(function(){
'use strict';

const Services=window.HealthGoServices;
if(!Services)return;

let activeDevice=null;
let activeServer=null;
let batteryLevel=null;
let heartRate=null;
let activeCapabilities=[];
let heartCharacteristic=null;

function el(tag,cls,text){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined&&text!==null)node.textContent=String(text);
  return node;
}

function button(label,handler,secondary){
  const b=el('button','btn'+(secondary?' secondary':''),label);
  b.type='button';
  b.addEventListener('click',handler);
  return b;
}

function platform(){
  const ua=navigator.userAgent||'';
  if(/Android/i.test(ua))return 'Android';
  if(/iPhone|iPad|iPod/i.test(ua))return 'iOS';
  if(/Windows/i.test(ua))return 'Windows';
  if(/Mac/i.test(ua))return 'macOS';
  return 'Web';
}

function isIOS(){
  return /iPhone|iPad|iPod/i.test(navigator.userAgent||'');
}

function isAndroid(){
  return /Android/i.test(navigator.userAgent||'');
}

function nativeLink(host){
  return 'healthgo://'+host;
}

function openNative(host,fallback){
  const status=document.getElementById('hgRealDeviceStatus');
  const started=Date.now();
  try{window.location.href=nativeLink(host)}catch(_){}
  setTimeout(()=>{
    if(document.visibilityState==='visible'&&Date.now()-started>1200&&status){
      status.textContent=fallback;
    }
  },1700);
}

function openNativeBluetooth(){
  openNative(
    'connect-bluetooth',
    'Na iPhonie bezpośrednie łączenie zegarka działa w natywnej aplikacji HealthGo. Otwórz zainstalowane HealthGo i wybierz „Szukaj zegarka”.'
  );
}

function openHealthPlatform(){
  const status=document.getElementById('hgRealDeviceStatus');
  if(isIOS()){
    openNative(
      'connect-health',
      'Safari nie ma dostępu do systemowych danych zdrowotnych. Otwórz natywną aplikację HealthGo na iPhonie.'
    );
    return;
  }
  if(status)status.textContent='Na Androidzie dane zegarka mogą trafiać do Health Connect. Otwórz natywną aplikację HealthGo i wybierz „Połącz dane zdrowotne”.';
}

function deviceType(name){
  const n=String(name||'').toLowerCase();
  if(/watch|band|fit|garmin|polar|amazfit|galaxy|mi band|huawei|zegarek|opaska/i.test(n))return 'wearable';
  return 'bluetooth';
}

function fmt(value){
  if(!value)return '—';
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}):'—';
}

function withTimeout(promise,ms,label){
  let timer;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label||'TIMEOUT')),ms)})
  ]).finally(()=>clearTimeout(timer));
}

async function saveDevice(device,connected,battery){
  if(!device||!Services.state.uid)return;
  await Services.call('registerDevice',{
    externalId:device.id,
    name:device.name||'Urządzenie Bluetooth',
    platform:platform(),
    deviceType:deviceType(device.name),
    connectionType:'ble',
    batteryLevel:battery==null?null:battery,
    connected:connected!==false
  });
}

async function readBattery(server){
  try{
    const service=await withTimeout(server.getPrimaryService('battery_service'),5000,'BATTERY_SERVICE_TIMEOUT');
    const characteristic=await withTimeout(service.getCharacteristic('battery_level'),5000,'BATTERY_CHARACTERISTIC_TIMEOUT');
    const value=await withTimeout(characteristic.readValue(),5000,'BATTERY_READ_TIMEOUT');
    return value.getUint8(0);
  }catch(_){
    return null;
  }
}

function parseHeartRate(value){
  if(!value||value.byteLength<2)return null;
  const flags=value.getUint8(0),is16=(flags&1)!==0;
  return is16&&value.byteLength>=3?value.getUint16(1,true):value.getUint8(1);
}

function onHeartRate(event){
  try{
    const value=parseHeartRate(event.target.value);
    if(Number.isFinite(value)&&value>0&&value<300){
      heartRate=value;
      render();
    }
  }catch(_){}
}

async function setupHeartRate(server){
  try{
    const service=await withTimeout(server.getPrimaryService('heart_rate'),5000,'HEART_SERVICE_TIMEOUT');
    const characteristic=await withTimeout(service.getCharacteristic('heart_rate_measurement'),5000,'HEART_CHARACTERISTIC_TIMEOUT');
    characteristic.removeEventListener?.('characteristicvaluechanged',onHeartRate);
    characteristic.addEventListener?.('characteristicvaluechanged',onHeartRate);
    await withTimeout(characteristic.startNotifications(),5000,'HEART_NOTIFY_TIMEOUT');
    heartCharacteristic=characteristic;
    return true;
  }catch(_){
    heartCharacteristic=null;
    return false;
  }
}

async function detectCapabilities(server){
  const caps=[];
  const battery=await readBattery(server);
  if(battery!=null)caps.push('bateria');
  const hr=await setupHeartRate(server);
  if(hr)caps.push('tętno');
  try{
    await withTimeout(server.getPrimaryService('device_information'),3500,'DEVICE_INFO_TIMEOUT');
    caps.push('informacje o urządzeniu');
  }catch(_){}
  return{caps,battery};
}

async function handleDisconnected(){
  const device=activeDevice;
  activeServer=null;
  batteryLevel=null;
  heartRate=null;
  activeCapabilities=[];
  heartCharacteristic=null;
  if(device){
    try{await saveDevice(device,false,null)}catch(_){}
  }
  render();
}

async function connectDevice(device){
  if(!device||!device.gatt)throw new Error('To urządzenie nie udostępnia połączenia BLE/GATT.');
  activeDevice=device;
  device.removeEventListener?.('gattserverdisconnected',handleDisconnected);
  device.addEventListener?.('gattserverdisconnected',handleDisconnected);
  activeServer=await withTimeout(device.gatt.connect(),15000,'Połączenie Bluetooth przekroczyło limit czasu.');
  const capabilities=await detectCapabilities(activeServer);
  activeCapabilities=capabilities.caps;
  batteryLevel=capabilities.battery;
  await saveDevice(device,true,batteryLevel);
  render();
  return device;
}

async function requestBluetooth(){
  const status=document.getElementById('hgRealDeviceStatus');
  if(!Services.state.uid){
    if(status)status.textContent='Najpierw zaloguj się do HealthGo.';
    return;
  }

  if(isIOS()){
    if(status)status.textContent='Otwieram natywne skanowanie Bluetooth HealthGo…';
    openNativeBluetooth();
    return;
  }

  if(!navigator.bluetooth||typeof navigator.bluetooth.requestDevice!=='function'){
    if(status)status.textContent=isAndroid()
      ?'Ta przeglądarka nie udostępnia Web Bluetooth. Użyj zgodnej przeglądarki lub natywnej aplikacji HealthGo.'
      :'Ta przeglądarka nie udostępnia Web Bluetooth.';
    return;
  }

  if(status)status.textContent='Szukam zegarków i opasek Bluetooth…';
  try{
    const device=await navigator.bluetooth.requestDevice({
      acceptAllDevices:true,
      optionalServices:['battery_service','heart_rate','device_information']
    });
    if(status)status.textContent='Łączę z '+(device.name||'urządzeniem')+'…';
    await connectDevice(device);
    if(status){
      status.textContent=activeCapabilities.length
        ?'Połączono z '+(device.name||'urządzeniem')+'. Obsługiwane: '+activeCapabilities.join(', ')+'.'
        :'Połączono z '+(device.name||'urządzeniem')+'. Zegarek nie udostępnia standardowych usług BLE; dane mogą wymagać aplikacji producenta lub systemu zdrowotnego.';
    }
  }catch(error){
    const message=String(error&&error.message||'');
    if(status)status.textContent=/cancel|cancelled|user cancelled|notfound/i.test(message)
      ?'Wybieranie urządzenia anulowano.'
      :'Nie udało się połączyć: '+(message||'sprawdź Bluetooth i spróbuj ponownie.');
  }
}

async function refreshDatabaseDevices(){
  const status=document.getElementById('hgRealDeviceStatus');
  if(!Services.state.uid){if(status)status.textContent='Najpierw zaloguj się do HealthGo.';return;}
  try{
    if(status)status.textContent='Odświeżam urządzenia z konta HealthGo…';
    const rows=typeof Services.refreshDevices==='function'?await Services.refreshDevices():[];
    if(status)status.textContent='Lista urządzeń odświeżona · '+rows.length+' '+(rows.length===1?'urządzenie':'urządzeń')+'.';
  }catch(_){
    if(status)status.textContent='Nie udało się odświeżyć urządzeń z konta.';
  }
}

async function reconnectGranted(){
  const status=document.getElementById('hgRealDeviceStatus');
  if(isIOS()){
    openNativeBluetooth();
    return;
  }
  if(!navigator.bluetooth||typeof navigator.bluetooth.getDevices!=='function'){
    if(status)status.textContent='Ta wersja przeglądarki nie pozwala automatycznie odczytać wcześniej zatwierdzonych urządzeń.';
    return;
  }
  try{
    const granted=await navigator.bluetooth.getDevices();
    if(!granted.length){
      if(status)status.textContent='Nie ma wcześniej zatwierdzonych urządzeń. Kliknij „Połącz zegarek”.';
      return;
    }
    const saved=Services.state.devices||[];
    const selected=granted.find(d=>saved.some(s=>s.externalId===d.id))||granted[0];
    if(status)status.textContent='Łączę ponownie z '+(selected.name||'urządzeniem')+'…';
    await connectDevice(selected);
    if(status)status.textContent='Połączono ponownie z '+(selected.name||'urządzeniem')+'.';
  }catch(error){
    if(status)status.textContent='Ponowne połączenie nie powiodło się: '+String(error&&error.message||'błąd Bluetooth');
  }
}

async function disconnectCurrent(){
  try{
    if(heartCharacteristic){
      heartCharacteristic.removeEventListener?.('characteristicvaluechanged',onHeartRate);
      await heartCharacteristic.stopNotifications?.().catch(()=>{});
    }
  }catch(_){}
  heartCharacteristic=null;

  if(activeDevice&&activeDevice.gatt&&activeDevice.gatt.connected){
    activeDevice.gatt.disconnect();
    return;
  }
  if(activeDevice){
    try{await saveDevice(activeDevice,false,null)}catch(_){}
  }
  activeDevice=null;
  activeServer=null;
  batteryLevel=null;
  heartRate=null;
  activeCapabilities=[];
  render();
}

function ensureRoot(){
  const page=document.getElementById('devices');
  if(!page)return null;
  let root=document.getElementById('hgRealDevices');
  if(root)return root;

  root=el('section','card');
  root.id='hgRealDevices';
  root.style.marginTop='14px';

  const hero=page.querySelector('.hero');
  if(hero&&hero.nextSibling)page.insertBefore(root,hero.nextSibling);
  else page.appendChild(root);
  return root;
}

function render(){
  const root=ensureRoot();
  if(!root)return;
  root.replaceChildren();

  const connected=!!(activeServer&&activeServer.connected);
  const header=el('div','between');
  const copy=el('div');
  copy.append(
    el('h3','',isIOS()?'⌚ Zegarek i dane zdrowotne':'⌚ Połącz zegarek'),
    el('p','muted',isIOS()
      ?'Na iPhonie zwykły zegarek łączy się przez natywny moduł Bluetooth HealthGo. Dane systemowe można osobno synchronizować z aplikacji Zdrowie.'
      :'Wybierz zegarek z systemowego okna Bluetooth. HealthGo zapisuje wyłącznie urządzenie, które sam wybierzesz.')
  );
  header.append(copy,el('span','tag',connected?'Połączono':'Gotowe'));
  root.appendChild(header);

  const controls=el('div','row');
  controls.style.marginTop='12px';
  controls.append(
    button('Połącz zegarek',requestBluetooth,false),
    button('Połącz ponownie',reconnectGranted,true),
    button('Dane zdrowotne',openHealthPlatform,true),
    button('Odśwież listę',refreshDatabaseDevices,true)
  );
  if(activeDevice)controls.appendChild(button('Rozłącz',disconnectCurrent,true));
  root.appendChild(controls);

  const status=el('div','muted',
    connected
      ?'Aktywne: '+(activeDevice?.name||'Urządzenie Bluetooth')+
        (batteryLevel==null?'':' · bateria '+batteryLevel+'%')+
        (heartRate==null?'':' · tętno '+heartRate+' bpm')
      :isIOS()
        ?'Kliknij „Połącz zegarek”. HealthGo otworzy natywny moduł Bluetooth na iPhonie.'
        :'Kliknij „Połącz zegarek”, aby otworzyć prawdziwy wybór Bluetooth.'
  );
  status.id='hgRealDeviceStatus';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  status.style.marginTop='10px';
  root.appendChild(status);

  if(connected){
    const capabilities=el('div','settings-note',
      activeCapabilities.length
        ?'Standardowe funkcje wykryte przez HealthGo: '+activeCapabilities.join(', ')+'.'
        :'Połączenie Bluetooth działa, ale urządzenie nie udostępnia standardowych usług baterii/tętna. To typowe dla części zegarków korzystających z własnej aplikacji producenta.'
    );
    capabilities.style.marginTop='10px';
    root.appendChild(capabilities);
  }

  const saved=Services.state.devices||[];
  const list=el('div');
  list.style.marginTop='14px';
  if(!saved.length){
    list.appendChild(el('div','settings-note','Nie zapisano jeszcze żadnego urządzenia na tym koncie.'));
  }else{
    list.appendChild(el('b','','Urządzenia zapisane na koncie HealthGo'));
    saved.forEach(d=>{
      const row=el('div','hg2-member');
      const avatar=el('div','hg2-avatar',d.deviceType==='wearable'?'⌚':'📡');
      const text=el('div','hg2-grow');
      const connection=d.lastConnectedAt&&(!d.lastDisconnectedAt||new Date(d.lastConnectedAt)>new Date(d.lastDisconnectedAt))?'Ostatnio połączone':'Zapisane';
      text.append(
        el('b','',d.name||'Urządzenie'),
        el('small','',connection+' · '+(d.platform||'HealthGo')+' · ostatnia synchronizacja '+fmt(d.lastSyncAt))
      );
      if(d.batteryLevel!=null)text.appendChild(el('span','hg2-member-role','Bateria '+d.batteryLevel+'%'));
      row.append(avatar,text);
      list.appendChild(row);
    });
  }
  root.appendChild(list);

  const info=el('div','settings-note');
  info.style.marginTop='12px';
  info.textContent='HealthGo nie może obiecać pełnych danych z każdego zegarka. Jeśli urządzenie udostępnia standardowe BLE, aplikacja może wykryć połączenie, baterię i usługę tętna. Kroki, sen i inne dane często są przekazywane przez Health Connect, aplikację Zdrowie lub aplikację producenta.';
  root.appendChild(info);
}

Services.subscribe(render);
window.HealthGoDevices={
  connect:requestBluetooth,
  reconnect:reconnectGranted,
  disconnect:disconnectCurrent,
  get activeDevice(){return activeDevice;},
  get connected(){return !!(activeServer&&activeServer.connected);},
  get capabilities(){return activeCapabilities.slice();},
  get heartRate(){return heartRate;}
};
render();
})();