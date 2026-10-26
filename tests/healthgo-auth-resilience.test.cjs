'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const src=fs.readFileSync('www/supabase-client.js','utf8');
const KEY='healthgo_supabase_session_v1';
function setup(reply){
 let now=Date.now();const data=new Map(),events=[],calls=[];
 const saved={access_token:'old-access',refresh_token:'old-refresh',expires_at:Math.floor(now/1000)-10,
  user:{id:'user-a',email:'test@example.invalid'}};
 data.set(KEY,JSON.stringify(saved));
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const context={
  Date:{now:()=>now},localStorage:storage,sessionStorage:storage,
  queueMicrotask,crypto:webcrypto,TextEncoder,Uint8Array,btoa,atob,URLSearchParams,
  location:{search:'',hash:'',pathname:'/',origin:'https://example.invalid'},
  history:{replaceState(){}},
  fetch:async(url,options)=>{
   calls.push({url,options});return reply(url,options,calls.length);
  }
 };
 context.window=context;
 vm.runInNewContext(src,context,{filename:'supabase-client.js'});
 const auth=context.HealthGoSupabase.auth;
 auth.onAuthStateChange(event=>events.push(event));
 return{auth,data,events,calls,advance(ms){now+=ms},context,saved};
}
const json=(value,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(value)});
test('temporary iPhone network failure retains persisted login and emits no SIGNED_OUT',async()=>{
 let fail=true;
 const h=setup(async url=>{
  if(url.includes('grant_type=refresh_token')){if(fail)throw new TypeError('Failed to fetch');return json({
   access_token:'new-token',refresh_token:'new-refresh',expires_in:3600,user:{id:'user-a'}
  });}
  return json({id:'user-a'});
 });
 const restored=await h.auth.restore();
 assert.equal(restored?.user?.id,'user-a');
 assert.equal(h.auth.currentUser?.id,'user-a');
 assert.equal(JSON.parse(h.data.get(KEY)).refresh_token,'old-refresh');
 assert.ok(!h.events.includes('SIGNED_OUT'));
 assert.ok(h.events.includes('INITIAL_SESSION'));
 // Do not hammer Supabase during an outage; retry when time permits.
 await assert.rejects(h.auth.refreshSession(),e=>e.code==='SESSION_RECOVERY_PENDING');
 assert.equal(h.calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,1);
 fail=false;h.advance(3500);
 const next=await h.auth.refreshSession();
 assert.equal(next.access_token,'new-token');
 assert.equal(JSON.parse(h.data.get(KEY)).refresh_token,'new-refresh');
 assert.ok(h.events.includes('TOKEN_REFRESHED'));
 assert.ok(!h.events.includes('SIGNED_OUT'));
});
test('HTTP 500, generic 401 and errors without explicit revocation never clear a valid local identity',async()=>{
 for(const status of [500,503,401]){
  const h=setup(async()=>json({error:'temporary_server_error',message:'server unavailable'},status));
  const restored=await h.auth.restore();
  assert.equal(restored?.user?.id,'user-a');
  assert.equal(h.events.filter(e=>e==='SIGNED_OUT').length,0);
  assert.ok(h.data.has(KEY));
 }
});
test('explicitly revoked refresh token causes real sign out and removes invalid session',async()=>{
 const h=setup(async()=>json({code:'refresh_token_not_found',message:'Invalid refresh token'},400));
 const session=await h.auth.restore();
 assert.equal(session,null);
 assert.equal(h.auth.currentUser,null);
 assert.equal(h.data.has(KEY),false);
 assert.ok(h.events.includes('SIGNED_OUT'));
});
test('sign out beats any refresh still in flight and cannot silently log back in',async()=>{
 let release=null;
 const blocked=new Promise(resolve=>{release=resolve});
 const h=setup(async url=>{
  if(url.includes('grant_type=refresh_token'))return blocked;
  return json({},204);
 });
 const pending=h.auth.refreshSession();
 await Promise.resolve();
 const explicit=h.auth.signOut();
 await explicit;
 assert.equal(h.auth.currentUser,null);
 assert.equal(h.data.has(KEY),false);
 release(json({access_token:'stale',refresh_token:'stale-refresh',expires_in:3600,user:{id:'user-a'}}));
 await pending;
 assert.equal(h.auth.currentUser,null);
 assert.equal(h.data.has(KEY),false);
 assert.ok(h.events.includes('SIGNED_OUT'));
});
test('invalid Google callback does not erase previously saved account',async()=>{
 const h=setup(async()=>json({id:'user-a'}));
 h.context.location.search='?code=missing-pkce-verifier';
 await assert.rejects(h.auth.restore(),/google_expired/);
 assert.equal(JSON.parse(h.data.get(KEY)).user.id,'user-a');
});
test('version-checking applies published updates only when safe and preserves auth callbacks',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(html,/healthGoUpdateStatus\('Wykryto nową wersję HealthGo/);\n assert.match(html,/healthGoActivateNewVersion\(remote,force\)/);
 assert.match(html,/HealthGoMapPro\?\.isNavigating\?\.\(\)/);
 assert.match(html,/if\(auth\.currentUser\)\{showApp\(\)/);
 assert.match(html,/resumeAuthIfNeeded/);
 assert.match(html,/supabase-client\.js\?v=2/);
});
