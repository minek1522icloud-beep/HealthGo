'use strict';

/**
 * Runs update checks in the packaged desktop app, even if GitHub publishes a
 * release after HealthGo was launched. One check at a time; network errors are
 * retried during the next periodic/focus check, not treated as installed.
 */
function createAutomaticUpdateChecks({
  check,
  isBusy=()=>false,
  intervalMs=10*60*1000,
  minGapMs=2*60*1000,
  now=()=>Date.now(),
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval,
  onError=()=>{}
}){
  if(typeof check!=='function')throw new TypeError('check must be a function');
  let started=false;
  let checking=false;
  let lastCheckAt=null;
  let timer=null;

  async function checkNow(reason='periodic'){
    if(!started||checking||isBusy())return false;
    const at=now();
    if(lastCheckAt!==null&&at-lastCheckAt<minGapMs)return false;
    lastCheckAt=at;
    checking=true;
    try{
      await check(reason);
      return true;
    }catch(error){
      try{onError(error,reason)}catch(_){}
      return false;
    }finally{
      checking=false;
    }
  }

  function start(){
    if(started)return;
    started=true;
    timer=setIntervalFn(()=>{void checkNow('periodic')},intervalMs);
    if(timer&&typeof timer.unref==='function')timer.unref();
    void checkNow('startup');
  }

  function stop(){
    started=false;
    if(timer!==null){
      clearIntervalFn(timer);
      timer=null;
    }
  }

  return {start,stop,checkNow,get isRunning(){return started}};
}

module.exports={createAutomaticUpdateChecks};
