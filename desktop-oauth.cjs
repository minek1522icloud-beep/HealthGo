'use strict';
function createDesktopOAuth(openExternal,getWindow){
 let pending=null;
 return {
  launch(value){
   let url,redirect;
   try{url=new URL(value);redirect=new URL(url.searchParams.get('redirect_to'));}catch(_){return false;}
   if(url.origin!=='https://oqrfapmdcofguwdvhbeo.supabase.co'||url.pathname!=='/auth/v1/authorize'||url.searchParams.get('provider')!=='google'||url.searchParams.get('code_challenge_method')!=='s256'||!/^[\w-]{43}$/.test(url.searchParams.get('code_challenge')||''))return false;
   const attempt=redirect.searchParams.get('attempt');
   if(redirect.origin!=='http://127.0.0.1:5500'||redirect.pathname!=='/auth/callback'||!/^[\w-]{43}$/.test(attempt||''))return false;
   pending={attempt,expires:Date.now()+600000};
   Promise.resolve(openExternal(url.href)).catch(()=>{pending=null;});return true;
  },
  callback(url){
   if(!pending||pending.expires<Date.now()||url.searchParams.get('attempt')!==pending.attempt)return false;
   const code=url.searchParams.get('code'),error=url.searchParams.get('error');
   if((!code&&!error)||(code&&code.length>2048))return false;
   const win=getWindow();if(!win||win.isDestroyed())return false;
   pending=null;
   const target=new URL('http://127.0.0.1:5500/index.html');
   target.searchParams.set(code?'code':'error',code||'access_denied');
   target.searchParams.set('oauth_return','1');
   win.loadURL(target.href);win.show();win.focus();return true;
  }
 };
}
module.exports={createDesktopOAuth};
