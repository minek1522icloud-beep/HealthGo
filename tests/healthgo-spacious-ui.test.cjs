'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('www/healthgo-spacious-ui.css','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const js=fs.readFileSync('www/healthgo-map-pro.js','utf8');

test('Spacious styles load after all older map/chat/mobile styles on every app screen',()=>{
 const mobile=html.indexOf('healthgo-mobile-suite.css');
 const chat=html.indexOf('healthgo-chat-modern.css');
 const map=html.indexOf('healthgo-map-v2.css?v=3');
 const newStyle=html.indexOf('healthgo-spacious-ui.css?v=2');
 assert.ok(mobile>=0&&chat>mobile&&map>chat&&newStyle>map,
  'layout overrides must load last');
 assert.match(html,/healthgo-map-pro\.js\?v=2/);
 assert.match(css,/--hg-ui-space:18px/);
 assert.match(css,/\.main \.page:not\(#map\):not\(#ai\) \.card/);
 assert.match(css,/\.main \.page:not\(#map\):not\(#ai\) \.settings-section/);
 assert.match(css,/#ai \.ai-messages/);
});

test('Live navigation covers the entire screen without sheets or bottom mobile menu',()=>{
 assert.match(js,/document\.body\?\.classList\?\.add\('hg-navigation-active'\)/);
 assert.match(js,/document\.body\?\.classList\?\.remove\('hg-navigation-active'\)/);
 assert.match(js,/panels\?\.forEach\?\.\(panel=>\{panel\.hidden=true;\}\)/);
 assert.match(css,/body\.hg-navigation-active #map\.page\.active/);
 assert.match(css,/position:fixed!important/);
 assert.match(css,/body\.hg-navigation-active \.mobile-nav/);
 assert.match(css,/body\.hg-navigation-active #map \.map-v2-panel/);
 assert.match(css,/body\.hg-navigation-active #map #mapResultsPanel/);
 assert.match(css,/body\.hg-navigation-active #map #hgProNavigation:not\(\[hidden\]\)/);
 assert.match(css,/body\.hg-navigation-active #map #healthgoMap/);
});


test('Navigation HUD stays hidden on normal map even if older CSS sets display:flex',()=>{
 const oldCSS=fs.readFileSync('www/healthgo-map-v2.css','utf8');
 // The hidden attribute can be overridden by an author display:flex rule.
 // Enforce explicit display:none !important in both active and inactive states.
 assert.match(oldCSS,/#map #hgProNavigation\[hidden\]\s*\{\s*display:none!important/);
 assert.match(css,/body:not\(\.hg-navigation-active\) #map #hgProNavigation/);
 assert.match(css,/#map #hgProNavigation\[hidden\]\s*\{\s*display:none!important/);
 assert.match(js,/show\('hgProNavigation',true\)/);
 assert.match(js,/show\('hgProNavigation',false\)/);
 assert.match(html,/id="hgProNavigation"[^>]*hidden/);
});

test('Navigation cards have separate top and bottom safe-area positions',()=>{
 assert.match(css,/top:calc\(12px \+ env\(safe-area-inset-top\)\)/);
 assert.match(css,/bottom:calc\(16px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/@media\(max-height:680px\)/);
 assert.match(css,/body\.hg-navigation-active #map #hgProNavigation \.hg-pro-nav-warning/);
});

test('Responsive global layout increases breathing room without changing GPS or accounts',()=>{
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/--hg-ui-card-pad:19px/);
 assert.match(css,/\.main \.page:not\(#map\):not\(#ai\) \.activity-metrics/);
 assert.match(css,/\.main \.page:not\(#map\):not\(#ai\) \.plan-shell/);
 assert.match(css,/\.main \.page:not\(#map\):not\(#ai\) \.challenge-layout/);
 assert.match(css,/\.main \.page:not\(#map\):not\(#ai\) \.activity-shell/);
 assert.doesNotMatch(css,/navigator\.geolocation|localStorage|fetch\(/);
});
