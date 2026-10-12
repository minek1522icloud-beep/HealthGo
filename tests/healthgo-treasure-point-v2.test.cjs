'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const treasure=fs.readFileSync('www/healthgo-treasure.js','utf8');
const points=fs.readFileSync('www/healthgo-point.js','utf8');
const feature=fs.readFileSync('www/healthgo-feature-center.js','utf8');
const mobile=fs.readFileSync('www/healthgo-mobile-suite.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
function huntHarness(sites=[]){
 const handlers={},stat={textContent:''},world={};
 const root={innerHTML:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn},
  querySelector(){return null}};
 const document={getElementById(id){return id==='hgTreasureCenter'?root:id==='hptWorldMap'?world:stat},
  createElement(tag){return{tag,textContent:'',children:[],append(...nodes){this.children.push(...nodes)},
   addEventListener(){},setAttribute(){}}}};
 const called={map:0,gps:0,view:null};
 const fakeMap={remove(){},setView(center,z){called.view={center,z};return this},
  fitBounds(){return this},invalidateSize(){return this}};
 const L={map(){called.map++;return fakeMap},
  tileLayer(){return{addTo(){}}},
  featureGroup(){return{addTo(){},getBounds(){return{};}}},
  marker(){return{addTo(){return this},bindPopup(){return this}}},
  circleMarker(){return{addTo(){return this},bindPopup(){return this}}}};
 const window={HealthGoPoints:{getState:()=>({sites}),refresh:async()=>{}},
  HealthGoSupabase:{db:{rpc(){throw Error('RPC only after verified location')}}},
  HealthGoServices:{state:{uid:'tester'},subscribe(fn){fn(this.state)}},
  L,setTimeout(fn){fn()},addEventListener(name,fn){handlers[name]=fn}};
 const navigator={geolocation:{getCurrentPosition(){called.gps++}}};
 vm.runInNewContext(treasure,{window,document,navigator,console,Math,Number,Array,String,Uint8Array,Promise},
  {filename:'healthgo-treasure.js'});
 const click=(attrs={},data={})=>{
  const button={hasAttribute:key=>!!attrs[key],dataset:data};
  root.listeners.click({target:{closest:()=>button}});
 };
 return{root,window,called,click,handlers};
}
test('treasure game compiles and opens world map even with no approved reward sites',()=>{
 new vm.Script(treasure);
 const h=huntHarness([]);
 assert.match(h.root.innerHTML,/Poszukiwacz Skarbów/);
 assert.match(h.root.innerHTML,/Brak zatwierdzonych skarbów/);
 assert.equal(h.called.gps,0,'opening a page must not access GPS');
 h.click({'data-ht-map':true});
 assert.match(h.root.innerHTML,/id="hptWorldMap"/);
 assert.equal(h.called.map,1);
 assert.deepEqual(Array.from(h.called.view.center),[22,0]);
 assert.equal(h.called.gps,0,'world map never implicitly requests location');
});
test('treasure markers come from returned approved sites, without synthetic claim or XP',()=>{
 const sites=[{id:'approved',lat:52.2,lon:21.01,name:'Publiczne miejsce',claimed:false}];
 const h=huntHarness(sites);
 assert.match(h.root.innerHTML,/Publiczne miejsce/);
 h.click({'data-ht-map':true});
 assert.equal(h.called.map,1);
 assert.match(treasure,/hg_point_claim/);
 assert.match(treasure,/w.crypto.subtle.digest|w\.crypto\.subtle\.digest/);
 assert.doesNotMatch(treasure,/grantXp\(|Math\.random\(/);
});
test('retired demo products are not redeemable and backend retirement preserves previous owners',async()=>{
 new vm.Script(points);
 assert.match(points,/DEMO_IDS/);
 assert.match(points,/!DEMO_IDS.has\(x.id\)/);
 assert.match(points,/hg_point_redeem/);
 const migration=fs.readFileSync('supabase/migrations/20261012_healthgo_retire_demo_point_rewards.sql','utf8');
 assert.match(migration,/set active=false/);
 assert.doesNotMatch(migration,/delete\s+from\s+public\.hg_point_inventory/i);
 assert.doesNotMatch(migration,/update\s+public\.hg_point_wallets/i);
});
test('2FA settings buttons are removed, but existing-account challenge is not bypassed',()=>{
 assert.doesNotMatch(mobile,/button\('Włącz 2FA'|button\('Wyłącz 2FA'/);
 assert.match(mobile,/Ochrona sesji/);
 assert.match(html,/if\(!\(await finishMfaStep\(uid\)\)\)return/);
 assert.match(html,/auth\.mfa\.verify/);
 assert.match(feature,/huntMap\.setView\(\[22,0\],2\)/);
});
