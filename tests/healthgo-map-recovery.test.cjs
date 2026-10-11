'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync('www/healthgo-map-recovery.js','utf8');
function harness(hostname='minek1522icloud-beep.github.io'){
 const messages=[],tiles=[],layers=[],head=[],listeners=[],recoveryPanel={hidden:true},copy={textContent:''};
 const map={eachLayer(fn){layers.slice().forEach(fn);},removeLayer(layer){layers.splice(layers.indexOf(layer),1);},
  invalidateSize(){this.invalidated=true;}};
 const doc={getElementById(id){return id==='hgMapRecoveryPanel'?recoveryPanel:id==='hgMapRecoveryText'?copy:null;},
  querySelector(){return null;},createElement(tag){return {tagName:tag.toUpperCase(),dataset:{}};},
  head:{appendChild(node){head.push(node);if(node.tagName==='SCRIPT'){host.L=leaflet;node.onload();}}}};
 const leaflet={TileLayer:function(){},
  tileLayer(url,options){const layer=Object.create(leaflet.TileLayer.prototype);
   layer.url=url;layer.options=options;layer.handlers={};layer.on=function(n,cb){this.handlers[n]=cb;return this;};
   layer.addTo=function(target){layers.push(this);return this;};
   tiles.push(layer);return layer;}};
 const host={location:{hostname,protocol:hostname==='localhost'?'http:':'https:'},
  setTimeout(fn){return 1;},clearTimeout(){},healthGoMapInstance:()=>map,
  initHealthGoMap(){this.initCalls=(this.initCalls||0)+1;},
  mapStatus(s){messages.push(s);}};
 vm.runInNewContext(script,{window:host,document:doc,Promise,Map,Number,Object,Array}, {filename:'map-recovery.js'});
 return {host,document:doc,leaflet,map,layers,tiles,head,messages,recoveryPanel,copy};
}
test('hosted mobile map uses real OSM tiles and correctly credits OSM',()=>{
 const h=harness(),api=h.host.HealthGoMapRecovery;
 assert.equal(api.hosted(),true);
 assert.match(api.tileUrl(),/^https:\/\/tile\.openstreetmap\.org/);
 assert.match(api.tileAttribution(),/OpenStreetMap/);
 const local=harness('localhost');
 assert.equal(local.host.HealthGoMapRecovery.hosted(),false);
 assert.match(local.host.HealthGoMapRecovery.tileUrl(),/^\/map-tiles/);
});
test('three failed OSM tile requests trigger Esri fallback rather than blank map',()=>{
 const h=harness(),api=h.host.HealthGoMapRecovery;h.host.L=h.leaflet;
 const layer=h.leaflet.tileLayer(api.tileUrl(),{maxZoom:19}).addTo(h.map);
 api.attach(layer,h.map);
 layer.handlers.tileerror();layer.handlers.tileerror();
 assert.equal(h.tiles.length,1);
 layer.handlers.tileerror();
 assert.equal(h.tiles.length,2);
 assert.match(h.tiles[1].url,/server\.arcgisonline\.com/);
 assert.equal(h.layers.includes(layer),false);
 assert.equal(h.layers.includes(h.tiles[1]),true);
 assert.equal(h.recoveryPanel.hidden,false);
 h.tiles[1].handlers.tileload();
 assert.equal(h.recoveryPanel.hidden,true);
});
test('manual retry resets failing source and replaces map tile layer',()=>{
 const h=harness(),api=h.host.HealthGoMapRecovery;h.host.L=h.leaflet;
 const first=h.leaflet.tileLayer(api.tileUrl(),{maxZoom:19}).addTo(h.map);
 api.retry();
 assert.equal(h.tiles.length,2);
 assert.match(h.tiles[1].url,/tile\.openstreetmap\.org/);
 assert.equal(h.layers.length,1);
 assert.equal(h.recoveryPanel.hidden,false);
});
test('a missing primary Leaflet loads a secondary CDN instead of crashing',async()=>{
 const h=harness(),api=h.host.HealthGoMapRecovery;
 const result=await api.loadLeaflet();
 assert.equal(result,true);
 assert.equal(h.host.L,h.leaflet);
 assert.equal(h.head.filter(x=>x.tagName==='SCRIPT').length,1);
 assert.equal(h.head.filter(x=>x.tagName==='LINK').length,1);
 assert.match(h.head.find(x=>x.tagName==='SCRIPT').src,/cdn\.jsdelivr\.net\/npm\/leaflet/);
});
test('recovery UI and CSP rules are wired into the real application',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(html,/id="hgMapRecoveryPanel"/);
 assert.match(html,/HealthGoMapRecovery\.retry\(\)/);
 assert.match(html,/window\.HealthGoMapRecovery\?\.loadLeaflet/);
 assert.match(html,/https:\/\/cdn\.jsdelivr\.net/);
 assert.ok(html.indexOf('healthgo-map-recovery.js?v=2')<html.indexOf('healthgo-map-v2.js?v=5'));
 assert.match(fs.readFileSync('www/healthgo-map-v2.js','utf8'),/HealthGoMapRecovery\?\.tileUrl/);
});
