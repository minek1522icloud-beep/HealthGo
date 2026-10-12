'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file=p=>fs.readFileSync(p,'utf8');
const script=file('www/healthgo-feature-center.js'),html=file('www/index.html'),styles=file('www/healthgo-feature-center.css');
function boot(sites=[],uid='tester'){
 const handlers=[],state={uid,online:true,engine:null,health:null,healthDays:[],family:{members:[]},devices:[],profile:null,locationSettings:{mode:'off'}};
 const services={state,subscribe(fn){handlers.push(fn);return()=>{}},refreshHealth:async()=>null,
  initialize:async()=>null,refreshDevices:async()=>[],errorMessage:e=>String(e.message||'error')};
 const engine={getLevel:()=>({level:1,xp:0,needed:400,remaining:400,percent:0}),viewAchievements:()=>[],viewChallenges:()=>[]};
 const window={document:{getElementById:()=>null,createElement:()=>({}),querySelector:()=>null},
  HealthGoServices:services,HealthGoEngine:engine,
  HealthGoPoints:{getState:()=>({sites})},
  addEventListener(){},setTimeout:fn=>fn(),requestAnimationFrame:fn=>fn(),
  navigator:{userAgent:'iPhone'},isSecureContext:true};
 vm.runInNewContext(script,{window,document:window.document},{filename:'healthgo-feature-center.js'});
 return{center:window.HealthGoFeatureCenter,state,window,handlers};
}
test('all seven feature panels are installed in existing HealthGo sections without new tabs',()=>{
 const ids=['hfcChallenges','hfcActivity','hfcDevices','hfcFamily','hfcTreasure','hfcPoint','hfcSettings'];
 const pages=['challenges','activity','devices','family','explore','points','settings'];
 for(let i=0;i<ids.length;i++)assert.match(script,new RegExp("mount\\('"+pages[i]+"','"+ids[i]+"'"));
 assert.match(html,/healthgo-feature-center\.js\?v=3/);
 assert.match(html,/healthgo-feature-center\.css\?v=2/);
 assert.match(html,/healthgo-point\.js\?v=2/);
 assert.match(html,/healthgo-v2-ui\.js/);
});
test('subsystems for XP, family, devices and point redemption remain server authoritative',()=>{
 assert.match(script,/Engine\.viewChallenges\(engine/);
 assert.match(script,/Engine\.viewAchievements\(engine/);
 assert.match(script,/S\.state\.devices/);
 assert.match(script,/f=state\.family/);
 assert.match(script,/HealthGoPoints\?\.getState/);
 assert.doesNotMatch(script,/\.rpc\('hg_point_claim'|setItem\([^)]*xp|setItem\([^)]*units/i);
 assert.match(file('www/healthgo-point.js'),/healthgo:points-updated/);
 assert.match(file('www/healthgo-services.js'),/xp_events/);
});
test('weekly activity uses only real per-day measurements and preserves missing values',()=>{
 const {center}=boot();
 const rows=[
  {id:'2026-10-12',steps:820,activeMinutes:15,source:'HealthGo'},
  {id:'2026-10-10',steps:0,activeMinutes:0,source:'Watch'},
  {id:'2026-10-06',steps:9999,activeMinutes:60},
  {id:'2026-09-01',steps:8888}
 ];
 const result=center.weekly(rows,new Date(2026,9,12));
 assert.equal(result.length,7);
 assert.equal(result[6].key,'2026-10-12');
 assert.equal(result[6].steps,820);
 assert.equal(result[6].minutes,15);
 assert.equal(result[4].steps,0);
 assert.equal(result[4].minutes,0);
 assert.equal(result[5].steps,null,'missing day is not fabricated as zero');
 assert.equal(result[0].key,'2026-10-06');
 assert.equal(result[0].steps,9999);
 const empty=center.weekly([],new Date(2026,9,12));
 assert.ok(empty.every(x=>x.steps===null&&x.minutes===null),'no mock measurements');
});
test('treasures must come from a logged-in approved backend snapshot',()=>{
 const sites=[{id:'one',lat:52.23,lon:21.02,name:'Publiczny skarb'},
  {id:'bad',lat:190,lon:21},{id:'bad2',lat:52,lon:NaN},
  {id:5,lat:52,lon:21}];
 const {center,state}=boot(sites,'abc');
 const ok=center.getApprovedSites();
 assert.equal(ok.length,1);
 assert.equal(ok[0].id,'one');
 state.uid=null;
 assert.equal(center.getApprovedSites().length,0,'signed-out user cannot see account-specific treasure sites');
 assert.match(script,/w\.L\.map\(container/);
 assert.match(script,/Pokaż mapę skarbów/);
 assert.match(script,/GPS uruchamia się tylko po Twojej zgodzie/);
 assert.doesNotMatch(script,/navigator\.geolocation\.(getCurrentPosition|watchPosition)/);
});
test('treasure map navigation uses GPS route engine only after tapping a specific approved pin',()=>{
 assert.match(script,/marker\.bindPopup\(card\)/);
 assert.match(script,/w\.HealthGoMapV2\.selectDestination\(site\.name,Number\(site\.lat\),Number\(site\.lon\)\)/);
 assert.match(script,/if\(site\.claimed\)return/);
 assert.match(script,/if\(!allowedSites\(\)\.length\)return/);
});
test('iPhone device information distinguishes web Bluetooth from native Apple Health access',()=>{
 assert.match(script,/Safari na iPhonie nie udostępnia Web Bluetooth/);
 assert.match(script,/w\.navigator\?\.bluetooth\?\.requestDevice/);
 assert.match(script,/Nie uzyska automatycznie danych Apple Health/);
 assert.doesNotMatch(script,/random.*heartRate|fake.*steps|Math\.random/);
});
test('family privacy and activity are explicitly opt-in, no automatic sharing on screen render',()=>{
 assert.match(script,/Tylko osoby z zatwierdzonymi uprawnieniami/);
 assert.match(script,/state\.locationSettings\?\.mode/);
 assert.match(script,/S\.refreshHealth\(\)/);
 assert.doesNotMatch(script,/Services\.call\('publishLocation'|HealthGoServices\.call\('publishLocation'/);
});
test('points show a plainly virtual goal and do not promise physical prizes',()=>{
 assert.match(script,/target=40/);
 assert.match(script,/20 HG to orientacyjny cel kolekcjonerski/);
 assert.match(script,/nie kupon na prawdziwy produkt/);
 assert.doesNotMatch(script,/redeem.*kaktus|redeem.*salatka/i);
});
test('visuals are responsive, polished and retain high contrast',()=>{
 assert.match(styles,/@media\(max-width:560px\)/);
 assert.match(styles,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(styles,/focus-visible/);
 assert.match(styles,/\.hfc-week-chart/);
 assert.match(styles,/\.hfc-setting-link/);
 assert.match(styles,/#hfcTreasureMap\[hidden\]/);
});

test('seven sections have functional controls connected to real HealthGo systems',()=>{
 assert.match(script,/function missionBoard\(root,defs\)/);
 assert.match(script,/Engine\.viewChallenges\(engine/);
 assert.match(script,/questFilter==='completed'/);
 assert.match(script,/item\.xpReward/);
 assert.match(script,/item\.source/);
 assert.match(script,/activityMetric==='steps'/);
 assert.match(script,/days\.map\(x=>x\[activityMetric\]/);
 assert.match(script,/value===null\?'0%'/);
 assert.match(script,/HealthGoDevices\?\.connect/);
 assert.match(script,/Safari na iPhonie nie udostępnia Web Bluetooth/);
 assert.match(script,/if\(linked&&Array\.isArray\(f\.members\)/);
 assert.match(script,/w\.HealthGoPoints\?\.refresh\?\./);
 assert.match(script,/w\.healthGoCheckMobileUpdate/);
 assert.match(styles,/\.hfc-mission-summary/);
 assert.match(styles,/\.hfc-filter-tabs/);
 assert.match(styles,/\.hfc-family-person/);
 assert.match(styles,/\.hfc-device-explainer/);
 assert.doesNotMatch(script,/Math\.random|fakeStep|fakeXp|faker|mockMeasurement/i);
});
