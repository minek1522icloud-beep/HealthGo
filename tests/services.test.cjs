'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const data=require('../www/core/health-data.js');
function fixture(){
 const storage=new Map(),callbacks=[],watchers=[];let identity=null;
 const doc={onSnapshot(options,fn){callbacks.push(fn);watchers.push({off:false});const w=watchers.at(-1);return()=>{w.off=true;};},collection(){return doc;},doc(){return doc;},orderBy(){return doc;},where(){return doc;},limit(){return doc;},get:async()=>({exists:false,metadata:{fromCache:false}}),update:async()=>{}};
 const eventTarget=new EventTarget(),window=eventTarget;window.HealthGoData=data;window.healthGoDb={collection:()=>doc};window.healthGoAuth={get currentUser(){return identity;}};
 const firebase={app:()=>({functions:()=>({httpsCallable:()=>async()=>({data:{profile:{nickname:'Test',accountType:'standard'},engine:{totalXp:0}}})})}),functions:()=>{}};
 window.firebase=firebase;
 const document={getElementById:()=>null,documentElement:{classList:{remove:()=>{}}}};
 const context={window,document,navigator:{onLine:true},firebase,EventTarget,CustomEvent,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},crypto:require('node:crypto').webcrypto,queueMicrotask,console};
 vm.runInNewContext(fs.readFileSync('www/healthgo-services.js','utf8'),context);
 return {service:window.HealthGoServices,callbacks,storage,watchers,login(uid){identity={uid,providerData:[]};return identity;}};
}
test('logout clears UID, private data and listeners',async()=>{
 const f=fixture();await f.service.start(f.login('A'));f.service.state.health={steps:500};f.service.stop();
 assert.equal(f.service.state.uid,null);assert.equal(f.service.state.health,null);assert.equal(f.service.state.family.id,null);assert.ok(f.watchers.every(w=>w.off));
});
test('late callbacks from A cannot populate B session',async()=>{
 const f=fixture();await f.service.start(f.login('A'));const old=f.callbacks.slice();f.service.stop();await f.service.start(f.login('B'));
 for(const cb of old)cb({exists:true,data:()=>({steps:999,nickname:'A'}),metadata:{fromCache:false},docs:[]});
 assert.equal(f.service.state.uid,'B');assert.equal(f.service.state.health,null);
});
test('cache is scoped per UID and shared v1 cache is not read',async()=>{
 const f=fixture();f.storage.set('healthgo_device_health_v1',JSON.stringify({steps:999}));
 f.storage.set('healthgo_v2_health_A',JSON.stringify({steps:123}));await f.service.start(f.login('B'));assert.equal(f.service.state.health,null);
 f.service.stop();await f.service.start(f.login('A'));assert.equal(f.service.state.health.steps,123);
});

test('permission revocation clears family projections and rejects late snapshots',async()=>{
 const f=fixture();await f.service.start(f.login('parent'));
 f.callbacks[0]({exists:true,data:()=>({accountType:'guardian',familyId:'family-A'}),metadata:{fromCache:false}});
 const familyStart=8;
 f.callbacks[familyStart]({docs:[{id:'child',data:()=>({uid:'child',role:'child'})}],metadata:{fromCache:false}});
 const permissions=f.callbacks[familyStart+1];
 permissions({docs:[{id:'grant',data:()=>({childUid:'child',guardianUid:'parent',scopes:{HEALTH_ACTIVITY:true,LOCATION_APPROXIMATE:true}})}],metadata:{fromCache:false}});
 const late=f.callbacks.slice(familyStart+4);
 for(const callback of late)callback({exists:true,data:()=>({steps:123,latitude:50,longitude:19}),metadata:{fromCache:false}});
 assert.equal(f.service.state.family.projections.child.activity.steps,123);
 permissions({docs:[],metadata:{fromCache:false}});
 assert.deepEqual(Object.keys(f.service.state.family.projections.child),[]);
 assert.equal(f.service.state.family.locations.length,0);
 for(const callback of late)callback({exists:true,data:()=>({steps:999,latitude:50,longitude:19}),metadata:{fromCache:false}});
 assert.equal(f.service.state.family.projections.child.activity,undefined);
 assert.equal(f.service.state.family.locations.length,0);
});
