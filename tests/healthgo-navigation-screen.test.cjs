'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('www/index.html','utf8');
const css=fs.readFileSync('www/healthgo-navigation-screen.css','utf8');
const controller=fs.readFileSync('www/healthgo-map-v2.js','utf8');
const live=fs.readFileSync('www/healthgo-map-pro.js','utf8');

test('Map Navigation opens as an overlay in the same app rather than external webpage',()=>{
 assert.match(html,/healthgo-navigation-screen\.css\?v=1/);
 assert.match(html,/data-panel="route" onclick="HealthGoMapV2\.toggle\('route'\)"/);
 assert.match(controller,/document\.body\?\.classList\?\.toggle\?\.\('hg-route-planner-open',name==='route'\)/);
 assert.match(controller,/document\.body\?\.classList\?\.remove\?\.\('hg-route-planner-open'\)/);
 assert.match(css,/body\.hg-route-planner-open #map\.page\.active/);
 assert.match(css,/position:fixed!important/);
 assert.match(css,/body\.hg-route-planner-open #map #healthgoMap/);
 assert.doesNotMatch(controller,/window\.open\(/);
});

test('Navigation X and controls exist, are accessible and linked to implemented JS',()=>{
 for(const action of [
  'HealthGoMapV2.close()','HealthGoMapV2.useGPSStart()',
  "HealthGoMapV2.toggle('saved')","HealthGoMapV2.toggle('settings')",
  'HealthGoMapV2.planRoute()','HealthGoMapPro.startNavigation()'
 ])assert.ok(html.includes(action),action);
 assert.match(html,/aria-label="Zamknij nawigację i wróć do mapy"/);
 assert.match(controller,/function swapRoute\(\)/);
 assert.match(controller,/function useGPSStart\(\)/);
 assert.match(css,/\.hg-nav-planner-x/);
 assert.match(css,/\.hg-nav-planner-shortcuts/);
 assert.match(css,/#map \.map-v2-panel\[data-map-panel="route"\] \[hidden\]/);
});

test('Full-screen form leaves an interactive map visible and mobile sheet scrollable',()=>{
 assert.match(css,/max-height:min\(57dvh,560px\)/);
 assert.match(css,/overflow-y:auto!important/);
 assert.match(css,/pointer-events:none!important/);
 assert.match(css,/pointer-events:auto!important/);
 assert.match(css,/env\(safe-area-inset-top\)/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/body\.hg-route-planner-open #map \.map-toolbar/);
});

test('GPS tracking is separate from opening the planner',()=>{
 assert.match(controller,/if\(name==='route'\)/.test(controller)?controller:/toggle\?\.\('hg-route-planner-open',name==='route'\)/);
 assert.match(live,/function startNavigation\(initialFix\)/);
 assert.match(live,/navigator\.geolocation\.watchPosition\(positionUpdate/);
 assert.match(html,/Za Twoją zgodą systemową/);
 assert.match(controller,/Punkt startowy: GPS\./);
 assert.match(controller,/if\(activePanel!=='route'\)toggle\('route'\)/);
});
