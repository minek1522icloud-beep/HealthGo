'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('www/healthgo-devices-pro45.js','utf8');
const old=fs.readFileSync('www/healthgo-devices.js','utf8');
function fixture(userAgent='Mozilla/5.0 (Linux; Android 16) Chrome/120'){
 const elements=[],events={},calls={ble:0,health:0,refresh:0},created=new Set();
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.textContent='';this.id='';this.className='';
   this.style={};this.attributes={};this.classList={add:x=>created.add(x),toggle(){},remove(){}};elements.push(this);}
  append(...xs){this.children.push(...xs)}
  appendChild(x){this.children.push(x);return x}
  replaceChildren(...xs){this.children=[...xs]}
  addEventListener(k,v){this.listeners[k]=v}
  setAttribute(k,v){this.attributes[k]=v}
  remove(){this.removed=true}
 }
 const hero={insertAdjacentElement(_pos,child){child.attached=true}};
 const page=new Element('section');page.id='devices';page.querySelector=()=>hero;page.prepend=node=>node.attached=true;
 const body=new Element('body');
 const document={body,createElement:tag=>new Element(tag),getElementById:id=>elements.find(x=>x.id===id&&!x.removed)};
 let active=null,connected=false,heartRate=null,batteryLevel=null;
 const api={connect(){calls.ble++;return Promise.resolve()},openHealth(){calls.health++},
  disconnect(){connected=false;active=null;return Promise.resolve()},
  get connected(){return connected},
  get activeDevice(){return active},
  get heartRate(){return heartRate},get batteryLevel(){return batteryLevel}};
 const state={uid:'alice',devices:[],health:null};
 const S={state,subscribe(fn){this.subscriber=fn},refreshDevices:async()=>{calls.refresh++;return[]},
  refreshHealth:async()=>{calls.refresh++;return null}};
 const window={document,navigator:{userAgent},HealthGoServices:S,HealthGoDevices:api,
  addEventListener(k,fn){events[k]=fn}};
 vm.runInNewContext(script,{window,document,Number,Date,Math,String,Array,JSON,console},{filename:'healthgo-devices-pro45.js'});
 const output=()=>{
  const root=document.getElementById('hg45Devices');
  const walk=x=>x&&typeof x==='object'?
    [x.textContent||'',...(x.children||[]).flatMap(walk)]:[];
  return walk(root).join(' ');
 };
 return {window,document,elements,events,calls,state,S,output,
  setConnected(x,b=undefined){connected=!!x;active=x?{id:'watch-1',name:'Prawdziwy zegarek'}:null;heartRate=b?.heartRate??null;batteryLevel=b?.batteryLevel??null;},
  findClass(name){return elements.filter(x=>(x.className||'').split(' ').includes(name)).slice(-1)[0];},
  btn(label){return elements.filter(x=>x.tag==='button'&&x.textContent.includes(label)).slice(-1)[0];}};
}
test('Devices PRO compiles with iPhone-safe, truthful missing readings and no fake metrics',()=>{
 new vm.Script(script);const f=fixture();
 assert.ok(f.document.getElementById('hg45Devices'));
 assert.match(f.output(),/Niepołączono/);
 assert.match(f.output(),/Brak danych/);
 assert.ok(f.output().includes('Na koncie'));
 assert.match(script,/HealthGoServices/);
 assert.doesNotMatch(script,/grantXP|Math\.random|recordProgressEvent/);
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(html,/healthgo-devices-pro45\.js\?v=1/);
 assert.match(html,/healthgo-devices-pro45\.css\?v=1/);
});
test('A saved device is never mistaken for an active Bluetooth connection',()=>{
 const f=fixture();
 f.state.devices=[{id:'server-1',externalId:'watch-1',name:'Zegarek historyczny',platform:'Android',connectionType:'ble',
  lastConnectedAt:'2026-10-13T08:00:00Z',lastSyncAt:'2026-10-13T08:30:00Z'}];
 f.S.subscriber(f.state);
 assert.match(f.output(),/Zegarek historyczny/);
 assert.match(f.output(),/Ostatnio połączone/);
 assert.doesNotMatch(f.output(),/Połączono teraz/);
 f.setConnected(true,{heartRate:72,batteryLevel:56});
 f.events['healthgo:device-connection']();
 assert.match(f.output(),/Połączono teraz/);
 assert.match(f.output(),/72 bpm/);
 assert.match(f.output(),/56%/);
});
test('Device-health readings are shown only for signed-in account with real source',()=>{
 const f=fixture();
 f.state.health={steps:2512,distanceKm:2.3,activeMinutes:20,heartRate:null,sleepMinutes:null,
  source:'Apple Health',updatedAt:'2026-10-13T08:00:00Z'};
 f.S.subscriber(f.state);
 assert.match(f.output(),/Apple Health/);
 assert.match(f.output(),/2[\s\u00a0]?512/);
 f.state.uid=null;f.S.subscriber(f.state);
 assert.doesNotMatch(f.output(),/2[\s\u00a0]?512/);
});
test('BLE pairing is user-initiated; native iOS health is routed separately',async()=>{
 const android=fixture();android.btn('Zegarek z Bluetooth LE').listeners.click();
 const control=android.btn('Wybierz zegarek Bluetooth');
 assert.ok(control);await control.listeners.click();
 assert.equal(android.calls.ble,1);
 assert.equal(android.calls.health,0);
 const ios=fixture('Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)');
 assert.ok(ios.btn('Jak połączyć Apple Health'));
 await ios.btn('Jak połączyć Apple Health').listeners.click();
 assert.equal(ios.calls.health,0,'the iPhone PWA must not attempt a native deep link');
 assert.equal(ios.calls.ble,0);
 assert.match(ios.output(),/Skrót|skrót|Safari/);
 ios.btn('Zegarek z Bluetooth LE').listeners.click();
 const ble=ios.btn('Jak podłączyć zegarek na iPhonie');
 assert.ok(ble);await ble.listeners.click();
 assert.equal(ios.calls.ble,0,'Web Bluetooth is not available in iOS Safari');
});
test('existing device backend cannot leak a live BLE connection across accounts',()=>{
 assert.match(old,/connectionGeneration/);
 assert.match(old,/connectionOwner/);
 assert.match(old,/healthgo:device-connection/);
 assert.match(old,/Sesja konta została zmieniona/);
 assert.match(old,/handleDisconnected\(event\)/);
 assert.match(old,/optionalServices:\['battery_service','heart_rate','device_information'\]/);
});
test('native Android deep links route to real Bluetooth and Health Connect actions',()=>{
 const manifest=fs.readFileSync('mobile/android/app/src/main/AndroidManifest.xml','utf8');
 const source=fs.readFileSync('mobile/android/app/src/main/java/com/healthgo/mobile/MainActivity.kt','utf8');
 assert.match(manifest,/android:scheme="healthgo" android:host="connect-health"/);
 assert.match(manifest,/android:scheme="healthgo" android:host="connect-bluetooth"/);
 assert.match(source,/"connect-health"->requestHealth\(\)/);
 assert.match(source,/"connect-bluetooth"->scanForWatch\(\)/);
 assert.match(source,/override fun onNewIntent\(intent: Intent\)/);
});


test('native link is never opened from an iPhone PWA without confirming native app installation',async()=>{
 const vm=require('node:vm');
 function boot(userAgent){
  const status={textContent:''};let navigations=0;
  const win={navigator:{userAgent},location:{set href(v){navigations++;this.last=v;}},HealthGoServices:{
   state:{uid:'alice',devices:[]},subscribe(){},
  }};
  const doc={getElementById:id=>id==='hgRealDeviceStatus'?status:null};
  const context={window:win,document:doc,navigator:win.navigator,
   setTimeout(){},Date,Number,String,Promise,console};
  vm.runInNewContext(old,context);
  return {win,status,get navigations(){return navigations}};
 }
 const ios=boot('Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)');
 ios.win.HealthGoDevices.openHealth();
 assert.equal(ios.navigations,0);
 assert.match(ios.status.textContent,/natywna|natywnej|Safari|internetowa/i);
 await ios.win.HealthGoDevices.connect();
 assert.equal(ios.navigations,0);
 assert.match(ios.status.textContent,/natywna|natywnej|internetowa/i);
 const android=boot('Mozilla/5.0 (Linux; Android 16)');
 android.win.HealthGoDevices.openHealth();
 assert.equal(android.navigations,1,'Android native deep link remains available');
 assert.equal(android.win.location.last,'healthgo://connect-health');
});
