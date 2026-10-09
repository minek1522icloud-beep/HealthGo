(function(){
  'use strict';

  const READY_KEY='healthgo_local_ai_smol135_wasm_v2';
  const DISMISSED_KEY='healthgo_local_ai_setup_skipped_v1';
  const WORKER='./healthgo-offline-ai-worker.js?v=2';
  let worker=null;
  let nextId=1;
  let setupPending=null;
  const pending=new Map();
  let mode='idle';
  let openOnce=false;

  const el=id=>document.getElementById(id);
  function isMobile(){
    return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent||'')
      &&location.protocol==='https:';
  }
  function storedReady(){
    try{return localStorage.getItem(READY_KEY)==='1';}catch(_){return false;}
  }
  function storeReady(value){
    try{if(value)localStorage.setItem(READY_KEY,'1');else localStorage.removeItem(READY_KEY);}catch(_){}
  }
  function dismissed(){
    try{return localStorage.getItem(DISMISSED_KEY)==='1';}catch(_){return false;}
  }
  function setDismissed(){
    try{localStorage.setItem(DISMISSED_KEY,'1');}catch(_){}
  }
  function showCard(show){
    const root=el('hgOfflineAiSetup');
    if(root)root.hidden=!show;
  }
  function status(message){
    const label=el('hgOfflineAiStatus');
    if(label)label.textContent=String(message||'');
  }
  function progress(value){
    const percent=Number.isFinite(value)?Math.min(100,Math.max(0,Math.floor(value))):null;
    const bar=el('hgOfflineAiProgress');
    const meter=el('hgOfflineAiMeter');
    if(bar)bar.hidden=percent===null;
    if(meter){
      meter.style.width=(percent===null?0:percent)+'%';
      meter.setAttribute('aria-valuenow',String(percent===null?0:percent));
    }
  }
  function render(){
    const start=el('hgOfflineAiInstallBtn');
    const later=el('hgOfflineAiLaterBtn');
    const badge=el('hgOfflineAiBadge');
    if(start){
      start.disabled=mode==='downloading'||mode==='testing';
      start.textContent=mode==='ready'?'AI jest zainstalowane ✓'
        :mode==='downloading'||mode==='testing'?'Instalowanie AI…'
        :mode==='error'?'Spróbuj ponownie':'Pobierz HealthGo AI';
    }
    if(later)later.disabled=mode==='downloading'||mode==='testing';
    if(badge)badge.textContent=mode==='ready'?'AI lokalne · gotowe'
      :mode==='downloading'||mode==='testing'?'Trwa instalowanie…'
      :mode==='error'?'Nie udało się'
      :'Jednorazowa konfiguracja';
  }
  function resetWorker(code){
    if(worker){worker.terminate();worker=null;}
    if(setupPending){setupPending.reject(new Error(code||'LOCAL_WORKER_STOPPED'));setupPending=null;}
    for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error(code||'LOCAL_WORKER_STOPPED'));}
    pending.clear();
  }
  function handleMessage(event){
    const msg=event.data||{};
    if(msg.type==='stage'){
      if(mode==='downloading'||mode==='testing'){
        status(msg.label||'Trwa instalowanie modelu…');
        if(/Sprawdzam/i.test(msg.label||'')){mode='testing';render();}
      }
      return;
    }
    if(msg.type==='progress'){
      if(mode==='downloading'){
        progress(msg.percent);
        const file=String(msg.file||'plik modelu').split('/').pop();
        status('Pobieram '+file+(Number.isFinite(msg.percent)?' · '+msg.percent+'% pliku':'')+'…');
      }
      return;
    }
    if(msg.type==='ready'){
      storeReady(true);
      mode='ready';
      status('Gotowe! Model odpowiada i jest zapisany w pamięci urządzenia.');
      progress(100);
      render();
      if(setupPending){setupPending.resolve(true);setupPending=null;}
      return;
    }
    const item=pending.get(msg.id);
    if(msg.type==='answer'&&item){
      clearTimeout(item.timer);pending.delete(msg.id);item.resolve(String(msg.answer||''));
      return;
    }
    if(msg.type==='error'){
      if(item){clearTimeout(item.timer);pending.delete(msg.id);item.reject(new Error(msg.code||'LOCAL_AI_ERROR'));}
      else if(setupPending){setupPending.reject(new Error(msg.code||'LOCAL_INSTALL_ERROR'));setupPending=null;}
    }
  }
  function ensureWorker(){
    if(worker)return worker;
    if(!('Worker' in window))throw new Error('LOCAL_WORKER_UNAVAILABLE');
    const deviceWorker=new Worker(WORKER,{type:'module',name:'HealthGo On-Device AI'});
    deviceWorker.addEventListener('message',handleMessage);
    deviceWorker.addEventListener('error',()=>{
      storeReady(false);
      if(mode==='downloading'||mode==='testing'){
        mode='error';status('Nie udało się uruchomić lokalnego AI na tym telefonie.');render();
      }
      resetWorker('LOCAL_WORKER_FAILED');
    });
    worker=deviceWorker;
    return worker;
  }
  function deviceSupport(){
    if(!isMobile())return 'LOCAL_MOBILE_ONLY';
    // The compact WASM model works without navigator.gpu, including iOS PWA.
    if(!('caches' in window))return 'LOCAL_STORAGE_UNAVAILABLE';
    if(!('Worker' in window))return 'LOCAL_WORKER_UNAVAILABLE';
    if(navigator.onLine===false&&!storedReady())return 'LOCAL_DOWNLOAD_OFFLINE';
    return null;
  }
  function infoFor(error){
    const code=String(error?.message||error||'');
    if(/LOCAL_WORKER_UNAVAILABLE|LOCAL_MOBILE_ONLY/.test(code))return 'Ta przeglądarka nie pozwala uruchomić lokalnego modelu. Możesz nadal używać AI w chmurze.';
    if(/LOCAL_STORAGE|quota|QuotaExceeded/i.test(code))return 'Brak wystarczającej pamięci telefonu. Instalacja AI nie została zakończona.';
    if(/offline|Failed to fetch|network|fetch/i.test(code))return 'Pobieranie przerwane. Sprawdź internet i spróbuj ponownie.';
    if(/MODEL_NO_REPLY|LOCAL_EMPTY_ANSWER/.test(code))return 'Model został pobrany, ale nie udało się uruchomić rozmowy. Spróbuj ponownie na Wi-Fi.';
    if(/LOCAL_INSTALL_TIMEOUT|LOCAL_LOAD_TIMEOUT|LOCAL_GENERATION_TIMEOUT/i.test(code))return 'Model nie odpowiedział na czas. Spróbuj ponownie, pozostawiając HealthGo otwarte.';
    if(/LOCAL_WORKER_FAILED|DataCloneError|wasm|backend/i.test(code))return 'Silnik AI nie zadziałał na tym telefonie. Nadal możesz korzystać z chmury.';
    return 'Instalacja AI nie powiodła się. Możesz spróbować ponownie albo używać AI w chmurze.';
  }
  async function install(){
    if(mode==='downloading'||mode==='testing')return false;
    const issue=deviceSupport();
    if(issue){mode='error';status(infoFor(issue));render();showCard(true);return false;}
    mode='downloading';showCard(true);status('Przygotowuję pobieranie…');progress(null);render();
    try{
      // Check quota without claiming an estimate is a guaranteed free-space value.
      if(navigator.storage?.estimate){
        const estimate=await navigator.storage.estimate();
        if(Number.isFinite(estimate.quota)&&Number.isFinite(estimate.usage)&&estimate.quota-estimate.usage<300*1024*1024){
          throw new Error('LOCAL_STORAGE_QUOTA');
        }
      }
      const existing=setupPending;
      if(existing)return await existing.promise;
      const current=ensureWorker();
      const id=nextId++;
      let resolve,reject;
      const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
      setupPending={resolve,reject,promise};
      current.postMessage({type:'install',id});
      let installTimer=null;
      let result;
      try{
        result=await Promise.race([
          promise,
          new Promise((_,no)=>{
            installTimer=setTimeout(()=>no(new Error('LOCAL_INSTALL_TIMEOUT')),8*60*1000);
          })
        ]);
      }finally{
        if(installTimer)clearTimeout(installTimer);
      }
      if(navigator.storage?.persist){
        try{await navigator.storage.persist();}catch(_){}
      }
      return result;
    }catch(error){
      resetWorker('LOCAL_SETUP_INTERRUPTED');
      storeReady(false);
      mode='error';progress(null);status(infoFor(error));render();
      return false;
    }
  }
  async function ask({message,history,mode:chatMode,responseMode,onStatus}){
    if(!storedReady())throw new Error('LOCAL_NOT_INSTALLED');
    const issue=deviceSupport();
    if(issue&&issue!=='LOCAL_DOWNLOAD_OFFLINE')throw new Error(issue);
    const current=ensureWorker();
    if(mode!=='ready'){
      mode='testing';
      if(typeof onStatus==='function')onStatus('Ładuję lokalny model z pamięci…');
      await new Promise((resolve,reject)=>{
        const id=nextId++;
        const timer=setTimeout(()=>{
          if(setupPending){setupPending.reject(new Error('LOCAL_LOAD_TIMEOUT'));setupPending=null;}
        },110000);
        setupPending={
          resolve(value){clearTimeout(timer);resolve(value);},
          reject(error){clearTimeout(timer);reject(error);}
        };
        current.postMessage({type:'install',id});
      });
    }
    const id=nextId++;
    if(typeof onStatus==='function')onStatus('Lokalne AI przygotowuje odpowiedź…');
    return await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        resetWorker('LOCAL_GENERATION_TIMEOUT');
      },90000);
      pending.set(id,{resolve,reject,timer});
      current.postMessage({
        type:'ask',id,message:String(message||''),history:Array.isArray(history)?history.slice(-8):[],
        mode:chatMode,responseMode
      });
    });
  }
  function openInstall(){
    if(!isMobile())return;
    openOnce=true;
    showCard(true);
    if(mode==='idle'){
      mode=storedReady()?'ready':'idle';
      status(storedReady()
        ?'Model jest zapisany na tym telefonie. Przy pierwszym pytaniu wczytamy go do pamięci.'
        :'Pobierz lżejszy model SmolLM2 (około 182 MB). Zalecamy Wi-Fi i przynajmniej 300 MB wolnego miejsca. Nie zamykaj aplikacji podczas pobierania.');
      render();
    }
  }
  function offerIfNeeded(){
    if(!isMobile()||openOnce||storedReady()||dismissed())return;
    openInstall();
  }
  function later(){
    setDismissed();
    showCard(false);
  }
  window.HealthGoOfflineAI={
    install,ask,openInstall,offerIfNeeded,later,available:storedReady,
    get status(){return mode;},
    get busy(){return mode==='downloading'||mode==='testing';},
    close:()=>showCard(false)
  };
  function wireControls(){
    el('hgOfflineAiInstallBtn')?.addEventListener('click',()=>{void install();});
    el('hgOfflineAiLaterBtn')?.addEventListener('click',later);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wireControls,{once:true});
  else wireControls();
})();
