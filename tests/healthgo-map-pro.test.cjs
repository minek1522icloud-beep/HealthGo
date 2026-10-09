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
  if(!nodes.has(id))nodes.set(id,{id,hidden:true,textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){}});
  return nodes.get(id);
 };
 const document={hidden:false,getElementById:element,addEventListener(){}};
 let starts=0,stops=0,onPosition=null;
 const navigator={geolocation:{watchPosition(cb){starts++;onPosition=cb;return 1},clearWatch(){stops++}}};
 const window={addEventListener(){},HealthGoMapV2:{close(){},resizeViewport(){},rememberPosition(){}},speechSynthesis:{cancel(){}}};
 const map={setView(){},getZoom(){return 16},removeLayer(){}};
 vm.runInNewContext(js,{document,window,navigator,healthGoMap:map,console,Date,Math,Number,String});
 return {api:window.HealthGoMapPro,element,emitGPS(coords){onPosition?.({coords})},counts(){return {starts,stops}}};
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
 assert.match(h.element('hgProNavEta').textContent,/Przyjazd/);
 assert.match(h.element('hgProNavDistance').textContent,/min/);
 h.api.leaveMap();
 assert.equal(h.counts().stops,1);
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
