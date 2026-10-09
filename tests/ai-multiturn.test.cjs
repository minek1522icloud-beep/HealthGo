'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(){
  const source=fs.readFileSync('www/healthgo-ai-entry.js','utf8')
    .replace(/^import .*;\s*$/gm,'');
  const apps=[],prompts=[],events=[];
  let appCheckInit=0,modelCalls=0,forceRefresh=0,onceFailure=true,failQuota=false,appCheckFails=false,invalidPlaceholder=false;
  const win={dispatchEvent:e=>events.push(e.type)};
  const app={name:'healthgo-mobile-ai'};
  const env={
    window:win,
    location:{hostname:'minek1522icloud-beep.github.io'},
    console:{error:()=>{}},
    Event:class{constructor(type){this.type=type}},
    setTimeout,clearTimeout,AbortController,
    initializeApp:(_config,name)=>{
      if(apps.some(a=>a.name===name))throw Error('firebase-app-duplicate');
      app.name=name;apps.push(app);return app;
    },
    getApps:()=>apps,
    ReCaptchaEnterpriseProvider:class{constructor(key){this.key=key}},
    initializeAppCheck:firebaseApp=>{
      appCheckInit++;
      if(appCheckInit>1)throw Error('app-check-already-initialized');
      return {app:firebaseApp};
    },
    getToken:async (_app,force)=>{
      if(force)forceRefresh++;
      if(appCheckFails)throw Object.assign(Error('recaptcha invalid-domain'),{code:'appCheck/recaptcha-error'});
      if(invalidPlaceholder)return {token:'placeholder-token',error:Object.assign(Error('Invalid App Check attestation'),{code:'appCheck/recaptcha-error'})};
      if(onceFailure&&!force){onceFailure=false;throw Error('expired-app-check-token')}
      return {token:'test-app-check-token'};
    },
    GoogleAIBackend:class{},
    getAI:()=>({backend:'mock'}),
    getGenerativeModel:(_ai,options)=>({
      async generateContent(parts){
        modelCalls++;
        prompts.push({parts,options});
        if(failQuota)throw Error('429 resource-exhausted');
        return {response:{text:()=>String('Odpowiedź '+modelCalls)}};
      }
    })
  };
  return{
    window:win,prompts,events,
    load(){vm.runInNewContext(source,env,{filename:'healthgo-ai-entry.js'})},
    stats(){return{appCheckInit,modelCalls,forceRefresh}},
    rateLimit(){failQuota=true},
    failAppCheck(){appCheckFails=true},
    rejectPlaceholder(){invalidPlaceholder=true}
  };
}

test('AI handles several messages, remembers context and keeps all five modes available',async()=>{
  const sdk=setup();sdk.load();
  const messages=[
    {message:'Cześć',mode:'assistant',responseMode:'average'},
    {message:'Ułóż mi plan',mode:'plan',responseMode:'medium'},
    {message:'Co można ugotować?',mode:'food',responseMode:'high'},
    {message:'Pomysł na spacer',mode:'activity',responseMode:'average'},
    {message:'Co można odkryć?',mode:'explore',responseMode:'medium'}
  ];
  let history=[];
  for(const message of messages){
    const result=await sdk.window.healthGoMobileAI.ask({...message,accountType:'child',history});
    assert.match(result,/Odpowiedź \d+/);
    history.push({role:'user',content:message.message},{role:'assistant',content:result});
  }
  assert.equal(sdk.stats().appCheckInit,1);
  assert.equal(sdk.stats().modelCalls,5);
  assert.equal(sdk.stats().forceRefresh,1);
  assert.match(String(sdk.prompts[1].parts[0]),/Użytkownik: Cześć/);
  assert.match(String(sdk.prompts[2].parts[0]),/Tryb: Jedzenie/);
  assert.match(String(sdk.prompts[3].parts[0]),/Tryb: Aktywność/);
  assert.match(String(sdk.prompts[4].parts[0]),/Tryb: Odkrywanie/);
});

test('AI bundle can initialize twice without duplicating Firebase App Check',async()=>{
  const sdk=setup();sdk.load();
  sdk.load();
  assert.equal(sdk.stats().appCheckInit,1);
  assert.deepEqual(sdk.events,['healthgo-mobile-ai-ready','healthgo-mobile-ai-ready']);
  const answer=await sdk.window.healthGoMobileAI.ask({
    message:'Drugie uruchomienie AI',mode:'assistant',responseMode:'average',history:[]
  });
  assert.match(answer,/Odpowiedź/);
  assert.equal(sdk.window.healthGoMobileAIInitError,'');
});

test('rate limiting does not trigger a storm of calls to fallback models',async()=>{
  const sdk=setup();sdk.load();sdk.rateLimit();
  await assert.rejects(
    sdk.window.healthGoMobileAI.ask({message:'Cześć',mode:'assistant',responseMode:'average',history:[]}),
    /AI_RATE_LIMIT/
  );
  assert.equal(sdk.stats().modelCalls,1);
});

test('chat history deletion, session isolation and cache preferences stay connected to actual handlers',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  const suite=fs.readFileSync('www/healthgo-mobile-suite.js','utf8');
  const sw=fs.readFileSync('www/service-worker.js','utf8');
  assert.match(html,/window\.healthGoClearAIHistory=/);
  assert.match(html,/window\.healthGoAISessionEpoch=/);
  assert.match(html,/healthGoAIRequestToken===requestToken/);
  assert.match(html,/ai-system-message/);
  assert.match(suite,/window\.healthGoClearAIHistory\(\)/);
  assert.match(suite,/applyOfflinePreference/);
  assert.match(sw,/HEALTHGO_OFFLINE_CACHE/);
  assert.match(sw,/caches\.delete\(CACHE_NAME\)/);
  assert.doesNotMatch(suite.slice(suite.indexOf('function setupMobileNav'),suite.indexOf('function updateProfileIcon')),/replaceChildren\(/);
});

test('Phone AI diagnoses App Check without making a generation request',async()=>{
 const sdk=setup();sdk.load();
 const ready=await sdk.window.healthGoMobileAI.diagnose();
 assert.equal(ready.appCheck,'ready');
 assert.equal(sdk.stats().modelCalls,0);
 sdk.failAppCheck();
 await assert.rejects(
  sdk.window.healthGoMobileAI.ask({message:'Cześć',mode:'assistant',history:[]}),
  /APP_CHECK_ERROR appCheck\/recaptcha-error/
 );
 assert.equal(sdk.stats().modelCalls,0);
});

test('Firebase placeholder tokens with attestation errors are never accepted',async()=>{
 const sdk=setup();sdk.load();sdk.rejectPlaceholder();
 await assert.rejects(
  sdk.window.healthGoMobileAI.ask({message:'Cześć',mode:'assistant',history:[]}),
  /APP_CHECK_ERROR appCheck\/recaptcha-error/
 );
 assert.equal(sdk.stats().modelCalls,0,'unverified App Check never reaches Gemini');
});

test('Mobile error guidance distinguishes domain attestation from Gemini/provider errors',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const entry=fs.readFileSync('www/healthgo-ai-entry.js','utf8');
 assert.match(html,/function healthGoMobileErrorCode\(error\)/);
 assert.match(html,/MOBILE_APP_CHECK/);
 assert.match(html,/Kod diagnostyczny:/);
 assert.match(html,/Sprawdź połączenie AI/);
 assert.match(html,/Firebase App Check nie potwierdził dostępu/);
 assert.match(html,/mode:requestMode,responseMode:requestLevel,history:requestHistory/);
 assert.match(entry,/async diagnose\(\)/);
 assert.match(entry,/getToken\(appCheck,attempt===1\)/);
});

test('Mobile keeps modes, navigation and offline rules intact',()=>{
 const entry=fs.readFileSync('www/healthgo-ai-entry.js','utf8');
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(entry,/gemini-3\.5-flash-lite/);
 assert.match(entry,/gemini-3\.8-flash/);
 assert.match(html,/data-mobile-page="map"/);
 assert.match(html,/data-mobile-page="plan"/);
 assert.match(html,/data-mobile-page="more"/);
 const sw=fs.readFileSync('www/service-worker.js','utf8');
 assert.match(sw,/healthgo-pwa-v30-nav-visibility-20261009/);
});

test('Gemini request has a real deadline even if provider promise never settles',async()=>{
 const source=fs.readFileSync('www/healthgo-ai-entry.js','utf8');
 const start=source.indexOf('    async function requestGemini(');
 const end=source.indexOf('    window.healthGoMobileAI={',start);
 assert.ok(start>=0&&end>start,'SDK timeout helper exists');
 let didAbort=false;
 const context={AbortController,Promise,setTimeout,clearTimeout};
 vm.runInNewContext(source.slice(start,end)+'\nthis.requestGemini=requestGemini;',context);
 const model={
  generateContent(_parts,opts){
   assert.ok(opts.signal,'Firebase generation receives AbortSignal');
   assert.equal(opts.timeout,20);
   opts.signal.addEventListener('abort',()=>{didAbort=true});
   return new Promise(()=>{});
  }
 };
 await assert.rejects(context.requestGemini(model,['hello'],20,null),/AI_PROVIDER_TIMEOUT/);
 assert.equal(didAbort,true);
});

test('Cancelling a mobile generation aborts Firebase and returns immediately',async()=>{
 const source=fs.readFileSync('www/healthgo-ai-entry.js','utf8');
 const start=source.indexOf('    async function requestGemini(');
 const end=source.indexOf('    window.healthGoMobileAI={',start);
 const context={AbortController,Promise,setTimeout,clearTimeout};
 vm.runInNewContext(source.slice(start,end)+'\nthis.requestGemini=requestGemini;',context);
 const stop=new AbortController();
 let sdkSignal=null;
 const pending=context.requestGemini({
  generateContent(_parts,opts){sdkSignal=opts.signal;return new Promise(()=>{})}
 },['hello'],30000,stop.signal);
 stop.abort();
 await assert.rejects(pending,/AI_CANCELLED/);
 assert.ok(sdkSignal.aborted);
});

test('Mobile request has progress and real cancellation; desktop Ollama remains unchanged',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const entry=fs.readFileSync('www/healthgo-ai-entry.js','utf8');
 assert.match(html,/mobileController=new AbortController/);
 assert.match(html,/signal:mobileController.signal/);
 assert.match(html,/healthGoAITimed\(askHealthGoMobileAI\(q,imageData,\{/);
 assert.match(html,/mobileTimeout,mobileController/);
 assert.match(html,/HealthGo AI/);
 assert.match(entry,/model.generateContent\(parts,\{signal:controller.signal,timeout:limitMs\}\)/);
 assert.match(entry,/notifyStage\(onStatus,'Generuję odpowiedź w Gemini/);
});
