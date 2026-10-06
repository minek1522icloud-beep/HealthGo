(function(){
'use strict';

const Services=window.HealthGoServices;
if(!Services)return;

let activeDevice=null;
let activeServer=null;
let batteryLevel=null;

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
  if(/Windows/i.test(ua))return 'Windows';
  if(/Android/i.test(ua))return 'Android';
  if(/iPhone|iPad|iPod/i.test(ua))return 'iOS';
  if(/Mac/i.test(ua))return 'macOS';
  return 'Web';
}

function isIOS(){
  return /iPhone|iPad|iPod/i.test(navigator.userAgent||'');
}

function appleHealthDevice(){
  return (Services.state.devices||[]).find(d=>d.connectionType==='healthkit'||/apple health/i.test(String(d.name||'')))||null;
}

async function openAppleHealth(){
  const status=document.getElementById('hgRealDeviceStatus');
  if(!Services.state.uid){
    if(status)status.textContent='Najpierw zaloguj się do HealthGo.';
    return;
  }
  if(!isIOS()){
    if(status)status.textContent='Apple Health jest dostępne w natywnej aplikacji HealthGo na iPhonie.';
    return;
  }
  if(status)status.textContent='Otwieram HealthGo i systemowe uprawnienia Apple Health…';
  const started=Date.now();
  try{window.location.href='healthgo://connect-health';}catch(_){}
  setTimeout(()=>{
    if(document.visibilityState==='visible'&&Date.now()-started>1200&&status){
      status.textContent='Safari nie ma bezpośredniego dostępu do Apple Health. Zainstaluj natywną aplikację HealthGo na iPhonie, a potem kliknij ponownie.';
    }
  },1800);
}

function deviceType(name){
  const n=String(name||'').toLowerCase();
  if(/watch|band|fit|garmin|polar|amazfit|galaxy|mi band|huawei/i.test(n))return 'wearable';
  return 'bluetooth';
}

function fmt(value){
  if(!value)return '—';
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}):'—';
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
    const service=await server.getPrimaryService('battery_service');
    const characteristic=await service.getCharacteristic('battery_level');
    const value=await characteristic.readValue();
    return value.getUint8(0);
  }catch(_){
    return null;
  }
}

async function handleDisconnected(){
  const device=activeDevice;
  activeServer=null;
  batteryLevel=null;
  if(device){
    try{await saveDevice(device,false,null)}catch(_){}
  }
  render();
}

async function connectDevice(device){
  if(!device||!device.gatt)throw new Error('To urządzenie nie udostępnia połączenia GATT.');
  activeDevice=device;
  device.removeEventListener?.('gattserverdisconnected',handleDisconnected);
  device.addEventListener?.('gattserverdisconnected',handleDisconnected);
  activeServer=await device.gatt.connect();
  batteryLevel=await readBattery(activeServer);
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
    await openAppleHealth();
    return;
  }
  if(!navigator.bluetooth||typeof navigator.bluetooth.requestDevice!=='function'){
    if(status)status.textContent='Ta przeglądarka nie udostępnia Web Bluetooth. Użyj HealthGo na Windowsie lub zgodnej przeglądarki na Androidzie.';
    return;
  }

  if(status)status.textContent='Szukam urządzeń Bluetooth…';
  try{
    const device=await navigator.bluetooth.requestDevice({
      acceptAllDevices:true,
      optionalServices:['battery_service','heart_rate','device_information']
    });
    if(status)status.textContent='Łączę z '+(device.name||'urządzeniem')+'…';
    await connectDevice(device);
    if(status)status.textContent='Połączono z '+(device.name||'urządzeniem')+'.';
  }catch(error){
    const message=String(error&&error.message||'');
    if(status)status.textContent=/cancel|cancelled|user cancelled|notfound/i.test(message)
      ?'Wybieranie urządzenia anulowano.'
      :'Nie udało się połączyć: '+(message||'sprawdź Bluetooth i spróbuj ponownie.');
  }
}

async function reconnectGranted(){
  const status=document.getElementById('hgRealDeviceStatus');
  if(!navigator.bluetooth||typeof navigator.bluetooth.getDevices!=='function'){
    if(status)status.textContent='Ta wersja nie pozwala automatycznie odczytać wcześniej zatwierdzonych urządzeń.';
    return;
  }
  try{
    const granted=await navigator.bluetooth.getDevices();
    if(!granted.length){
      if(status)status.textContent='Nie ma wcześniej zatwierdzonych urządzeń. Kliknij „Połącz urządzenie”.';
      return;
    }
    const saved=Services.state.devices||[];
    const selected=granted.find(d=>saved.some(s=>s.externalId===d.id))||granted[0];
    if(status)status.textContent='Łączę ponownie z '+(selected.name||'urządzeniem')+'…';
    await connectDevice(selected);
    if(status)status.textContent='Połączono ponownie.';
  }catch(error){
    if(status)status.textContent='Ponowne połączenie nie powiodło się.';
  }
}

async function disconnectCurrent(){
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

  const ios=isIOS();
  const healthKit=appleHealthDevice();
  const header=el('div','between');
  const copy=el('div');
  copy.append(
    el('h3','',ios?'❤️ Apple Health i zegarek':'📡 Prawdziwe połączenie urządzenia'),
    el('p','muted',ios
      ?'Na iPhonie HealthGo otwiera natywną aplikację i prawdziwe uprawnienia Apple Health. Tętno, kroki i sen są odczytywane tylko po Twojej zgodzie.'
      :'HealthGo używa systemowego wyboru Bluetooth i zapisuje tylko urządzenie, które sam wybierzesz.')
  );
  const badge=el('span','tag',ios?(healthKit?'Połączono':'Niepołączono'):(activeServer&&activeServer.connected?'Połączono':'Niepołączono'));
  header.append(copy,badge);
  root.appendChild(header);

  const controls=el('div','row');
  controls.style.marginTop='12px';
  if(ios){
    controls.append(
      button('Połącz Apple Health',openAppleHealth,false),
      button('Odśwież dane',()=>Services.refreshHealth(),true)
    );
  }else{
    controls.append(
      button('Połącz urządzenie',requestBluetooth,false),
      button('Połącz ponownie',reconnectGranted,true)
    );
    if(activeDevice)controls.appendChild(button('Rozłącz',disconnectCurrent,true));
  }
  root.appendChild(controls);

  const status=el('div','muted',ios
    ?(healthKit
      ?'Apple Health jest połączone z tym kontem. HealthGo pokazuje tylko dane faktycznie udostępnione przez iPhone lub zegarek.'
      :'Kliknij „Połącz Apple Health”. iPhone otworzy natywną aplikację HealthGo i systemowe okno uprawnień.')
    :(activeServer&&activeServer.connected
      ?'Aktywne: '+(activeDevice?.name||'Urządzenie Bluetooth')+(batteryLevel==null?'':' · bateria '+batteryLevel+'%')
      :'Kliknij „Połącz urządzenie”, aby otworzyć prawdziwy wybór Bluetooth.'));
  status.id='hgRealDeviceStatus';
  status.style.marginTop='10px';
  root.appendChild(status);

  const saved=Services.state.devices||[];
  const list=el('div');
  list.style.marginTop='14px';
  if(!saved.length){
    const empty=el('div','settings-note','Nie zapisano jeszcze żadnego urządzenia na tym koncie.');
    list.appendChild(empty);
  }else{
    const title=el('b','', 'Urządzenia zapisane na koncie');
    list.appendChild(title);
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
  info.textContent=ios
    ?'Apple Watch i inne zgodne źródła zapisują dane w Apple Health. HealthGo może odczytać kroki, sen i ostatni dostępny pomiar tętna wyłącznie po systemowej zgodzie. Safari samo nie ma dostępu do HealthKit.'
    :'Bluetooth potwierdza prawdziwe połączenie z urządzeniem. Kroki, sen i tętno są pobierane tylko wtedy, gdy urządzenie lub system zdrowotny rzeczywiście udostępnia te dane — HealthGo nie tworzy fikcyjnych pomiarów.';
  root.appendChild(info);
}

Services.subscribe(render);
window.HealthGoDevices={
  connect:requestBluetooth,
  reconnect:reconnectGranted,
  disconnect:disconnectCurrent,
  get activeDevice(){return activeDevice;},
  get connected(){return !!(activeServer&&activeServer.connected);}
};
render();
})();