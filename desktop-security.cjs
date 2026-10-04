'use strict';

const LOCAL_APP_HOSTS=new Set(['127.0.0.1','localhost']);
const AUTH_HOSTS=new Set([
  'accounts.google.com',
  'appleid.apple.com',
  'healthgo-e45be.firebaseapp.com',
  'healthgo-e45be.web.app'
]);

function parseHttpUrl(value){
  try{
    const url=new URL(String(value||''));
    if(url.protocol!=='http:'&&url.protocol!=='https:')return null;
    return url;
  }catch(_){
    return null;
  }
}

function isHealthGoOrigin(value){
  const url=parseHttpUrl(value);
  return !!url&&url.protocol==='http:'&&LOCAL_APP_HOSTS.has(url.hostname)&&url.port==='5500';
}

function isAllowedAuthPopupUrl(value){
  const url=parseHttpUrl(value);
  if(!url||url.protocol!=='https:')return false;
  if(AUTH_HOSTS.has(url.hostname))return true;
  return url.hostname.endsWith('.googleapis.com')||url.hostname.endsWith('.googleusercontent.com');
}

function secureWebPreferences(){
  return Object.freeze({
    contextIsolation:true,
    nodeIntegration:false,
    webSecurity:true,
    sandbox:true,
    allowRunningInsecureContent:false
  });
}

function guardMainNavigation(webContents){
  if(!webContents||typeof webContents.on!=='function')return;
  webContents.on('will-navigate',(event,url)=>{
    if(!isHealthGoOrigin(url))event.preventDefault();
  });
}

module.exports={
  isHealthGoOrigin,
  isAllowedAuthPopupUrl,
  secureWebPreferences,
  guardMainNavigation
};
