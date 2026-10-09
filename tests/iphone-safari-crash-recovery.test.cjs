'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('Safari initial page does not eagerly load both Gemini and optional WebGPU AI',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const sw=fs.readFileSync('www/service-worker.js','utf8');
 const local=fs.readFileSync('www/healthgo-offline-ai.js','utf8');
 assert.doesNotMatch(html,/window\.healthGoLoadAIBundle\(false\)\.catch/);
 assert.match(html,/async function waitForHealthGoMobileAI\(/);
 assert.match(html,/window\.healthGoLoadAIBundle/);
 assert.match(html,/setTimeout\(\(\)=>\{\s*navigator\.serviceWorker\.register/);
 const core=sw.match(/const CORE=([^;]+);/);
 assert.ok(core,'service worker shell cache declared');
 assert.doesNotMatch(core[1],/healthgo-offline-ai-worker\.js/);
 assert.doesNotMatch(core[1],/healthgo-offline-ai|healthgo-v2-ui|healthgo-mobile-suite/);
 assert.ok(fs.existsSync('www/recovery.html'),'recovery stays accessible without eager PWA pre-cache');
 assert.match(local,/new Worker\(INFERENCE_WORKER,\{type:'module'/);
 assert.match(local,/async function install\(\)/);
 assert.match(local,/start\.addEventListener|el\('hgOfflineAiInstallBtn'\)\?\.addEventListener/);
});

test('Standalone recovery page keeps account/local data and resets only PWA shell resources',()=>{
 const html=fs.readFileSync('www/recovery.html','utf8');
 assert.match(html,/Napraw i otwórz HealthGo/);
 assert.match(html,/reg\.unregister\(\)/);
 assert.match(html,/key\.startsWith\('healthgo-pwa-'\)/);
 assert.doesNotMatch(html,/localStorage\.clear\(/);
 assert.doesNotMatch(html,/indexedDB\.deleteDatabase\(/);
 assert.doesNotMatch(html,/caches\.keys\(\).*delete\(/);
 assert.match(html,/hg_recovered/);
});

test('Recovery actions can unregister only the HealthGo scope and preserve account storage',async()=>{
 const html=fs.readFileSync('www/recovery.html','utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(script,'standalone recovery JS exists');
 let handler=null,deleted=[],unregistered=[],nav='';
 const cacheNames=['healthgo-pwa-v17-on-device-ai-20261008','healthgo-preferences-v1','huggingface-transformers','unrelated-cache'];
 const registrations=[
  {scope:'https://minek1522icloud-beep.github.io/HealthGo/',unregister:async()=>{unregistered.push('HealthGo')}},
  {scope:'https://minek1522icloud-beep.github.io/AnotherApp/',unregister:async()=>{unregistered.push('AnotherApp')}}
 ];
 const elements={
  repair:{disabled:false,addEventListener:(event,fn)=>{if(event==='click')handler=fn}},
  status:{textContent:''}
 };
 const context={
  document:{getElementById:id=>elements[id]},
  navigator:{serviceWorker:{getRegistrations:async()=>registrations}},
  window:{caches:{}},
  caches:{keys:async()=>cacheNames,delete:async name=>{deleted.push(name);return true}},
  location:{href:'https://minek1522icloud-beep.github.io/HealthGo/recovery.html',replace:url=>{nav=url}},
  console:{warn(){}},Date:{now:()=>42},URL
 };
 vm.runInNewContext(script[1],context);
 assert.equal(typeof handler,'function');
 await handler();
 assert.deepEqual(unregistered,['HealthGo']);
 assert.deepEqual(deleted,['healthgo-pwa-v17-on-device-ai-20261008']);
 assert.match(nav,/\/HealthGo\/\?hg_recovered=42/);
 assert.match(elements.status.textContent,/Gotowe/);
});
