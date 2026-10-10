'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function read(file){return fs.readFileSync(path.join(__dirname,'..','www',file),'utf8')}

test('Weather UI loads last and links the true Open-Meteo panel',()=>{
 const html=read('index.html'),css=read('healthgo-weather-emerald-v5.css'),js=read('healthgo-map4.js');
 assert.ok(html.includes('healthgo-weather-emerald-v5.css?v=1'));
 assert.ok(html.indexOf('healthgo-weather-emerald-v5.css?v=1')>html.indexOf('healthgo-map-emerald-v5.css'));
 for(const id of ['hg5WeatherCity','hg5WeatherSearchButton','hg5WeatherResetButton','hg5WeatherDetails','hg4WeatherCurrent','hg4WeatherHours','hg4WeatherDaily'])
  assert.ok(html.includes('id="'+id+'"'),'Missing weather control '+id);
 assert.ok(html.includes('healthgo-map4.js?v=3'));
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(js,/api\.open-meteo\.com\/v1\/forecast/);
 assert.match(js,/nominatim\.openstreetmap\.org\/search/);
 assert.match(css,/hg5-weather-details/);
});

test('Weather extras are derived from real API fields and never from fabricated defaults',()=>{
 const js=read('healthgo-map4.js');
 for(const token of [
  'surface_pressure','wind_direction_10m','apparent_temperature',
  'precipitation_probability','sunrise','sunset','uv_index_max',
  "source:'miasto'","function searchWeatherCity()","function resetWeatherCity()",
  'Math.max(0,start)+12',"typeof v==='number'"
 ])assert.ok(js.includes(token),'Missing real weather field '+token);
 assert.match(js,/fmtValue\(rain\[j\],'%'\)/);
 assert.match(js,/fmtValue\(high\[i\],'°'\)/);
 assert.match(js,/fmtValue\(cur\.surface_pressure,' hPa'\)/);
 assert.doesNotMatch(js,/Math\.random/);
});

test('Dark detailed forecast supports small phone viewports and visible missing states',()=>{
 const css=read('healthgo-weather-emerald-v5.css');
 assert.match(css,/body\.hg-emerald #map/);
 assert.match(css,/max-width:370px/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/var\(--emerald-fg\)/);
 assert.match(css,/\.hg4-day/);
 assert.match(css,/\.hg4-hour/);
});
