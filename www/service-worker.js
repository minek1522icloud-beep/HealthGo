'use strict';
const CACHE_NAME='healthgo-pwa-v16-mobile-ai-cancel-20261008';
const CORE=['./','./index.html','./manifest.webmanifest','./healthgo-pro.js','./supabase-client.js','./core/achievement-engine.js','./core/health-data.js','./healthgo-services.js','./healthgo-v2-ui.js','./healthgo-mobile-suite.js','./healthgo-mobile-suite.css','./healthgo-devices.js'];
const PREFERENCES_CACHE='healthgo-preferences-v1';
const OFFLINE_DISABLED='./offline-disabled';
let offlinePreference=null;
async function offlineEnabled(){
 if(offlinePreference!==null)return offlinePreference;
 const cache=await caches.open(PREFERENCES_CACHE);
 offlinePreference=!(await cache.match(OFFLINE_DISABLED));
 return offlinePreference;
}
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING'){
  event.waitUntil(self.skipWaiting());
  return;
 }
 if(!event.data||event.data.type!=='HEALTHGO_OFFLINE_CACHE')return;
 event.waitUntil((async()=>{
  const enabled=event.data.enabled!==false;
  offlinePreference=enabled;
  const prefs=await caches.open(PREFERENCES_CACHE);
  if(enabled)await prefs.delete(OFFLINE_DISABLED);
  else{
   await prefs.put(OFFLINE_DISABLED,new Response('disabled'));
   await caches.delete(CACHE_NAME);
  }
 })());
});
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  if(await offlineEnabled()){
   const cache=await caches.open(CACHE_NAME);
   for(const url of CORE){try{await cache.add(url);}catch(_){}}
  }
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keep=await offlineEnabled();
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('healthgo-pwa-')&&(!keep||k!==CACHE_NAME)).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/auth/')||url.searchParams.has('code')||url.searchParams.has('error'))return;
 // Cache only the static shell. Never persist API responses or another account's data.
 if(url.pathname.startsWith('/api/')||url.pathname.endsWith('/version.json'))return;
 const isShell=req.mode==='navigate'||/\.(?:html|js|css|png|ico|webmanifest)$/.test(url.pathname);
 if(!isShell)return;
 event.respondWith((async()=>{
  const enabled=await offlineEnabled();
  if(!enabled)return fetch(req);
  try{
   const res=await fetch(req);
   if(res.ok){
    const copy=res.clone();
    caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)).catch(()=>{});
   }
   return res;
  }catch(_){
   const hit=await caches.match(req);
   if(hit)return hit;
   if(req.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
   return new Response('',{status:503,statusText:'Offline'});
  }
 })());
});
