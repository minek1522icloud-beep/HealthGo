'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const {createDesktopOAuth}=require('../desktop-oauth.cjs');
const attempt='a'.repeat(43);
function authUrl(){return 'https://oqrfapmdcofguwdvhbeo.supabase.co/auth/v1/authorize?'+new URLSearchParams({provider:'google',code_challenge:'b'.repeat(43),code_challenge_method:'s256',redirect_to:'http://127.0.0.1:5500/auth/callback?attempt='+attempt});}
test('desktop callback requires pending attempt, rejects mismatches and replay',()=>{
 const opened=[],loaded=[];
 const bridge=createDesktopOAuth(url=>opened.push(url),()=>({isDestroyed:()=>false,loadURL:url=>loaded.push(url),show(){},focus(){}}));
 const callback=new URL('http://127.0.0.1:5500/auth/callback?attempt='+attempt+'&code=valid');
 assert.equal(bridge.callback(callback),false);
 assert.equal(bridge.launch(authUrl()),true);
 assert.equal(bridge.callback(new URL('http://127.0.0.1:5500/auth/callback?attempt=wrong&code=bad')),false);
 assert.equal(bridge.callback(callback),true);assert.equal(bridge.callback(callback),false);
 assert.equal(opened.length,1);assert.equal(loaded[0],'http://127.0.0.1:5500/index.html?code=valid');
});
test('desktop never launches unrelated origins or unsafe redirects',()=>{
 const bridge=createDesktopOAuth(()=>assert.fail('must not open'),()=>null);
 assert.equal(bridge.launch(authUrl().replace('oqrfapmdcofguwdvhbeo.supabase.co','evil.example')),false);
 assert.equal(bridge.launch(authUrl().replace('127.0.0.1','evil.example')),false);
 assert.equal(bridge.launch('javascript:alert(1)'),false);
});
function client(enabled=true){
 const data=new Map(),calls=[];let opened;
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const ctx={URLSearchParams,TextEncoder,Uint8Array,crypto:webcrypto,btoa,queueMicrotask,localStorage:storage,sessionStorage:storage,navigator:{userAgent:'Electron/44'},location:{search:'',hash:'',pathname:'/index.html',origin:'http://127.0.0.1:5500'},history:{replaceState(){}},open:url=>{opened=url;},fetch:async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>JSON.stringify(url.includes('/settings')?{external:{google:enabled}}:{access_token:'test-access',refresh_token:'test-refresh',user:{id:'test-user'}})};}};
 vm.runInNewContext(fs.readFileSync('www/supabase-client.js','utf8'),ctx);
 return {ctx,calls,data,get opened(){return opened;}};
}
test('Google uses S256 PKCE and exchanges a callback exactly once',async()=>{
 const c=client();await c.ctx.HealthGoSupabase.auth.signInWithGoogle();
 const url=new URL(c.opened),pending=JSON.parse(c.data.get('healthgo_google_pkce_v1'));
 assert.equal(url.searchParams.get('code_challenge_method'),'s256');
 assert.equal(url.searchParams.get('code_challenge'),Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(pending.verifier))).toString('base64url'));
 c.ctx.location.search='?code=received';await c.ctx.HealthGoSupabase.auth.restore();
 const exchange=c.calls.find(x=>x.url.includes('grant_type=pkce'));
 assert.deepEqual(JSON.parse(exchange.options.body),{auth_code:'received',code_verifier:pending.verifier});
 assert.equal(c.ctx.HealthGoSupabase.auth.currentUser.id,'test-user');
 await assert.rejects(c.ctx.HealthGoSupabase.auth.restore(),/google_expired/);
});
test('disabled provider and missing verifier never proceed to Google or token exchange',async()=>{
 const c=client(false);await assert.rejects(c.ctx.HealthGoSupabase.auth.signInWithGoogle(),/google_not_configured/);assert.equal(c.opened,undefined);
 c.ctx.location.search='?code=unsolicited';await assert.rejects(c.ctx.HealthGoSupabase.auth.restore(),/google_expired/);
 assert.equal(c.calls.some(x=>x.url.includes('grant_type=pkce')),false);
});
