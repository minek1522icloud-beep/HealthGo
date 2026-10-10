/* HealthGo Map 4.0: light 2D turn-by-turn guidance, no 3D/WebGL dependencies. */
(function(){
 'use strict';
 const node=id=>document.getElementById(id);
 const map=()=>typeof healthGoMap==='undefined'?null:healthGoMap;
 let route=null,remaining=[],watchId=null,active=false,stepIndex=0,arrow=null;
 let voice=false,follow=true,night=false,lastSpeech='',lastCamera=0,position=null;
 let furthestProgress=0;
 let offRouteTicks=0,lastReroute=0,rerouting=false,rerouteCtl=null,voiceStep=-1,voiceStage='';
 let arrivalCount=0,arrivalTimer=null;
 const text=(id,value)=>{const n=node(id);if(n)n.textContent=String(value)};
 const show=(id,visible)=>{const n=node(id);if(n)n.hidden=!visible};
 function gpsAlert(message){
  const el=node('hgNavGpsStatus');
  if(!el)return;
  el.hidden=!message;
  if(message)el.textContent=message;
 }
 const radians=x=>x*Math.PI/180;
 const meters=(a,b)=>{
  const dy=radians(b.lat-a.lat),dx=radians(b.lon-a.lon);
  const x=Math.sin(dy/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dx/2)**2;
  return 12742000*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
 };
 const nice=m=>m>=1000?(m/1000).toFixed(1).replace('.',',')+' km':Math.max(0,Math.round(m))+' m';
 function suffix(coords){
  remaining=new Array(coords.length).fill(0);
  for(let i=coords.length-2;i>=0;i--)remaining[i]=remaining[i+1]+meters(
   {lat:coords[i][1],lon:coords[i][0]},{lat:coords[i+1][1],lon:coords[i+1][0]});
 }
 function segmentProgress(point){
  if(!route?.geometry?.length||!remaining.length)return {distance:Infinity,left:0};
  const p=route.geometry,latScale=111320,lonScale=Math.cos(radians(point.lat))*111320;
  let best=Infinity,left=remaining[0]||0;
  // Project the GPS position onto actual route segments, rather than using
  // only the closest route vertex (which can be far away on straight roads).
  for(let i=0;i<p.length-1;i++){
   const ax=(p[i][0]-point.lon)*lonScale,ay=(p[i][1]-point.lat)*latScale;
   const bx=(p[i+1][0]-point.lon)*lonScale,by=(p[i+1][1]-point.lat)*latScale;
   const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
   const t=len2?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len2)):0;
   const distance=Math.hypot(ax+t*dx,ay+t*dy);
   if(distance<best){
    best=distance;left=Math.max(0,(remaining[i]||0)-t*((remaining[i]||0)-(remaining[i+1]||0)));
   }
  }
  return {distance:best,left};
 }
 function routeRemaining(point){return segmentProgress(point).left}

 function maneuverInfo(step){
  const m=step?.maneuver||{},name=String(step?.name||'').slice(0,80);
  if(m.type==='arrive')return {action:'Dojeżdżasz do celu',street:name||'Cel podróży',icon:'◆'};
  if(m.type==='depart')return {action:'Rozpocznij jazdę',street:name||'Trzymaj się trasy',icon:'↑'};
  if(m.type==='roundabout'||m.type==='rotary')return {action:'Wjedź na rondo',street:name||'Rondo',icon:'⟳'};
  const direction=String(m.modifier||'');
  const action=direction==='uturn'?'Zawróć':direction.includes('left')?'Skręć w lewo':
   direction.includes('right')?'Skręć w prawo':'Jedź prosto';
  const icon=direction==='uturn'?'↶':direction.includes('left')?'↰':direction.includes('right')?'↱':'↑';
  return {action,street:name||'Kontynuuj wyznaczoną trasą',icon};
 }
 function instruction(step){
  const m=maneuverInfo(step);
  return [m.action+(step?.name?' — '+m.street:''),m.icon];
 }
 function setProgress(percent){
  const p=Math.min(100,Math.max(0,Number(percent)||0));
  const fill=node('hgProNavProgress'),arrow=node('hgProNavProgressTrack');
  if(fill)fill.style.width=p+'%';
  if(arrow){arrow.setAttribute('aria-valuenow',String(Math.round(p)));
   arrow.style.setProperty('--hg-drive-percent',p+'%');}
 }
 function navigationProgress(left){
  const total=Math.max(route?.meters||0,remaining[0]||0,1);
  furthestProgress=Math.max(furthestProgress,Math.min(100,100*(1-Math.min(1,left/total))));
  return furthestProgress;
 }
 function setRoute(item,destination){
  const coords=item?.geometry?.coordinates;
  if(!Array.isArray(coords)||coords.length<2||coords.some(p=>!Array.isArray(p)||
    p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])))return false;
  const steps=(Array.isArray(item.legs)?item.legs:[]).flatMap(l=>Array.isArray(l.steps)?l.steps:[]);
  if(!steps.some(step=>step?.maneuver&&Array.isArray(step.maneuver.location)&&
    step.maneuver.location.length===2&&Number.isFinite(step.maneuver.location[0])&&
    Number.isFinite(step.maneuver.location[1]))){
   text('mapV2RouteOutput','Ta trasa nie zawiera prawdziwych instrukcji skrętów. Spróbuj ponownie.');
   return false;
  }
  stopNavigation();
  route={geometry:coords,steps,meters:Number(item.distance)||0,seconds:Number(item.duration)||0,destination:String(destination||'Cel podróży').slice(0,100)};
  suffix(coords);stepIndex=0;furthestProgress=0;offRouteTicks=0;voiceStep=-1;voiceStage='';setProgress(0);
  show('hgNavStartButton',steps.length>0);
  text('hgProNavDestination',route.destination);
  return true;
 }
 function clearRoute(){stopNavigation();route=null;remaining=[];furthestProgress=0;setProgress(0);show('hgNavStartButton',false)}
 function removeArrow(){if(arrow){try{map()?.removeLayer?.(arrow)}catch(_){}arrow=null}}
 function placeArrow(point,heading){
  if(typeof L==='undefined'||!L.divIcon||!L.marker||!map())return;
  if(!arrow){
   arrow=L.marker([point.lat,point.lon],{
    icon:L.divIcon({className:'hg-nav-user-icon',
     html:'<span class="hg-nav-arrow"><svg width="38" height="44" viewBox="0 0 38 44" aria-hidden="true">'+
       '<path d="M19 2 30 12 32 33 26 39 12 39 6 33 8 12Z" fill="#166ef0" stroke="white" stroke-width="2.5"/>'+
       '<path d="m13 16 6-6 6 6v7H13Z" fill="#d6efff"/><path d="M13 29h12" stroke="#fff" stroke-width="3"/></svg></span>',
     iconSize:[48,48],iconAnchor:[24,24]}),
    interactive:false,zIndexOffset:3000
   }).addTo(map());
  }else arrow.setLatLng([point.lat,point.lon]);
  const tip=arrow.getElement?.()?.querySelector?.('.hg-nav-arrow');
  if(tip&&Number.isFinite(heading)&&heading>=0)tip.style.transform='rotate('+heading+'deg)';
 }
 function speak(message,key=message){
  if(!voice||!window.speechSynthesis||!window.SpeechSynthesisUtterance||key===lastSpeech)return;
  lastSpeech=key;
  try{window.speechSynthesis.cancel();const u=new window.SpeechSynthesisUtterance(message);u.lang='pl-PL';u.rate=.95;window.speechSynthesis.speak(u)}catch(_){}
 }
 function nearestRouteDistance(point){return segmentProgress(point).distance}
 async function requestReroute(point){
  if(rerouting||!active||!route?.geometry?.length||typeof fetch!=='function')return false;
  lastReroute=Date.now();rerouting=true;
  const destination=route.geometry[route.geometry.length-1];
  const current=route.destination,oldRoute=route;
  const url='https://router.project-osrm.org/route/v1/driving/'+
   encodeURIComponent(point.lon)+','+encodeURIComponent(point.lat)+';'+
   encodeURIComponent(destination[0])+','+encodeURIComponent(destination[1])+
   '?overview=full&geometries=geojson&steps=true&alternatives=false';
  const ctl=new AbortController();rerouteCtl=ctl;
  const timeout=setTimeout(()=>ctl.abort(),14000);
  text('hgProNavNext','Przeliczam trasę po zmianie kierunku…');
  try{
   const response=await fetch(url,{signal:ctl.signal});
   if(!response.ok)throw Error('ROUTE_SERVER');
   const data=await response.json(),updated=data?.routes?.[0];
   const geometry=updated?.geometry?.coordinates;
   if(!active||route!==oldRoute||!Array.isArray(geometry)||geometry.length<2||
      geometry.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])))return false;
   const steps=(updated.legs||[]).flatMap(l=>Array.isArray(l.steps)?l.steps:[]);
   if(!steps.length)return false;
   route={geometry,steps,meters:Number(updated.distance)||0,seconds:Number(updated.duration)||0,destination:current};
   suffix(geometry);stepIndex=0;furthestProgress=0;offRouteTicks=0;voiceStep=-1;voiceStage='';setProgress(0);
   window.HealthGoMapV2?.updateLiveRoute?.(updated);
   window.HealthGoNavigationFollow?.setRoute?.(updated);
   window.HealthGoNavigationLive?.setRoute?.(updated);
   speak('Trasa została przeliczona','route-recomputed-'+lastReroute);
   text('hgProNavNext','Zaktualizowano trasę na podstawie GPS');
   return true;
  }catch(_){if(active)text('hgProNavNext','Nie udało się przeliczyć. Pozostaje poprzednia trasa.');return false}
  finally{clearTimeout(timeout);if(rerouteCtl===ctl)rerouteCtl=null;rerouting=false}
 }
 function positionUpdate(pos){
  if(!active||!route)return;
  const c=pos.coords||{},point={lat:c.latitude,lon:c.longitude};
  if(typeof point.lat!=='number'||typeof point.lon!=='number'||
      !Number.isFinite(point.lat)||!Number.isFinite(point.lon)||
      typeof c.accuracy!=='number'||!Number.isFinite(c.accuracy)||c.accuracy<0||
      c.accuracy>150){
   gpsAlert('Słaby lub niedostępny sygnał GPS — czekam na dokładniejszy odczyt.');
   return;
  }
  gpsAlert(c.accuracy>80?'Dokładność GPS jest ograniczona. Sprawdź lokalizację przed jazdą.':'');
  position=point;
  window.HealthGoMapV2?.rememberPosition?.({lat:point.lat,lon:point.lon,accuracy:c.accuracy});
  // OSRM starts with a departure maneuver at the origin. Move on to the
  // next instruction once that origin is reached instead of displaying
  // the misleading "start driving" banner indefinitely.
  if(stepIndex===0&&route.steps.length>1&&route.steps[0]?.maneuver?.type==='depart')stepIndex=1;
  let step=route.steps[stepIndex],loc=step?.maneuver?.location;
  let target=Array.isArray(loc)?{lat:loc[1],lon:loc[0]}:null;
  let distanceTo=target?Math.max(0,routeRemaining(point)-routeRemaining(target)):null;
  if(distanceTo!==null&&distanceTo<30&&stepIndex<route.steps.length-1){
   stepIndex++;
   step=route.steps[stepIndex];loc=step?.maneuver?.location;
   target=Array.isArray(loc)?{lat:loc[1],lon:loc[0]}:null;
   distanceTo=target?Math.max(0,routeRemaining(point)-routeRemaining(target)):null;
  }
  const chosen=maneuverInfo(step);
  text('hgProNavDirection',chosen.action);
  text('hgProNavIcon',chosen.icon);
  text('hgProNavTurnDistance',distanceTo===null?'Jedź prosto':nice(distanceTo));
  text('hgProNavStreet',chosen.street);
  text('hgProNavNext',Number(c.accuracy)>60?'Słabszy sygnał GPS':'');
  const left=routeRemaining(point),full=Math.max(route.meters,remaining[0]||0,1);
  const seconds=Math.max(0,Math.round(route.seconds*Math.min(1,left/full)));
  const eta=new Date(Date.now()+seconds*1000);
  text('hgProNavEta',eta.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}));
  text('hgProNavTime',String(Math.max(0,Math.ceil(seconds/60))));
  text('hgProNavDistance',nice(left));
  setProgress(navigationProgress(left));
  text('hgProNavSpeed',c.speed==null||!Number.isFinite(c.speed)?'—':String(Math.max(0,Math.round(c.speed*3.6))));
  // A single GPS marker driven by real watchPosition samples. When the new
  // lightweight controller is unavailable, preserve the old Leaflet marker.
  const followed=window.HealthGoNavigationFollow?.update?.(pos);
  if(!followed)placeArrow(point,c.heading==null?NaN:Number(c.heading));
  window.HealthGoNavigationLive?.update?.(pos);
  if(Number(c.accuracy)<35&&Number(c.speed)>=0.8&&route?.geometry?.length>1){
   const away=nearestRouteDistance(point);
   offRouteTicks=away>90?offRouteTicks+1:0;
   if(offRouteTicks>=3&&!rerouting&&Date.now()-lastReroute>90000){
    offRouteTicks=0;requestReroute(point);
   }
  }else offRouteTicks=0;
  if(!window.HealthGoNavigationFollow?.status?.().active &&
      follow&&Date.now()-lastCamera>=1100){
   lastCamera=Date.now();map()?.setView?.([point.lat,point.lon],Math.max(16,map()?.getZoom?.()||16),{animate:true});
  }
  if(voiceStep!==stepIndex){voiceStep=stepIndex;voiceStage='';}
  if(distanceTo===null){
   if(voiceStage!=='next'){speak(instruction(step)[0],'step-'+stepIndex);voiceStage='next'}
  }else if(distanceTo<60&&voiceStage!=='near'){
   speak('Za '+nice(distanceTo)+' '+instruction(step)[0],'near-'+stepIndex);voiceStage='near';
  }else if(distanceTo<300&&voiceStage!=='approach'&&voiceStage!=='near'){
   speak('Za '+nice(distanceTo)+' '+instruction(step)[0],'approach-'+stepIndex);voiceStage='approach';
  }
  const finish=route.geometry[route.geometry.length-1];
  // An arrival requires two accurate GPS fixes near the end of the *actual*
  // route. One noisy position never ends a trip.
  const reached=Number.isFinite(c.accuracy)&&c.accuracy<=35&&
   meters(point,{lat:finish[1],lon:finish[0]})<25&&left<45;
  arrivalCount=reached?arrivalCount+1:0;
  if(reached){
   text('hgProNavDirection','Dotarcie do celu');text('hgProNavTurnDistance','Cel');
   text('hgProNavStreet',route.destination);text('hgProNavNext','Sprawdź dokładne położenie');
   setProgress(100);
   if(arrivalCount>=2&&!arrivalTimer){
    speak('Dotarłeś do celu. Kończę prowadzenie.','destination-arrived');
    // Leave a moment to see the real arrival on screen, then return to Map.
    arrivalTimer=window.setTimeout?.(()=>{arrivalTimer=null;if(active)stopNavigation();},4500)||null;
   }
  }
 }
 function syncVoiceButton(){
  const button=node('hgNavVoiceQuick');
  if(!button)return;
  const supported=!!window.speechSynthesis&&!!window.SpeechSynthesisUtterance;
  const enabled=supported&&voice;
  button.disabled=!supported;
  button.setAttribute('aria-pressed',String(enabled));
  button.setAttribute('aria-label',supported?(enabled?'Wycisz komunikaty głosowe':'Włącz komunikaty głosowe'):'Odczyt głosowy niedostępny na tym telefonie');
  button.title=supported?(enabled?'Głos nawigacji: włączony':'Głos nawigacji: wyłączony'):'Brak syntezy mowy';
 }
 function loadOptions(){
  const pref=window.HealthGoMap4?.getSettings?.()||{};
  // Every new trip should automatically follow the GPS arrow, even if the
  // previous trip used free-look mode.
  voice=!!pref.voice;follow=true;
  window.HealthGoNavigationFollow?.setFollowing?.(follow);
  syncVoiceButton();
  const b=node('hgProVoice');if(b){b.textContent=voice?'Głos: włączony':'Głos: wyłączony';b.setAttribute('aria-pressed',String(voice))}
  const f=node('hgProFollow');if(f){f.textContent=follow?'Śledź położenie':'Mapa swobodna';f.setAttribute('aria-pressed',String(follow))}
  setNight(pref.theme==='dark'||(pref.theme!=='light'&&new Date().getHours()>=19));
 }
 function setNight(value){
  night=!!value;
  node('mapWorkspace')?.classList?.toggle('hg-nav-dark',night);
 }
 let restoreMapLayer=null;
 function startNavigation(initialFix){
  if(active)return true;
  if(!route?.steps?.length){text('mapV2RouteOutput','Nie udało się pobrać skrętów trasy. Wyznacz trasę ponownie.');return false}
  if(!navigator.geolocation){text('mapV2RouteOutput','GPS niedostępny. Możesz użyć podglądu trasy z wpisanego adresu.');return false}
  active=true;stepIndex=0;lastSpeech='';lastCamera=0;furthestProgress=0;offRouteTicks=0;voiceStep=-1;voiceStage='';arrivalCount=0;
  setProgress(0);
  const options=node('hgProNavOptions');if(options)options.open=false;
  // During driving show a legible 2D street map instead of Esri satellite
  // imagery. Restore the user's chosen layer after exiting guidance.
  const mapModule=window.HealthGoMapV2;
  if(mapModule?.getLayerKind?.()==='satellite'){
   restoreMapLayer='satellite';mapModule.chooseLayer?.('street');
  }
  window.HealthGoMapV2?.close?.();
  const panels=document.querySelectorAll?.('#map .map-v2-panel');
  panels?.forEach?.(panel=>{panel.hidden=true;});
  document.body?.classList?.add('hg-navigation-active');
  node('mapWorkspace')?.classList?.add('map-pro-navigating');
  show('hgProNavigation',true);
  gpsAlert('');
  loadOptions();
  removeArrow();
  window.HealthGoNavigationFollow?.begin?.({geometry:{coordinates:route.geometry}},{follow});
  // Keep 2D Leaflet guidance lightweight and immediate on iPhone. The
  // optional perspective renderer is not started in 2D guidance.
  window.HealthGoNavigationLive?.stop?.();
  speak('Rozpoczynam prowadzenie. Sprawdzam pozycję GPS.','navigation-start');
  text('hgProNavDestination',route.destination);
  text('hgProNavDirection','Ustalam pozycję');text('hgProNavIcon','↑');
  text('hgProNavTurnDistance','—');text('hgProNavStreet','Czekam na GPS');
  text('hgProNavNext','Pozycja jest używana tylko podczas prowadzenia.');
  text('hgProNavEta','—');text('hgProNavTime',String(Math.max(1,Math.ceil(route.seconds/60))));
  text('hgProNavDistance',nice(route.meters));
  // Leaflet caches the size from the discovery map. Refresh its viewport
  // after the fullscreen layout settles, then recenter the real GPS arrow.
  window.setTimeout?.(()=>{
   map()?.invalidateSize?.({pan:false});
   if(active&&follow)window.HealthGoNavigationFollow?.setFollowing?.(true);
  },110);
  try{
   watchId=navigator.geolocation.watchPosition(positionUpdate,err=>{
    const message=err?.code===1?'Telefon nie zezwolił na GPS. Sprawdź uprawnienia lokalizacji albo wpisz punkt startowy.':'Utracono GPS. Spróbuj na otwartej przestrzeni.';
    text('hgProNavNext',message);text('hgProNavStreet','GPS niedostępny');gpsAlert(message);
    if(err?.code===1){
     stopNavigation();
     window.HealthGoMapV2?.toggle?.('route');
     text('mapV2RouteOutput',message);
    }
   },{enableHighAccuracy:true,maximumAge:5000,timeout:17000});
  }catch(_){stopNavigation();return false}
  // Immediate turn card and location from the authentic GPS fix obtained
  // when the user chose the destination, while continuous watch starts.
  const lat=Number(initialFix?.lat),lon=Number(initialFix?.lon),accuracy=Number(initialFix?.accuracy);
  if(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lon)&&Math.abs(lon)<=180&&
   Number.isFinite(accuracy)&&accuracy>=0&&accuracy<=150){
   positionUpdate({coords:{latitude:lat,longitude:lon,accuracy,speed:null,heading:null}});
  }
  return true;
 }
 function stopNavigation(){
  active=false;
  if(arrivalTimer){window.clearTimeout?.(arrivalTimer);arrivalTimer=null;}
  arrivalCount=0;
  if(rerouteCtl){rerouteCtl.abort();rerouteCtl=null}rerouting=false;
  window.HealthGoNavigationLive?.stop?.();
  window.HealthGoNavigationFollow?.stop?.();
  if(watchId!==null)try{navigator.geolocation?.clearWatch?.(watchId)}catch(_){}
  watchId=null;position=null;removeArrow();
  show('hgProNavigation',false);
  gpsAlert('');
  node('mapWorkspace')?.classList?.remove('map-pro-navigating');
  node('mapWorkspace')?.classList?.remove('hg-nav-dark');
  document.body?.classList?.remove('hg-navigation-active');
  try{window.speechSynthesis?.cancel?.()}catch(_){}
  if(restoreMapLayer){window.HealthGoMapV2?.chooseLayer?.(restoreMapLayer);restoreMapLayer=null;}
  window.HealthGoMapV2?.resizeViewport?.();
  window.setTimeout?.(()=>map()?.invalidateSize?.({pan:false}),50);
 }
 function toggleVoice(){
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){
   text('hgProNavNext','Ten telefon nie udostępnia głosowego odczytywania wskazówek.');return false
  }
  voice=!voice;lastSpeech='';
  const b=node('hgProVoice');if(b){b.textContent=voice?'Głos: włączony':'Głos: wyłączony';b.setAttribute('aria-pressed',String(voice))}
  window.HealthGoMap4?.saveSettings?.({voice});
  syncVoiceButton();
  return voice;
 }
 function toggleFollow(){
  follow=!follow;
  const b=node('hgProFollow');if(b){b.textContent=follow?'Śledź położenie':'Mapa swobodna';b.setAttribute('aria-pressed',String(follow))}
  // Free-look applies to this navigation session only; next trip follows GPS.
  window.HealthGoNavigationFollow?.setFollowing?.(follow);
  return follow;
 }
 function resumeFollow(){
  if(!follow)return toggleFollow();
  window.HealthGoNavigationFollow?.setFollowing?.(true);
  return true;
 }
 function toggleNavigationTheme(){setNight(!night);window.HealthGoMap4?.saveSettings?.({theme:night?'dark':'light'});return night}
 function isNavigating(){
  const hud=node('hgProNavigation');
  return active&&!!document.body?.classList?.contains?.('hg-navigation-active')&&hud?.hidden===false;
 }
 function leaveMap(){stopNavigation()}
 // Fresh app launches always begin in regular map mode. The HUD is mounted
 // in HTML but cannot be shown until startNavigation explicitly opens it.
 show('hgProNavigation',false);
 document.body?.classList?.remove('hg-navigation-active');
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopNavigation()});
 window.addEventListener('pagehide',stopNavigation);
 window.HealthGoMapPro={setRoute,clearRoute,startNavigation,stopNavigation,isNavigating,toggleVoice,toggleFollow,resumeFollow,
  toggleNavigationTheme,leaveMap,routeRemaining,instruction,maneuverInfo,navigationProgress,nearestRouteDistance};
})();
