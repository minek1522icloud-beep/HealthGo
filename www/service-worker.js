'use strict';
const CACHE_NAME='healthgo-pwa-v2-20261004';
const CORE=['./','./index.html','./manifest.webmanifest','./healthgo-pro.js','./core/achievement-engine.js','./core/health-data.js','./healthgo-services.js','./healthgo-v2-ui.js','./healthgo-v2.css'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(async cache=>{for(const url of CORE){try{await cache.add(url);}catch(_){}}}));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('healthgo-pwa-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 // Cache only the static shell. Never persist API responses or another account's data.
 if(url.pathname.startsWith('/api/')||url.pathname.endsWith('/version.json'))return;
 const isShell=req.mode==='navigate'||/\.(?:html|js|css|png|ico|webmanifest)$/.test(url.pathname);
 if(!isShell)return;
 event.respondWith(fetch(req).then(res=>{
  if(res.ok){const copy=res.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)).catch(()=>{});}return res;
 }).catch(async()=>{
  const hit=await caches.match(req);if(hit)return hit;
  if(req.mode==='navigate')return caches.match('./index.html');
  return new Response('',{status:503,statusText:'Offline'});
 }));
});
