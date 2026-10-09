'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const js=fs.readFileSync('www/healthgo-map-pro.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const mapJS=fs.readFileSync('www/healthgo-map-v2.js','utf8');
const css=fs.readFileSync('www/healthgo-map-v2.css','utf8');

test('Optional 3D map and guidance UI have responsive icons and controls',()=>{
 new vm.Script(js);
 for(const id of ['hg3DMap','hg3DButton','hg3DRefresh','hgNavStartButton',
 'hgProNavigation','hgProNavDirection','hgProNavNext','hgProNavDistance','hgProVoice','hgProFollow']){
  assert.match(html,new RegExp('id="'+id+'"'),'missing '+id);
 }
 assert.match(html,/healthgo-map-pro\.js\?v=1/);
 assert.match(html,/https:\/\/tile\.openstreetmap\.org/);
 assert.match(html,/worker-src 'self' blob:/);
 assert.match(css,/#map \.hg-pro-3d-host\[hidden\]/);
 assert.match(css,/\.hg-pro-icon/);
 assert.match(html,/<symbol id="hg-map-route"/);
 assert.match(html,/<symbol id="hg-map-layers"/);
 assert.match(html,/window\.HealthGoMapPro\?\.leaveMap\(\)/);
});

test('MapLibre data is actual OSM building footprints with honest estimated heights',()=>{
 assert.match(js,/way\["building"\]/);
 assert.match(js,/overpass-api\.de\/api\/interpreter/);
 assert.match(js,/type:'fill-extrusion'/);
 assert.doesNotMatch(js,/tiles\.openfreemap\.org/);
 const sdk=harness().api;
 const rows=sdk.buildingsToFeatures([
  {type:'way',tags:{height:'14 m'},geometry:[
   {lat:52,lon:21},{lat:52.0001,lon:21},{lat:52.0001,lon:21.0001},{lat:52,lon:21.0001}]},
  {type:'way',tags:{'building:levels':'2'},geometry:[
   {lat:52,lon:21},{lat:52.0001,lon:21},{lat:52.0001,lon:21.0001},{lat:52,lon:21.0001}]},
  {type:'node',tags:{building:'house'},geometry:[]}
 ]);
 assert.equal(rows.features.length,2);
 assert.equal(rows.features[0].properties.height,14);
 assert.equal(rows.features[0].properties.estimated,false);
 assert.equal(rows.features[1].properties.estimated,true);
 assert.equal(rows.features[1].geometry.coordinates[0].length,5,'polygons closed');
});

function harness(){
 const elems=new Map();
 const element=id=>{
  if(!elems.has(id))elems.set(id,{id,hidden:true,disabled:false,textContent:'',classList:{add(){},remove(){}},setAttribute(){}});
  return elems.get(id);
 };
 const document={hidden:false,
  getElementById:element,addEventListener(){},
  head:{appendChild(){}},querySelector(){return null},
  createElement(){return{dataset:{},setAttribute(){}}}
 };
 let starts=0,stops=0;
 const navigator={geolocation:{
  watchPosition(success,error,options){starts++;return 11;},
  clearWatch(){stops++;}
 }};
 const window={addEventListener(){},HealthGoMapV2:{close(){}},speechSynthesis:{cancel(){}}};
 const map={setView(){},invalidateSize(){},getZoom(){return 16;}};
 const vmEnv={document,window,navigator,console,setTimeout,clearTimeout,fetch(){throw Error('not expected')},
  healthGoMap:map,AbortController,URLSearchParams};
 vm.runInNewContext(js,vmEnv,{filename:'healthgo-map-pro.js'});
 return {api:window.HealthGoMapPro,element,window,document,navigator,stats(){return{starts,stops}}};
}

test('GPS navigation starts only after a route with real OSRM maneuvers',()=>{
 const app=harness(),sdk=app.api;
 assert.equal(app.stats().starts,0);
 assert.equal(sdk.startNavigation(),false);
 assert.equal(app.stats().starts,0,'cannot track without a real route');
 assert.equal(sdk.setRoute({geometry:{coordinates:[[21,52],[21.01,52.01]]},legs:[{
  steps:[{maneuver:{type:'depart',location:[21,52]},name:'Start'},
   {maneuver:{type:'turn',modifier:'right',location:[21.01,52.01]},name:'Główna'}]
 }],distance:1700,duration:400},'Park'),true);
 assert.equal(app.element('hgNavStartButton').hidden,false);
 assert.equal(sdk.startNavigation(),true);
 assert.equal(app.stats().starts,1);
 assert.equal(app.element('hgProNavigation').hidden,false);
 sdk.stopNavigation();
 assert.equal(app.stats().stops,1);
 assert.equal(app.element('hgProNavigation').hidden,true);
 sdk.clearRoute();
 assert.equal(app.element('hgNavStartButton').hidden,true);
});

test('Switching page hides navigation and releases tracking',()=>{
 const app=harness(),sdk=app.api;
 sdk.setRoute({geometry:{coordinates:[[21,52],[21.005,52.005]]},
  legs:[{steps:[{maneuver:{type:'depart',location:[21,52]}}]}]},'Cel');
 sdk.startNavigation();sdk.leaveMap();
 assert.equal(app.stats().starts,1);
 assert.equal(app.stats().stops,1);
 assert.equal(app.element('hgProNavigation').hidden,true);
});


test('Street-level zoom automatically enables the real 3D renderer with fallback',()=>{
 const sdk=harness();
 assert.equal(sdk.api.enableAuto3D(),false,'mock has no zoom event capability');
 assert.match(js,/mapLibreScript='https:\/\/unpkg\.com\/maplibre-gl@6\.11\.2\/dist\/maplibre-gl\.mjs'/);
 assert.match(js,/import\(mapLibreScript\)/,'MapLibre 6 loads as an ES module');
 assert.match(js,/if\(z<17\|\|!auto3DArmed\)return/);
 assert.match(js,/map\.on\('zoomend'/);
 assert.match(js,/if\(threeD&&gl&&gl\.getZoom\(\)<14\.8\)stop3D\(\)/);
 assert.match(html,/id="hg3DMap"/);
});
test('Regular Map 2D, privacy and older favorites remain wired',()=>{
 assert.match(mapJS,/window\.HealthGoMapPro\?\.setRoute\(route,destination\.name\)/);
 assert.match(mapJS,/window\.HealthGoMapPro\?\.clearRoute\(\)/);
 assert.match(html,/window\.HealthGoMapV2\?\.mount\(\)/);
 assert.match(mapJS,/healthgo\.map2\./);
 assert.match(js,/function center3D\(\)/);
 assert.match(js,/if\(!threeD\|\|!gl\)return false/);
 assert.match(js,/navigator\.geolocation\.getCurrentPosition\(/);
 assert.match(html,/id="hgProNavIcon"/);
 assert.match(js,/function maneuverIcon\(step\)/);
 assert.match(js,/document\.addEventListener\('visibilitychange'/);
 assert.match(js,/navigator\.geolocation\.watchPosition\(/);
 assert.match(js,/stopNavigation\(\)/);
 assert.match(html,/Nie obsługuj|nie obsługuj telefonu/);
});
