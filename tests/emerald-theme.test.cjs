'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const base=path.join(__dirname,'..','www');
function read(file){return fs.readFileSync(path.join(base,file),'utf8')}

test('Emerald assets are included after legacy styles and scripts',()=>{
 const html=read('index.html');
 const css='healthgo-emerald-2.css?v=1';
 const js='healthgo-emerald-dashboard.js?v=1';
 assert.ok(html.includes(css));
 assert.ok(html.includes(js));
 assert.ok(html.indexOf(css)>html.indexOf('healthgo-navigation-live.css'));
 assert.ok(html.indexOf(js)>html.indexOf('healthgo-map4.js'));
 assert.ok(html.includes('<body class="hg-emerald"'));
});

test('Emerald dashboard uses existing service data, not synthetic metrics',()=>{
 const source=read('healthgo-emerald-dashboard.js');
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.match(source,/HealthGoServices/);
 assert.match(source,/viewChallenges/);
 assert.match(source,/getLevel/);
 assert.doesNotMatch(source,/Math\.random/);
 assert.match(source,/Brak|synchronizacji|aktualnie dostępnych/);
});

test('Theme is accessible and respects reduced motion',()=>{
 const source=read('healthgo-emerald-2.css');
 assert.match(source,/:focus-visible/);
 assert.match(source,/prefers-reduced-motion/);
 assert.match(source,/@media\(max-width:520px\)/);
 assert.match(source,/body\.hg-emerald/);
});

test('PWA branding uses the new background and new static assets exist',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest'));
 assert.equal(manifest.background_color,'#061a14');
 assert.equal(manifest.theme_color,'#061a14');
 assert.ok(fs.existsSync(path.join(base,'healthgo-emerald-2.css')));
 assert.ok(fs.existsSync(path.join(base,'healthgo-emerald-dashboard.js')));
});
