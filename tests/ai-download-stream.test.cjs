'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('Model files are streamed to persistent browser cache without loading inference',async()=>{
 const source=fs.readFileSync('www/healthgo-ai-download-worker.js','utf8');
 const saved=new Map(),messages=[],requested=[];
 let onMessage,finish;
 const done=()=>new Promise(resolve=>{finish=resolve;});
 const cache={match:async url=>saved.has(url)?{ok:true}:null,
  put:async(url,response)=>{saved.set(url,(await response.arrayBuffer()).byteLength);}
 };
 const handlers={};
 const ctx={
  self:{addEventListener:(type,fn)=>{handlers[type]=fn;},postMessage(message){
   messages.push(message);
   if((message.type==='downloaded'||message.type==='error')&&finish)finish(message);
  }},
  caches:{open:async key=>{assert.equal(key,'transformers-cache');return cache;}},
  fetch:async url=>{
   requested.push(url);
   return new Response(new Uint8Array(128),{status:200,headers:{
    'Content-Type':'application/octet-stream','Content-Length':'128'
   }});
  },
  Response,Headers,TransformStream,AbortController,
  setTimeout,clearTimeout,Promise,Number,String,Error,Math
 };
 vm.runInNewContext(source,ctx,{filename:'healthgo-ai-download-worker.js'});
 assert.equal(typeof handlers.message,'function');
 let wait=done();
 handlers.message({data:{type:'download',id:1}});
 const result=await wait;
 assert.equal(result.type,'downloaded');
 assert.equal(saved.size,5);
 assert.equal(requested.length,5);
 assert.ok(requested.some(url=>url.endsWith('/onnx/model_q4.onnx')));
 assert.equal(messages.filter(m=>m.type==='progress').length>0,true);
 // The second install reuses completed Cache Storage files.
 wait=done();
 handlers.message({data:{type:'download',id:2}});
 assert.equal((await wait).type,'downloaded');
 assert.equal(requested.length,5,'already cached model does not re-download');
});

test('Download failure reports an error and does not pretend installation completed',async()=>{
 const source=fs.readFileSync('www/healthgo-ai-download-worker.js','utf8');
 let handler=null,notify;
 const result=new Promise(resolve=>{notify=resolve;});
 vm.runInNewContext(source,{
  self:{addEventListener:(_type,fn)=>{handler=fn;},postMessage(message){
   if(message.type==='error'||message.type==='downloaded')notify(message);
  }},
  caches:{open:async()=>({match:async()=>null,put:async()=>{throw Error('cache full');}})},
  fetch:async()=>new Response(new Uint8Array(2),{status:200}),
  Response,Headers,TransformStream,AbortController,
  setTimeout,clearTimeout,Promise,Number,String,Math,Error
 });
 handler({data:{type:'download',id:1}});
 const message=await result;
 assert.equal(message.type,'error');
 assert.match(message.code,/cache full/);
});
