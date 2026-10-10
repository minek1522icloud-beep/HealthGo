'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-map4.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const mapJS=fs.readFileSync('www/healthgo-map-v2.js','utf8');

function harness(){
 const store=new Map(),nodes=new Map(),calls=[];
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{id,hidden:false,value:'',textContent:'',checked:false,children:[],
   replaceChildren(){this.children=[]},appendChild(e){this.children.push(e);return e},
   addEventListener(){},setAttribute(){},classList:{add(){},remove(){}}});
  return nodes.get(id);
 };
 const document={readyState:'loading',hidden:false,addEventListener(){},getElementById:node,
  createElement:tag=>({...node('tag-'+tag+'-'+nodes.size),tagName:tag})};
 const window={addEventListener(){},HealthGoServices:{state:{uid:'u1'}},HealthGoMapV2:{getRecentPosition(){return null},chooseMode(){},toggle(){}}};
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const leaflet={getCenter:()=>({lat:52.2,lng:21.01}),removeLayer(){}};
 const L={layerGroup(){return{addTo(){return this}}},polyline(){return{addTo(){return this},bindPopup(){}}}};
 const weather={current:{temperature_2m:19.3,relative_humidity_2m:60,precipitation:0,wind_speed_10m:8,weather_code:2,time:'2026-10-09T12:00'},
  hourly:{time:['2026-10-09T12:00','2026-10-09T13:00'],temperature_2m:[19,20],precipitation_probability:[20,30]}};
 const fetch=async (url,opts)=>{
  calls.push({url:String(url),options:opts});
  if(String(url).includes('open-meteo'))return {ok:true,json:async()=>weather};
  return {ok:true,json:async()=>({elements:[{type:'way',geometry:[{lat:52.2,lon:21},{lat:52.201,lon:21.01}],tags:{name:'Remont ulicy'}}]})};
 };
 vm.runInNewContext(source,{document,window,localStorage,healthGoMap:leaflet,L,fetch,
  setTimeout:()=>1,clearTimeout(){},AbortController:class{constructor(){this.signal={}}abort(){}},
  URLSearchParams,Date,Math,Number,JSON,String,console});
 return {api:window.HealthGoMap4,node,calls,store,window};
}

test('Map 4 weather, navigation and saved UI exists without MapLibre 3D',()=>{
 new vm.Script(source);
 for(const name of ['route','weather','saved','settings'])assert.match(html,new RegExp('data-map-panel="'+name+'"'));
 for(const id of ['hg4WeatherCurrent','hg4WeatherHours','hg4WeatherStatus','hg4SavedRoutes','hg4WorksStatus','hg4Theme','hg4Voice'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/healthgo-map4\.js\?v=2/);
 assert.match(html,/https:\/\/api\.open-meteo\.com/);
 assert.match(mapJS,/alternatives=true/);
 assert.doesNotMatch(html,/id="hg3DButton"|id="hg3DMap"|id="hgProNav3D"/);
 assert.doesNotMatch(source,/maplibre|3D building/gi);
});

test('Weather on map center uses actual Open-Meteo response, never requests GPS',async()=>{
 const h=harness();
 assert.equal(await h.api.refreshWeather(),true);
 assert.equal(h.calls.length,1);
 assert.match(h.calls[0].url,/api\.open-meteo\.com\/v1\/forecast/);
 assert.match(h.calls[0].url,/latitude=52\.2000/);
 assert.match(h.node('hg4WeatherCurrent').children[0].children[1].children[0].textContent,/19°C/);
 assert.equal(h.node('hg4WeatherHours').children.length,2);
 assert.match(h.node('hg4WeatherStatus').textContent,/Open-Meteo/);
 assert.match(source,/map\(\)\?\.getCenter/);
});

test('Crowdsourced roadworks never claim live traffic or hide missing feed',async()=>{
 const h=harness();
 assert.equal(await h.api.refreshWorks(),true);
 assert.equal(h.calls.length,1);
 assert.match(h.calls[0].url,/overpass-api\.de/);
 assert.match(h.node('hg4WorksStatus').textContent,/NIE są korki na żywo/);
 assert.match(source,/Brak oznaczonych remontów/);
 h.api.clearWorks();
 assert.match(h.node('hg4WorksStatus').textContent,/wyłączona/);
});

test('Route bookmarks are account-specific and contain no GPS coordinates',()=>{
 const h=harness();h.node('mapV2RouteFrom').value='';h.node('mapV2RouteTo').value='Park';
 assert.equal(h.api.saveCurrentRoute(),true);
 const saved=JSON.parse(h.store.get('healthgo.map4.routes.u1'));
 assert.equal(saved[0].to,'Park');
 assert.equal(saved[0].from,'');
 assert.equal(JSON.stringify(saved).includes('latitude'),false);
 h.window.HealthGoServices.state.uid='u2';
 assert.equal(h.api.savedRoutes().length,0);
});

test('Voice, navigation appearance and user preferences are saved per account',()=>{
 const h=harness();
 assert.equal(h.api.saveSettings({theme:'dark',voice:true,follow:false,mode:'bike',avoidMotorways:true}),true);
 const p=h.api.getSettings();
 assert.equal(p.theme,'dark');assert.equal(p.voice,true);assert.equal(p.follow,false);
 assert.equal(p.avoidMotorways,true);assert.equal(p.mode,'bike');
 h.window.HealthGoServices.state.uid='u2';
 assert.equal(h.api.getSettings().theme,'auto');
 assert.equal(h.api.getSettings().voice,true);
});
