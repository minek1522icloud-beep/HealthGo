(function(){
'use strict';
const D=window.HealthGoData,Engine=window.HealthGoEngine,S=window.HealthGoSupabase;
const events=new EventTarget(),subscribers=new Set();
let generation=0,pollTimer=null,initializing=null;
const emptyFamily=()=>({id:null,members:[],permissions:[],locations:[],devices:[],audit:[],invites:[],projections:{}});
const empty=()=>({uid:null,profile:null,engine:null,health:null,healthDays:[],syncEvents:[],notifications:[],devices:[],family:emptyFamily(),online:navigator.onLine,backendAvailable:false,error:null,loading:false,privacy:null,locationSettings:{enabled:false,mode:'off'},session:null,cloudState:null});
let state=empty();

function emit(type,detail){events.dispatchEvent(new CustomEvent(type,{detail}));}
function notify(){for(const fn of subscribers){try{fn(state);}catch(_){}}emit('STATE_CHANGED',state);}
function key(area,uid){return 'healthgo_v2_'+area+'_'+(uid||state.uid||'signed-out');}
function read(area,uid){try{return JSON.parse(localStorage.getItem(key(area,uid))||'null');}catch(_){return null;}}
function saveFor(area,uid,value){if(!uid)return;try{localStorage.setItem(key(area,uid),JSON.stringify(value));}catch(_){}}
function save(area,value){saveFor(area,state.uid,value);}
function errorMessage(error){
 const raw=String(error&&((error.code)||(error.message))||'').toLowerCase();
 if(/unauth|jwt|token/.test(raw))return 'Zaloguj się ponownie, aby wykonać tę operację.';
 if(/account-type-locked/.test(raw))return 'Typ konta jest zablokowany po pierwszej konfiguracji.';
 if(/guardian-account-required/.test(raw))return 'Rodzinę może utworzyć tylko konto Rodzica / Opiekuna.';
 if(/permission|row-level|rls|denied/.test(raw))return 'Nie masz uprawnienia do tej operacji.';
 if(/rate|429|too many/.test(raw))return 'Za dużo prób. Poczekaj chwilę i spróbuj ponownie.';
 if(/invalid|violat|check constraint/.test(raw))return 'Sprawdź wprowadzone dane.';
 if(/function.*not found|schema cache|pgrst202/.test(raw))return 'Backend Supabase wymaga jeszcze migracji HealthGo.';
 if(/network|fetch|failed to fetch|offline/.test(raw))return 'Brak połączenia z chmurą. Dane lokalne pozostają dostępne.';
 return 'Nie udało się wykonać operacji. Spróbuj ponownie.';
}
function ensureSession(){
 if(!state.uid||!S||!S.hasSession()||!S.auth.currentUser||S.auth.currentUser.id!==state.uid){
  const e=new Error('unauthenticated');e.code='unauthenticated';throw e;
 }
}
function legacyProfile(row){
 if(!row)return null;
 return{id:row.id,nickname:row.display_name||'',displayName:row.display_name||'',accountType:row.account_type||'standard',configured:row.account_type_locked===undefined?!!row.display_name:!!row.account_type_locked,xp:Number(row.xp)||0,level:Number(row.level)||1,createdAt:row.created_at||null,familyId:state.family&&state.family.id||null};
}
function healthRow(row){
 if(!row)return null;
 return D&&D.normalize?D.normalize({
  schemaVersion:2,steps:row.steps,distanceKm:row.distance_meters==null?null:Number(row.distance_meters)/1000,
  activeMinutes:row.active_minutes,heartRate:row.heart_rate,sleepMinutes:row.sleep_minutes,
  source:row.source||'Supabase',day:row.activity_date,timestamp:row.updated_at,updatedAt:row.updated_at
 }):null;
}
function rebuildEngine(rows,profile){
 let engine=null;
 try{engine=Engine&&Engine.createState?Engine.createState(null,new Date().toISOString()):null;}catch(_){}
 if(engine&&Array.isArray(rows)){
  const sorted=rows.slice().sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
  for(const row of sorted){
   try{
    const event={id:row.client_event_id||row.dedupe_key||row.id,type:row.event_key,payload:row.event_payload||{},occurredAt:row.created_at||new Date().toISOString()};
    engine=Engine.applyEvent(engine,event).state;
   }catch(_){}
  }
 }
 if(!engine)engine=read('engine')||null;
 if(engine&&profile){profile.xp=Number(engine.totalXp)||0;try{profile.level=Engine.getLevel(engine.totalXp||0).level;}catch(_){}}
 return engine;
}
async function selectOne(table,filters){
 const rows=await S.db.select(table,Object.assign({},filters,{limit:1}));
 return Array.isArray(rows)&&rows.length?rows[0]:null;
}
async function refreshEngine(){
 ensureSession();
 const rows=await S.db.select('xp_events',{user_id:'eq.'+state.uid,order:'created_at.asc',limit:1000});
 state.engine=rebuildEngine(rows,state.profile);if(state.engine)save('engine',state.engine);emit('ENGINE_UPDATED',state.engine);notify();return state.engine;
}
async function refreshHealth(){
 if(!state.uid||!S||!S.hasSession())return null;
 const uid=state.uid;
 const rows=await S.db.select('activity_daily',{user_id:'eq.'+uid,order:'activity_date.desc',limit:366});
 if(uid!==state.uid)return null;
 state.healthDays=(rows||[]).map((r,i)=>Object.assign({id:r.activity_date},healthRow(r)||{}));
 state.health=state.healthDays[0]||null;if(state.health)save('health',state.health);save('days',state.healthDays);
 state.syncEvents=(rows||[]).slice(0,50).map(r=>({id:r.activity_date,source:r.source||'Supabase',day:r.activity_date,status:'synced',occurredAt:r.updated_at}));
 emit('HEALTH_SYNCED',state.health);notify();return state.health;
}
async function loadCloudState(){
 if(!state.uid||!S||!S.hasSession())return null;
 const row=await selectOne('account_state',{user_id:'eq.'+state.uid});
 state.cloudState=row||null;if(row)state.settings=row.settings_v3||null;return row;
}
async function syncCloudState(partial){
 ensureSession();
 try{const settings=JSON.parse(localStorage.getItem('healthgo_settings_v3_uid_'+state.uid)||'{}');if(settings.cloudSync===false&&!partial.settingsV3)return false;}catch(_){}
 const body={user_id:state.uid,updated_at:new Date().toISOString()};
 if(Object.prototype.hasOwnProperty.call(partial,'plan'))body.plan=partial.plan;
 if(Object.prototype.hasOwnProperty.call(partial,'manualActivities'))body.manual_activities=partial.manualActivities;
 if(Object.prototype.hasOwnProperty.call(partial,'settingsV3'))body.settings_v3=partial.settingsV3;
 if(Object.prototype.hasOwnProperty.call(partial,'selectedTitle'))body.selected_title=partial.selectedTitle;
 const rows=await S.db.upsert('account_state',body,'user_id');state.cloudState=Array.isArray(rows)&&rows[0]||Object.assign({},state.cloudState||{},body);return true;
}
async function initialize(){
 if(!state.uid||!S||!S.hasSession())return null;if(initializing)return initializing;
 const g=generation,uid=state.uid;state.loading=true;notify();
 initializing=(async()=>{
  try{
   const profileRows=await S.db.select('profiles',{id:'eq.'+uid,limit:1});
   if(g!==generation||uid!==state.uid)return null;
   const profileRow=profileRows&&profileRows[0];state.profile=legacyProfile(profileRow);
   const [ledger,activity,notes,cloud,loc,family,devices]=await Promise.all([
    S.db.select('xp_events',{user_id:'eq.'+uid,order:'created_at.asc',limit:1000}).catch(()=>[]),
    S.db.select('activity_daily',{user_id:'eq.'+uid,order:'activity_date.desc',limit:366}).catch(()=>[]),
    S.db.select('notifications',{user_id:'eq.'+uid,order:'created_at.desc',limit:100}).catch(()=>[]),
    selectOne('account_state',{user_id:'eq.'+uid}).catch(()=>null),
    selectOne('location_settings',{user_id:'eq.'+uid}).catch(()=>null),
    S.db.rpc('healthgo_get_family_state',{}).catch(()=>emptyFamily()),
    S.db.select('devices',{user_id:'eq.'+uid,order:'last_sync_at.desc',limit:50}).catch(()=>[])
   ]);
   if(g!==generation||uid!==state.uid)return null;
   state.family=family&&typeof family==='object'?Object.assign(emptyFamily(),family):emptyFamily();
   if(state.profile)state.profile.familyId=state.family.id||null;
   state.engine=rebuildEngine(ledger,state.profile);if(state.engine)save('engine',state.engine);
   state.healthDays=(activity||[]).map(r=>Object.assign({id:r.activity_date},healthRow(r)||{}));state.health=state.healthDays[0]||null;
   if(state.health){save('health',state.health);save('days',state.healthDays);}
   state.syncEvents=(activity||[]).slice(0,50).map(r=>({id:r.activity_date,source:r.source||'Supabase',day:r.activity_date,status:'synced',occurredAt:r.updated_at}));
   state.notifications=(notes||[]).map(n=>Object.assign({},n,{read:!!n.read_at,readAt:n.read_at,createdAt:n.created_at}));
   state.devices=(devices||[]).map(d=>({id:d.id,externalId:d.external_id||'',name:d.name||'Urządzenie',platform:d.platform||'',deviceType:d.device_type||'',connectionType:d.connection_type||'',batteryLevel:d.battery_level,lastSyncAt:d.last_sync_at,lastConnectedAt:d.last_connected_at,lastDisconnectedAt:d.last_disconnected_at}));
   state.cloudState=cloud||null;state.settings=cloud&&cloud.settings_v3||null;
   state.locationSettings=loc?{enabled:!!loc.enabled,mode:loc.mode||'off',familySharing:!!loc.family_sharing,updatedAt:loc.updated_at}:{enabled:false,mode:'off'};
   state.backendAvailable=true;state.error=null;state.loading=false;
   notify();return{profile:state.profile,engine:state.engine,familyId:state.family.id,cloudState:state.cloudState};
  }catch(e){
   if(g===generation){state.backendAvailable=false;state.error=errorMessage(e);state.loading=false;notify();}
   return null;
  }finally{if(g===generation)initializing=null;}
 })();
 return initializing;
}
async function rpc(name,body){
 const requestUid=state.uid,requestGeneration=generation;ensureSession();
 try{
  const result=await S.db.rpc(name,body||{});
  if(requestGeneration!==generation||state.uid!==requestUid||!S.auth.currentUser||S.auth.currentUser.id!==requestUid){const stale=new Error('Sesja została zmieniona.');stale.code='unauthenticated';throw stale;}
  return result;
 }catch(e){if(e&&e.code==='unauthenticated')throw e;const safe=new Error(errorMessage(e));safe.code=e.code||e.status;throw safe;}
}
async function call(name,data){
 data=data||{};
 switch(name){
  case 'initializeHealthGo':return initialize();
  case 'configureAccount':{const r=await rpc('healthgo_configure_account',{p_nickname:data.nickname,p_account_type:data.accountType});await initialize();return r;}
  case 'recordProgressEvent':{const r=await rpc('healthgo_record_progress_event',{p_event_id:data.id,p_event_type:data.type,p_payload:data.payload||{}});await refreshEngine();return r;}
  case 'updateProfilePreferences':await syncCloudState({selectedTitle:data.titleId});return{ok:true};
  case 'createFamily':{const r=await rpc('healthgo_create_family_named',{p_name:data.name||null});await initialize();return r;}
  case 'createFamilyInvite':return rpc('healthgo_create_family_invite',{});
  case 'acceptFamilyInvite':{const r=await rpc('healthgo_accept_family_invite',{p_code:data.code});await initialize();return r;}
  case 'leaveFamily':{const r=await rpc('healthgo_leave_family',{});await initialize();return r;}
  case 'registerDevice':{const r=await rpc('healthgo_register_device',{p_external_id:data.externalId,p_name:data.name,p_platform:data.platform||'web',p_device_type:data.deviceType||'bluetooth',p_connection_type:data.connectionType||'ble',p_battery_level:data.batteryLevel==null?null:Number(data.batteryLevel),p_connected:data.connected!==false});await initialize();return r;}
  case 'updateFamilyPermissions':{const r=await rpc('healthgo_update_family_permissions',{p_child_id:data.childUid,p_guardian_id:data.guardianUid,p_scopes:data.scopes||{}});await initialize();return r;}
  case 'updateLocationSettings':{const r=await rpc('healthgo_update_location_settings',{p_mode:data.mode||'off'});await initialize();return r;}
  case 'publishLocation':{const r=await rpc('healthgo_publish_location',{p_latitude:Number(data.latitude),p_longitude:Number(data.longitude),p_accuracy:Number(data.accuracyMeters)||0,p_device:data.device||'HealthGo'});await initialize();return r;}
  case 'exportOwnData':return{exportedAt:new Date().toISOString(),profile:state.profile,engine:state.engine,health:state.health,privacy:state.privacy,locationSettings:state.locationSettings,cloudState:state.cloudState};
  default:{const e=new Error('Funkcja nie jest dostępna w Supabase.');e.code='not-found';throw e;}
 }
}
function stop(){
 generation++;if(pollTimer){clearInterval(pollTimer);pollTimer=null;}initializing=null;
 for(const node of document.querySelectorAll?.('.hg2-dialog-backdrop')||[])node.remove();document.body?.classList.remove('hg2-dialog-open');
 state=empty();window.healthGoCurrentUid='';window.healthGoCurrentEmail='';document.documentElement.classList.remove('hg-session-known');
 const chat=document.getElementById('aiMessages');if(chat)chat.replaceChildren();
 for(const id of ['planList','todayPlanList','todayPlanPreview','manualActivityLog'])document.getElementById(id)?.replaceChildren();
 for(const id of ['topNick','sidebarNick']){const node=document.getElementById(id);if(node)node.textContent='HealthGo';}
 for(const id of ['stepsValue','distanceValue','activeValue','sleepValue','deviceSteps','deviceDistance','deviceHeart','deviceSleep']){const el=document.getElementById(id);if(el)el.textContent='Brak danych';}
 document.getElementById('accountSetup')?.classList.remove('show');emit('SESSION_CHANGED',null);notify();
}
async function start(user){
 if(!user||!user.uid)return stop();
 if(state.uid===user.uid)return initialize();stop();
 const g=generation;state.uid=user.uid;state.deviceId=read('installationId')||crypto.randomUUID();save('installationId',state.deviceId);
 state.session={providers:(user.providerData||[]).map(p=>p.providerId),mfaFactors:user.multiFactor?.enrolledFactors?.length||0};state.loading=true;
 window.healthGoCurrentUid=user.uid;window.healthGoCurrentEmail=user.email||'';
 state.legacyArchive=read('legacyArchive');if(!state.legacyArchive&&typeof loadProgress==='function'){state.legacyArchive=loadProgress();save('legacyArchive',state.legacyArchive);}
 state.health=read('health');state.healthDays=read('days')||[];state.engine=read('engine');
 emit('SESSION_CHANGED',{uid:user.uid});notify();
 if(!S||!S.hasSession()){state.loading=false;state.backendAvailable=false;if(!state.engine&&Engine&&typeof loadProgress==='function')state.engine=Engine.migrateLegacy(loadProgress(),new Date().toISOString());notify();return null;}
 await initialize();if(g!==generation)return null;
 if(!state.engine&&Engine&&typeof loadProgress==='function'){state.engine=Engine.migrateLegacy(loadProgress(),new Date().toISOString());state.legacyPreview=true;notify();}
 pollTimer=setInterval(()=>{if(state.uid&&navigator.onLine)initialize().catch(()=>{});},60000);
 await flush();return state;
}
async function record(type,payload,id){
 if(!state.uid)return false;
 const requestUid=state.uid,requestGeneration=generation,event={id:id||crypto.randomUUID(),type,payload:payload||{}};
 if(!navigator.onLine||!state.backendAvailable){
  const outbox=read('outbox',requestUid)||[];if(!outbox.some(e=>e.id===event.id)){outbox.push(event);saveFor('outbox',requestUid,outbox.slice(-500));}return false;
 }
 try{await call('recordProgressEvent',event);return true;}catch(e){
  if(state.uid===requestUid&&generation===requestGeneration&&String(e&&e.code||'')!=='unauthenticated'){
   const queue=read('outbox',requestUid)||[];if(!queue.some(x=>x.id===event.id))queue.push(event);saveFor('outbox',requestUid,queue.slice(-500));
  }
  return false;
 }
}
async function flush(){
 const uid=state.uid;if(!uid||!state.backendAvailable||!navigator.onLine)return;
 const queue=read('outbox')||[];
 for(const event of queue.slice()){if(uid!==state.uid)return;try{await call('recordProgressEvent',event);queue.splice(queue.findIndex(x=>x.id===event.id),1);save('outbox',queue);}catch(_){break;}}
}
async function markNotificationRead(id){if(!state.uid)return;await rpc('healthgo_mark_notification_read',{p_notification_id:id});await initialize();}
const api={events,get state(){return state;},subscribe(fn){subscribers.add(fn);fn(state);return()=>subscribers.delete(fn);},start,stop,initialize,call,record,refreshHealth,refreshEngine,markNotificationRead,loadFamilyProjections(){return initialize();},syncCloudState,loadCloudState,
 refreshLegacy(){if(!state.engine&&Engine&&typeof loadProgress==='function'){state.engine=Engine.migrateLegacy(loadProgress(),new Date().toISOString());state.legacyPreview=true;notify();}},
 setTitle(titleId){return call('updateProfilePreferences',{titleId});},errorMessage};
window.HealthGoServices=api;
window.AccountService={configure:data=>call('configureAccount',data),get profile(){return state.profile;},start,stop};
window.FamilyService={call,get state(){return state.family;}};
window.PrivacyService={get state(){return state.privacy;},update:data=>call('updateLocationSettings',data)};
window.addEventListener('online',()=>{state.online=true;notify();initialize().then(flush).catch(()=>{});});
window.addEventListener('offline',()=>{state.online=false;notify();});
})();
