'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const diagnostics=require('../www/healthgo-ai-diagnostics.js');

function createInference(responseFactory,model='qwen3:4b'){
 const source=fs.readFileSync('main.cjs','utf8');
 const start=source.indexOf('async function askLocalOllama(data) {');
 const end=source.indexOf('\nfunction startAIServer()',start);
 assert.ok(start>=0&&end>start,'Local Ollama function not found');
 const requests=[];
 const sandbox={
  activeOllamaModel:model,
  OLLAMA_BASE_URL:'http://127.0.0.1:11434',
  ensureOllamaRunning:async()=>true,
  chooseOllamaModel:async()=>model,
  fetch:async(url,opts)=>{
   assert.equal(url,'http://127.0.0.1:11434/api/chat');
   const body=JSON.parse(opts.body);
   requests.push(body);
   return responseFactory(body);
  },
  AbortController,console:{warn(){}},setTimeout,clearTimeout,Error,JSON,String,Array
 };
 vm.createContext(sandbox);
 vm.runInContext(source.slice(start,end),sandbox,{filename:'local-ollama-function.js'});
 return{ask:input=>sandbox.askLocalOllama(input),requests};
}

test('Qwen3 returns actual text instead of spending short-mode budget on thinking',async()=>{
 const runner=createInference(async body=>({
  ok:true,
  json:async()=>({done:true,done_reason:'stop',message:{role:'assistant',content:'Cześć!'}})
 }));
 const answer=await runner.ask({
  message:'Cześć',mode:'assistant',responseMode:'average',
  history:[{role:'user',content:'Jak się masz?'}]
 });
 assert.equal(answer,'Cześć!');
 assert.equal(runner.requests.length,1);
 const payload=runner.requests[0];
 assert.equal(payload.think,false);
 assert.equal(payload.stream,false);
 assert.equal(payload.keep_alive,'10m');
 assert.equal(payload.options.num_predict,420);
 assert.match(payload.messages.at(-1).content,/^\/no_think\nCześć/);
 assert.equal(payload.messages[1].role,'user');
});

test('All effort modes give Qwen3 adequate answer budgets without changing safety instructions',async()=>{
 const runner=createInference(async()=>({
  ok:true,
  json:async()=>({message:{content:'Odpowiedź'}})
 }));
 await runner.ask({message:'Pytanie pierwsze',responseMode:'average',history:[]});
 await runner.ask({message:'Pytanie drugie',responseMode:'medium',history:[]});
 await runner.ask({message:'Pytanie trzecie',responseMode:'high',history:[]});
 assert.deepEqual(runner.requests.map(x=>x.options.num_predict),[420,900,1600]);
 assert.ok(runner.requests.every(x=>x.think===false));
 assert.ok(runner.requests.every(x=>x.messages[0].content.includes('W sprawach zdrowotnych')));
});

test('Qwen3 empty visible output is distinguishable from a missing Ollama model',async()=>{
 const runner=createInference(async()=>({
  ok:true,
  json:async()=>({message:{content:'',thinking:'internal reasoning'},done_reason:'length'})
 }));
 await assert.rejects(runner.ask({message:'Cześć',responseMode:'average'}),/OLLAMA_EMPTY_RESPONSE/);
 const diagnosed=diagnostics.classify({code:'OLLAMA_EMPTY_RESPONSE',message:'Model zakończył generowanie bez treści odpowiedzi.'},'LOCAL');
 assert.equal(diagnosed.code,'LOCAL_EMPTY_RESPONSE');
});

test('Local engine 500 error is propagated to the backend for a useful diagnostic',async()=>{
 const runner=createInference(async()=>({
  ok:false,status:500,json:async()=>({error:'could not load model'})
 }));
 await assert.rejects(async()=>{
  try{await runner.ask({message:'Cześć'});}
  catch(e){assert.equal(e.status,500);throw e;}
 },/could not load model/);
});

test('Diagnostic UI validates real inference instead of only reading installed model tags',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const main=fs.readFileSync('main.cjs','utf8');
 assert.match(html,/Testuję odpowiedź/);
 assert.match(html,/message:'Odpowiedz jednym słowem: OK\.'/);
 assert.match(html,/Test udany — model rzeczywiście odpowiada/);
 assert.match(html,/probe\.ok&&typeof result\.answer==='string'/);
 assert.match(main,/OLLAMA_EMPTY_RESPONSE/);
 assert.match(main,/think:\s*\n?\s*false/);
});
