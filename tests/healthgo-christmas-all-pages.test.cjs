'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..','www',name),'utf8');

test('all HealthGo tabs share the approved Christmas visual system without duplicating Start',()=>{
 const js=read('healthgo-christmas-all-pages.js');
 const css=read('healthgo-christmas-all-pages.css');
 const index=read('index.html');
 const pages=['ai','map','explore','points','contests','plan','challenges','backpack','devices','activity','settings','family','notifications'];
 for(const key of pages)assert.match(js,new RegExp('(?:^|\\s)'+key+':\\{'),key+' needs a festive hero and 3 shortcuts');
 assert.match(js,/if\(.*page\.id==='start'/,'Start must retain its original premium holiday surface');
 assert.match(js,/observer\.observe\(main,\{childList:true\}\)/,'Family created later must also receive a holiday header');
 assert.match(js,/page\.prepend\(root\)/,'Existing tabs must stay intact');
 assert.match(js,/window\.go\(destination\)/,'Quick links must perform real navigation');
 assert.match(js,/createElement/,'Build controls as elements without interpolating account data');
 assert.match(css,/\.hgx-holiday-page\{display:none\}/,'Ordinary look must hide seasonal decorations');
 assert.match(css,/body\.hg-christmas/,'Holiday styles must require user seasonal opt-in');
 for(const id of ['ai','map','family','points','plan'])assert.ok(css.includes('#'+id),'Missing '+id+' seasonal details');
 assert.ok(index.includes('healthgo-christmas-all-pages.css?v=1'));
 assert.ok(index.includes('healthgo-christmas-all-pages.js?v=1'));
 assert.ok(index.indexOf('healthgo-christmas-all-pages.css')>index.indexOf('healthgo-christmas-premium.css'));
 assert.ok(index.indexOf('healthgo-christmas-all-pages.js')>index.indexOf('healthgo-christmas-premium.js'));
 assert.match(read('service-worker.js'),/healthgo-pwa-v65-christmas-map-fullscreen-20261105/);
});

test('holiday visuals reuse the original licensed HealthGo drawings rather than embedding dummy stats',()=>{
 const css=read('healthgo-christmas-all-pages.css'),js=read('healthgo-christmas-all-pages.js');
 assert.match(css,/christmas-hero-premium\.svg/);
 assert.match(css,/christmas-header-premium\.svg/);
 assert.doesNotMatch(js,/steps:|heartRate:|sleepMinutes:|totalXp:|grantXP|awardXP|updateEngine/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/\.hgx-shortcut:focus-visible/);
 assert.match(css,/hg-navigation-active/);
});
