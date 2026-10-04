(function(){
'use strict';
const D=window.HealthGoData;
const events=new EventTarget(),subscribers=new Set();
let generation=0,unsubscribers=[],familyUnsubs=[],familyId=null,initializing=null;
const empty=()=>({uid:null,profile:null,engine:null,health:null,healthDays:[],syncEvents:[],notifications:[],family:{id:null,members:[],permissions:[],locations:[],devices:[],audit:[],invites:[],projections:{}},online:navigator.onLine,backendAvailable:false,error:null,loading:false,privacy:null,locationSettings:{enabled:false,mode:'off'},session:null});
let state=empty();
function emit(type,detail){events.dispatchEvent(new CustomEvent(type,{detail}));}
function notify(){for(const fn of subscribers){try{fn(state);}catch(_){}}emit('STATE_CHANGED',state);}
function key(area,uid){return 'healthgo_v2_'+area+'_'+(uid||state.uid||'signed-out');}
function read(area,uid){try{return JSON.parse(localStorage.getItem(key(area,uid))||'null');}catch(_){return null;}}
function save(area,value){if(!state.uid)return;try{localStorage.setItem(key(area),JSON.stringify(value));}catch(_){}}
function errorMessage(error){
 const code=String(error&&error.code||'');
 if(/unauthenticated/.test(code))return 'Zaloguj się ponownie, aby wykonać tę operację.';
 if(/permission-denied/.test(code))return 'Nie masz uprawnienia do tej operacji.';
 if(/resource-exhausted/.test(code))return 'Za dużo prób. Poczekaj chwilę i spróbuj ponownie.';
 if(/failed-precondition/.test(code))return 'Sprawdź uprawnienia lub potwierdź ponownie swoją tożsamość.';
 if(/invalid-argument/.test(code))return 'Sprawdź wprowadzone dane.';
 if(/not-found|unavailable|internal/.test(code))return 'Funkcja nie jest jeszcze dostępna. Spróbuj ponownie później.';
 return 'Nie udało się wykonać operacji. Spróbuj ponownie.';
}
async function call(name,data){
 if(!window.healthGoAuth||!window.healthGoAuth.currentUser||!window.firebase||!firebase.functions)throw new Error('Zaloguj się ponownie, aby wykonać tę operację.');
 try{
  const result=await firebase.app().functions('us-central1').httpsCallable(name)(data||{});
  return result.data;
 }catch(e){const safe=new Error(errorMessage(e));safe.code=e.code;throw safe;}
}
function watch(ref,fn,collection){
 const g=generation;
 const off=ref.onSnapshot({includeMetadataChanges:true},snap=>{
  if(g!==generation||!state.uid)return;
  const value=collection?snap.docs.map(d=>Object.assign({id:d.id},d.data())):snap.exists?snap.data():null;
  fn(value,snap);notify();
 },()=>{if(g===generation){state.error='Nie udało się odświeżyć danych. Ostatni zapis pozostaje dostępny lokalnie.';notify();}});
 return off;
}
function watchCollection(ref,fn){return watch(ref,fn,true);}
function rootRef(){return window.healthGoDb.collection('users').doc(state.uid);}
function stop(){
 generation++;for(const off of unsubscribers.splice(0))off();for(const off of familyUnsubs.splice(0))off();familyId=null;initializing=null;
 state=empty();window.healthGoCurrentUid='';window.healthGoCurrentEmail='';document.documentElement.classList.remove('hg-session-known');
 const chat=document.getElementById('aiMessages');if(chat)chat.replaceChildren();
 for(const id of ['stepsValue','distanceValue','activeValue','sleepValue','deviceSteps','deviceDistance','deviceHeart','deviceSleep']){const el=document.getElementById(id);if(el)el.textContent='Brak danych';}
 document.getElementById('accountSetup')?.classList.remove('show');
 emit('SESSION_CHANGED',null);notify();
}
function familyReset(){for(const off of familyUnsubs.splice(0))off();state.family=empty().family;}
function watchFamily(fid){
 if(fid===familyId)return;familyReset();familyId=fid||null;if(!fid){notify();return;}
 const f=window.healthGoDb.collection('families').doc(fid);state.family.id=fid;
 familyUnsubs.push(watchCollection(f.collection('members'),members=>{state.family.members=members;loadFamilyProjections();}));
 familyUnsubs.push(watchCollection(f.collection('permissions').where(state.profile?.accountType==='child'?'childUid':'guardianUid','==',state.uid),permissions=>{state.family.permissions=permissions;loadFamilyProjections();}));
 familyUnsubs.push(watchCollection(f.collection('audit').orderBy('createdAt','desc').limit(50),v=>{state.family.audit=v;}));
 familyUnsubs.push(watchCollection(f.collection('invites').where('inviterUid','==',state.uid),v=>{state.family.invites=v;}));
}
let projectionRun=0;
async function loadFamilyProjections(){
 const run=++projectionRun,g=generation,fid=state.family.id;if(!fid)return;
 const f=window.healthGoDb.collection('families').doc(fid),out={},locations=[],devices=[];
 for(const member of state.family.members){
  if(member.uid===state.uid||member.id===state.uid)continue;
  const uid=member.uid||member.id,grant=state.family.permissions.find(p=>p.childUid===uid&&p.guardianUid===state.uid),scopes=grant?.scopes||{};
  out[uid]={};
  const fields={HEALTH_ACTIVITY:'activity',HEALTH_SLEEP:'sleep',HEALTH_HEART_RATE:'heartRate',DEVICE_STATUS:'device',ACHIEVEMENTS:'achievements',CHALLENGE_PROGRESS:'challenges',NOTIFICATIONS:'notifications'};
  for(const [scope,area] of Object.entries(fields)){
   if(scopes[scope]!==true)continue;
   try{const snap=await f.collection('shared').doc(uid).collection(area).doc('latest').get();if(snap.exists)out[uid][area]=snap.data();}catch(_){}
  }
  if(out[uid].device)devices.push(Object.assign({uid},out[uid].device));
  if(scopes.LOCATION_APPROXIMATE===true||scopes.LOCATION_PRECISE===true){
   try{const snap=await f.collection('locations').doc(uid).get();if(snap.exists)locations.push(Object.assign({uid},snap.data()));}catch(_){}
  }
 }
 if(run!==projectionRun||g!==generation)return;
 state.family.projections=out;state.family.locations=locations;state.family.devices=devices;notify();
}
async function initialize(){
 if(!state.uid)return;if(initializing)return initializing;
 const g=generation;
 initializing=call('initializeHealthGo').then(result=>{
  if(g!==generation)return;
  state.backendAvailable=true;state.error=null;
  if(result.profile)state.profile=result.profile;
  if(result.engine){state.engine=result.engine;state.legacyPreview=false;}
  watchFamily(result.familyId);notify();return result;
 }).catch(e=>{if(g===generation){state.backendAvailable=false;state.error=e.message;notify();}return null;}).finally(()=>{if(g===generation)initializing=null;});
 return initializing;
}
async function start(user){
 if(state.uid===user.uid)return initialize();stop();
 const g=generation;state.uid=user.uid;state.deviceId=read('installationId')||crypto.randomUUID();save('installationId',state.deviceId);state.session={providers:(user.providerData||[]).map(p=>p.providerId),mfaFactors:user.multiFactor?.enrolledFactors?.length||0};state.loading=true;
 window.healthGoCurrentUid=user.uid;window.healthGoCurrentEmail=user.email||'';
 state.health=read('health');state.healthDays=read('days')||[];state.engine=read('engine');
 emit('SESSION_CHANGED',{uid:user.uid});notify();
 const db=window.healthGoDb;if(!db){state.loading=false;notify();return;}
 const u=db.collection('users').doc(user.uid);
 unsubscribers.push(watch(u,profile=>{
  state.settings=profile?.settingsV3||null;
  state.profile=profile?Object.assign({},profile.profile||{},{accountType:profile.accountType||profile.profile?.accountType||null,createdAt:profile.createdAt,familyId:profile.familyId||null}):null;
  if(typeof loadHealthGoCloudState==='function')loadHealthGoCloudState();
  watchFamily(profile?.familyId||null);
 }));
 unsubscribers.push(watch(u.collection('engine').doc('state'),engine=>{
  if(engine){state.engine=engine;state.legacyPreview=false;save('engine',engine);emit('ENGINE_UPDATED',engine);}
 }));
 unsubscribers.push(watch(u.collection('health').doc('latest'),(data,snap)=>{
  state.health=D.normalize(data);if(state.health)save('health',state.health);
  state.healthFromCache=!!snap.metadata.fromCache;
  emit('HEALTH_SYNCED',state.health);loadFamilyProjections();
 }));
 unsubscribers.push(watchCollection(u.collection('health').doc('daily').collection('days').orderBy('day','desc').limit(366),days=>{state.healthDays=days.map(d=>Object.assign({id:d.id},D.normalize(d)||{}));save('days',state.healthDays);}));
 unsubscribers.push(watchCollection(u.collection('syncEvents').orderBy('createdAt','desc').limit(50),v=>{state.syncEvents=v;}));
 unsubscribers.push(watchCollection(u.collection('notifications').orderBy('createdAt','desc').limit(100),v=>{state.notifications=v;}));
 unsubscribers.push(watch(u.collection('privacy').doc('current'),v=>{state.privacy=v;}));
 unsubscribers.push(watch(u.collection('locationSettings').doc('current'),v=>{state.locationSettings=v||{enabled:false,mode:'off'};}));
 await initialize();if(g!==generation)return;
 if(!state.engine&&window.HealthGoEngine&&typeof loadProgress==='function'){state.engine=HealthGoEngine.migrateLegacy(loadProgress(),new Date().toISOString());state.legacyPreview=true;}
 state.loading=false;notify();await flush();
}
async function refreshHealth(){
 if(!state.uid||!window.healthGoDb)return;
 const uid=state.uid,snap=await rootRef().collection('health').doc('latest').get();
 if(state.uid!==uid)return;
 state.health=D.normalize(snap.exists?snap.data():null);if(state.health)save('health',state.health);notify();
}
async function record(type,payload,id){
 if(!state.uid)return false;
 const event={id:id||crypto.randomUUID(),type,payload:payload||{}};
 if(!navigator.onLine||!state.backendAvailable){
  const outbox=read('outbox')||[];if(!outbox.some(e=>e.id===event.id)){outbox.push(event);save('outbox',outbox.slice(-500));}return false;
 }
 try{await call('recordProgressEvent',event);return true;}catch(e){
  if(/unavailable|internal/.test(String(e.code))){const queue=read('outbox')||[];if(!queue.some(x=>x.id===event.id))queue.push(event);save('outbox',queue.slice(-500));}
  return false;
 }
}
async function flush(){
 const uid=state.uid;if(!uid||!state.backendAvailable||!navigator.onLine)return;
 const queue=read('outbox')||[];
 for(const event of queue.slice()){if(uid!==state.uid)return;try{await call('recordProgressEvent',event);queue.splice(queue.findIndex(x=>x.id===event.id),1);save('outbox',queue);}catch(_){break;}}
}
async function markNotificationRead(id){if(state.uid)await rootRef().collection('notifications').doc(id).update({read:true,readAt:new Date().toISOString()});}
const api={events,refreshLegacy(){if(!state.engine&&window.HealthGoEngine&&typeof loadProgress==='function'){state.engine=HealthGoEngine.migrateLegacy(loadProgress(),new Date().toISOString());state.legacyPreview=true;notify();}},get state(){return state;},subscribe(fn){subscribers.add(fn);fn(state);return()=>subscribers.delete(fn);},start,stop,initialize,call,record,refreshHealth,markNotificationRead,loadFamilyProjections,
 setTitle(titleId){return call('updateProfilePreferences',{titleId});},
 errorMessage};
window.HealthGoServices=api;
window.AccountService={configure:data=>call('configureAccount',data),get profile(){return state.profile;},start,stop};
window.FamilyService={call,get state(){return state.family;}};
window.PrivacyService={get state(){return state.privacy;},update:data=>call('updateLocationSettings',data)};
window.addEventListener('online',()=>{state.online=true;notify();initialize().then(flush);refreshHealth().catch(()=>{});});
window.addEventListener('offline',()=>{state.online=false;notify();});
})();
