'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const models=require('../desktop-ai-models.cjs');

test('Qwen3 4B default is a thinking-only model, while Qwen3 Instruct is conversational',()=>{
 assert.equal(models.RECOMMENDED_MODEL,'qwen3:4b-instruct');
 assert.equal(models.isThinkingOnlyModel('qwen3:4b'),true);
 assert.equal(models.isThinkingOnlyModel('qwen3:4b-thinking'),true);
 assert.equal(models.isThinkingOnlyModel('qwen3:4b-instruct'),false);
 assert.equal(models.isConversationModel('qwen3:4b'),false);
 assert.equal(models.isConversationModel('qwen3:4b-instruct'),true);
});

test('Model selector avoids broken default and chooses existing nonthinking model',()=>{
 assert.equal(models.chooseConversationModel(['qwen3:4b']),null);
 assert.equal(models.chooseConversationModel(['qwen3:4b','qwen3:4b-instruct']),models.RECOMMENDED_MODEL);
 assert.equal(models.chooseConversationModel(['qwen3:4b','qwen2.5:3b']),'qwen2.5:3b');
 assert.equal(models.chooseConversationModel([]),null);
 assert.equal(models.chooseConversationModel(['qwen3:4b-instruct'],'qwen3:4b'),'qwen3:4b-instruct');
});

test('The local endpoint reports missing conversation model instead of generating more drafts',()=>{
 const main=fs.readFileSync('main.cjs','utf8');
 const html=fs.readFileSync('www/index.html','utf8');
 const diag=fs.readFileSync('www/healthgo-ai-diagnostics.js','utf8');
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 assert.ok(pkg.build.files.includes('desktop-ai-models.cjs'));
 assert.match(main,/throw new Error\('OLLAMA_INSTRUCT_REQUIRED'\)/);
 assert.match(main,/getInstalledOllamaModels/);
 assert.match(main,/chooseConversationModel\(names,OLLAMA_MODEL\)/);
 assert.match(main,/requestUrl\.pathname === '\/api\/ai\/install-model'/);
 assert.match(main,/allowedOrigin/);
 assert.match(html,/Pobierz model rozmowy \(~2,5 GB\)/);
 assert.match(html,/confirm\('HealthGo pobierze model/);
 assert.match(diag,/ollama_instruct_required/);
});

test('Model is downloaded only on user-approved endpoint, never on app startup',()=>{
 const main=fs.readFileSync('main.cjs','utf8');
 const i=main.indexOf('async function pullRecommendedModel()');
 const j=main.indexOf('async function isOllamaRunning()',i);
 assert.ok(i>0&&j>i);
 const segment=main.slice(i,j);
 assert.match(segment,/stream:true/);
 assert.match(segment,/data\.status==='success'/);
 assert.match(segment,/modelDownload\.success=true/);
 const boot=main.slice(main.indexOf('app.whenReady().then('));
 assert.doesNotMatch(boot,/pullRecommendedModel\(/);
});

test('Streaming install updates progress and confirms the installed model',async()=>{
 const main=fs.readFileSync('main.cjs','utf8');
 const i=main.indexOf('async function pullRecommendedModel()');
 const j=main.indexOf('async function isOllamaRunning()',i);
 let installed=false,postCount=0;
 const lines=[
  '{"status":"pulling manifest"}\n',
  '{"status":"downloading 1234","total":100,"completed":48}\n',
  '{"status":"success"}\n'
 ];
 const bytes=lines.map(line=>new TextEncoder().encode(line));
 const context={
  modelDownload:{active:false,status:'',percent:0,error:'',success:false},
  modelDownloadTask:null,
  RECOMMENDED_MODEL:'qwen3:4b-instruct',
  OLLAMA_BASE_URL:'http://127.0.0.1:11434',
  ensureOllamaRunning:async()=>true,
  getInstalledOllamaModels:async()=>installed?['qwen3:4b-instruct']:['qwen3:4b'],
  fetch:async(_url,opts)=>{
   postCount++;
   const body=JSON.parse(opts.body);
   assert.equal(body.name,'qwen3:4b-instruct');
   assert.equal(body.stream,true);
   let pos=0;
   return{
    ok:true,
    body:{getReader(){return{
     async read(){
      if(pos===bytes.length){installed=true;return{done:true}}
      return{done:false,value:bytes[pos++]};
     },
     releaseLock(){}
    }}}
   };
  },
  TextDecoder,console:{error(){}}
 };
 vm.createContext(context);
 vm.runInContext(main.slice(i,j),context,{filename:'desktop-model-pull.js'});
 await context.pullRecommendedModel();
 assert.equal(postCount,1);
 assert.equal(context.modelDownload.percent,100);
 assert.equal(context.modelDownload.success,true);
 assert.equal(context.modelDownload.active,false);
 assert.equal(context.modelDownload.error,'');
});

test('Download failure is recoverable and cannot leave busy state stuck',async()=>{
 const main=fs.readFileSync('main.cjs','utf8');
 const i=main.indexOf('async function pullRecommendedModel()');
 const j=main.indexOf('async function isOllamaRunning()',i);
 const context={
  modelDownload:{active:false,status:'',percent:0,error:'',success:false},
  modelDownloadTask:null,
  RECOMMENDED_MODEL:'qwen3:4b-instruct',
  OLLAMA_BASE_URL:'http://127.0.0.1:11434',
  ensureOllamaRunning:async()=>true,
  getInstalledOllamaModels:async()=>['qwen3:4b'],
  fetch:async()=>({ok:false,status:503}),
  TextDecoder,console:{error(){}}
 };
 vm.createContext(context);
 vm.runInContext(main.slice(i,j),context,{filename:'desktop-model-pull.js'});
 await context.pullRecommendedModel();
 assert.equal(context.modelDownload.active,false);
 assert.equal(context.modelDownload.success,false);
 assert.match(context.modelDownload.error,/MODEL_DOWNLOAD_HTTP_503/);
});
