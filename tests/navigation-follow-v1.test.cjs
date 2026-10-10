'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-navigation-follow-v1.js','utf8');
const route={geometry:{coordinates:[[19.24,50.12],[19.25,50.12],[19.26,50.12]]}};
function harness(){
 const classes=new Set(),layers=[],removed=[],frames=[];
 const markerDom={
  classList:{toggle(name,on){if(on)classes.add('marker:'+name);else classes.delete('marker:'+name)}},
  attrs:{},setAttribute(k,v){this.attrs[k]=v},
  querySelector(selector){if(selector==='.hg-follow-arrow-shape')return {style:rotation};return null}
 };
 const rotation={transform:''};
 const map={
  getZoom(){return 16},
  getSize(){return {x:400,y:800}},
  project(latlng){return {x:latlng[1]*10000,y:-latlng[0]*10000}},
  unproject(pixel){return {lat:-pixel[1]/10000,lng:pixel[0]/10000}},
  setView(center,zoom,opts){frames.push({center,zoom,opts});return this},
  removeLayer(layer){removed.push(layer);layer.removed=true}
 };
 const leaf={
  marker(latLng,opts){
   const marker={
    kind:'marker',latLng,opts,addTo(m){layers.push(this);this.map=m;return this},
    setLatLng(value){this.latLng=value},
    getElement(){return {querySelector(sel){return sel==='.hg-follow-marker'?markerDom:null}}}
   };return marker;
  },
  divIcon(opts){return {options:opts}},
  polyline(coords,opts){return {
   kind:opts.className,coords,opts,
   addTo(m){layers.push(this);this.map=m;return this},
   setLatLngs(arr){this.coords=arr},
   getLatLngs(){return this.coords}
  }}
 };
 const recenter={hidden:true};
 const document={
  body:{classList:{
   add(name){classes.add(name)},remove(name){classes.delete(name)},contains(name){return classes.has(name)}
  }},
  getElementById(id){return id==='hgFollowRecenter'?recenter:null}
 };
 const window={matchMedia(){return {matches:false}}};
 vm.runInNewContext(source,{document,window,healthGoMap:map,L:leaf,console,Date,Number,Math,String});
 return {api:window.HealthGoNavigationFollow,layers,removed,frames,classes,recenter,markerDom,rotation};
}
const fix=(lon,lat=50.12,accuracy=7,heading=null)=>({
 coords:{latitude:lat,longitude:lon,accuracy,heading,speed:null}
});
test('GPS follower is parseable and has no synthetic timer or background polling',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.doesNotMatch(source,/getCurrentPosition|watchPosition|Math\.random|setInterval/);
 assert.match(source,/return \{active,following,hasGPS:/);
});
test('GPS arrow appears only on a real fix and tracks actual latitude/longitude',()=>{
 const h=harness();
 assert.equal(h.api.begin(route),true);
 assert.equal(h.layers.filter(x=>x.kind==='marker').length,0);
 assert.equal(h.api.status().hasGPS,false);
 assert.equal(h.api.update(fix(19.241,50.12,8,95)),true);
 const marker=h.layers.find(x=>x.kind==='marker');
 assert.ok(marker,'No moving arrow marker was created');
 assert.deepEqual(Array.from(marker.latLng),[50.12,19.241]);
 assert.match(h.rotation.transform,/rotate\(95deg\)/);
 assert.equal(h.api.status().headingSource,'device');
 h.api.update(fix(19.248,50.1205,8,110));
 assert.deepEqual(Array.from(marker.latLng),[50.1205,19.248]);
 assert.equal(h.api.status().heading,110);
 assert.ok(h.frames.length>0,'map never followed GPS');
 assert.ok(h.frames[0].center[0]>50.12,'GPS position should be in lower map area, road ahead remains visible');
});
test('Route-aligned arrow before movement, then heading from actual location changes',()=>{
 const h=harness();
 h.api.begin(route);
 h.api.update(fix(19.241));
 assert.equal(h.api.status().headingSource,'route');
 assert.ok(h.api.status().heading>80&&h.api.status().heading<100);
 // Simulate device heading unavailable, but a real GPS position moves east.
 h.api.update(fix(19.246,50.12,6));
 assert.equal(h.api.status().headingSource,'movement');
 assert.ok(h.api.status().heading>80&&h.api.status().heading<100);
 assert.match(h.markerDom.attrs['aria-label'],/pomiar/);
});
test('Route ahead shortens with real GPS; passed route is dimmed and progress remains monotone',()=>{
 const h=harness();h.api.begin(route);
 h.api.update(fix(19.241));
 const ahead=h.layers.find(x=>x.kind==='hg-follow-remaining-route');
 const behind=h.layers.find(x=>x.kind==='hg-follow-passed-route');
 assert.ok(ahead&&behind);
 assert.equal(h.classes.has('hg-guidance-follow-ready'),true);
 const firstProgress=h.api.status().progressMeters;
 h.api.update(fix(19.251));
 const secondProgress=h.api.status().progressMeters;
 assert.ok(secondProgress>firstProgress+400,'route did not advance after GPS move');
 assert.ok(ahead.coords[0][1]>19.250&&ahead.coords[0][1]<19.252);
 assert.ok(behind.coords.length>=3,'passed route should retain traveled vertices');
 h.api.update(fix(19.244)); // GPS jitter backwards should not repaint path.
 assert.equal(h.api.status().progressMeters,secondProgress);
 assert.ok(ahead.coords[0][1]>19.25);
 h.api.setRoute({geometry:{coordinates:[[19.251,50.12],[19.255,50.13]]}});
 assert.equal(h.api.status().progressMeters,0,'rerouted line must reset');
});
test('No fabricated position from inaccurate, missing or invalid GPS',()=>{
 const h=harness();h.api.begin(route);
 for(const pos of [
  fix(19.241,50.12,200,90),
  {coords:{latitude:50.12,longitude:19.241,accuracy:undefined}},
  {coords:{latitude:50.12,longitude:190,accuracy:12,heading:45}},
  {coords:{latitude:NaN,longitude:19.241,accuracy:10}}
 ])assert.equal(h.api.update(pos),false);
 assert.equal(h.api.status().hasGPS,false);
 assert.equal(h.layers.filter(x=>x.kind==='marker').length,0);
 assert.equal(h.frames.length,0);
});
test('Free-look pauses follow and recenter resumes at most recent actual GPS',()=>{
 const h=harness();h.api.begin(route);
 h.api.update(fix(19.241));
 const first=h.frames.length;
 h.api.setFollowing(false);
 assert.equal(h.recenter.hidden,false);
 h.api.update(fix(19.248));
 assert.equal(h.frames.length,first);
 h.api.setFollowing(true);
 assert.equal(h.recenter.hidden,true);
 assert.ok(h.frames.length>first,'recenter should move the map');
 assert.equal(h.api.status().position.lon,19.248);
 h.api.stop();
 assert.equal(h.recenter.hidden,true);
 assert.equal(h.api.status().active,false);
 assert.equal(h.api.status().hasGPS,false);
 assert.equal(h.classes.has('hg-guidance-follow-ready'),false);
 assert.ok(h.removed.length>=3,'marker and route layers must be removed');
});
test('Projection follows long straight OSRM road segments, not just vertices',()=>{
 const h=harness();
 const p=h.api.projectOnRoute({lat:50.12,lon:19.245},route.geometry.coordinates);
 assert.ok(p.distance<1);
 assert.equal(p.index,0);
 assert.ok(p.t>.4&&p.t<.6);
 const segments=h.api.splitRoute(route.geometry.coordinates,p);
 assert.equal(segments.remaining[0][1],19.245);
 assert.equal(segments.travelled.at(-1)[1],19.245);
});
