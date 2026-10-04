(function(root){
'use strict';
const URL='https://oqrfapmdcofguwdvhbeo.supabase.co';
const KEY='sb_publishable_AuERvskDwwmm13In-B45zA_yKP6IElB';
const STORAGE='healthgo_supabase_session_v1';
const listeners=new Set();
let session=readSession(),refreshing=null;

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
const auth={
 get currentUser(){return session&&session.user||null;},
 async restore(){
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
  const data=await decode(response),next=authPayload(data);if(next){persist(next);notify('SIGNED_IN');}
  return{data:{session:next,user:(next&&next.user)||data.user||null},error:null};
 },
 async signOut(){
  try{if(session&&session.access_token)await request('/auth/v1/logout',{method:'POST'});}catch(_){}
  persist(null);notify('SIGNED_OUT');return{error:null};
 },
 async getSession(){return{data:{session},error:null};}
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
 return{uid:user.id,email:user.email||'',providerData:providers,multiFactor:{enrolledFactors:[]},raw:user};
}
root.HealthGoSupabase={url:URL,publishableKey:KEY,auth,db,request,toHealthGoUser,hasSession(){return!!(session&&session.access_token);},get session(){return session;}};
})(typeof window!=='undefined'?window:globalThis);
