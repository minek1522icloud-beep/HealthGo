'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const js=fs.readFileSync('www/healthgo-map-pro.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const mapJS=fs.readFileSync('www/healthgo-map-v2.js','utf8');
const css=fs.readFileSync('www/healthgo-map-v2.css','utf8');
function harness(){
 const nodes=new Map(),element=id=>{
  if(!nodes.has(id))nodes.set(id,{id,hidden:true,textContent:'',style:{width:'',setProperty(key,val){this[key]=val}},attributes:{},classList:{add(){},remove(){},toggle(){}},setAttribute(key,val){this.attributes[key]=val}});
  return nodes.get(id);
 };
 const applied=new Set();
 const bodyClass={add:x=>applied.add(x),remove:x=>applied.delete(x),contains:x=>applied.has(x)};
 const sheets=[{hidden:false},{hidden:false},{hidden:false}];
 const document={hidden:false,body:{classList:bodyClass},getElementById:element,addEventListener(){},
  querySelectorAll:selector=>selector==='#map .map-v2-panel'?sheets:[]};
 let starts=0,stops=0,onPosition=null;
 const navigator={geolocation:{watchPosition(cb){starts++;onPosition=cb;return 1},clearWatch(){stops++}}};
 const window={addEventListener(){},HealthGoMapV2:{close(){},resizeViewport(){},rememberPosition(){}},speechSynthesis:{cancel(){}}};
 const map={setView(){},getZoom(){return 16},removeLayer(){}};
 vm.runInNewContext(js,{document,window,navigator,healthGoMap:map,console,Date,Math,Number,String});
 return {api:window.HealthGoMapPro,element,applied,sheets,emitGPS(coords){onPosition?.({coords})},counts(){return {starts,stops}}};
}
test('Old 3D engine, renderers and model buttons are gone from mobile map',()=>{
 new vm.Script(js,{filename:'healthgo-map-pro.js'});
 for(const id of ['hgNavStartButton','hgProNavigation','hgProNavDirection','hgProNavEta','hgProVoice','hgProFollow','hgProNavTheme'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(js,/maplibre|fill-extrusion|buildingsToFeatures|toggle3D|import\(/i);
 assert.doesNotMatch(html,/id="hg3DMap"|id="hg3DButton"|id="hgProNav3D"/);
 assert.match(css,/HealthGo Map 4.0 interface/);
 assert.match(mapJS,/window\.HealthGoMapPro\?\.setRoute\?\.\(route,destination\?\.name/);
});
test('GPS only starts on manual navigation after real route is loaded',()=>{
 const h=harness();
 assert.equal(h.counts().starts,0);
 assert.equal(h.api.startNavigation(),false);
 assert.equal(h.counts().starts,0);
 assert.equal(h.api.setRoute({geometry:{coordinates:[[21,52],[21.01,52.01]]},
  distance:1100,duration:150,legs:[{steps:[{maneuver:{type:'depart',location:[21,52]}},
   {maneuver:{type:'turn',modifier:'right',location:[21.01,52.01]}}]}]},'Park'),true);
 assert.equal(h.element('hgNavStartButton').hidden,false);
 assert.equal(h.api.startNavigation(),true);
 assert.equal(h.counts().starts,1);
 assert.equal(h.element('hgProNavigation').hidden,false);
 h.api.stopNavigation();
 assert.equal(h.counts().stops,1);
 assert.equal(h.element('hgProNavigation').hidden,true);
});
test('Entering navigation hides all old map panels and restores normal UI on exit',()=>{
 const h=harness();
 h.api.setRoute({geometry:{coordinates:[[21,52],[21.01,52.01]]},
  distance:1000,duration:200,
  legs:[{steps:[{maneuver:{type:'depart',location:[21,52]}}]}]},'Cel');
 assert.equal(h.api.startNavigation(),true);
 assert.equal(h.applied.has('hg-navigation-active'),true);
 assert.ok(h.sheets.every(x=>x.hidden),'all overlapping map panels hidden');
 assert.equal(h.element('hgProNavigation').hidden,false);
 h.api.stopNavigation();
 assert.equal(h.applied.has('hg-navigation-active'),false);
 assert.equal(h.element('hgProNavigation').hidden,true);
});
test('Route path updates ETA, GPS speed, and end-of-route progress without 3D',()=>{
 const h=harness();
 h.api.setRoute({geometry:{coordinates:[[21,52],[21.005,52],[21.01,52]]},
  distance:680,duration:110,legs:[{steps:[{maneuver:{type:'depart',location:[21,52]}},
   {maneuver:{type:'turn',modifier:'right',location:[21.01,52]}}]}]},'Dom');
 assert.ok(h.api.routeRemaining({lat:52,lon:21})>500);
 assert.equal(h.api.routeRemaining({lat:52,lon:21.01}),0);
 h.api.startNavigation();
 h.emitGPS({latitude:52,longitude:21.004,accuracy:10,speed:5,heading:90});
 assert.equal(h.element('hgProNavSpeed').textContent,'18');
 assert.match(h.element('hgProNavEta').textContent,/^\d{2}:\d{2}$/);
 assert.match(h.element('hgProNavDistance').textContent,/m|km/);
 assert.match(h.element('hgProNavTime').textContent,/^\d+$/);
 assert.equal(h.element('hgProNavStreet').textContent,'Kontynuuj wyznaczoną trasą');
 assert.match(h.element('hgProNavTurnDistance').textContent,/m/);
 assert.ok(h.element('hgProNavProgress').style.width.endsWith('%'));
 assert.equal(h.element('hgProNavProgressTrack').attributes['aria-valuenow']!==undefined,true);
 h.api.leaveMap();
 assert.equal(h.counts().stops,1);
});

test('Next OSRM maneuver updates blue banner with real distance and street name',()=>{
 const h=harness();
 const points=[[21,52],[21.005,52],[21.01,52]];
 h.api.setRoute({geometry:{coordinates:points},
  distance:680,duration:110,legs:[{steps:[
   {maneuver:{type:'depart',location:points[0]},name:'Startowa'},
   {maneuver:{type:'turn',modifier:'right',location:points[2]},name:'Główna'}]}]},'Rynek');
 h.api.startNavigation();
 assert.equal(h.element('hgProNavEta').textContent,'—','ETA must await GPS');
 assert.equal(h.element('hgProNavTurnDistance').textContent,'—');
 h.emitGPS({latitude:52,longitude:21,accuracy:8,speed:null});
 assert.equal(h.element('hgProNavIcon').textContent,'↱');
 assert.equal(h.element('hgProNavDirection').textContent,'Skręć w prawo');
 assert.equal(h.element('hgProNavStreet').textContent,'Główna');
 assert.match(h.element('hgProNavTurnDistance').textContent,/m/);
 assert.equal(h.element('hgProNavSpeed').textContent,'—','do not fake speed without sensor');
 h.emitGPS({latitude:52,longitude:21.0095,accuracy:8,speed:3});
 assert.equal(h.element('hgProNavSpeed').textContent,'11');
 assert.ok(Number.parseFloat(h.element('hgProNavProgress').style.width)>80);
 h.api.stopNavigation();
});
test('GPS is projected onto road segments even when route vertices are far apart',()=>{
 const h=harness();
 // Highway-like long straight section: midpoint is ~340m from either vertex
 // but 0m from the actual road. No false off-route recalculation.
 h.api.setRoute({geometry:{coordinates:[[21,52],[21.01,52]]},distance:685,duration:65,
  legs:[{steps:[{maneuver:{type:'depart',location:[21,52]}}]}]},'Cel');
 const point={lat:52,lon:21.005};
 assert.ok(h.api.nearestRouteDistance(point)<3,'GPS near line must not be treated as off route');
 assert.ok(h.api.routeRemaining(point)>300&&h.api.routeRemaining(point)<390,'remaining distance is roughly half');
});

test('Driving screen has white ETA card, single exit X and optional controls',()=>{
 const style=fs.readFileSync('www/healthgo-drive-ui.css','utf8');
 for(const id of ['hgProNavTurnDistance','hgProNavStreet','hgProNavTime','hgProNavProgress',
  'hgProNavProgressTrack','hgProNavSpeed','hgProNavOptions','hgProNavDistance']){
  assert.match(html,new RegExp('id="'+id+'"'),'missing '+id);
 }
 assert.match(html,/aria-label="Zakończ prowadzenie i wróć do mapy"/);
 assert.match(style,/background:#176ff1!important/);
 assert.match(style,/background:rgba\(255,255,255,\.99\)!important/);
 assert.match(style,/\.hg-drive-progress-fill/);
 assert.match(style,/\.hg-drive-options:not\(\[open\]\) \.hg-pro-nav-buttons\{display:none!important/);
 assert.match(html,/healthgo-drive-ui\.css\?v=1/);
 assert.match(html,/healthgo-map-pro\.js\?v=6/);
});
test('Voice and follow controls are adjustable; permission remains opt-in',()=>{
 const h=harness();
 assert.equal(h.api.toggleFollow(),false);
 assert.equal(h.api.toggleVoice(),false,'speech synthesis unavailable in the harness');
 assert.match(js,/navigator\.geolocation\.watchPosition\(positionUpdate/);
 assert.doesNotMatch(js,/navigator\.geolocation\.getCurrentPosition/);
 assert.match(js,/document\.addEventListener\('visibilitychange'/);
 assert.match(html,/Nie obsługuj|nie obsługuj telefonu/);
});
