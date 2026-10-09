'use strict';
// Download the actual quantized model to the Transformers.js Cache API without
// ever creating an ONNX session. Safari can otherwise kill the standalone app
// during "installation" due to the combined model + generation memory peak.
const MODEL='onnx-community/SmolLM2-135M-Instruct-ONNX-MHA';
const CACHE='transformers-cache';
const FILES=['config.json','tokenizer.json','tokenizer_config.json','generation_config.json','onnx/model_q4.onnx'];
const WEIGHT_BYTES=182000000;
const BASE='https://huggingface.co/'+MODEL+'/resolve/main/';
let downloading=false;
const send=(type,data={})=>self.postMessage({type,...data});
function modelUrl(file){return BASE+file;}
async function install(id){
 if(downloading){send('error',{id,code:'LOCAL_DOWNLOAD_BUSY'});return;}
 downloading=true;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8*60*1000);
 try{
  if(!self.caches)throw new Error('LOCAL_STORAGE_UNAVAILABLE');
  const cache=await caches.open(CACHE);
  for(const [index,file] of FILES.entries()){
   const url=modelUrl(file);
   if(await cache.match(url)){
    send('stage',{label:'Plik '+(index+1)+'/'+FILES.length+' jest już zapisany.'});
    continue;
   }
   send('stage',{label:'Pobieram plik '+(index+1)+' z '+FILES.length+'…'});
   const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
   if(!response.ok||!response.body)throw new Error('LOCAL_DOWNLOAD_HTTP_'+response.status);
   // Stream bytes directly to CacheStorage; never allocate an in-memory
   // arrayBuffer of the ~182MB ONNX weight file in an iPhone WebContent tab.
   let downloaded=0;
   const total=Number(response.headers.get('Content-Length'))|| (file.endsWith('.onnx')?WEIGHT_BYTES:0);
   const counted=response.body.pipeThrough(new TransformStream({
    transform(chunk,ctl){
     downloaded+=chunk.byteLength;
     if(file.endsWith('.onnx')){
      send('progress',{file,percent:total?Math.min(99,Math.floor(100*downloaded/total)):null,bytes:downloaded});
     }
     ctl.enqueue(chunk);
    }
   }));
   await cache.put(url,new Response(counted,{
    status:response.status,
    statusText:response.statusText,
    headers:new Headers({'Content-Type':response.headers.get('Content-Type')||'application/octet-stream'})
   }));
  }
  for(const file of FILES)if(!(await cache.match(modelUrl(file))))
   throw new Error('LOCAL_MODEL_CACHE_INCOMPLETE');
  send('downloaded',{id,model:MODEL});
 }catch(error){
  const raw=String(error?.message||error||'LOCAL_DOWNLOAD_ERROR');
  send('error',{id,code:raw==='AbortError'?'LOCAL_INSTALL_TIMEOUT':raw.slice(0,160)});
 }finally{
  clearTimeout(timer);
  downloading=false;
 }
}
self.addEventListener('message',event=>{
 const message=event.data||{};
 if(message.type==='download'&&Number.isSafeInteger(message.id)&&message.id>0){
  void install(message.id);
 }
});
