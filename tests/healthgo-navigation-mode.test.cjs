'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('www/healthgo-navigation-mode.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
function mount(store=new Map(),uid='alpha'){
 const buttons=['2d','3d'].map(x=>{
  const cls=new Set();
  return {dataset:{hgView:x},attrs:{},classList:{toggle(k,on){if(on)cls.add(k);else cls.delete(k);},contains(k){return cls.has(k)}},
   setAttribute(k,v){this.attrs[k]=v}};
 });
 let click;const fields=new Map();
 const switcher={buttons,attrs:{},setAttribute(k,v){this.attrs[k]=v},
  querySelectorAll(){return buttons;},addEventListener(name,callback){if(name==='click')click=callback}};
 const node=id=>{if(id==='hgViewModeSwitch')return switcher;if(!fields.has(id))fields.set(id,{hidden:true,textContent:''});return fields.get(id)};
 const document={getElementById:node};
 const storeAPI={getItem:k=>store.get(k)||null,setItem:(k,v)=>{store.set(k,v)}};
 const layers=[{id:'family'},{id:'location'},{id:'places'}],visible=new Set(layers);
 const map={hasLayer:l=>visible.has(l),removeLayer(l){visible.delete(l);},addLayer(l){visible.add(l);}};
 const signals={begin:0,stop:0,update:0,route:0};
 const live={begin(route){signals.begin++;signals.lastRoute=route},stop(){signals.stop++},update(pos){signals.update++;signals.position=pos},setRoute(){signals.route++}};
 const window={HealthGoServices:{state:{uid}},healthGoMapInstance:()=>map,HealthGoNavigationLive:live};
 vm.runInNewContext(script,{window,document,localStorage:storeAPI,
  healthGoFamilyLayer:layers[0],healthGoLocationLayer:layers[1],healthGoPlacesLayer:layers[2]},{filename:'healthgo-navigation-mode.js'});
 return {api:window.HealthGoNavigationMode,window,fields,layers,visible,signals,click,buttons,store};
}
const route={geometry:{coordinates:[[21,52],[21.01,52.02]]}};
test('starts with saved 3D preference but loads no fake location before real GPS',()=>{
 const h=mount();
 assert.equal(h.api.getMode(),'3d');
 assert.equal(h.signals.begin,0);
 assert.equal(h.signals.update,0);
 h.api.begin(route);
 assert.equal(h.signals.begin,1);
 assert.equal(h.signals.update,0);
 assert.deepEqual(Array.from(h.visible).length,0,'family and other map markers are hidden');
 assert.match(h.fields.get('hgLiveMapStatus').textContent,/3D/);
 assert.equal(h.buttons[1].attrs['aria-pressed'],'true');
 h.api.stop();
 assert.equal(h.visible.size,3,'all hidden map layers are restored on exit');
});
test('switch 3D > 2D > 3D without stopping the GPS navigation session',()=>{
 const h=mount(),gps={coords:{latitude:52,longitude:21,accuracy:10,heading:80}};
 h.api.begin(route);
 h.api.rememberFix(gps);
 const before=h.signals.stop;
 assert.equal(h.api.setMode('2d'),true);
 assert.equal(h.api.getMode(),'2d');
 assert.equal(h.api.isRunning(),true);
 assert.equal(h.signals.stop,before+1);
 assert.equal(h.buttons[0].attrs['aria-pressed'],'true');
 assert.equal(h.store.get('healthgo.navigation.view.v1.alpha'),'2d');
 assert.equal(h.api.setMode('3d'),true);
 assert.equal(h.signals.begin,2);
 assert.equal(h.signals.update,1,'3D resumes from the previously authorized real GPS fix');
 assert.equal(h.signals.position,gps);
 assert.equal(h.store.get('healthgo.navigation.view.v1.alpha'),'3d');
 h.api.stop();
});
test('3D unavailable falls back to working 2D without erasing saved preference',()=>{
 const h=mount();
 h.api.begin(route);
 h.api.fallback();
 assert.equal(h.api.getMode(),'2d');
 assert.equal(h.api.isRunning(),true);
 assert.equal(h.api.getPreference(),'3d');
 assert.match(h.fields.get('hgLiveMapStatus').textContent,/2D/);
});
test('saved preference belongs only to the account and never stores GPS coordinates',()=>{
 const store=new Map();
 let h=mount(store,'alpha');
 h.api.setMode('2d');
 assert.equal(h.api.getPreference(),'2d');
 const second=mount(store,'beta');
 assert.equal(second.api.getMode(),'3d');
 assert.equal(mount(store,'alpha').api.getMode(),'2d');
 const text=JSON.stringify([...store.entries()]);
 assert.doesNotMatch(text,/latitude|longitude|accuracy|coords/);
});
test('real mobile UI offers accessible buttons and does not allow manual origin',()=>{
 assert.match(html,/id="hgViewModeSwitch"/);
 assert.match(html,/data-hg-view="2d"/);
 assert.match(html,/data-hg-view="3d"/);
 assert.match(html,/healthgo-navigation-mode\.js\?v=2/);
 assert.match(html,/healthgo-navigation-mode\.css\?v=3/);
 assert.match(html,/id="hgGpsConsentAction"/);
 assert.doesNotMatch(html,/id="mapV2RouteFrom"|id="hgRouteManualOrigin"/);
 assert.match(fs.readFileSync('www/healthgo-map-pro.js','utf8'),/HealthGoNavigationMode\?\.begin/);
 assert.match(fs.readFileSync('www/healthgo-navigation-live.js','utf8'),/pitch:52/);
});

test('iPhone map fills the screen during GPS, without leaving blank bottom space',()=>{
 const css=fs.readFileSync('www/healthgo-navigation-mode.css','utf8');
 assert.match(css,/body\.hg-navigation-active #map\.page\.active/);
 assert.match(css,/height:100dvh!important/);
 assert.match(css,/overflow:visible!important/);
 assert.match(css,/map-workspace\.map-pro-navigating/);
 assert.match(css,/map-canvas-wrap/);
 assert.match(css,/hg-live-perspective/);
});

test('compact blue location arrow is consistent between 2D and 3D, without changing GPS routing',()=>{
 const follow=fs.readFileSync('www/healthgo-navigation-follow-v1.js','utf8');
 const pitched=fs.readFileSync('www/healthgo-navigation-live.js','utf8');
 const followCss=fs.readFileSync('www/healthgo-navigation-follow-v1.css','utf8');
 const cameraCss=fs.readFileSync('www/healthgo-navigation-mode.css','utf8');
 assert.match(follow,/iconSize:\[36,40\],iconAnchor:\[18,20\]/);
 assert.match(follow,/viewBox="0 0 40 44" width="36" height="40"/);
 assert.match(pitched,/width="34" height="38" viewBox="0 0 40 44"/);
 assert.match(follow,/fill="#4285f4"/);
 assert.match(pitched,/fill="#4285f4"/);
 assert.match(followCss,/width:36px!important;height:40px!important/);
 assert.match(cameraCss,/\.hg-live-car\{width:34px;height:38px/);
 assert.match(pitched,/marker\?\.setLngLat\(\[p.lon,p.lat\]\)/);
 assert.match(follow,/arrow\.setLatLng\(\[point.lat,point.lon\]\)/);
});

test('syntax checker uses the updated compact GPS arrow stylesheet',()=>{
 const checker=fs.readFileSync('scripts/check-syntax.cjs','utf8');
 assert.match(checker,/healthgo-navigation-follow-v1\.css\?v=2/);
});
