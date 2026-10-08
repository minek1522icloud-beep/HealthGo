'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(){
 const source=fs.readFileSync('www/healthgo-offline-ai.js','utf8');
 const store=new Map(),elements=new Map();
 let created=0,worker=null,lastAsk=null;
 class WorkerStub{
  constructor(url,opts){
   assert.match(url,/healthgo-offline-ai-worker\.js/);
   assert.equal(opts.type,'module');
   created++;worker=this;this.events={};
  }
  addEventListener(event,cb){this.events[event]=cb;}
  terminate(){this.terminated=true;}
  fire(value){this.events.message?.({data:value});}
  postMessage(message){
   if(message.type==='install'){
    this.fire({type:'progress',percent:26,file:'model_q4f16.onnx'});
    this.fire({type:'ready',model:'onnx-community/Qwen2.5-0.5B-Instruct'});
   }else if(message.type==='ask'){
    lastAsk=message;
    this.fire({type:'answer',id:message.id,answer:'Cześć! Jak mogę Ci pomóc?'});
   }
  }
 }
 function element(id){
  if(!elements.has(id))elements.set(id,{
   id,hidden:false,disabled:false,style:{},textContent:'',isConnected:true,
   listeners:{},
   setAttribute(name,value){this[name]=value},
   addEventListener(name,cb){this.listeners[name]=cb}
  });
  return elements.get(id);
 }
 const window={
  Worker:WorkerStub,
  localStorage:{getItem:key=>store.get(key)||null,setItem:(key,v)=>store.set(key,v),removeItem:key=>store.delete(key)},
  navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',gpu:{},onLine:true,storage:{estimate:async()=>({quota:2e9,usage:0}),persist:async()=>true}},
  location:{protocol:'https:',hostname:'minek1522icloud-beep.github.io'},
  document:{getElementById:element,addEventListener:(name,cb)=>{if(name==='DOMContentLoaded')cb()}}
 };
 const context={window,document:window.document,navigator:window.navigator,location:window.location,localStorage:window.localStorage,
  Worker:WorkerStub,Promise,Map,Number,String,Math,Error,Array,setTimeout,clearTimeout};
 vm.runInNewContext(source,context,{filename:'healthgo-offline-ai.js'});
 return{api:window.HealthGoOfflineAI,store,elements,element,get created(){return created},get worker(){return worker},get lastAsk(){return lastAsk},window};
}

test('First phone visit offers genuine install UI only after entering AI screen',()=>{
 const sdk=setup();
 assert.equal(sdk.api.available(),false);
 assert.equal(sdk.element('hgOfflineAiSetup').hidden,false);
 sdk.api.later();
 assert.equal(sdk.element('hgOfflineAiSetup').hidden,true);
 sdk.api.offerIfNeeded();
 assert.equal(sdk.element('hgOfflineAiSetup').hidden,true);
 sdk.api.openInstall();
 assert.equal(sdk.element('hgOfflineAiSetup').hidden,false);
});

test('Local model is marked installed only after worker reports ready',async()=>{
 const sdk=setup();
 assert.equal(sdk.store.has('healthgo_local_ai_qwen05_ready_v1'),false);
 sdk.api.openInstall();
 const ok=await sdk.api.install();
 assert.equal(ok,true);
 assert.equal(sdk.api.available(),true);
 assert.equal(sdk.api.status,'ready');
 assert.match(sdk.element('hgOfflineAiStatus').textContent,/Gotowe/);
 assert.equal(sdk.element('hgOfflineAiMeter').style.width,'100%');
 assert.equal(sdk.created,1);
});

test('Installed phone AI really handles a conversation using worker inference',async()=>{
 const sdk=setup();
 await sdk.api.install();
 const reply=await sdk.api.ask({
  message:'Cześć',history:[{role:'user',content:'Dzień dobry'}],mode:'assistant',responseMode:'medium'
 });
 assert.equal(reply,'Cześć! Jak mogę Ci pomóc?');
 assert.equal(sdk.lastAsk.message,'Cześć');
 assert.equal(sdk.lastAsk.mode,'assistant');
 assert.equal(sdk.lastAsk.history.length,1);
 assert.equal(sdk.lastAsk.responseMode,'medium');
});

test('No GPU or insufficient storage cannot falsely finish the install',async()=>{
 const sdk=setup();
 sdk.window.navigator.gpu=null;
 const ok=await sdk.api.install();
 assert.equal(ok,false);
 assert.equal(sdk.api.available(),false);
 assert.equal(sdk.created,0);
 assert.match(sdk.element('hgOfflineAiStatus').textContent,/WebGPU/);
});

test('Real LLM worker is built on GitHub Pages from Transformers.js and model files are not embedded in the PWA',()=>{
 const worker=fs.readFileSync('www/healthgo-offline-ai-worker.entry.js','utf8');
 const html=fs.readFileSync('www/index.html','utf8');
 const workflow=fs.readFileSync('.github/workflows/mobile-pages.yml','utf8');
 const sw=fs.readFileSync('www/service-worker.js','utf8');
 assert.match(worker,/pipeline\('text-generation',MODEL/);
 assert.match(worker,/onnx-community\/Qwen2\.5-0\.5B-Instruct/);
 assert.match(worker,/dtype:'q4f16'/);
 assert.match(worker,/device:'webgpu'/);
 assert.match(worker,/progress_callback:progress/);
 assert.match(worker,/const proof=await generator/);
 assert.match(worker,/report\('answer',\{id,answer:/);
 assert.match(html,/id="hgOfflineAiProgress"/);
 assert.match(html,/id="hgOfflineAiInstallBtn"/);
 assert.match(html,/HealthGoOfflineAI\?\.offerIfNeeded/);
 assert.match(html,/local\.ask\(\{/);
 assert.match(html,/navigator\.onLine===false/);
 assert.match(html,/healthgo-offline-ai\.js/);
 assert.match(workflow,/@huggingface\/transformers@3\.8\.1/);
 assert.match(workflow,/--outfile=\.\.\/www\/healthgo-offline-ai-worker\.js/);
 assert.match(sw,/healthgo-pwa-v17-on-device-ai-20261008/);
});
