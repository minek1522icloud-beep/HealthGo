'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const data=require('../www/core/health-data.js');
const engine=require('../www/core/achievement-engine.js');

function fixture(){
 const storage=new Map(),selectHooks=new Map(),rpcHooks=new Map();let identity=null,sessionEnabled=true;
 class TestCustomEvent extends Event{constructor(type,init){super(type);this.detail=init&&init.detail;}}
 function profile(uid){return{id:uid,display_name:uid==='B'?'Bee':'Test',account_type:'standard',xp:0,level:1,created_at:'2026-10-04T00:00:00Z'};}
 const db={
  select(table,params){
   const hook=selectHooks.get(table);if(hook)return hook(params||{});
   if(table==='profiles'){const uid=String(params&&params.id||'').replace(/^eq\./,'');return Promise.resolve([profile(uid)]);}
   return Promise.resolve([]);
  },
  rpc(name,body){
   const hook=rpcHooks.get(name);if(hook)return hook(body||{});
   if(name==='healthgo_get_family_state')return Promise.resolve({id:null,members:[],permissions:[],locations:[],devices:[],audit:[],invites:[],projections:{}});
   return Promise.resolve({ok:true});
  },
  upsert(){return Promise.resolve([]);},
  update(){return Promise.resolve([]);}
 };
 const auth={get currentUser(){return identity;}};
 const supabase={db,auth,hasSession(){return !!identity&&sessionEnabled;}};
 const eventTarget=new EventTarget(),window=eventTarget;window.HealthGoData=data;window.HealthGoEngine=engine;window.HealthGoSupabase=supabase;
 const document={getElementById:()=>null,querySelectorAll:()=>[],body:{classList:{remove:()=>{}}},documentElement:{classList:{remove:()=>{}}}};
 const context={window,document,navigator:{onLine:true},EventTarget,CustomEvent:TestCustomEvent,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:require('node:crypto').webcrypto,queueMicrotask,console,setInterval:()=>1,clearInterval:()=>{}};
 vm.runInNewContext(fs.readFileSync('www/healthgo-services.js','utf8'),context);
 return {
  service:window.HealthGoServices,storage,
  login(uid){identity={id:uid,email:uid+'@example.invalid'};sessionEnabled=true;return{uid,email:identity.email,providerData:[]};},
  localUser(uid){identity=null;sessionEnabled=false;return{uid,email:uid+'@example.invalid',providerData:[]};},
  setSelect(table,fn){selectHooks.set(table,fn);},
  setRpc(name,fn){rpcHooks.set(name,fn);}
 };
}

test('logout clears UID and private state',async()=>{
 const f=fixture();await f.service.start(f.login('A'));f.service.state.health={steps:500};f.service.stop();
 assert.equal(f.service.state.uid,null);assert.equal(f.service.state.health,null);assert.equal(f.service.state.family.id,null);
});

test('late Supabase response from A cannot populate B session',async()=>{
 const f=fixture();let resolveA;
 f.setSelect('profiles',params=>{
  const uid=String(params.id||'').replace(/^eq\./,'');
  if(uid==='A')return new Promise(done=>{resolveA=done;});
  return Promise.resolve([{id:'B',display_name:'Bee',account_type:'standard',xp:0,level:1,created_at:'2026-10-04T00:00:00Z'}]);
 });
 const pendingA=f.service.start(f.login('A'));await new Promise(resolve=>setImmediate(resolve));
 f.service.stop();await f.service.start(f.login('B'));
 resolveA([{id:'A',display_name:'Alice',account_type:'standard',xp:0,level:1,created_at:'2026-10-04T00:00:00Z'}]);await pendingA;
 assert.equal(f.service.state.uid,'B');assert.equal(f.service.state.profile.nickname,'Bee');f.service.stop();
});

test('offline cache is scoped per UID and shared legacy cache is ignored',async()=>{
 const f=fixture();f.storage.set('healthgo_device_health_v1',JSON.stringify({steps:999}));
 f.storage.set('healthgo_v2_health_A',JSON.stringify({steps:123}));
 await f.service.start(f.localUser('B'));assert.equal(f.service.state.health,null);
 f.service.stop();await f.service.start(f.localUser('A'));assert.equal(f.service.state.health.steps,123);f.service.stop();
});

test('Supabase Family state is loaded for the authenticated account',async()=>{
 const f=fixture();f.setRpc('healthgo_get_family_state',()=>Promise.resolve({id:'family-A',members:[{uid:'parent',role:'guardian'},{uid:'child',role:'child'}],permissions:[],locations:[],devices:[],audit:[],invites:[],projections:{}}));
 await f.service.start(f.login('parent'));
 assert.equal(f.service.state.family.id,'family-A');assert.equal(f.service.state.family.members.length,2);f.service.stop();
});

test('pending event from A cannot enter B outbox after account switch',async()=>{
 const f=fixture();await f.service.start(f.login('A'));let resolveEvent;
 f.setRpc('healthgo_record_progress_event',()=>new Promise(done=>{resolveEvent=done;}));
 const pending=f.service.record('AI_USED',{},'A-event');await new Promise(resolve=>setImmediate(resolve));
 f.service.stop();await f.service.start(f.login('B'));
 resolveEvent({duplicate:false});assert.equal(await pending,false);
 assert.equal(f.storage.get('healthgo_v2_outbox_B'),undefined);f.service.stop();
});
