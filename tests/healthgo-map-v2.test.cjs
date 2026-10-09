'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-map-v2.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const css=fs.readFileSync('www/healthgo-map-v2.css','utf8');
const workflow=fs.readFileSync('.github/workflows/mobile-pages.yml','utf8');

test('Map 2.0 ships five real control panels plus searchable existing Leaflet map',()=>{
 for(const id of ['healthgoMap','mapV2RouteTo','mapV2RouteOutput','mapV2Favorites','mapV2Activities','mapV2TrackState','mapV2MeasureHud','mapV2MeasureDistance','mapV2MeasureHint','mapV2SpaciousButton'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const p of ['route','layers','favorites','activity','tools'])
  assert.match(html,new RegExp('data-map-panel="'+p+'"'));
 assert.match(html,/window\.HealthGoMapV2\?\.mount\(\)/);
 assert.match(html,/healthgo-map-v2\.js\?v=1/);
 assert.match(html,/healthgo-map-v2\.css\?v=1/);
 assert.match(css,/#map \.map-v2-panel\[hidden\]/);
 assert.match(css,/#map \.map-v2-measure-hud\[hidden\]/);
 assert.match(css,/map-v2-spacious \.map-categories/);
 assert.match(html,/OpenStreetMap/);
 assert.match(workflow,/healthgo-map-v2\.test\.cjs/);
});

test('Map search results expose real route and save-place actions without faking destinations',()=>{
 assert.match(html,/window\.HealthGoMapV2\.savePlace\(\{name,lat:p\.lat,lon:p\.lon\}\)/);
 assert.match(html,/window\.HealthGoMapV2\.selectDestination\(name,p\.lat,p\.lon\)/);
 assert.match(html,/https:\/\/router\.project-osrm\.org/);
 assert.match(html,/https:\/\/server\.arcgisonline\.com/);
 assert.match(html,/współrzędne startu i celu trafią do zewnętrznej usługi/);
});

test('Map module parses and requests GPS only after a user action',()=>{
 new vm.Script(source,{filename:'healthgo-map-v2.js'});
 assert.doesNotMatch(source,/getCurrentPosition\([^)]*\)\s*;/);
 assert.match(source,/function locateOptIn\(\)/);
 assert.match(source,/async function planRoute\(\)/);
 assert.match(source,/navigator\.geolocation\.watchPosition\(/);
 assert.match(source,/document\.addEventListener\('visibilitychange'/);
 assert.match(source,/window\.addEventListener\('pagehide'/);
});

function harness(){
 const storage=new Map();
 const nodes=new Map();
 const classes=()=>({add(){},remove(){},toggle(){}});
 const node=(id)=>{
  if(!nodes.has(id))nodes.set(id,{
   id,textContent:'',value:'',hidden:false,classList:classes(),children:[],
   appendChild(child){this.children.push(child);return child;},
   replaceChildren(){this.children=[];},
   addEventListener(){},
   setAttribute(){},
   querySelectorAll(){return[];},
   invalidateSize(){}
  });
  return nodes.get(id);
 };
 const document={
  readyState:'loading',hidden:false,
  addEventListener(){},
  getElementById:node,
  querySelectorAll:()=>[],
  createElement:tag=>({...node('new-'+tag+'-'+nodes.size),tagName:tag})
 };
 const map={
  handlers:{},layers:new Set(),
  on(kind,handler){this.handlers[kind]=handler;return this;},
  off(kind,handler){if(this.handlers[kind]===handler)delete this.handlers[kind];return this;},
  invalidateSize(){},
  removeLayer(layer){this.layers.delete(layer);return this;},
  emitClick(lat,lng){this.handlers.click?.({latlng:{lat,lng}});}
 };
 const layer=()=>({
  addTo(m){m.layers.add(this);return this;}
 });
 const L={circleMarker:()=>layer(),polyline:()=>layer()};
 const locationCalls={current:0,tracking:0};
 const navigator={geolocation:{
  getCurrentPosition(){locationCalls.current++;},
  watchPosition(){locationCalls.tracking++;return 1;},
  clearWatch(){}
 }};
 const window={addEventListener(){},HealthGoServices:{state:{uid:'user-a'}}};
 const localStorage={
  getItem:k=>storage.get(k)||null,
  setItem:(k,v)=>storage.set(k,v),
  removeItem:k=>storage.delete(k)
 };
 vm.runInNewContext(source,{document,window,navigator,localStorage,console,setTimeout,clearTimeout,URLSearchParams,Date,Number,Math,JSON,String,encodeURIComponent,AbortController,healthGoMap:map,L});
 return {window,storage,node,locationCalls,map};
}
test('No location tracking starts at map load; favorites are account-specific',()=>{
 const app=harness();
 assert.equal(app.locationCalls.current,0);
 assert.equal(app.locationCalls.tracking,0);
 assert.equal(app.window.HealthGoMapV2.savePlace({name:'Park',lat:52.21,lon:21.01}),true);
 assert.equal(app.window.HealthGoMapV2.savePlace({name:'Park',lat:52.21,lon:21.01}),false,'deduplicated');
 const one=JSON.parse(app.storage.get('healthgo.map2.favorites.user-a'));
 assert.equal(one.length,1);
 app.window.HealthGoServices.state.uid='user-b';
 app.window.HealthGoMapV2.toggle('favorites');
 assert.equal(app.storage.has('healthgo.map2.favorites.user-b'),false);
 assert.equal(app.locationCalls.current,0);
 assert.equal(app.locationCalls.tracking,0);
});

test('Distance measurement uses map taps without GPS or persisting location',()=>{
 const app=harness(),api=app.window.HealthGoMapV2;
 assert.equal(api.startMeasure(),true);
 assert.equal(app.node('mapV2MeasureHud').hidden,false);
 assert.equal(app.node('mapV2MeasureDistance').textContent,'0 m');
 app.map.emitClick(52.2,21.01);
 assert.equal(app.node('mapV2MeasureDistance').textContent,'0 m');
 app.map.emitClick(52.2,21.02);
 assert.match(app.node('mapV2MeasureDistance').textContent,/^6[0-9]{2} m$/);
 assert.equal(app.locationCalls.current,0);
 assert.equal(app.locationCalls.tracking,0);
 assert.equal(app.storage.size,0,'map taps are not saved');
 api.undoMeasure();
 assert.equal(app.node('mapV2MeasureDistance').textContent,'0 m');
 app.map.emitClick(52.2,21.02);
 assert.ok(app.map.layers.size>0);
 api.clearMeasure();
 assert.equal(app.node('mapV2MeasureDistance').textContent,'0 m');
 assert.equal(app.map.layers.size,0);
 api.stopMeasure();
 assert.equal(app.node('mapV2MeasureHud').hidden,true);
 assert.equal(app.map.handlers.click,undefined);
});

test('Opening other map tools stops measurement and spacious mode is reversible',()=>{
 const app=harness(),api=app.window.HealthGoMapV2;
 assert.equal(api.toggleSpacious(),true);
 assert.equal(app.node('mapV2SpaciousButton').textContent,'▤ Pokaż filtry mapy');
 assert.equal(api.toggleSpacious(),false);
 assert.equal(app.node('mapV2SpaciousButton').textContent,'▣ Więcej miejsca na mapę');
 api.startMeasure();
 app.map.emitClick(52.2,21);
 api.toggle('favorites');
 assert.equal(app.map.handlers.click,undefined);
 assert.equal(app.node('mapV2MeasureHud').hidden,true);
 assert.equal(app.node('mapV2MeasureDistance').textContent,'0 m');
});
test('Traffic, weather and 3D are identified as unavailable until real feeds exist',()=>{
 assert.match(source,/Warstwa korków wymaga zewnętrznego dostawcy/);
 assert.match(source,/Radar i ostrzeżenia pogodowe wymagają aktualnego źródła/);
 assert.match(source,/Widok 3D wymaga osobnego silnika/);
 assert.match(source,/Bez zgody na GPS/);
 assert.match(source,/Nie wyświetlam zmyślonego czasu/);
});
