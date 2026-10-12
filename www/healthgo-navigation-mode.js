/* HealthGo navigation 2D/3D mode controller.
 * Reuses the exact OSRM route, GPS watcher and voice directions in HealthGoMapPro.
 * Never simulates travel; no GPS coordinates are saved in localStorage.
 */
(function(w){
 'use strict';
 const $=id=>document.getElementById(id);
 let running=false,mode='3d',route=null,lastFix=null,hiddenLayers=[],hiddenMap=null;
 const key=()=>{
  const uid=String(w.HealthGoServices?.state?.uid||'').trim();
  return uid?'healthgo.navigation.view.v1.'+uid:null;
 };
 function savedMode(){
  const storageKey=key();
  if(!storageKey)return '3d';
  try{return localStorage.getItem(storageKey)==='2d'?'2d':'3d'}catch(_){return '3d'}
 }
 function persist(){
  const storageKey=key();
  if(storageKey)try{localStorage.setItem(storageKey,mode)}catch(_){}
 }
 function message(s){
  const node=$('hgLiveMapStatus');
  if(node){node.hidden=!s;if(s)node.textContent=s;}
 }
 function buttons(){
  const parent=$('hgViewModeSwitch');
  if(!parent)return;
  for(const button of parent.querySelectorAll?.('[data-hg-view]')||[]){
   const pressed=button.dataset.hgView===mode;
   button.classList?.toggle?.('active',pressed);
   button.setAttribute('aria-pressed',String(pressed));
  }
  parent.setAttribute('aria-label','Widok nawigacji: '+(mode==='3d'?'3D':'2D'));
 }
 const map=()=>w.healthGoMapInstance?.()||null;
 function hideDiscoveryLayers(){
  const m=map();if(!m)return;
  hiddenLayers=[];hiddenMap=m;
  // Existing family/place/location layers are merely hidden, never destroyed.
  const layers=[
   typeof healthGoFamilyLayer==='undefined'?null:healthGoFamilyLayer,
   typeof healthGoLocationLayer==='undefined'?null:healthGoLocationLayer,
   typeof healthGoPlacesLayer==='undefined'?null:healthGoPlacesLayer
  ];
  for(const layer of layers){
   if(layer&&m.hasLayer?.(layer)){
    try{m.removeLayer(layer);hiddenLayers.push(layer);}catch(_){}
   }
  }
 }
 function restoreLayers(){
  const m=map();
  if(m&&m===hiddenMap){
   for(const layer of hiddenLayers){try{if(!m.hasLayer?.(layer))m.addLayer(layer)}catch(_){}}
  }
  hiddenLayers=[];hiddenMap=null;
 }
 function apply(){
  buttons();
  if(!running)return mode;
  if(mode==='2d'){
   w.HealthGoNavigationLive?.stop?.();
   message('');
  }else{
   const driver=w.HealthGoNavigationLive;
   if(!driver){fallback();return mode;}
   message('Przygotowuję pochylony widok 3D. Nawigacja GPS działa dalej w 2D.');
   driver.begin?.(route);
   if(lastFix)driver.update?.(lastFix);
  }
  return mode;
 }
 function setMode(next,save=true){
  if(next!=='2d'&&next!=='3d')return false;
  if(next===mode){buttons();return true;}
  mode=next;if(save)persist();
  apply();
  return true;
 }
 function begin(gpsRoute){
  if(running)stop();
  route=gpsRoute;lastFix=null;mode=savedMode();running=true;
  hideDiscoveryLayers();w.HealthGoMapExtras?.navigationStarted?.();apply();
  return true;
 }
 function rememberFix(position){
  if(!running||!position?.coords)return;
  const c=position.coords;
  if(!Number.isFinite(Number(c.latitude))||!Number.isFinite(Number(c.longitude))||
   !Number.isFinite(Number(c.accuracy))||Number(c.accuracy)>150)return;
  // Ephemeral only. Used to initialize 3D immediately on user mode switch.
  lastFix=position;
 }
 function setRoute(next){
  route=next;
  if(running&&mode==='3d')w.HealthGoNavigationLive?.setRoute?.(next);
 }
 function fallback(){
  if(!running||mode!=='3d')return;
  mode='2d'; // Runtime fallback must not rewrite a user's saved 3D preference.
  w.HealthGoNavigationLive?.stop?.();
  buttons();
  message('Widok 3D jest niedostępny na tym urządzeniu. Trasa i głos nadal działają w 2D.');
 }
 function stop(){
  running=false;route=null;lastFix=null;
  w.HealthGoNavigationLive?.stop?.();
  restoreLayers();w.HealthGoMapExtras?.navigationStopped?.();
  message('');
  buttons();
 }
 // Buttons change only the renderer; the route, OSRM progress, voice and
 // navigator.geolocation.watchPosition callback stay active.
 $('hgViewModeSwitch')?.addEventListener('click',event=>{
  const control=event.target.closest?.('[data-hg-view]');
  if(control)setMode(control.dataset.hgView);
 });
 mode=savedMode();buttons();
 w.HealthGoNavigationMode=Object.freeze({begin,stop,setMode,setRoute,rememberFix,fallback,
  getMode:()=>mode,isRunning:()=>running,getPreference:savedMode});
})(window);