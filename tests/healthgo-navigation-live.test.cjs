'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('www/healthgo-navigation-live.js','utf8');
const pro=fs.readFileSync('www/healthgo-map-pro.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const css=fs.readFileSync('www/healthgo-navigation-live.css','utf8');
function harness(){
 const nodes=new Map(),calls=[],classes=new Set();
 const element=id=>{
  if(!nodes.has(id))nodes.set(id,{id,hidden:true,textContent:'',dataset:{},classList:{
   toggle(n,value){if(value)classes.add(n);else classes.delete(n)},add(n){classes.add(n)}
  }});
  return nodes.get(id);
 };
 const document={getElementById:element,querySelector(){return null},head:{appendChild(){}},body:{classList:{toggle(){}}},
  createElement:()=>({dataset:{},className:'',innerHTML:'',setAttribute(){}})};
 const window={};
 const fetch=async url=>{
  calls.push(String(url));
  return {ok:true,json:async()=>({current:{temperature_2m:18.7,precipitation:.4,weather_code:3,wind_speed_10m:9}})};
 };
 const Ctrl=class{constructor(){this.signal={}}abort(){}};
 vm.runInNewContext(src,{window,document,fetch,console,
  setTimeout:()=>1,clearTimeout(){},AbortController:Ctrl,
  URLSearchParams,Number,Math,Date,String});
 return {api:window.HealthGoNavigationLive,element,calls,classes};
}
test('Pitched guidance map uses an on-demand MapLibre 6 ES module and real OSM tiles',()=>{
 new vm.Script(src);
 assert.match(src,/maplibre-gl@6\.11\.2\/dist\/maplibre-gl\.mjs/);
 assert.match(src,/pitch:52/);
 assert.match(src,/https:\/\/tile\.openstreetmap\.org/);
 assert.match(src,/container:\s*'hgNavigationPerspective'|container,style:colorStyle/);
 assert.match(css,/#map #hgNavigationPerspective\[hidden\]/);
 assert.match(css,/\.hg-live-loading\{visibility:hidden!important\}/);
 assert.match(src,/new lib\.Marker\(/);
 assert.match(src,/svg width="52" height="62"/);
 assert.doesNotMatch(src,/navigator\.geolocation\.watchPosition|navigator\.geolocation\.getCurrentPosition/);
});
test('Live map is not started until GPS has a valid position',async()=>{
 const h=harness();
 const route={geometry:{coordinates:[[21,52],[21.01,52.01]]}};
 assert.equal(h.api.begin(route),true);
 assert.equal(h.calls.length,0,'no weather request without location');
 h.api.update({coords:{latitude:52,longitude:21,accuracy:180,speed:8,heading:70}});
 assert.equal(h.calls.length,0,'weak GPS ignored');
 h.api.stop();
 assert.equal(h.element('hgNavigationPerspective').hidden,true);
});
test('Real weather is requested with coordinates from authorized GPS, not placeholders',async()=>{
 const h=harness();
 h.api.begin({geometry:{coordinates:[[21,52],[21.01,52.01]]}});
 await h.api.loadWeather({lat:52.2,lon:21.01});
 assert.equal(h.calls.length,1);
 assert.match(h.calls[0],/api\.open-meteo\.com\/v1\/forecast/);
 assert.match(h.calls[0],/latitude=52\.200/);
 assert.match(h.element('hgLiveWeather').textContent,/19°C/);
 assert.match(h.element('hgLiveWeather').textContent,/Open-Meteo/);
 assert.equal(h.element('hgLiveWeather').hidden,false);
 h.api.stop();
 assert.equal(h.element('hgLiveWeather').hidden,true);
});
test('Map gets a heading from actual movement but not a made-up fixed direction',()=>{
 const h=harness();
 const heading=h.api.bearing({lat:52.2,lon:21},{lat:52.2,lon:21.01});
 assert.ok(heading>80&&heading<100,'east movement is about 90°');
 assert.match(src,/Number\(c\.accuracy\)/);
 assert.match(src,/distance>Math\.max\(12,accuracy\*1\.3\)/);
 assert.match(src,/if\(Number\.isFinite\(heading\)\)lastHeading=heading/);
});
test('Guidance connects live camera, voice prompts and real OSRM rerouting',()=>{
 assert.match(pro,/HealthGoNavigationLive\?\.stop\?/);
 assert.match(pro,/HealthGoNavigationLive\?\.update\?/);
 assert.match(pro,/HealthGoNavigationLive\?\.stop\?/);
 assert.match(pro,/HealthGoNavigationLive\?\.setRoute\?/);
 assert.match(pro,/router\.project-osrm\.org\/route\/v1\/driving/);
 assert.match(pro,/offRouteTicks>=3/);
 assert.match(pro,/Date\.now\(\)-lastReroute>90000/);
 assert.match(pro,/Number\(c\.accuracy\)<35/);
 assert.match(pro,/speechSynthesis\.speak\(u\)/);
 assert.match(html,/id="hgNavigationPerspective"/);
 assert.match(html,/id="hgLiveWeather"/);
 assert.match(html,/healthgo-navigation-live\.js\?v=1/);
 assert.match(html,/healthgo-navigation-live\.css\?v=1/);
});
