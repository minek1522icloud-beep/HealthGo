'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const diagnostics=require('../www/healthgo-ai-diagnostics.js');
const {normalizeLocalAIResponse}=require('../local-ai-response.cjs');

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
  AbortController,console:{warn(){}},setTimeout,clearTimeout,Error,JSON,String,Array,normalizeLocalAIResponse
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
 assert.equal(payload.messages.at(-1).content,'Cześć');
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


test('Screenshot-like English drafting text is never returned as a chat answer',()=>{
 const draft="Okay, the user said '/no_think' and 'czesc'. Let me break this down.\nFirst, I need to respond in Polish.\nThe user probably wants a greeting.";
 assert.equal(normalizeLocalAIResponse(draft),'');
 assert.equal(normalizeLocalAIResponse('Cześć! Jak mogę Ci pomóc?'),'Cześć! Jak mogę Ci pomóc?');
 assert.equal(normalizeLocalAIResponse('Hello! How can I help you?'),'Hello! How can I help you?');
});

test('Reasoning tags are removed only when a genuine final answer exists',()=>{
 assert.equal(normalizeLocalAIResponse('<think>private draft</think>\nCześć!'),'Cześć!');
 assert.equal(normalizeLocalAIResponse('<think>private draft only'),'');
 assert.equal(normalizeLocalAIResponse('The user wants a greeting.\nFinal answer: Cześć!'),'Cześć!');
});

test('Qwen3 retries one invalid draft and returns only the genuine second answer',async()=>{
 let calls=0;
 const runner=createInference(async()=>{
  calls++;
  if(calls===1){
    return{ok:true,json:async()=>({
      message:{content:"Okay, the user said 'czesc'. Let me break this down.\nThe user probably wants a greeting."}
    })};
  }
  return{ok:true,json:async()=>({message:{content:'Cześć! Jak mogę Ci pomóc?'}})};
 });
 const answer=await runner.ask({message:'cześć',responseMode:'average',history:[]});
 assert.equal(answer,'Cześć! Jak mogę Ci pomóc?');
 assert.equal(calls,2);
 assert.equal(runner.requests[0].messages.at(-1).content,'cześć');
 assert.equal(runner.requests[1].messages.at(-1).content,'cześć');
 assert.equal(runner.requests[0].think,false);
 assert.equal(runner.requests[1].think,false);
});

test('Repeated drafting returns a safe error instead of exposing reasoning',async()=>{
 const draft="Okay, the user said hello. Let me break this down.";
 const runner=createInference(async()=>({ok:true,json:async()=>({message:{content:draft}})}));
 await assert.rejects(runner.ask({message:'cześć',history:[]}),/OLLAMA_DRAFT_RESPONSE/);
 assert.equal(runner.requests.length,2);
 assert.equal(diagnostics.classify({code:'OLLAMA_DRAFT_RESPONSE'},'LOCAL').code,'LOCAL_DRAFT_RESPONSE');
});

test('Previous mistaken drafting responses are not included in new model context',async()=>{
 const runner=createInference(async()=>({ok:true,json:async()=>({message:{content:'Dzień dobry!'}})}));
 const answer=await runner.ask({
  message:'Jak się masz?',
  history:[
   {role:'user',content:'Cześć'},
   {role:'assistant',content:'Okay, the user said hello. Let me break this down.'},
   {role:'assistant',content:'Cześć!'}
  ]
 });
 assert.equal(answer,'Dzień dobry!');
 assert.equal(runner.requests.length,1);
 const assistantHistory=runner.requests[0].messages.filter(x=>x.role==='assistant');
 assert.equal(assistantHistory.length,1);
 assert.equal(assistantHistory[0].content,'Cześć!');
});

test('Packaged Windows app contains final-answer sanitizer',()=>{
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 const main=fs.readFileSync('main.cjs','utf8');
 assert.ok(pkg.build.files.includes('local-ai-response.cjs'));
 assert.match(main,/normalizeLocalAIResponse/);
 assert.doesNotMatch(main,/\/no_think\\n/);
 assert.match(main,/OLLAMA_DRAFT_RESPONSE/);
});
