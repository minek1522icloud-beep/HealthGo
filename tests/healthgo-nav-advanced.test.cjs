'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('www/healthgo-nav-advanced.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const pro=fs.readFileSync('www/healthgo-map-pro.js','utf8');
const live=fs.readFileSync('www/healthgo-navigation-live.js','utf8');
function harness(){
 const nodes=new Map();
 const make=()=>({textContent:'',hidden:true,attrs:{},style:{},children:[],
  setAttribute(k,v){this.attrs[k]=v},appendChild(x){this.children.push(x)},
  replaceChildren(){this.children=[]},addEventListener(){},closest(){return null}});
 const $=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id)};
 const classNames=new Set(),store=new Map(),calls=[];
 const doc={getElementById:$,createElement:()=>make(),body:{classList:{
  toggle(cls,v){if(v)classNames.add(cls);else classNames.delete(cls)},
  remove(c){classNames.delete(c)}}}};
 const window={HealthGoServices:{state:{uid:'test'}},fetch:async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>({elements:[]})};
 }};
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 vm.runInNewContext(script,{window,document:doc,localStorage:storage,Number,Math,String,Array,Date,
  AbortController,setTimeout,clearTimeout,URLSearchParams,console},{filename:'healthgo-nav-advanced.js'});
 return {api:window.HealthGoNavAdvanced,window,store,calls,nodes,$,classNames};
}
test('scripts compile, and live GPS HUD mounts the expected controls without replacing existing route screen',()=>{
 new vm.Script(script);
 new vm.Script(pro);
 new vm.Script(live);
 for(const id of ['hgNavLaneAssistant','hgNavSpeedLimit','hgNavLimitEnable',
  'hgNavAdvancedTools','hgNavMinimal','hgNavWeatherRisk',
  'hgNavArrivalSummary','hgNavTripWeatherStatus','hgNavCompassBearing'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/healthgo-nav-advanced\.js\?v=5/);
 assert.match(html,/healthgo-nav-advanced\.css\?v=3/);
 assert.match(pro,/HealthGoNavAdvanced\?\.gps\?\./);
 assert.match(pro,/HealthGoNavAdvanced\?\.start\?\./);
 assert.match(pro,/HealthGoNavAdvanced\?\.arrived\?\./);
 assert.match(live,/HealthGoNavAdvanced\?\.weather\?\./);
});
test('lane assistant renders only OSRM intersection.lanes with authoritative valid flags',()=>{
 const h=harness(),fn=h.api.lanes;
 assert.equal(fn({name:'Topolowa',intersections:[{lanes:[{indications:['left']},{indications:['straight']}]}]}),null);
 assert.equal(fn({intersections:[{lanes:[{valid:false,indications:['left']},{valid:false,indications:['right']}]}]}),null);
 assert.equal(fn({intersections:[{lanes:[{valid:true,indications:['straight']},{valid:false,indications:['right']}]}]})[0].arrow,'↑');
 const list=fn({intersections:[{lanes:[{valid:false,indications:['left']},
  {valid:true,indications:['straight','right']},{valid:false,indications:['right']}]}]});
 assert.equal(list.length,3);
 assert.equal(list[0].valid,false);
 assert.equal(list[1].valid,true);
 assert.equal(list[1].arrow,'↑ ↱');
 assert.match(script,/distanceTo<=650/,'lane arrows are only exposed near the actual upcoming junction');
});
test('OSM maxspeed accepts only explicit speed numerals in km/h; never guesses unknown traffic rules',()=>{
 const fn=harness().api.speedLimitValue;
 assert.equal(fn('50'),50);
 assert.equal(fn(' 30 km/h '),30);
 assert.equal(fn('140'),140);
 assert.equal(fn('PL:urban'),null);
 assert.equal(fn('signals'),null);
 assert.equal(fn('30 mph'),null);
 assert.equal(fn('90;70'),null);
 assert.equal(fn('20 @ (Mo-Fr 07:00-19:00)'),null);
 assert.equal(fn('500'),null);
});
test('OSM speed limit appears only for same named road, accurate GPS proximity and unambiguous value',()=>{
 const fn=harness().api.matchMaxspeed,position={lat:52,lon:21.005};
 const road=(name,maxspeed,latitude=52)=>({type:'way',tags:{name,maxspeed},
  geometry:[{lat:latitude,lon:21},{lat:latitude,lon:21.01}]});
 assert.equal(fn({elements:[road('Ludowa','50')]},position,'Ludowa').kmh,50);
 assert.equal(fn({elements:[road('Inna','50')]},position,'Ludowa'),null);
 assert.equal(fn({elements:[road('Ludowa','50',52.005)]},position,'Ludowa'),null);
 assert.equal(fn({elements:[road('Ludowa','50'),road('Ludowa','30')]},position,'Ludowa'),null);
 assert.equal(fn({elements:[road('Ludowa','PL:urban')]},position,'Ludowa'),null);
});
test('navigation preferences store settings only; starting a route never requests optional OSM speed data',()=>{
 const h=harness(),steps=[
  {name:'Ludowa',maneuver:{type:'depart',location:[21,52]}},
  {name:'Wspólna',maneuver:{type:'turn',modifier:'right',location:[21.005,52]},
   intersections:[{lanes:[{valid:true,indications:['right']},{valid:false,indications:['straight']}]}]}
 ];
 h.api.start({steps,geometry:[[21,52],[21.01,52]],meters:680});
 h.api.gps({position:{lat:52,lon:21},accuracy:9,speed:5,heading:90,stepIndex:1,distanceTo:350});
 assert.equal(h.calls.length,0,'opt-in disabled by default');
 assert.equal(h.api.getState().currentStreet,'Ludowa');
 assert.equal(h.api.getState().nextStreet,'Wspólna');
 assert.equal(h.$('hgNavLaneAssistant').hidden,false);
 h.api.setMinimal(true);
 assert.equal(h.classNames.has('hg-nav-minimal'),true);
 assert.equal(h.$('hgNavLaneAssistant').hidden,true);
 assert.ok([...h.store.keys()].every(x=>!x.includes('latitude')&&!x.includes('coords')));
 h.api.stop();
 assert.equal(h.classNames.has('hg-nav-minimal'),false);
});
test('manual opt-in to speed limit uses small Overpass query, not a fake fixed limit',async()=>{
 const h=harness(),steps=[{name:'Ludowa',maneuver:{type:'depart',location:[21,52]}}];
 h.api.start({steps,geometry:[[21,52],[21.01,52]],meters:680});
 h.api.gps({position:{lat:52,lon:21},accuracy:5,speed:5,heading:60,stepIndex:0,distanceTo:300});
 assert.equal(h.calls.length,0);
 h.api.setLimits(true);
 // Async first HTTP request resolves on a microtask.
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(h.calls.length,1);
 assert.match(h.calls[0].url,/overpass-api\.de\/api\/interpreter/);
 assert.match(h.calls[0].options.body,/way%5B/);
 assert.equal(h.$('hgNavSpeedLimit').textContent,'—','empty OSM result must not fabricate a speed limit');
 assert.equal(h.store.get('healthgo.nav.advanced.limits.test'),'1');
 h.api.stop();
});
test('weather warning uses actual model numbers and trip weather is explicitly requested',async()=>{
 const h=harness(),route={steps:[{name:'Ludowa'}],geometry:[[21,52],[21.01,52],[21.02,52.01]]};
 h.api.start(route);
 assert.equal(h.calls.length,0);
 h.api.weather({temp:14,rain:3,wind:50});
 assert.match(h.$('hgNavWeatherRisk').textContent,/Opady|opady/i);
 assert.match(h.$('hgNavWeatherRisk').textContent,/50 km\/h/);
 assert.equal(h.$('hgNavCompactWeather').textContent,'14°C');
 // More detailed trip conditions are only requested on user action.
 h.window.fetch=async(url,options)=>{
  h.calls.push({url,options});
  return {ok:true,json:async()=>[
   {current:{temperature_2m:14,precipitation:1,wind_speed_10m:20}},
   {current:{temperature_2m:12,precipitation:3,wind_speed_10m:55}},
   {current:{temperature_2m:11,precipitation:0,wind_speed_10m:27}}
  ]};
 };
 assert.equal(await h.api.routeWeather(),true);
 assert.equal(h.calls.length,1);
 assert.match(h.$('hgNavTripWeatherStatus').textContent,/55 km\/h/);
 assert.match(h.$('hgNavTripWeatherStatus').textContent,/nie jest ostrzeżenie urzędowe/);
 h.api.stop();
});
test('camera supports route overview, dynamic zoom on approach and GPS recenter without inventing travel',()=>{
 assert.match(live,/function overview\(/);
 assert.match(live,/function recenter\(/);
 assert.match(live,/function orientNorth\(/);
 assert.match(live,/function setApproach\(/);
 assert.match(live,/approachDistance<100\?17\.6/);
 assert.match(live,/if\(follows\)gl\.easeTo/);
 assert.doesNotMatch(script,/navigator\.geolocation\.(?:getCurrentPosition|watchPosition)/);
});
test('arrival summary is based on existing accurate-GPS arrival counter, not arbitrary tapping',()=>{
 assert.match(pro,/if\(arrivalCount>=2&&!arrivalTimer\)/);
 assert.match(pro,/HealthGoNavAdvanced\?\.arrived\?\./);
 const h=harness();
 h.api.start({steps:[],geometry:[[21,52],[21.01,52]],meters:1000});
 h.api.arrived({meters:1000});
 assert.equal(h.$('hgNavArrivalSummary').hidden,false);
 assert.equal(h.$('hgNavSummaryDistance').textContent,'1,0 km');
 h.api.stop();
});
test('fullscreen map and borderless compact ETA strip fix blank bottom and overflow',()=>{
 const css=fs.readFileSync('www/healthgo-nav-advanced.css','utf8');
 assert.match(css,/body\.hg-navigation-active #map\.page\.active/);
 assert.match(css,/height:100dvh!important/);
 assert.match(css,/min-height:100dvh!important/);
 assert.match(css,/\.hg-drive-footer\{/);
 assert.match(css,/border:0!important;border-radius:0!important;box-shadow:none!important/);
 assert.match(css,/\.hg-drive-progress-track\{/);
 assert.match(css,/overflow:hidden!important/);
 assert.match(css,/hg-nav-minimal/);
 assert.match(html,/data-hg-view="2d"/);
 assert.match(html,/data-hg-view="3d"/);
});

test('marked-up Teraz/Potem panel is completely removed while turn data remains internally available',()=>{
 assert.doesNotMatch(html,/id="hgNavStreetChip"|id="hgNavCurrentRoad"|id="hgNavNextRoad"/);
 assert.doesNotMatch(script,/hgNavStreetChip|hgNavCurrentRoad|hgNavNextRoad/);
 const css=fs.readFileSync('www/healthgo-nav-advanced.css','utf8');
 assert.doesNotMatch(css,/#hgNavStreetChip/);
 assert.match(html,/id="hgProNavNext"/,'main top turn guidance is preserved');
 assert.match(script,/currentStreet=clean\(last\?\.name\)/,'internal street name retained to match OSM maxspeed');
});
test('right-side map actions show explicit accessible labels and retain all three working actions',()=>{
 for(const [action,label] of [
  ['overview','Cała trasa'],['follow','Moja pozycja'],['north','Północ']
 ]){
  assert.match(html,new RegExp('data-hgna="'+action+'"[^>]*aria-label="[^"]+"[^>]*>[\\s\\S]*?<span>'+label+'</span>'));
 }
 const css=fs.readFileSync('www/healthgo-nav-advanced.css','utf8');
 assert.match(css,/max-width:min\(126px,39vw\)/);
 assert.match(css,/>button svg/);
 assert.match(script,/if\(action==='overview'\)showOverview\(\)/);
 assert.match(script,/if\(action==='follow'\)follow\(\)/);
 assert.match(script,/if\(action==='north'\)north\(\)/);
});
