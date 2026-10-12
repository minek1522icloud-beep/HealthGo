'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('www/index.html');
const live=read('www/healthgo-navigation-live.js');
const overlaySource=read('www/healthgo-route-3d-overlay.js');
const extrasSource=read('www/healthgo-map-extras.js');
const mapSource=read('www/healthgo-map-v2.js');
test('Map toolbar contains exactly Mapa, Pogoda, Nawigacja and previous large launcher is hidden',()=>{
 const nav=html.match(/<nav class="map-v2-bottom"[^>]*>([\s\S]*?)<\/nav>/);
 assert.ok(nav,'missing map function bar');
 const tabs=[...nav[1].matchAll(/data-panel="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(tabs,['map','weather','route']);
 assert.match(html,/id="hgMapExtrasToggle"/);
 assert.match(html,/id="hgMapExtrasPanel"/);
 assert.match(read('www/healthgo-map-extras.css'),/#map #hgNavigationQuick\{display:none!important\}/);
 assert.match(html,/➤ Rozpocznij nawigację/);
});
test('all new on-demand map controls are wired and no panorama image is fabricated',()=>{
 for(const action of ['satellite','street','streetview','paths','treasures','saved','treasurePage','buildings','elevation','radar','weather'])
  assert.match(html,new RegExp('data-hg-map-action="'+action+'"'));
 assert.match(extrasSource,/map_action=pano&viewpoint=/);
 assert.match(extrasSource,/https:\/\/overpass-api\.de\/api\/interpreter/);
 assert.match(extrasSource,/https:\/\/api\.open-meteo\.com\/v1\/elevation/);
 assert.match(extrasSource,/healthgo\.map\.buildings\.v1/);
 assert.match(extrasSource,/fill-extrusion/);
 assert.doesNotMatch(extrasSource,/bulkDownload|tilePrefetch|fetchAllTiles|mbtiles/i);
 for(const file of ['www/healthgo-route-3d-overlay.css','www/healthgo-map-extras.css'])assert.ok(fs.statSync(file).size>100);
});
test('3D overlay projects the actual supplied route, updates on reroute and destroys itself on exit',()=>{
 const elements=[],host={clientWidth:500,clientHeight:360,children:[],appendChild(el){this.children.push(el);}};
 function element(tag){
  const x={tag,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=String(v);},appendChild(y){this.children.push(y);},remove(){x.removed=true}};
  elements.push(x);return x;
 }
 const document={getElementById:id=>id==='hgNavigationPerspective'?host:null,createElementNS:(ns,tag)=>element(tag)};
 const subs={};
 const map={on(n,fn){subs[n]=fn},off(n){delete subs[n]},project(coords){return {x:coords[0]*20+10,y:coords[1]*30+15}},
  getCanvas(){return{clientWidth:500,clientHeight:360}}};
 const w={requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(overlaySource,{document,window:w,Number,Math,Array,setTimeout});
 const api=w.HealthGoRoute3DOverlay,first=[[10,15],[11,16],[12,18]];
 assert.equal(api.attach(map,first),true);
 const shadows=elements.filter(x=>x.tag==='path');
 assert.equal(shadows.length,2);
 const old=shadows[1].attrs.d;
 assert.ok(old.startsWith('M'));
 assert.match(old,/L/);
 api.setRoute([[20,10],[21,12]]);
 assert.notEqual(shadows[1].attrs.d,old);
 assert.equal(api.draw(),true);
 assert.equal(typeof subs.move,'function');
 api.detach();
 assert.equal(Object.keys(subs).length,0);
 assert.ok(host.children[0].removed);
});
test('trail and elevation data helpers use real coordinates and do not invent GPS',()=>{
 const panel={addEventListener(){},hidden:true};
 const button={addEventListener(){},setAttribute(){}};
 const document={getElementById:id=>id==='hgMapExtrasPanel'?panel:id==='hgMapExtrasToggle'?button:null,addEventListener(){}};
 const w={HealthGoServices:{state:{uid:'student'}}};
 const storage={getItem(){return null},setItem(){}};
 vm.runInNewContext(extrasSource,{document,window:w,localStorage:storage,Math,Number,Date,Array,Set,URLSearchParams,setTimeout,clearTimeout});
 const points=w.HealthGoMapExtras.sampledRoute([[21,52],[21.03,52.03],[21.06,52.06]],25);
 assert.equal(points.length,25);
 assert.equal(points[0].lat,52);
 assert.equal(points[0].lon,21);
 assert.ok(Math.abs(points.at(-1).lat-52.06)<1e-7);
 assert.ok(points.every((p,i)=>i===0||p.distance>=points[i-1].distance));
 assert.doesNotMatch(extrasSource,/navigator\.geolocation\.(?:watchPosition|getCurrentPosition)/);
});
test('one real OSRM waypoint survives route setup and off-route rerouting',()=>{
 assert.match(html,/id="hgMapRouteStop"/);
 assert.match(mapSource,/const stopPromise=viaRaw\?locateByName\(viaRaw\)/);
 assert.match(mapSource,/segments\.map\(p=>encodeURIComponent\(p\[0\]\)/);
 assert.match(mapSource,/hgVia:\[via\.lon,via\.lat\]/);
 assert.match(mapSource,/getSelectedRoute:\(\)=>routeChoices\[routeChosen\]/);
 const driving=read('www/healthgo-map-pro.js');
 assert.match(driving,/route\.via/);
 assert.match(driving,/const via=Array\.isArray\(route\.via\)/);
 assert.match(driving,/c\.accuracy<=35&&meters\(point/);
 assert.match(driving,/HealthGoNavigationMode\?\.setRoute/);
});
test('offline tile bulk downloads are explicitly disabled; existing cached shell remains offline',()=>{
 assert.match(html,/Nie pobieramy masowo kafelków OSM/);
 assert.match(read('www/service-worker.js'),/const CORE=\['\.\/index\.html','\.\/manifest\.webmanifest'\]/);
 assert.doesNotMatch(extrasSource,/caches\.open|cache\.addAll/);
 assert.match(html,/healthgo-route-3d-overlay\.js\?v=1/);
 assert.match(html,/healthgo-map-extras\.js\?v=2/);
 assert.match(html,/healthgo-map-photos\.js\?v=1/);
});

test('place images are only loaded for explicit OSM Commons File tags with proper attribution',()=>{
 const js=read('www/healthgo-map-photos.js');
 new vm.Script(js,{filename:'healthgo-map-photos.js'});
 const w={};
 vm.runInNewContext(js,{window:w,document:{},AbortController,URLSearchParams,fetch:()=>{throw Error('Must not fetch at load')}});
 assert.equal(w.HealthGoMapPhotos.legalFile('File:Park_w_Warszawie.jpg'),true);
 assert.equal(w.HealthGoMapPhotos.legalFile('Category:Other images'),false);
 assert.equal(w.HealthGoMapPhotos.legalFile('https://example.com/random-photo.jpg'),false);
 assert.match(js,/extmetadata/);
 assert.match(js,/LicenseShortName/);
 assert.match(js,/commons.wikimedia.org/);
 assert.match(html,/HealthGoMapPhotos\?\.attach\?\.\(card,t,name\)/);
});
