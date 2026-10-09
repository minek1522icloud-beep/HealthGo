'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function harness(remote,running,search='',isDownloading=false){
 const source=fs.readFileSync('www/index.html','utf8');
 const start=source.indexOf('let healthGoVersionCheckBusy=false;');
 const end=source.indexOf('function setupMobilePWA(){',start);
 assert.ok(start>0&&end>start,'Missing HealthGo update module');
 const code=source.slice(start,end);
 const storage=new Map(),history=[],updates=[],messages=[];
 const status={textContent:''};
 const location={
  href:'https://example.org/HealthGo/'+search,search,replace(url){history.push(url)}
 };
 const document={
  getElementById:id=>id==='healthgoUpdateStatus'?status:null,
  querySelector:q=>q==='meta[name="healthgo-build"]'?{getAttribute:()=>running}:null
 };
 const registration={waiting:{postMessage:x=>messages.push(x)},update:async()=>updates.push('update')};
 const context={
  document,location,URL,URLSearchParams,
  navigator:{serviceWorker:{getRegistration:async()=>registration}},
  window:{HealthGoOfflineAI:{busy:isDownloading}},sessionStorage:{
    getItem:k=>storage.get(k)||null,
    setItem:(k,v)=>storage.set(k,v),
    removeItem:k=>storage.delete(k)
  },
  fetch:async()=>({ok:true,json:async()=>({version:remote})}),
  console:{warn(){}},
  Date,
  isHostedMobileHealthGo:()=>true
 };
 vm.runInNewContext(code,context,{filename:'healthgo-update.js'});
 return{context,status,storage,history,updates,messages};
}

const V1='a'.repeat(40),V2='b'.repeat(40);

test('deployed build is not refreshed unnecessarily',async()=>{
 const x=harness(V1,V1);
 await x.context.window.healthGoCheckMobileUpdate();
 assert.equal(x.history.length,0);
 assert.match(x.status.textContent,/Aktualna wersja/);
});

test('new build triggers service worker update with cache-busted URL',async()=>{
 const x=harness(V2,V1);
 await x.context.window.healthGoCheckMobileUpdate();
 assert.equal(x.history.length,1);
 assert.match(x.history[0],/hg_build=bbbbbbbbbbbb/);
 assert.deepEqual(x.updates,['update']);
 assert.equal(x.messages[0].type,'SKIP_WAITING');
});

test('stale shell cannot create an infinite automatic refresh loop',async()=>{
 const x=harness(V2,V1);
 await x.context.window.healthGoCheckMobileUpdate();
 await x.context.window.healthGoCheckMobileUpdate();
 assert.equal(x.history.length,1);
 assert.match(x.status.textContent,/Zamknij HealthGo/);
});

test('login callbacks cannot lose auth code during automatic update',async()=>{
 const x=harness(V2,V1,'?code=example');
 await x.context.window.healthGoCheckMobileUpdate();
 assert.equal(x.history.length,0);
});

test('manual retry can override automatic cooldown',async()=>{
 const x=harness(V2,V1);
 await x.context.window.healthGoCheckMobileUpdate();
 await x.context.window.healthGoCheckMobileUpdate(true);
 assert.equal(x.history.length,2);
});

test('deployment stamps real commit into HTML and publishes matching version',()=>{
 const workflow=fs.readFileSync('.github/workflows/mobile-pages.yml','utf8');
 const html=fs.readFileSync('www/index.html','utf8');
 const suite=fs.readFileSync('www/healthgo-mobile-suite.js','utf8');
 const sw=fs.readFileSync('www/service-worker.js','utf8');
 assert.match(html,/<meta name="healthgo-build" content="development">/);
 assert.match(workflow,/index\.write_text\(html\.replace\(original/);
 assert.match(workflow,/grep -q "\$GITHUB_SHA" www\/version\.json/);
 assert.match(workflow,/test -s www\/healthgo-ai-bundle\.js/);
 assert.match(suite,/Sprawdź i pobierz aktualizację/);
 assert.match(sw,/SKIP_WAITING/);
 assert.match(sw,/healthgo-pwa-v25-map-ui-20261009/);
});

test('home-screen shortcut updates are postponed while AI model downloads',async()=>{
 const x=harness(V2,V1,'',true);
 await x.context.window.healthGoCheckMobileUpdate();
 assert.equal(x.history.length,0);
 assert.equal(x.updates.length,0);
 await x.context.healthGoActivateNewVersion(V2,true);
 assert.equal(x.history.length,0);
 assert.match(x.status.textContent,/poczeka na zakończenie pobierania AI/);
 x.context.window.HealthGoOfflineAI.busy=false;
 await x.context.window.healthGoCheckMobileUpdate();
 assert.equal(x.history.length,1);
});

test('PWA checks installed shortcut updates after initial paint, not during startup',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(html,/setTimeout\(checkHealthGoMobileUpdate,12000\)/);
 assert.match(html,/setInterval\(checkHealthGoMobileUpdate,900000\)/);
 assert.match(html,/window\.HealthGoOfflineAI\?\.busy\|\|window\.healthGoAIRequestBusy/);
});
