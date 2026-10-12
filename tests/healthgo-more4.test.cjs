'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('www/healthgo-more4.js','utf8');
const css=fs.readFileSync('www/healthgo-more4.css','utf8');
const html=fs.readFileSync('www/index.html','utf8');
function harness(){
 const saved=new Map(),state={uid:'test-account',engine:{totalXp:520,history:[
  {type:'XP_GAINED',occurredAt:'2026-10-11T16:00:00Z',payload:{xp:40}},
  {type:'LEVEL_UP',occurredAt:'2026-10-11T16:00:01Z',payload:{level:2}},
  {type:'REWARD_GRANTED',occurredAt:'2026-10-11T16:00:02Z',payload:{rewardId:'task'}}
 ]}};
 const body={setAttribute(){},classList:{toggle(){}}};
 const document={body,getElementById(){return null},querySelector(){return null},addEventListener(){}};
 const services={state,subscribe(){return()=>{}}};
 const localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
 const window={document,localStorage,HealthGoServices:services,HealthGoEngine:{},addEventListener(){},setTimeout:fn=>fn(),requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(code,{window,document,console},{filename:'healthgo-more4.js'});
 return {api:window.HealthGoMore4,state,saved};
}
test('HealthGo More 4.0 compiles and is loaded after existing real-data systems',()=>{
 new vm.Script(code);
 assert.match(html,/healthgo-feature-center\.js\?v=3<\/script>/);
 assert.match(html,/healthgo-more4\.css\?v=1/);
 assert.match(html,/healthgo-more4\.js\?v=1/);
 assert.ok(html.indexOf('healthgo-feature-center.js?v=3')<html.indexOf('healthgo-more4.js?v=1'));
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css, /prefers-reduced-motion/);
});
test('More 4.0 enhances existing screens and preserves map and collectible code',()=>{
 for(const page of ['challenges','activity','devices','family','settings']){
  assert.match(code,new RegExp("'"+page+"'"));
 }
 for(const panel of ['hg4XpDashboard','hg4MissionPeriods','hg4Stats','hg4Notifications','hg4Security','hg4Academy','hg4SettingsPro','hg4Info']){
  assert.match(code,new RegExp(panel));
 }
 assert.doesNotMatch(code,/navigator\.geolocation|Math\.random|applyEvent\(|healthgo-map-pro|healthgo-badge-3d/);
});
test('Only confirmed history populates notifications; filtering is per signed-in account',()=>{
 const h=harness(),all=h.api.notices();
 assert.equal(all.length,3);
 assert.equal(all[0].type,'REWARD_GRANTED');
 h.saved.set('healthgo.more4.prefs.test-account',JSON.stringify({xp:false,missions:true}));
 assert.equal(h.api.notices().length,1);
 assert.equal(h.api.notices()[0].type,'REWARD_GRANTED');
 h.state.uid='';
 assert.equal(h.api.notices().length,0);
});
test('XP history uses only actual account events and does not invent rewards or sensitive health sharing',()=>{
 const h=harness();
 assert.equal(h.api.history().length,3);
 h.state.uid='';
 assert.deepEqual(Array.from(h.api.history()),[]);
 assert.match(code,/Engine\.viewChallenges\(e,new Date\(\)\.toISOString\(\)\)/);
 assert.match(code,/S\.state\?\.healthDays/);
 assert.match(code,/api\?\.connected/);
 assert.match(code,/Nie tworzymy drugiego/);
 assert.match(code,/Dane zdrowotne pozostają prywatne/);
});
test('SOS action needs explicit user confirmation; no automatic emergency dispatch or false push claims',()=>{
 assert.match(code,/w\.confirm\('Otworzyć aplikację telefonu/);
 assert.match(code,/w\.location\.href='tel:112'/);
 assert.doesNotMatch(code,/fetch\([^)]*112|sendEmergency|dispatchEmergency/);
 assert.match(code,/Nie aktywują same z siebie powiadomień push/);
 assert.match(code,/Notification\.requestPermission/);
});
test('More menu contains vector-icon destinations to Notifications and SOS',()=>{
 for(const id of ['hg4Notifications','hg4Security']){
  assert.match(html,new RegExp('data-hg4-open="'+id+'"'));
  assert.match(code,new RegExp("id==='"+id+"'"));
 }
 assert.match(html,/class="hg-more-action" data-hg4-open="hg4Notifications"/);
 assert.match(html,/class="hg-more-action" data-hg4-open="hg4Security"/);
});
