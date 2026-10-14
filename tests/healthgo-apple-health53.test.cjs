'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('www/healthgo-apple-health53.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
function fixture(native=true,settings={}){
 const nodes=[],storage=new Map(),registered=[],calls=[],applied=[],cleared=[],events={};
 class E{
  constructor(tag){this.tag=tag;this.id='';this.className='';this.textContent='';this.children=[];this.listeners={};this.disabled=false;nodes.push(this);}
  append(...xs){for(const x of xs){x.parentElement=this;this.children.push(x);}}
  appendChild(x){this.append(x);return x;}
  replaceChildren(...xs){this.children=[];this.append(...xs);}
  addEventListener(type,fn){this.listeners[type]=fn;}
  setAttribute(){}
 }
 const d={createElement:tag=>new E(tag),getElementById:id=>nodes.find(x=>x.id===id&&x.parentElement)||null,
  addEventListener(type,fn){events[type]=fn;},visibilityState:'visible'};
 const parent=new E('div');parent.id='parent';
 const service={state:{uid:'account-a'},subscribe(fn){this.sub=fn;},
  applyNativeHealthSnapshot(sample,uid){applied.push({sample,uid});return true;},
  clearNativeHealthSnapshot(uid){cleared.push(uid);return true;}};
 const api={
  async availability(){calls.push('availability');return {available:true};},
  async requestAccess(){calls.push('requestAccess');return {requested:true};},
  async readToday(){calls.push('readToday');return {day:'test',steps:321,heartRate:72,activeCalories:85,source:'Apple Health',updatedAt:new Date().toISOString()};},
  ...settings
 };
 const w={document:d,HealthGoServices:service,
  Capacitor:native?{isNativePlatform:()=>true,getPlatform:()=> 'ios',registerPlugin(name){registered.push(name);return api;}}:undefined,
  localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){storage.set(k,v);},removeItem(k){storage.delete(k);}},
  confirm:()=>true,addEventListener(type,fn){events[type]=fn;}};
 vm.runInNewContext(script,{window:w,document:d,Number,Date,Math,JSON,String,Array,Promise,console},{filename:'healthgo-apple-health53.js'});
 const module=w.HealthGoAppleHealth53;
 function walk(node){return [node.textContent||'',...(node.children||[]).flatMap(walk)].join(' ');}
 return {w,d,parent,service,api,registered,calls,applied,cleared,storage,module,events,render(){module.render(parent);},visible(){return walk(parent);},
  buttons(){return nodes.filter(n=>n.tag==='button'&&n.parentElement&&n.disabled!==undefined);}};
}
test('Native bridge is present in bundle and never exposes readings inside device panel',()=>{
 new vm.Script(script);
 assert.match(html,/healthgo-apple-health53\.js\?v=1/);
 assert.match(html,/healthgo-apple-health53\.css\?v=1/);
 const f=fixture();f.render();
 assert.match(f.visible(),/Apple Watch i Apple Health/);
 assert.match(f.visible(),/Połącz Apple Health/);
 assert.doesNotMatch(f.visible(),/321|72 BPM|85 kcal/);
});
test('Website cannot access HealthKit and never pretends that a watch connected',async()=>{
 const f=fixture(false);f.render();
 await f.module.connect();
 assert.deepEqual(f.registered,[]);
 assert.deepEqual(f.applied,[]);
 assert.equal(f.module.getState().enabled,false);
 assert.match(f.visible(),/natywna|natywnej/);
});
test('On native iPhone a user click requests real HealthKit data and keeps it out of device UI',async()=>{
 const f=fixture();f.render();
 await f.module.connect();
 assert.deepEqual(f.calls,['availability','requestAccess','readToday']);
 assert.deepEqual(f.registered,['HealthGoHealth']);
 assert.equal(f.applied.length,1);
 assert.equal(f.applied[0].uid,'account-a');
 assert.equal(f.applied[0].sample.steps,321);
 assert.equal(f.module.getState().enabled,true);
 assert.equal(f.storage.get('healthgo.applehealth.enabled.account-a'),'true');
 assert.doesNotMatch(f.visible(),/321|72 BPM|85 kcal/);
 assert.match(f.visible(),/Synchronizuj teraz/);
});
test('No measurements never becomes a fabricated health reading',async()=>{
 const f=fixture(true,{readToday:async()=>({day:'test',steps:null,heartRate:null})});
 f.render();await f.module.connect();
 assert.equal(f.applied.length,0);
 assert.match(f.module.getState().message,/Nie otrzymano/);
});
test('Disconnect stops local synchronization and does not claim to unpair Apple Watch',async()=>{
 const f=fixture();f.render();await f.module.connect();await f.module.disconnect();
 assert.equal(f.module.getState().enabled,false);
 assert.deepEqual(f.cleared,['account-a']);
 assert.equal(f.storage.has('healthgo.applehealth.enabled.account-a'),false);
 assert.match(f.module.getState().message,/Zegarek|HealthKit|Rozłączono/);
});
test('Account changed while system permission sheet is open never forwards data to next account',async()=>{
 let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const f=fixture(true,{requestAccess:()=>pending});
 f.render();
 const started=f.module.connect();
 await Promise.resolve();await Promise.resolve();
 f.service.state.uid='account-b';f.service.sub();
 release({requested:true});
 await started;
 assert.equal(f.applied.length,0);
 assert.equal(f.module.getState().enabled,false);
 assert.equal(f.storage.has('healthgo.applehealth.enabled.account-a'),false);
});
