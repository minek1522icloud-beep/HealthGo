(function(root){
'use strict';
const URL='https://oqrfapmdcofguwdvhbeo.supabase.co';
const KEY='sb_publishable_AuERvskDwwmm13In-B45zA_yKP6IElB';
const STORAGE='healthgo_supabase_session_v1';
const PKCE='healthgo_google_pkce_v1';
function randomToken(){return base64url(crypto.getRandomValues(new Uint8Array(32)));}
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
const listeners=new Set();
let session=readSession(),refreshing=null,mfaFactorCount=0;

function readSession(){
 try{
  const value=JSON.parse(localStorage.getItem(STORAGE)||'null');
  return value&&value.access_token&&value.user?value:null;
 }catch(_){return null;}
}
function persist(value){
 session=value&&value.access_token?normalizeSession(value):null;
 try{if(session)localStorage.setItem(STORAGE,JSON.stringify(session));else localStorage.removeItem(STORAGE);}catch(_){}
 return session;
}
function normalizeSession(value){
 const expiresIn=Number(value.expires_in)||3600;
 return Object.assign({},value,{expires_at:Number(value.expires_at)||Math.floor(Date.now()/1000)+expiresIn});
}
function notify(event){for(const fn of listeners){try{fn(event,session);}catch(_){}}}
function apiError(data,status){
 const message=(data&&((data.msg)||(data.message)||(data.error_description)||(data.error)))||('HTTP '+status);
 const error=new Error(String(message));error.status=status;error.code=String(data&&((data.code)||(data.error_code)||(data.error))||status);return error;
}
async function decode(response){
 const text=await response.text();let data=null;
 if(text){try{data=JSON.parse(text);}catch(_){data=text;}}
 if(!response.ok)throw apiError(data,response.status);
 return data;
}
function headers(token,extra){
 return Object.assign({'apikey':KEY,'Authorization':'Bearer '+(token||KEY),'Content-Type':'application/json','Accept':'application/json'},extra||{});
}
async function refreshSession(){
 if(refreshing)return refreshing;
 if(!session||!session.refresh_token)return null;
 refreshing=(async()=>{
  try{
   const response=await fetch(URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:headers(null),body:JSON.stringify({refresh_token:session.refresh_token})});
   const data=await decode(response),next=persist(data);notify('TOKEN_REFRESHED');return next;
  }catch(e){persist(null);notify('SIGNED_OUT');throw e;}
  finally{refreshing=null;}
 })();
 return refreshing;
}
async function token(){
 if(session&&session.expires_at&&session.expires_at<=Math.floor(Date.now()/1000)+45)await refreshSession();
 return session&&session.access_token||null;
}
async function request(path,options){
 options=options||{};const useAuth=options.auth!==false,access=useAuth?await token():null;
 const response=await fetch(URL+path,{method:options.method||'GET',headers:headers(access,options.headers),body:options.body===undefined?undefined:JSON.stringify(options.body)});
 return decode(response);
}
function authPayload(data){
 if(!data)return null;
 if(data.session)return normalizeSession(data.session);
 if(data.access_token)return normalizeSession(data);
 return null;
}
function decodeJwtPayload(value){
 try{
  const part=String(value||'').split('.')[1];
  if(!part)return null;
  const normalized=part.replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  return JSON.parse(decodeURIComponent(Array.from(atob(padded)).map(c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
 }catch(_){return null;}
}
function normalizeFactors(data){
 const all=Array.isArray(data)?data:Array.isArray(data&&data.all)?data.all:Array.isArray(data&&data.factors)?data.factors:[];
 return{
  all,
  totp:all.filter(x=>(x.factor_type||x.type)==='totp'),
  phone:all.filter(x=>(x.factor_type||x.type)==='phone')
 };
}
const mfa={
 async listFactors(){
  let user=session&&session.user||null;
  if(!user&&session&&session.access_token){
   try{user=await request('/auth/v1/user');session.user=user;persist(session);}catch(_){}
  }
  const data=normalizeFactors(user&&user.factors||[]);
  mfaFactorCount=data.all.filter(x=>x.status==='verified').length;
  return{data,error:null};
 },
 async enroll(options){
  const body={factor_type:(options&&options.factorType)||'totp'};
  if(options&&options.friendlyName)body.friendly_name=String(options.friendlyName);
  const data=await request('/auth/v1/factors',{method:'POST',body});
  return{data,error:null};
 },
 async challenge(options){
  const factorId=String(options&&options.factorId||'');
  if(!factorId)throw new Error('mfa_factor_missing');
  const data=await request('/auth/v1/factors/'+encodeURIComponent(factorId)+'/challenge',{method:'POST',body:{}});
  return{data,error:null};
 },
 async verify(options){
  const factorId=String(options&&options.factorId||''),challengeId=String(options&&options.challengeId||''),code=String(options&&options.code||'').trim();
  if(!factorId||!challengeId||!/^[0-9]{6}$/.test(code))throw new Error('mfa_invalid_code');
  const data=await request('/auth/v1/factors/'+encodeURIComponent(factorId)+'/verify',{method:'POST',body:{challenge_id:challengeId,code}});
  const next=authPayload(data);
  if(next)persist(next);
  mfaFactorCount=Math.max(1,mfaFactorCount);
  return{data:errorSafeData(data),error:null};
 },
 async getAuthenticatorAssuranceLevel(){
  const payload=decodeJwtPayload(session&&session.access_token),currentLevel=payload&&payload.aal||'aal1';
  const factors=await mfa.listFactors(),verified=factors.data.all.some(x=>x.status==='verified');
  return{data:{currentLevel,nextLevel:verified?'aal2':'aal1'},error:null};
 }
};
function errorSafeData(data){return data&&typeof data==='object'?data:{};}
async function sessionFromUrl(){
 try{
  const query=new URLSearchParams(root.location&&root.location.search||'');
  if(query.has('code')||query.has('error')){
   let pending;try{pending=JSON.parse(sessionStorage.getItem(PKCE)||localStorage.getItem(PKCE)||'null');}catch(_){}
   sessionStorage.removeItem(PKCE);try{localStorage.removeItem(PKCE);}catch(_){}
   root.history.replaceState(null,'',root.location.pathname);
   if(query.has('error'))throw new Error('google_cancelled');
   if(!pending||Date.now()-pending.created>600000)throw new Error('google_expired');
   const response=await fetch(URL+'/auth/v1/token?grant_type=pkce',{method:'POST',headers:headers(null),body:JSON.stringify({auth_code:query.get('code'),code_verifier:pending.verifier})});
   const next=authPayload(await decode(response));
   if(!next||!next.user)throw new Error('invalid_google_session');
   persist(next);notify('SIGNED_IN');return next;
  }
  const hash=String(root.location&&root.location.hash||'');
  if(!hash||hash.indexOf('access_token=')<0)return null;
  const params=new URLSearchParams(hash.replace(/^#/,''));
  const accessToken=params.get('access_token');
  if(!accessToken)return null;
  const response=await fetch(URL+'/auth/v1/user',{headers:headers(accessToken)});
  const user=await decode(response);
  const next=normalizeSession({
   access_token:accessToken,
   refresh_token:params.get('refresh_token')||'',
   expires_in:Number(params.get('expires_in'))||3600,
   token_type:params.get('token_type')||'bearer',
   user
  });
  persist(next);
  try{if(root.history&&root.location)root.history.replaceState(null,'',root.location.pathname+root.location.search);}catch(_){}
  notify('SIGNED_IN');return next;
 }catch(e){persist(null);throw e;}
}
const auth={
 async signInWithGoogle(){
  const settings=await request('/auth/v1/settings',{auth:false});
  if(!settings.external||!settings.external.google)throw new Error('google_not_configured');
  const verifier=randomToken();
  const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const desktop=/Electron\//.test(root.navigator&&root.navigator.userAgent||'');
  const redirect=root.location.origin+root.location.pathname;
  const pending={verifier,created:Date.now()};
  sessionStorage.setItem(PKCE,JSON.stringify(pending));
  try{localStorage.setItem(PKCE,JSON.stringify(pending));}catch(_){}
  const params=new URLSearchParams({provider:'google',redirect_to:redirect,code_challenge:challenge,code_challenge_method:'s256'});
  const target=URL+'/auth/v1/authorize?'+params;
  if(desktop)root.open(target,'_blank');else root.location.assign(target);
 },
 get currentUser(){return session&&session.user||null;},
 async restore(){
  const redirected=await sessionFromUrl();if(redirected)return redirected;
  if(!session){notify('INITIAL_SESSION');return null;}
  try{
   if(session.expires_at<=Math.floor(Date.now()/1000)+45)await refreshSession();
   const user=await request('/auth/v1/user');
   session.user=user;persist(session);notify('INITIAL_SESSION');return session;
  }catch(_){persist(null);notify('SIGNED_OUT');return null;}
 },
 onAuthStateChange(fn){listeners.add(fn);queueMicrotask(()=>{try{fn('INITIAL_SESSION',session);}catch(_){}});return{data:{subscription:{unsubscribe(){listeners.delete(fn);}}}};},
 async signInWithPassword(credentials){
  const response=await fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:headers(null),body:JSON.stringify({email:String(credentials.email||'').trim(),password:String(credentials.password||'')})});
  const data=await decode(response),next=authPayload(data);persist(next);notify('SIGNED_IN');return{data:{session:next,user:next&&next.user},error:null};
 },
 async signUp(credentials){
  const body={email:String(credentials.email||'').trim(),password:String(credentials.password||'')};
  if(credentials.options&&credentials.options.data)body.data=credentials.options.data;
  const response=await fetch(URL+'/auth/v1/signup',{method:'POST',headers:headers(null),body:JSON.stringify(body)});
  const data=await decode(response),next=authPayload(data),returnedUser=(next&&next.user)||data.user||null;
  if(!next&&returnedUser&&Array.isArray(returnedUser.identities)&&returnedUser.identities.length===0){const e=new Error('user_already_exists');e.code='user_already_exists';throw e;}
  if(next){persist(next);notify('SIGNED_IN');}
  return{data:{session:next,user:returnedUser},error:null};
 },
 async signOut(){
  try{if(session&&session.access_token)await request('/auth/v1/logout',{method:'POST'});}catch(_){}
  persist(null);notify('SIGNED_OUT');return{error:null};
 },
 async getSession(){return{data:{session},error:null};},
 mfa
};
function queryString(params){
 if(typeof params==='string')return params.replace(/^\?/,'');
 const out=new URLSearchParams();for(const [k,v] of Object.entries(params||{})){if(v!==undefined&&v!==null)out.set(k,String(v));}return out.toString();
}
const db={
 select(table,params){const qs=queryString(params);return request('/rest/v1/'+encodeURIComponent(table)+(qs?'?'+qs:''));},
 insert(table,body){return request('/rest/v1/'+encodeURIComponent(table),{method:'POST',headers:{Prefer:'return=representation'},body});},
 upsert(table,body,onConflict){return request('/rest/v1/'+encodeURIComponent(table)+(onConflict?'?on_conflict='+encodeURIComponent(onConflict):''),{method:'POST',headers:{Prefer:'return=representation,resolution=merge-duplicates'},body});},
 update(table,body,params){const qs=queryString(params);return request('/rest/v1/'+encodeURIComponent(table)+(qs?'?'+qs:''),{method:'PATCH',headers:{Prefer:'return=representation'},body});},
 rpc(name,body){return request('/rest/v1/rpc/'+encodeURIComponent(name),{method:'POST',body:body||{}});}
};
function toHealthGoUser(user){
 if(!user)return null;
 const providers=(user.identities||[]).map(x=>({providerId:(x.provider||'email')+'.com'}));
 if(!providers.length)providers.push({providerId:'password'});
 return{uid:user.id,email:user.email||'',providerData:providers,multiFactor:{enrolledFactors:Array.from({length:mfaFactorCount},(_,i)=>({uid:'mfa-'+i}))},raw:user};
}
root.HealthGoSupabase={url:URL,publishableKey:KEY,auth,db,request,toHealthGoUser,hasSession(){return!!(session&&session.access_token);},get session(){return session;}};
})(typeof window!=='undefined'?window:globalThis);
