(function(){
 'use strict';

 const READY_KEY='healthgo_local_ai_smol135_wasm_v2';
 const INTERRUPTED_KEY='healthgo_local_ai_download_interrupted_v1';
 const DISMISSED_KEY='healthgo_local_ai_setup_skipped_v1';
 const DOWNLOAD_WORKER='./healthgo-ai-download-worker.js?v=1';
 const INFERENCE_WORKER='./healthgo-offline-ai-worker.js?v=2';
 const CACHE_NAME='transformers-cache';
 const MODEL_BASE='https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX-MHA/resolve/main/';
 const REQUIRED_FILES=['config.json','tokenizer.json','tokenizer_config.json','generation_config.json','onnx/model_q4.onnx'];
 let downloader=null,inference=null;
 let installed=false,checked=false,localActive=false,installInFlight=false;
 let mode='idle',opened=false,nextId=1;
 let installPending=null,warmupPending=null;
 const pending=new Map();
 const el=id=>document.getElementById(id);
 const phone=()=>/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent||'')&&location.protocol==='https:';
 const isBusy=()=>installInFlight||mode==='downloading'||mode==='testing'||pending.size>0;
 function interrupted(){try{return localStorage.getItem(INTERRUPTED_KEY)==='1';}catch(_){return false;}}
 function markInterrupted(value){try{if(value)localStorage.setItem(INTERRUPTED_KEY,'1');else localStorage.removeItem(INTERRUPTED_KEY);}catch(_){}}
 function markInstalled(value){
  installed=!!value;
  try{
   if(installed)localStorage.setItem(READY_KEY,'1');
   else localStorage.removeItem(READY_KEY);
  }catch(_){}
 }
 function dismissed(){
  try{return localStorage.getItem(DISMISSED_KEY)==='1'}catch(_){return false;}
 }
 function showCard(show){const x=el('hgOfflineAiSetup');if(x)x.hidden=!show;}
 function status(message){const x=el('hgOfflineAiStatus');if(x)x.textContent=String(message||'');}
 function progress(value){
  const valueNumber=Number.isFinite(value)?Math.min(100,Math.max(0,Math.floor(value))):null;
  const shell=el('hgOfflineAiProgress'),meter=el('hgOfflineAiMeter');
  if(shell)shell.hidden=valueNumber===null;
  if(meter){
   meter.style.width=(valueNumber===null?0:valueNumber)+'%';
   meter.setAttribute('aria-valuenow',String(valueNumber===null?0:valueNumber));
  }
 }
 function render(){
  const action=el('hgOfflineAiInstallBtn'),later=el('hgOfflineAiLaterBtn');
  const tester=el('hgOfflineAiTryLocalBtn'),badge=el('hgOfflineAiBadge');
  const deviceBadge=el('hgOfflineAiDeviceBadge');
  if(action){
   action.disabled=isBusy()||installed;
   action.textContent=mode==='downloading'?'Pobieranie AI…'
    :mode==='testing'?'Uruchamiam model…'
    :installed?'Model pobrany ✓'
    :interrupted()?'Wznów pobieranie AI':mode==='error'?'Spróbuj pobrać ponownie':'Pobierz HealthGo AI';
  }
  if(later)later.disabled=mode==='downloading';
  if(tester){
   tester.hidden=!installed;
   tester.disabled=isBusy();
   tester.textContent=localActive?'✓ Lokalne AI działa teraz':'Uruchom lokalne AI';
  }
  if(badge)badge.textContent=localActive?'Lokalne AI aktywne'
   :installed?'Pliki AI zapisane na tym telefonie'
   :mode==='downloading'?'Trwa pobieranie'
   :mode==='testing'?'Sprawdzam model'
   :mode==='error'?'Wymagana ponowna próba'
   :'Jednorazowa konfiguracja';
  if(deviceBadge){
   deviceBadge.textContent=localActive?'✓ Lokalne AI działa'
    :installed?'✓ Model AI na tym telefonie'
    :interrupted()?'↻ Pobieranie przerwane — wznów'
    :checked?'↓ Model AI niepobrany'
    :'Sprawdzam pliki AI…';
   deviceBadge.setAttribute('data-installed',String(installed));
  }
 }
 async function verifyStored(){
  try{
   if(!('caches' in window))throw Error('LOCAL_STORAGE_UNAVAILABLE');
   const cache=await caches.open(CACHE_NAME);
   for(const file of REQUIRED_FILES){
    if(!(await cache.match(MODEL_BASE+file))){
     markInstalled(false);
     if(mode!=='downloading'&&mode!=='testing')mode='idle';
     return false;
    }
   }
   markInstalled(true);
   markInterrupted(false);
   if(mode==='idle'||mode==='error')mode='downloaded';
   return true;
  }catch(_){
   markInstalled(false);
   if(mode!=='downloading'&&mode!=='testing')mode='idle';
   return false;
  }finally{
   checked=true;
   render();
  }
 }
 function infoFor(error){
  const message=String(error?.message||error||'');
  if(/LOCAL_STORAGE|QuotaExceeded|quota/i.test(message))return 'Telefon nie ma wystarczającej pamięci na model. Możesz nadal korzystać z AI w chmurze.';
  if(/LOCAL_WORKER_UNAVAILABLE/i.test(message))return 'Ta wersja iOS nie obsługuje lokalnego modułu AI. Możesz używać chmury.';
  if(/HTTP_|Failed to fetch|network|fetch|AbortError/i.test(message))return 'Nie udało się pobrać wszystkich plików AI. Sprawdź Wi-Fi i spróbuj ponownie.';
  if(/TIMEOUT/i.test(message))return 'Model nie odpowiedział na czas. Możesz korzystać z AI w chmurze.';
  if(/MODEL_NO_REPLY|LOCAL_EMPTY_ANSWER/i.test(message))return 'Pliki są zapisane, ale model nie odpowiedział. Możesz używać AI w chmurze.';
  return 'Nie udało się ukończyć działania AI na tym telefonie. Spróbuj ponownie albo użyj chmury.';
 }
 function resetDownloader(error){
  if(downloader){downloader.terminate();downloader=null;}
  if(installPending){
   const item=installPending;installPending=null;clearTimeout(item.timer);
   item.reject(new Error(error||'LOCAL_DOWNLOAD_INTERRUPTED'));
  }
 }
 function resetInference(error){
  if(inference){inference.terminate();inference=null;}
  localActive=false;
  if(warmupPending){
   const item=warmupPending;warmupPending=null;clearTimeout(item.timer);
   item.reject(new Error(error||'LOCAL_WARMUP_INTERRUPTED'));
  }
  for(const item of pending.values()){
   clearTimeout(item.timer);
   item.reject(new Error(error||'LOCAL_INFERENCE_INTERRUPTED'));
  }
  pending.clear();
  if(mode==='ready'||mode==='testing')mode=installed?'downloaded':'idle';
  render();
 }
 async function onDownload(event){
  const msg=event.data||{};
  if(msg.type==='stage'){if(mode==='downloading')status(msg.label||'Pobieram pliki…');return;}
  if(msg.type==='progress'){
   if(mode==='downloading'){
    progress(msg.percent);
    status('Pobieram model na telefon'+(Number.isFinite(msg.percent)?' · '+msg.percent+'% pliku':'')+'…');
   }
   return;
  }
  if(msg.type==='downloaded'){
   const item=installPending;
   if(!item)return;
   const good=await verifyStored();
   if(!good){
    item.reject(new Error('LOCAL_MODEL_CACHE_INCOMPLETE'));
    return;
   }
   status('Pliki modelu zapisane na tym telefonie. Możesz korzystać z AI w chmurze albo osobno uruchomić lokalny model.');
   progress(100);
   mode='downloaded';render();
   item.resolve(true);
  }else if(msg.type==='error'&&installPending){
   installPending.reject(new Error(msg.code||'LOCAL_DOWNLOAD_ERROR'));
  }
 }
 function onInference(event){
  const msg=event.data||{};
  if(msg.type==='ready'){
   if(warmupPending){
    localActive=true;mode='ready';render();
    const item=warmupPending;warmupPending=null;clearTimeout(item.timer);
    item.resolve(true);
   }
   return;
  }
  if(msg.type==='stage'){
   if(warmupPending)status(msg.label||'Uruchamiam model…');
   for(const item of pending.values())if(typeof item.onStatus==='function')item.onStatus(msg.label||'Lokalne AI pracuje…');
   return;
  }
  const item=pending.get(msg.id);
  if(msg.type==='answer'&&item){
   pending.delete(msg.id);clearTimeout(item.timer);item.resolve(String(msg.answer||''));render();
  }else if(msg.type==='error'){
   if(item){pending.delete(msg.id);clearTimeout(item.timer);item.reject(new Error(msg.code||'LOCAL_ERROR'));}
   else if(warmupPending)warmupPending.reject(new Error(msg.code||'LOCAL_WARMUP_ERROR'));
  }
 }
 function newDownloader(){
  if(downloader)return downloader;
  if(!('Worker' in window))throw new Error('LOCAL_WORKER_UNAVAILABLE');
  downloader=new Worker(DOWNLOAD_WORKER,{name:'HealthGo AI download'});
  downloader.addEventListener('message',event=>{void onDownload(event);});
  downloader.addEventListener('error',()=>resetDownloader('LOCAL_DOWNLOAD_WORKER_ERROR'));
  return downloader;
 }
 function newInference(){
  if(inference)return inference;
  if(!('Worker' in window))throw new Error('LOCAL_WORKER_UNAVAILABLE');
  inference=new Worker(INFERENCE_WORKER,{type:'module',name:'HealthGo local AI'});
  inference.addEventListener('message',onInference);
  inference.addEventListener('error',()=>resetInference('LOCAL_INFERENCE_WORKER_ERROR'));
  return inference;
 }
 async function install(){
  if(isBusy()||!phone())return false;
  installInFlight=true;
  try{
  showCard(true);
  if(await verifyStored()){
   mode='downloaded';status('Model jest już pobrany na ten telefon.');render();return true;
  }
  if(navigator.onLine===false){mode='error';status('Do pierwszego pobrania AI potrzebujesz internetu.');render();return false;}
  mode='downloading';progress(null);status('Zapisuję pliki modelu w pamięci telefonu…');render();
  try{
   if(navigator.storage?.estimate){
    const estimate=await navigator.storage.estimate();
    if(Number.isFinite(estimate.quota)&&Number.isFinite(estimate.usage)&&estimate.quota-estimate.usage<300*1024*1024)
     throw new Error('LOCAL_STORAGE_QUOTA');
   }
   const download=newDownloader();
   markInterrupted(true);
   const id=nextId++;
   const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('LOCAL_INSTALL_TIMEOUT')),8*60*1000+10000);
    installPending={resolve,reject,timer};
    download.postMessage({type:'download',id});
   });
   if(navigator.storage?.persist){try{await navigator.storage.persist();}catch(_){}}
   return result;
  }catch(error){
   mode='error';status(infoFor(error));progress(null);render();
   return false;
  }finally{
   resetDownloader();
   if(mode==='downloading')mode=installed?'downloaded':'error';
   render();
  }
  }finally{
   installInFlight=false;
   render();
  }
 }
 async function startLocal(){
  if(isBusy())return false;
  if(!(await verifyStored())){
   status('Pliki modelu zniknęły z pamięci Safari. Pobierz model ponownie.');
   mode='idle';render();return false;
  }
  showCard(true);
  if(localActive)return true;
  mode='testing';status('Uruchamiam model na tym telefonie. To może potrwać.');render();
  try{
   const model=newInference();
   const id=nextId++;
   const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('LOCAL_LOAD_TIMEOUT')),65000);
    warmupPending={resolve,reject,timer};
    model.postMessage({type:'warmup',id});
   });
   status('Lokalny model odpowiada. Możesz teraz rozmawiać bez internetu.');
   return result;
  }catch(error){
   status(infoFor(error));
   resetInference('LOCAL_WARMUP_INTERRUPTED');
   return false;
  }finally{
   if(warmupPending){clearTimeout(warmupPending.timer);warmupPending=null;}
   if(mode==='testing')mode=installed?'downloaded':'idle';
   render();
  }
 }
 async function ask({message,history,mode:chatMode,responseMode,onStatus}){
  if(!localActive||!installed)throw new Error('LOCAL_NOT_ACTIVE');
  const current=newInference();
  const id=nextId++;
  if(typeof onStatus==='function')onStatus('Lokalne AI przygotowuje odpowiedź…');
  return await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{resetInference('LOCAL_GENERATION_TIMEOUT');},60000);
   pending.set(id,{resolve,reject,timer,onStatus});
   current.postMessage({type:'ask',id,message:String(message||''),history:Array.isArray(history)?history.slice(-8):[],mode:chatMode,responseMode});
  });
 }
 function openInstall(){
  if(!phone())return;
  opened=true;showCard(true);
  if(mode==='idle'&&installed)mode='downloaded';
  status(installed?'Model AI jest pobrany na ten telefon. Możesz osobno uruchomić lokalne AI.'
   :'Pobierz pliki AI (około 182 MB) przez Wi-Fi. Nie zamykaj aplikacji podczas pobierania.');
  render();
 }
 async function offerIfNeeded(){
  if(!phone())return;
  await verifyStored();
  if(!opened&&!installed&&!dismissed())openInstall();
 }
 function later(){
  try{localStorage.setItem(DISMISSED_KEY,'1');}catch(_){}
  showCard(false);
 }
 function wireControls(){
  el('hgOfflineAiInstallBtn')?.addEventListener('click',()=>{void install();});
  el('hgOfflineAiTryLocalBtn')?.addEventListener('click',()=>{void startLocal();});
  el('hgOfflineAiLaterBtn')?.addEventListener('click',later);
  void verifyStored();
  render();
 }
 window.HealthGoOfflineAI={
  install,ask,startLocal,openInstall,offerIfNeeded,later,verifyStored,
  available:()=>installed&&localActive,
  get installed(){return installed;},
  get busy(){return isBusy();},
  get status(){return mode;},
  close:()=>showCard(false)
 };
 // Release heavy model memory when iOS moves the Home Screen app to background.
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'&&localActive)resetInference('LOCAL_APP_BACKGROUND');
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wireControls,{once:true});
 else wireControls();
})();
