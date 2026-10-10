'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function source(name){return fs.readFileSync(path.join(__dirname,'..','www',name),'utf8')}

test('Maps Emerald CSS is last and keeps real map tiles unchanged',()=>{
 const html=source('index.html'),css=source('healthgo-map-emerald-v5.css');
 assert.ok(html.includes('healthgo-map-emerald-v5.css?v=1'));
 assert.ok(html.indexOf('healthgo-map-emerald-v5.css?v=1')>html.indexOf('healthgo-ai-emerald-v3.css'));
 assert.match(css,/body\.hg-navigation-active #map/);
 assert.match(css,/hg-live-weather/);
 assert.match(css,/hg-drive-speed/);
 assert.match(css,/hg-nav-quickvoice/);
 assert.match(css,/var\(--emerald-accent\)/);
 assert.doesNotMatch(css,/\.leaflet-tile\s*\{\s*filter:/);
});

test('Navigation voice and recent places do not invent directions or GPS readings',()=>{
 const js=source('healthgo-map-v2.js'),pro=source('healthgo-map-pro.js');
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.doesNotThrow(()=>new vm.Script(pro));
 assert.match(js,/rememberDestination/);
 assert.match(js,/drawRecentDestinations/);
 assert.match(js,/saveHomeFromCenter/);
 assert.match(js,/currentUid\(\)/);
 assert.match(js,/healthgo\.map2/);
 assert.match(pro,/syncVoiceButton/);
 assert.match(pro,/aria-pressed/);
 assert.match(pro,/navigator\.geolocation\.watchPosition/);
 assert.match(pro,/router\.project-osrm\.org/);
});

test('Minimal navigation HUD has direct voice control and real endpoints',()=>{
 const html=source('index.html');
 for(const id of ['hgProNavTurnDistance','hgProNavStreet','hgProNavEta','hgProNavTime','hgProNavDistance','hgNavVoiceQuick','hgProNavDestination','mapV2RouteTo','hgMapRecentDestinations'])
  assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
 assert.match(html,/HealthGoMapPro\.stopNavigation\(\)/);
 assert.match(html,/HealthGoMapV2\.goHome\(\)/);
 assert.match(html,/HealthGoMapV2\.clearRecent\(\)/);
 assert.match(html,/healthgo-map-v2\.js\?v=3/);
 assert.match(html,/healthgo-map-pro\.js\?v=8/);
});

test('Unsupported walking and cycling routes remain external, not fabricated',()=>{
 const js=source('healthgo-map-v2.js');
 assert.match(js,/routeMode!=='car'/);
 assert.match(js,/https:\/\/www\.openstreetmap\.org\/directions/);
 assert.match(js,/Nie wyświetlam zmyślonego czasu/);
});
