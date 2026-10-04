'use strict';

const crypto=require('node:crypto');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onDocumentWritten}=require('firebase-functions/v2/firestore');

initializeApp();
const db=getFirestore();
const Engine=require('./achievement-engine.cjs');

const REGION='us-central1';
const CLIENT_EVENTS=new Set(['PLAN_CREATED','PLAN_COMPLETED','AI_USED','MAP_EXPLORED','ACTIVITY_RECORDED','DAILY_TASK_CONFIRMED']);
const FAMILY_SCOPES=new Set(['HEALTH_ACTIVITY','HEALTH_SLEEP','HEALTH_HEART_RATE','DEVICE_STATUS','LOCATION_APPROXIMATE','LOCATION_PRECISE','CHALLENGE_PROGRESS','ACHIEVEMENTS','NOTIFICATIONS']);
const DAY_MS=86400000;

function nowIso(){return new Date().toISOString()}
function requireAuth(request){
  if(!request.auth||!request.auth.uid)throw new HttpsError('unauthenticated','Authentication required.');
  return request.auth.uid;
}
function plain(value){return value&&typeof value==='object'&&!Array.isArray(value)}
function string(value,max){
  if(typeof value!=='string')return null;
  value=value.trim();
  if(!value||value.length>(max||200))return null;
  return value;
}
function id(value,label){
  value=string(value,200);
  if(!value||!/^[A-Za-z0-9_.:@-]{1,200}$/.test(value))throw new HttpsError('invalid-argument','Invalid '+label+'.');
  return value;
}
function safeDocId(value){return String(value).replace(/\//g,'_').slice(0,400)}
function accountType(value){
  if(value!=='standard'&&value!=='child')throw new HttpsError('invalid-argument','Invalid account type.');
  return value;
}
function nickname(value){
  value=string(value,20);
  if(!value||value.length<3||!/^[\p{L}\p{N}_. -]+$/u.test(value))throw new HttpsError('invalid-argument','Invalid nickname.');
  const compact=value.toLowerCase().replace(/[._ -]/g,'');
  if(['kurwa','chuj','pierd','jeb','fuck','shit','nazi','hitler'].some(x=>compact.includes(x)))throw new HttpsError('invalid-argument','Invalid nickname.');
  return value;
}
function nearbyDay(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const ms=Date.parse(value+'T12:00:00Z');
  return Number.isFinite(ms)&&Math.abs(ms-Date.now())<=2*DAY_MS;
}
function iso(value){
  if(value&&typeof value.toDate==='function')return value.toDate().toISOString();
  const ms=typeof value==='number'?value:Date.parse(value);
  return Number.isFinite(ms)?new Date(ms).toISOString():null;
}
function publicProfile(root){
  const p=plain(root&&root.profile)?root.profile:{};
  return {
    nickname:typeof p.nickname==='string'?p.nickname:'HealthGo',
    accountType:root&&root.accountType||p.accountType||null,
    configured:!!(p.configured&&root&&root.accountType),
    createdAt:iso(root&&root.createdAt)||root&&root.createdAt||null,
    familyId:root&&root.familyId||null,
    selectedTitle:typeof p.selectedTitle==='string'?p.selectedTitle:null
  };
}
function legacyFor(root){
  if(!root)return null;
  if(root.progress||root.profile||root.plan||root.manualActivities){
    return {progress:root.progress||{},profile:root.profile||{},plan:Array.isArray(root.plan)?root.plan:[],manualActivities:Array.isArray(root.manualActivities)?root.manualActivities:[],createdAt:root.createdAt||null};
  }
  return null;
}
function compactEngineState(input,at){
  const state=JSON.parse(JSON.stringify(input));
  const cutoff=new Date(Date.parse(at)-400*DAY_MS).toISOString().slice(0,10);
  const m=state.metrics||{};
  if(plain(m.healthDays))Object.keys(m.healthDays).forEach(day=>{if(day<cutoff)delete m.healthDays[day]});
  if(plain(m.dailyHistory))Object.keys(m.dailyHistory).forEach(day=>{if(day<cutoff)delete m.dailyHistory[day]});
  if(plain(state.rewards))Object.keys(state.rewards).forEach(key=>{
    if(!key.startsWith('daily:'))return;
    const day=key.slice(6,16);
    if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&day<cutoff)delete state.rewards[key];
  });
  if(Array.isArray(state.history))state.history=state.history.slice(-120);
  if(plain(state.processedEvents)){
    const keys=Object.keys(state.processedEvents);
    if(keys.length>512)keys.slice(0,keys.length-512).forEach(k=>delete state.processedEvents[k]);
  }
  return state;
}
function defaultRoot(uid,request){
  const email=string(request&&request.auth&&request.auth.token&&request.auth.token.email,200)||'';
  const raw=email.includes('@')?email.split('@')[0]:'HealthGo';
  const clean=raw.replace(/[^\p{L}\p{N}_.-]/gu,'').slice(0,20);
  return {
    createdAt:nowIso(),
    accountType:null,
    familyId:null,
    profile:{nickname:clean.length>=3?clean:'HealthGo',configured:false,accountType:null}
  };
}
async function ensureUser(uid,request){
  const ref=db.collection('users').doc(uid),engineRef=ref.collection('engine').doc('state');
  return db.runTransaction(async tx=>{
    const userSnap=await tx.get(ref);
    const engineSnap=await tx.get(engineRef);
    let root=userSnap.exists?userSnap.data():defaultRoot(uid,request);
    if(!userSnap.exists)tx.set(ref,root,{merge:true});
    let engine=engineSnap.exists?engineSnap.data():Engine.createState(legacyFor(root),nowIso());
    if(!engineSnap.exists)tx.set(engineRef,compactEngineState(engine,nowIso()),{merge:false});
    return {root,engine};
  });
}
function notificationFromOutput(output){
  if(!output||!output.type)return null;
  if(output.type==='ACHIEVEMENT_UNLOCKED')return {type:'achievement',title:'Nowe osiągnięcie',message:(output.payload&&output.payload.name)||'Nagroda została dodana do Plecaka.'};
  if(output.type==='CHALLENGE_COMPLETED')return {type:'challenge',title:'Wyzwanie ukończone',message:(output.payload&&output.payload.name)||'Wyzwanie zostało ukończone.'};
  if(output.type==='LEVEL_UP')return {type:'level',title:'Nowy poziom',message:'Awans na poziom '+String(output.payload&&output.payload.level||'')+'.'};
  return null;
}
function validateClientEvent(root,event){
  if(!plain(event)||!CLIENT_EVENTS.has(event.type))throw new HttpsError('permission-denied','This progress event must be verified by HealthGo.');
  id(event.id,'event id');
  const payload=plain(event.payload)?event.payload:{};
  if(['PLAN_COMPLETED','ACTIVITY_RECORDED','DAILY_TASK_CONFIRMED'].includes(event.type)&&!nearbyDay(payload.day))throw new HttpsError('invalid-argument','Invalid event day.');
  if(event.type==='PLAN_CREATED'||event.type==='PLAN_COMPLETED'){
    const planId=id(payload.planId,'plan id');
    const plans=Array.isArray(root.plan)?root.plan:[];
    if(!plans.some(item=>item&&String(item.id)===planId))throw new HttpsError('failed-precondition','Plan item is not synchronized.');
  }
  if(event.type==='DAILY_TASK_CONFIRMED')id(payload.taskId,'task id');
  if(event.type==='ACTIVITY_RECORDED'){
    id(payload.activityId,'activity id');
    const seconds=payload.seconds;
    if(!Number.isInteger(seconds)||seconds<1||seconds>86400)throw new HttpsError('invalid-argument','Invalid activity duration.');
  }
}
async function applyProgressEvent(uid,event,options){
  options=options||{};
  const userRef=db.collection('users').doc(uid),engineRef=userRef.collection('engine').doc('state'),eventRef=userRef.collection('progressEvents').doc(safeDocId(event.id));
  const result=await db.runTransaction(async tx=>{
    const userSnap=await tx.get(userRef);
    const engineSnap=await tx.get(engineRef);
    const eventSnap=await tx.get(eventRef);
    if(!userSnap.exists)throw new HttpsError('failed-precondition','Configure HealthGo first.');
    const root=userSnap.data();
    if(eventSnap.exists)return {duplicate:true,engine:engineSnap.exists?engineSnap.data():Engine.createState(legacyFor(root),nowIso()),outputs:[],root};
    if(!options.system)validateClientEvent(root,event);
    let engine=engineSnap.exists?engineSnap.data():Engine.createState(legacyFor(root),nowIso());
    const verified={id:id(event.id,'event id'),type:event.type,payload:plain(event.payload)?event.payload:{},occurredAt:nowIso()};
    let applied;
    try{applied=Engine.applyEvent(engine,verified)}catch(error){throw new HttpsError('invalid-argument','Invalid progress event.')}
    engine=compactEngineState(applied.state,verified.occurredAt);
    tx.set(engineRef,engine,{merge:false});
    tx.set(eventRef,{id:verified.id,type:verified.type,occurredAt:verified.occurredAt,createdAt:verified.occurredAt},{merge:false});
    (applied.events||[]).forEach(output=>{
      if(output.type==='REWARD_GRANTED'&&output.payload&&output.payload.rewardId){
        tx.set(userRef.collection('rewardLedger').doc(safeDocId(output.payload.rewardId)),Object.assign({},output.payload,{recordedAt:verified.occurredAt}),{merge:false});
      }
      const notice=notificationFromOutput(output);
      if(notice)tx.set(userRef.collection('notifications').doc(safeDocId(output.id)),Object.assign(notice,{createdAt:verified.occurredAt,read:false,eventId:output.id}),{merge:false});
    });
    return {duplicate:false,engine,outputs:applied.events||[],root};
  });
  if(!result.duplicate)await projectEngine(uid,result.root,result.engine);
  return result;
}
async function projectEngine(uid,root,engine){
  if(!root||root.accountType!=='child'||!root.familyId)return;
  const family=db.collection('families').doc(root.familyId),batch=db.batch();
  const achievements=Engine.viewAchievements(engine).filter(x=>x.earned).map(x=>({id:x.id,name:x.name,icon:x.icon,category:x.category,rarity:x.rarity,earnedAt:x.earnedAt})).slice(-150);
  const challenges=Engine.viewChallenges(engine,nowIso()).map(x=>({id:x.id,name:x.name,category:x.category,status:x.status,progress:x.progress,target:x.target,percent:x.percent,xpReward:x.xpReward})).slice(-80);
  batch.set(family.collection('shared').doc(uid).collection('achievements').doc('latest'),{items:achievements,total:achievements.length,updatedAt:nowIso()},{merge:false});
  batch.set(family.collection('shared').doc(uid).collection('challenges').doc('latest'),{items:challenges,updatedAt:nowIso()},{merge:false});
  await batch.commit();
}
async function projectHealth(uid,root,health){
  if(!root||root.accountType!=='child'||!root.familyId||!health)return;
  const family=db.collection('families').doc(root.familyId),batch=db.batch(),updatedAt=nowIso();
  batch.set(family.collection('shared').doc(uid).collection('activity').doc('latest'),{steps:health.steps??null,distanceKm:health.distanceKm??null,activeMinutes:health.activeMinutes??null,source:health.source||null,updatedAt},{merge:false});
  batch.set(family.collection('shared').doc(uid).collection('sleep').doc('latest'),{sleepMinutes:health.sleepMinutes??null,source:health.source||null,updatedAt},{merge:false});
  batch.set(family.collection('shared').doc(uid).collection('heartRate').doc('latest'),{heartRate:health.heartRate??null,source:health.source||null,updatedAt},{merge:false});
  batch.set(family.collection('shared').doc(uid).collection('device').doc('latest'),{source:health.source||null,device:health.device||health.source||null,updatedAt},{merge:false});
  await batch.commit();
}
function normalizedHealth(data){
  if(!plain(data))return null;
  const limits={steps:250000,distanceKm:500,activeMinutes:1440,heartRate:350,sleepMinutes:1440},out={};
  let any=false;
  for(const key of Object.keys(limits)){
    const value=data[key];
    if(value===undefined||value===null){out[key]=null;continue}
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>limits[key])return null;
    if(['steps','activeMinutes','sleepMinutes'].includes(key)&&!Number.isInteger(value))return null;
    out[key]=value;any=true;
  }
  if(!any)return null;
  out.source=string(data.source,120)||'HealthGo Mobile';
  out.device=string(data.device,120)||out.source;
  out.observedAt=iso(data.timestamp||data.updatedAt||data.observedAt)||nowIso();
  out.day=out.observedAt.slice(0,10);
  const material=uidSafe(out.source)+'|'+out.observedAt+'|'+JSON.stringify(out);
  out.syncId='sync_'+crypto.createHash('sha256').update(material).digest('hex').slice(0,32);
  return out;
}
function uidSafe(value){return String(value||'').replace(/[^A-Za-z0-9_.:@-]/g,'_').slice(0,120)||'unknown'}
function inviteHash(code){return crypto.createHash('sha256').update(String(code).toUpperCase()).digest('hex')}

exports.initializeHealthGo=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),result=await ensureUser(uid,request);
  return {profile:publicProfile(result.root),engine:result.engine,familyId:result.root.familyId||null};
});

exports.configureAccount=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),data=plain(request.data)?request.data:{},name=nickname(data.nickname),type=accountType(data.accountType);
  const userRef=db.collection('users').doc(uid),engineRef=userRef.collection('engine').doc('state');
  const result=await db.runTransaction(async tx=>{
    const userSnap=await tx.get(userRef),engineSnap=await tx.get(engineRef);
    const root=userSnap.exists?userSnap.data():defaultRoot(uid,request),existing=root.accountType||root.profile&&root.profile.accountType||null;
    if(existing&&existing!==type)throw new HttpsError('failed-precondition','Account type change requires a protected migration.');
    if(root.familyId&&existing&&existing!==type)throw new HttpsError('failed-precondition','Disconnect Family before changing account type.');
    let engine=engineSnap.exists?engineSnap.data():Engine.createState(legacyFor(root),nowIso());
    const configured=!!(root.profile&&root.profile.configured);
    if(!configured){
      const applied=Engine.applyEvent(engine,{id:'profile-configured:'+uid+':'+type,type:'PROFILE_CONFIGURED',payload:{accountType:type},occurredAt:nowIso()});
      engine=compactEngineState(applied.state,nowIso());
      tx.set(engineRef,engine,{merge:false});
    }
    const profile=Object.assign({},root.profile||{},{nickname:name,accountType:type,configured:true,updatedAt:nowIso()});
    tx.set(userRef,{accountType:type,profile,createdAt:root.createdAt||nowIso(),updatedAt:nowIso()},{merge:true});
    return {profile:Object.assign({},profile,{familyId:root.familyId||null}),engine};
  });
  return result;
});

exports.recordProgressEvent=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),data=plain(request.data)?request.data:{};
  const result=await applyProgressEvent(uid,{id:data.id,type:data.type,payload:plain(data.payload)?data.payload:{}},{system:false});
  return {duplicate:result.duplicate,engine:result.engine,events:result.outputs};
});

exports.updateProfilePreferences=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),title=id(request.data&&request.data.titleId,'title');
  const userRef=db.collection('users').doc(uid),engineRef=userRef.collection('engine').doc('state');
  await db.runTransaction(async tx=>{
    const engineSnap=await tx.get(engineRef),userSnap=await tx.get(userRef);
    if(!engineSnap.exists||!userSnap.exists)throw new HttpsError('failed-precondition','HealthGo is not initialized.');
    const engine=engineSnap.data();
    if(!Array.isArray(engine.titles)||!engine.titles.includes(title))throw new HttpsError('permission-denied','Title is not unlocked.');
    const root=userSnap.data(),profile=Object.assign({},root.profile||{},{selectedTitle:title,updatedAt:nowIso()});
    tx.set(userRef,{profile},{merge:true});tx.set(engineRef,{selectedTitle:title,updatedAt:nowIso()},{merge:true});
  });
  return {ok:true};
});

exports.createFamily=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),familyId='fam_'+crypto.randomUUID().replace(/-/g,'').slice(0,24),userRef=db.collection('users').doc(uid),familyRef=db.collection('families').doc(familyId);
  const result=await db.runTransaction(async tx=>{
    const userSnap=await tx.get(userRef);
    if(!userSnap.exists)throw new HttpsError('failed-precondition','Configure HealthGo first.');
    const root=userSnap.data();
    if(root.familyId)return {familyId:root.familyId,existing:true};
    if(root.accountType==='child')throw new HttpsError('permission-denied','A child account joins a family with an invite.');
    if(!root.accountType)throw new HttpsError('failed-precondition','Choose the account type first.');
    const member={uid,role:'guardian',nickname:root.profile&&root.profile.nickname||'Opiekun',joinedAt:nowIso()};
    tx.set(familyRef,{createdBy:uid,createdAt:nowIso(),updatedAt:nowIso()},{merge:false});
    tx.set(familyRef.collection('members').doc(uid),member,{merge:false});
    tx.set(familyRef.collection('audit').doc('created_'+crypto.randomUUID()),{type:'FAMILY_CREATED',actorUid:uid,createdAt:nowIso()},{merge:false});
    tx.set(userRef,{familyId,updatedAt:nowIso()},{merge:true});
    return {familyId,existing:false};
  });
  return result;
});

exports.createFamilyInvite=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),userSnap=await db.collection('users').doc(uid).get();
  if(!userSnap.exists||!userSnap.data().familyId)throw new HttpsError('failed-precondition','Create or join a family first.');
  const familyId=userSnap.data().familyId,family=db.collection('families').doc(familyId),member=await family.collection('members').doc(uid).get();
  if(!member.exists||member.data().role!=='guardian')throw new HttpsError('permission-denied','Only a guardian can invite a child.');
  const code=crypto.randomBytes(6).toString('hex').toUpperCase(),hash=inviteHash(code),expiresAt=new Date(Date.now()+30*60*1000).toISOString();
  const data={familyId,inviterUid:uid,role:'child',createdAt:nowIso(),expiresAt,used:false};
  const batch=db.batch();batch.set(db.collection('familyInvites').doc(hash),data,{merge:false});batch.set(family.collection('invites').doc(hash),data,{merge:false});await batch.commit();
  return {code,expiresAt};
});

exports.acceptFamilyInvite=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),raw=string(request.data&&request.data.code,32);
  if(!raw)throw new HttpsError('invalid-argument','Invite code is required.');
  const code=raw.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  if(code.length<8)throw new HttpsError('invalid-argument','Invalid invite code.');
  const hash=inviteHash(code),inviteRef=db.collection('familyInvites').doc(hash),userRef=db.collection('users').doc(uid);
  const result=await db.runTransaction(async tx=>{
    const inviteSnap=await tx.get(inviteRef),userSnap=await tx.get(userRef);
    if(!inviteSnap.exists)throw new HttpsError('not-found','Invite not found.');
    if(!userSnap.exists)throw new HttpsError('failed-precondition','Configure HealthGo first.');
    const invite=inviteSnap.data(),root=userSnap.data();
    if(invite.used||Date.parse(invite.expiresAt)<=Date.now())throw new HttpsError('failed-precondition','Invite expired or already used.');
    if(root.accountType!=='child')throw new HttpsError('failed-precondition','This invite is for a child account.');
    if(root.familyId&&root.familyId!==invite.familyId)throw new HttpsError('failed-precondition','This account already belongs to another family.');
    const family=db.collection('families').doc(invite.familyId),permissionId=invite.inviterUid+'_'+uid;
    tx.set(family.collection('members').doc(uid),{uid,role:'child',nickname:root.profile&&root.profile.nickname||'HealthGo',joinedAt:nowIso()},{merge:false});
    tx.set(family.collection('permissions').doc(permissionId),{guardianUid:invite.inviterUid,childUid:uid,scopes:{HEALTH_ACTIVITY:false,HEALTH_SLEEP:false,HEALTH_HEART_RATE:false,DEVICE_STATUS:false,LOCATION_APPROXIMATE:false,LOCATION_PRECISE:false,CHALLENGE_PROGRESS:false,ACHIEVEMENTS:false,NOTIFICATIONS:false},updatedAt:nowIso()},{merge:false});
    tx.set(userRef,{familyId:invite.familyId,updatedAt:nowIso()},{merge:true});
    tx.update(inviteRef,{used:true,usedBy:uid,usedAt:nowIso()});
    tx.set(family.collection('invites').doc(hash),{used:true,usedBy:uid,usedAt:nowIso()},{merge:true});
    tx.set(family.collection('audit').doc('joined_'+crypto.randomUUID()),{type:'CHILD_CONNECTED',actorUid:uid,createdAt:nowIso()},{merge:false});
    return {familyId:invite.familyId};
  });
  return result;
});

exports.updateFamilyPermissions=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),childUid=id(request.data&&request.data.childUid,'child uid'),raw=plain(request.data&&request.data.scopes)?request.data.scopes:{},scopes={};
  FAMILY_SCOPES.forEach(key=>{scopes[key]=raw[key]===true});
  const user=await db.collection('users').doc(uid).get();
  if(!user.exists||!user.data().familyId)throw new HttpsError('failed-precondition','No family.');
  const familyId=user.data().familyId,family=db.collection('families').doc(familyId);
  const caller=await family.collection('members').doc(uid).get(),child=await family.collection('members').doc(childUid).get();
  if(!caller.exists||!child.exists||child.data().role!=='child')throw new HttpsError('permission-denied','Invalid family relationship.');
  let guardianUid;
  if(caller.data().role==='guardian'){
    guardianUid=uid;
  }else if(caller.data().role==='child'&&uid===childUid){
    guardianUid=id(request.data&&request.data.guardianUid,'guardian uid');
    const guardian=await family.collection('members').doc(guardianUid).get();
    if(!guardian.exists||guardian.data().role!=='guardian')throw new HttpsError('permission-denied','Invalid guardian.');
    const current=await family.collection('permissions').doc(guardianUid+'_'+childUid).get();
    if(!current.exists)throw new HttpsError('not-found','Permission grant not found.');
    const existing=current.data().scopes||{};
    for(const key of FAMILY_SCOPES){
      if(scopes[key]===true&&existing[key]!==true)throw new HttpsError('permission-denied','A child account can revoke access but cannot grant new access.');
    }
  }else{
    throw new HttpsError('permission-denied','Only a guardian may grant access.');
  }
  const permissionId=guardianUid+'_'+childUid,batch=db.batch();
  batch.set(family.collection('permissions').doc(permissionId),{guardianUid,childUid,scopes,updatedAt:nowIso()},{merge:false});
  batch.set(family.collection('audit').doc('permission_'+crypto.randomUUID()),{type:'PERMISSION_CHANGED',actorUid:uid,childUid,guardianUid,createdAt:nowIso()},{merge:false});
  batch.set(db.collection('users').doc(childUid).collection('notifications').doc('family_permission_'+Date.now()),{type:'family',title:'Zmieniono udostępnianie rodzinne',message:'Sprawdź w HealthGo Family, jakie dane są udostępniane.',createdAt:nowIso(),read:false},{merge:false});
  await batch.commit();return {ok:true};
});

exports.updateLocationSettings=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),data=plain(request.data)?request.data:{},mode=data.mode;
  if(!['off','approximate','precise'].includes(mode))throw new HttpsError('invalid-argument','Invalid location mode.');
  const enabled=mode!=='off'&&data.enabled!==false,familySharing=enabled&&data.familySharing===true;
  const settings={enabled,mode:enabled?mode:'off',familySharing,updatedAt:nowIso()};
  await db.collection('users').doc(uid).collection('locationSettings').doc('current').set(settings,{merge:false});
  const user=await db.collection('users').doc(uid).get();
  if(user.exists&&user.data().familyId){
    await db.collection('families').doc(user.data().familyId).collection('audit').doc('location_'+crypto.randomUUID()).set({type:enabled?'LOCATION_SHARING_ENABLED':'LOCATION_SHARING_DISABLED',actorUid:uid,createdAt:nowIso()});
  }
  return settings;
});

exports.publishLocation=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),settingsSnap=await db.collection('users').doc(uid).collection('locationSettings').doc('current').get();
  const settings=settingsSnap.exists?settingsSnap.data():{enabled:false,mode:'off'};
  if(!settings.enabled||!settings.familySharing||!['approximate','precise'].includes(settings.mode))throw new HttpsError('failed-precondition','Location sharing is disabled.');
  const data=plain(request.data)?request.data:{},lat=numLocation(data.latitude,-90,90),lon=numLocation(data.longitude,-180,180),accuracy=Math.max(0,Number(data.accuracyMeters)||0);
  const user=await db.collection('users').doc(uid).get();
  if(!user.exists||!user.data().familyId)throw new HttpsError('failed-precondition','No family.');
  let point={latitude:lat,longitude:lon,accuracyMeters:accuracy,mode:settings.mode,timestamp:nowIso(),device:string(data.device,120)||'HealthGo'};
  if(settings.mode==='approximate')point={latitude:Math.round(lat*100)/100,longitude:Math.round(lon*100)/100,accuracyMeters:Math.max(1500,accuracy),mode:'approximate',timestamp:point.timestamp,device:point.device};
  const family=db.collection('families').doc(user.data().familyId);
  await family.collection('locations').doc(uid).collection('samples').doc(settings.mode).set(point,{merge:false});
  return {status:'saved',mode:settings.mode,timestamp:point.timestamp};
});
function numLocation(value,min,max){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new HttpsError('invalid-argument','Invalid coordinates.');return value}

exports.exportOwnData=onCall({region:REGION},async request=>{
  const uid=requireAuth(request),userRef=db.collection('users').doc(uid);
  const [user,engine,health,privacy,location]=await Promise.all([userRef.get(),userRef.collection('engine').doc('state').get(),userRef.collection('health').doc('latest').get(),userRef.collection('privacy').doc('current').get(),userRef.collection('locationSettings').doc('current').get()]);
  return {exportedAt:nowIso(),profile:user.exists?publicProfile(user.data()):null,engine:engine.exists?engine.data():null,health:health.exists?health.data():null,privacy:privacy.exists?privacy.data():null,locationSettings:location.exists?location.data():null};
});

exports.processHealthSnapshot=onDocumentWritten({document:'users/{uid}/health/latest',region:REGION},async event=>{
  if(!event.data||!event.data.after.exists)return;
  const uid=event.params.uid,data=event.data.after.data(),health=normalizedHealth(data);
  if(!health)return;
  const userRef=db.collection('users').doc(uid),user=await userRef.get();
  if(!user.exists)return;
  const syncEvent={id:health.syncId,type:'HEALTH_SYNCED',payload:{day:health.day,timestamp:health.observedAt,syncId:health.syncId,source:health.source,device:health.device,steps:health.steps,distanceKm:health.distanceKm,activeMinutes:health.activeMinutes,heartRate:health.heartRate,sleepMinutes:health.sleepMinutes}};
  const batch=db.batch();
  batch.set(userRef.collection('health').doc('daily').collection('days').doc(health.day),Object.assign({},health,{updatedAt:nowIso()}),{merge:true});
  batch.set(userRef.collection('syncEvents').doc(health.syncId),{source:health.source,device:health.device,occurredAt:nowIso(),day:health.day,status:'synced'},{merge:false});
  await batch.commit();
  await applyProgressEvent(uid,syncEvent,{system:true});
  await projectHealth(uid,user.data(),health);
});
