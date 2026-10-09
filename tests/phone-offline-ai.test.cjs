'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const MODEL_BASE='https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX-MHA/resolve/main/';
const FILES=['config.json','tokenizer.json','tokenizer_config.json','generation_config.json','onnx/model_q4.onnx'];

function setup(shared={}){
 const source=fs.readFileSync('www/healthgo-offline-ai.js','utf8');
 const urls=shared.urls||(shared.urls=new Set());
 const local=shared.local||(shared.local=new Map());
 const elements=new Map();
 const workers=[];
 let lastAsk=null;
 class WorkerStub{
  constructor(url,opts){
   assert.match(url,/healthgo-(?:ai-download-worker|offline-ai-worker)\.js/);
   this.kind=/ai-download-worker/.test(url)?'download':'inference';
   if(this.kind==='inference')assert.equal(opts.type,'module');
   this.listeners={};
   workers.push(this);
  }
  addEventListener(type,cb){this.listeners[type]=cb;}
  terminate(){this.terminated=true;}
  fire(data){this.listeners.message?.({data});}
  postMessage(message){
   if(this.kind==='download'&&message.type==='download'){
    if(shared.cancelDownload){this.fire({type:'error',id:message.id,code:'LOCAL_DOWNLOAD_HTTP_503'});return;}
    if(!shared.noSavedFiles)for(const file of FILES)urls.add(MODEL_BASE+file);
    this.fire({type:'progress',file:'onnx/model_q4.onnx',percent:96});
    this.fire({type:'downloaded',id:message.id});
   }
   if(this.kind==='inference'&&message.type==='warmup'){
    if(shared.failWarmup)this.fire({type:'error',id:message.id,code:'LOCAL_MODEL_NO_REPLY'});
    else this.fire({type:'ready',id:message.id});
   }
   if(this.kind==='inference'&&message.type==='ask'){
    lastAsk=message;
    this.fire({type:'answer',id:message.id,answer:'Cześć! Jak mogę Ci pomóc?'});
   }
  }
 }
 function element(id){
  if(!elements.has(id))elements.set(id,{
   id,disabled:false,hidden:true,textContent:'',style:{},listeners:{},
   setAttribute(name,value){this[name]=value;},
   addEventListener(name,cb){this.listeners[name]=cb;}
  });
  return elements.get(id);
 }
 const cacheAPI={
  open:async()=>({match:async url=>urls.has(url)?{ok:true}:null})
 };
 const localStorage={getItem:key=>local.get(key)||null,setItem:(key,v)=>local.set(key,v),removeItem:key=>local.delete(key)};
 const navigator={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',onLine:true,gpu:null,
  storage:{estimate:async()=>({quota:2e9,usage:0}),persist:async()=>true}};
 const document={readyState:'complete',visibilityState:'visible',getElementById:element,addEventListener(){}};
 const window={Worker:WorkerStub,caches:cacheAPI};
 const context={window,Worker:WorkerStub,document,navigator,location:{protocol:'https:'},
  localStorage,caches:cacheAPI,setTimeout,clearTimeout,Number,String,Array,Map,Math,Error,Promise};
 vm.runInNewContext(source,context,{filename:'healthgo-offline-ai.js'});
 return{api:window.HealthGoOfflineAI,urls,local,element,navigator,get workers(){return workers;},get lastAsk(){return lastAsk;}};
}

test('First visit shows install UI without launching a heavy AI model',async()=>{
 const x=setup();
 assert.equal(await x.api.verifyStored(),false);
 x.api.offerIfNeeded();
 assert.equal(x.api.available(),false);
 assert.match(x.element('hgOfflineAiDeviceBadge').textContent,/niepobrany/);
 assert.equal(x.workers.length,0,'no inference worker on startup');
});

test('Downloading stores actual files and never starts local inference on installation',async()=>{
 const x=setup();
 assert.equal(await x.api.install(),true);
 assert.equal(x.api.installed,true);
 assert.equal(x.api.available(),false,'a downloaded model is not automatically running');
 assert.equal(x.api.status,'downloaded');
 assert.equal(x.workers.length,1);
 assert.equal(x.workers[0].kind,'download');
 assert.equal(x.element('hgOfflineAiMeter').style.width,'100%');
 assert.match(x.element('hgOfflineAiDeviceBadge').textContent,/na tym telefonie/);
 assert.match(x.element('hgOfflineAiInstallBtn').textContent,/pobrany/);
 assert.equal(x.element('hgOfflineAiTryLocalBtn').hidden,false);
 assert.equal(x.local.get('healthgo_local_ai_smol135_wasm_v2'),'1');
});

test('Downloaded badge survives Home Screen app restart and correctly identifies evicted model',async()=>{
 const shared={};
 const first=setup(shared);
 assert.equal(await first.api.install(),true);
 const reopened=setup(shared);
 assert.equal(await reopened.api.verifyStored(),true);
 assert.equal(reopened.api.installed,true);
 assert.equal(reopened.api.available(),false,'no automatic heavy inference after Safari restart');
 assert.equal(reopened.workers.length,0);
 assert.match(reopened.element('hgOfflineAiDeviceBadge').textContent,/na tym telefonie/);
 shared.urls.delete(MODEL_BASE+'onnx/model_q4.onnx');
 assert.equal(await reopened.api.verifyStored(),false);
 assert.match(reopened.element('hgOfflineAiDeviceBadge').textContent,/niepobrany/);
 assert.equal(shared.local.has('healthgo_local_ai_smol135_wasm_v2'),false);
});

test('Explicit local AI start and conversation work only after verified download',async()=>{
 const x=setup();
 await x.api.install();
 assert.equal(await x.api.startLocal(),true);
 assert.equal(x.api.available(),true);
 assert.equal(x.workers.length,2);
 assert.equal(x.workers[1].kind,'inference');
 assert.match(x.element('hgOfflineAiDeviceBadge').textContent,/Lokalne AI działa/);
 const answer=await x.api.ask({message:'Cześć',mode:'assistant',responseMode:'medium',history:[{role:'user',content:'Hej'}]});
 assert.equal(answer,'Cześć! Jak mogę Ci pomóc?');
 assert.equal(x.lastAsk.history.length,1);
 assert.equal(x.lastAsk.message,'Cześć');
});

test('iPhone AI load errors preserve downloaded status, with cloud chat remaining available',async()=>{
 const x=setup({failWarmup:true});
 await x.api.install();
 assert.equal(await x.api.startLocal(),false);
 assert.equal(x.api.installed,true);
 assert.equal(x.api.available(),false);
 assert.match(x.element('hgOfflineAiDeviceBadge').textContent,/na tym telefonie/);
});

test('Failed or incomplete downloads never show a fake installed badge',async()=>{
 const error=setup({cancelDownload:true});
 assert.equal(await error.api.install(),false);
 assert.equal(error.api.installed,false);
 const incomplete=setup({noSavedFiles:true});
 assert.equal(await incomplete.api.install(),false);
 assert.equal(incomplete.api.installed,false);
 assert.match(incomplete.element('hgOfflineAiDeviceBadge').textContent,/niepobrany/);
});

test('The download worker streams model files directly into browser Cache API',()=>{
 const source=fs.readFileSync('www/healthgo-ai-download-worker.js','utf8');
 const worker=fs.readFileSync('www/healthgo-offline-ai-worker.entry.js','utf8');
 const html=fs.readFileSync('www/index.html','utf8');
 const workflow=fs.readFileSync('.github/workflows/mobile-pages.yml','utf8');
 assert.match(source,/cache\.put\(url,new Response\(counted/);
 assert.match(source,/response\.body\.pipeThrough\(new TransformStream/);
 assert.match(source,/const CACHE='transformers-cache'/);
 assert.doesNotMatch(source,/pipeline\('text-generation'/);
 assert.match(worker,/if\(input\.type==='warmup'\)/);
 assert.match(worker,/numThreads=1/);
 assert.match(html,/id="hgOfflineAiDeviceBadge"/);
 assert.match(html,/id="hgOfflineAiTryLocalBtn"/);
 assert.match(html,/healthgo-offline-ai\.js/);
 assert.match(workflow,/@huggingface\/transformers@3\.8\.1/);
 assert.match(workflow,/npx esbuild worker\.entry\.js --bundle --format=esm/);
});
