'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const catalog=fs.readFileSync('www/healthgo-device-catalog50.js','utf8');
const wizard=fs.readFileSync('www/healthgo-device-wizard50.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
function fixture(agent='Mozilla/5.0 (Linux; Android 16) Chrome/120'){
 const nodes=[],memory=new Map(),events={};
 class E{
  constructor(tag){
   this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.id='';this.className='';
   this.textContent='';this.value='';this.disabled=false;
  }
  append(...children){for(const child of children){this.children.push(child);child.parentElement=this;}}
  appendChild(child){this.append(child);return child;}
  replaceChildren(...children){this.children=[];this.append(...children);}
  addEventListener(type,fn){this.listeners[type]=fn;}
  setAttribute(k,v){this.attributes[k]=v;}
 }
 const createElement=tag=>{const x=new E(tag);nodes.push(x);return x;};
 const parent=createElement('main');parent.id='parent';
 const document={
  createElement,getElementById(id){return nodes.find(x=>x.id===id&&(
   x===parent||x.parentElement&&x.parentElement.children.includes(x)))||null;}
 };
 const state={uid:'owner-a',devices:[],health:null};
 let statusConnected=false,device=null,connectionCalls=0,refreshes=0;
 const services={state,refreshDevices:async()=>{refreshes++},refreshHealth:async()=>{refreshes++}};
 const bluetooth={async requestDevice(){return {};}};
 const deviceApi={async connect(){
   connectionCalls++;
   statusConnected=true;
   device={name:'Wybrany prawdziwy zegarek',id:'real-device'};
  },get connected(){return statusConnected;},get activeDevice(){return device;},
  get capabilities(){return ['Bateria'];}};
 const win={document,navigator:{userAgent:agent,bluetooth},
  HealthGoServices:services,HealthGoDevices:deviceApi,
  HealthGoDevicesPro45:{render(){}},
  localStorage:{setItem(k,v){memory.set(k,v)},getItem(k){return memory.get(k)||null}}};
 const context={window:win,document,console,Array,Date,Number,Math,String,Map,JSON,Object,Promise};
 vm.runInNewContext(catalog,context,{filename:'device-catalog.js'});
 vm.runInNewContext(wizard,context,{filename:'wizard.js'});
 function walk(node){
  return [node.textContent||'',...(node.children||[]).flatMap(walk)].join(' ');
 }
 return {win,parent,nodes,memory,services,walk:()=>walk(parent),deviceApi,
  get calls(){return connectionCalls;},get refreshes(){return refreshes;},
  button(name){return nodes.find(x=>x.tag==='button'&&x.textContent.includes(name)&&x.parentElement?.children.includes(x));},
  render(){win.HealthGoDeviceWizard50.render(parent);},
  get catalog(){return win.HealthGoDeviceCatalog50;},
  get wizard(){return win.HealthGoDeviceWizard50;},
  setConnected(v){statusConnected=v;device=v?{id:'known',name:'Urządzenie'}:null;}
 };
}
test('catalog covers agreed brands and distinguishes manufacturer from verified device capabilities',()=>{
 new vm.Script(catalog);new vm.Script(wizard);
 const f=fixture(),ids=Array.from(f.catalog.brands, x=>x.id);
 for(const name of ['apple','samsung','garmin','xiaomi','huawei','amazfit','fitbit','polar','other']){
  assert.ok(ids.includes(name),'brand '+name);
 }
 assert.equal(f.catalog.getBrand('unknown').id,'other');
 const ios=f.catalog.resolve({brand:'apple',model:'Series',platform:'ios',webBluetooth:true});
 assert.equal(ios.webBluetooth,false);
 assert.equal(ios.methods.some(x=>x.kind==='ble'&&x.enabled),false);
 assert.equal(ios.methods.find(x=>x.id==='health').enabled,false);
 const android=f.catalog.resolve({brand:'xiaomi',model:'Smart Band',platform:'android',webBluetooth:true});
 assert.equal(android.methods.find(x=>x.id==='ble').enabled,true);
 assert.match(android.methods.find(x=>x.id==='ble').note,/standardow/i);
 assert.equal(android.methods.find(x=>x.id==='health').enabled,false);
});
test('on iPhone no fake connection or invalid custom URL is produced for any brand',()=>{
 const f=fixture('Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)');
 f.render();
 assert.ok(f.walk().includes('Apple Watch'));
 assert.ok(f.walk().includes('Garmin'));
 assert.ok(f.walk().includes('Xiaomi'));
 for(const b of f.catalog.brands){
  f.wizard.selectBrand(b.id);
  const p=f.wizard.resolve();
  assert.equal(p.webBluetooth,false);
  assert.ok(p.methods.every(x=>x.enabled===false));
  f.wizard.selectMethod(p.methods[0].id);
  assert.ok(f.walk().includes('Wybierz producenta'));
 }
 assert.equal(f.calls,0);
 assert.doesNotMatch(wizard,/location\.href|healthgo:\/\/connect|Math\.random|awardXP/);
});
test('on compatible Android Bluetooth requires direct user action and real confirmed connection',async()=>{
 const f=fixture();
 f.render();
 f.wizard.selectBrand('samsung');
 f.wizard.selectModel('Galaxy Watch Classic');
 assert.equal(f.wizard.getState().model,'Galaxy Watch Classic');
 assert.equal(f.calls,0);
 f.wizard.selectMethod('ble');
 const start=f.button('Wyszukaj i połącz Bluetooth LE');
 assert.ok(start);
 assert.equal(f.calls,0,'never connect automatically');
 await start.listeners.click();
 assert.equal(f.calls,1);
 assert.match(f.wizard.getState().status,/Połączono przez Bluetooth LE/);
 assert.match(f.wizard.getState().status,/rzeczywiste połączenie/i);
});
test('missing Web Bluetooth displays unavailable state and never attempts pairing',()=>{
 const f=fixture();f.win.navigator.bluetooth={};
 f.render();f.wizard.selectBrand('garmin');f.wizard.selectMethod('ble');
 assert.equal(f.wizard.resolve().methods.find(x=>x.id==='ble').enabled,false);
 assert.equal(f.button('Wyszukaj i połącz Bluetooth LE'),undefined);
 assert.equal(f.calls,0);
});
test('brand/model preference is scoped to current user, not fake pairing or health data',()=>{
 const f=fixture();f.render();
 f.wizard.selectBrand('garmin');f.wizard.selectModel('Fēnix');
 const previous=JSON.parse(f.memory.get('healthgo.devices50.selection.owner-a'));
 assert.equal(previous.brand,'garmin');
 assert.equal(previous.model,'Fēnix');
 assert.deepEqual(Object.keys(previous).sort(),['brand','model']);
 f.services.state.uid='owner-b';f.render();
 assert.notEqual(f.wizard.getState().brand,'garmin');
 assert.equal(f.memory.get('healthgo.devices50.selection.owner-b'),undefined);
 f.services.state.uid='owner-a';f.render();
 assert.equal(f.wizard.getState().brand,'garmin');
 assert.equal(f.wizard.getState().model,'Fēnix');
});
test('mobile bundles load in safe order and include responsive styles and native safeguards',()=>{
 assert.match(html,/healthgo-device-catalog50\.js\?v=1/);
 assert.match(html,/healthgo-device-wizard50\.js\?v=1/);
 assert.match(html,/healthgo-device-wizard50\.css\?v=1/);
 assert.ok(html.indexOf('healthgo-device-catalog50.js')<html.indexOf('healthgo-device-wizard50.js'));
 const center=fs.readFileSync('www/healthgo-devices-pro45.js','utf8');
 assert.match(center,/HealthGoDeviceWizard50/);
 const css=fs.readFileSync('www/healthgo-device-wizard50.css','utf8');
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/prefers-reduced-motion/);
 const ble=fs.readFileSync('www/healthgo-devices.js','utf8');
 assert.match(ble,/if\(isIOS\(\)\)\{/);
 assert.match(ble,/return false;/);
});
