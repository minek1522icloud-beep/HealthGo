/* HealthGo Map 4.0: light 2D turn-by-turn guidance, no 3D/WebGL dependencies. */
(function(){
 'use strict';
 const node=id=>document.getElementById(id);
 const map=()=>typeof healthGoMap==='undefined'?null:healthGoMap;
 let route=null,remaining=[],watchId=null,active=false,stepIndex=0,arrow=null;
 let voice=false,follow=true,night=false,lastSpeech='',lastCamera=0,position=null;
 const text=(id,value)=>{const n=node(id);if(n)n.textContent=String(value)};
 const show=(id,visible)=>{const n=node(id);if(n)n.hidden=!visible};
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
 function routeRemaining(point){
  if(!route||!remaining.length)return 0;
  const pts=route.geometry,step=Math.max(1,Math.ceil(pts.length/500));
  let nearest=0,best=Infinity;
  for(let i=0;i<pts.length;i+=step){
   const d=meters(point,{lat:pts[i][1],lon:pts[i][0]});
   if(d<best){best=d;nearest=i}
  }
  for(let i=Math.max(0,nearest-step);i<Math.min(pts.length,nearest+step+1);i++){
   const d=meters(point,{lat:pts[i][1],lon:pts[i][0]});
   if(d<best){best=d;nearest=i}
  }
  return remaining[nearest]||0;
 }
 function instruction(step){
  const m=step?.maneuver||{},name=String(step?.name||'').slice(0,80);
  if(m.type==='arrive')return ['Cel jest blisko','◆'];
  if(m.type==='depart')return ['Rozpocznij prowadzenie','↑'];
  if(m.type==='roundabout'||m.type==='rotary')return ['Wjedź na rondo','⟳'];
  const direction=String(m.modifier||'');
  const label=direction.includes('left')?'Skręć w lewo':direction.includes('right')?'Skręć w prawo':
   direction==='uturn'?'Zawróć':'Jedź prosto';
  const symbol=direction.includes('left')?'↰':direction.includes('right')?'↱':direction==='uturn'?'↶':'↑';
  return [label+(name?' — '+name:''),symbol];
 }
 function setRoute(item,destination){
  const coords=item?.geometry?.coordinates;
  if(!Array.isArray(coords)||coords.length<2||coords.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])))return false;
  stopNavigation();
  const steps=(item.legs||[]).flatMap(l=>Array.isArray(l.steps)?l.steps:[]);
  route={geometry:coords,steps,meters:Number(item.distance)||0,seconds:Number(item.duration)||0,destination:String(destination||'Cel podróży').slice(0,100)};
  suffix(coords);stepIndex=0;
  show('hgNavStartButton',steps.length>0);
  text('hgProNavDestination',route.destination);
  return true;
 }
 function clearRoute(){stopNavigation();route=null;remaining=[];show('hgNavStartButton',false)}
 function removeArrow(){if(arrow){try{map()?.removeLayer?.(arrow)}catch(_){}arrow=null}}
 function placeArrow(point,heading){
  if(typeof L==='undefined'||!L.divIcon||!L.marker||!map())return;
  if(!arrow){
   arrow=L.marker([point.lat,point.lon],{
    icon:L.divIcon({className:'hg-nav-user-icon',html:'<span class="hg-nav-arrow">▲</span>',iconSize:[48,48],iconAnchor:[24,24]}),
    interactive:false,zIndexOffset:3000
   }).addTo(map());
  }else arrow.setLatLng([point.lat,point.lon]);
  const tip=arrow.getElement?.()?.querySelector?.('.hg-nav-arrow');
  if(tip&&Number.isFinite(heading)&&heading>=0)tip.style.transform='rotate('+heading+'deg)';
 }
 function speak(message){
  if(!voice||!window.speechSynthesis||!window.SpeechSynthesisUtterance||message===lastSpeech)return;
  lastSpeech=message;
  try{window.speechSynthesis.cancel();const u=new window.SpeechSynthesisUtterance(message);u.lang='pl-PL';u.rate=.95;window.speechSynthesis.speak(u)}catch(_){}
 }
 function positionUpdate(pos){
  if(!active||!route)return;
  const c=pos.coords||{},point={lat:Number(c.latitude),lon:Number(c.longitude)};
  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Number(c.accuracy)>150)return;
  position=point;
  window.HealthGoMapV2?.rememberPosition?.({lat:point.lat,lon:point.lon,accuracy:c.accuracy});
  const next=route.steps[stepIndex],loc=next?.maneuver?.location;
  const target=Array.isArray(loc)?{lat:loc[1],lon:loc[0]}:null;
  let distanceTo=target?meters(point,target):null;
  if(distanceTo!==null&&distanceTo<30&&stepIndex<route.steps.length-1){
   stepIndex++;distanceTo=null;
  }
  const chosen=instruction(route.steps[stepIndex]);
  text('hgProNavDirection',chosen[0]);text('hgProNavIcon',chosen[1]);
  text('hgProNavNext',distanceTo===null?'Kontynuuj jazdę':nice(distanceTo)+' do manewru');
  const left=routeRemaining(point),full=Math.max(route.meters,remaining[0]||0,1);
  const seconds=Math.round(route.seconds*Math.min(1,left/full));
  const eta=new Date(Date.now()+seconds*1000);
  text('hgProNavEta','Przyjazd '+eta.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}));
  text('hgProNavDistance',nice(left)+' · około '+Math.max(1,Math.ceil(seconds/60))+' min');
  text('hgProNavSpeed',c.speed==null||!Number.isFinite(c.speed)?'—':String(Math.max(0,Math.round(c.speed*3.6))));
  placeArrow(point,Number(c.heading));
  if(follow&&Date.now()-lastCamera>=1100){
   lastCamera=Date.now();map()?.setView?.([point.lat,point.lon],Math.max(16,map()?.getZoom?.()||16),{animate:true});
  }
  speak(chosen[0]);
  const finish=route.geometry[route.geometry.length-1];
  if(meters(point,{lat:finish[1],lon:finish[0]})<25){
   text('hgProNavDirection','Jesteś w pobliżu celu');text('hgProNavNext','Sprawdź dokładne położenie');
  }
 }
 function loadOptions(){
  const pref=window.HealthGoMap4?.getSettings?.()||{};
  voice=!!pref.voice;follow=pref.follow!==false;
  const b=node('hgProVoice');if(b){b.textContent=voice?'Głos: włączony':'Głos: wyłączony';b.setAttribute('aria-pressed',String(voice))}
  const f=node('hgProFollow');if(f){f.textContent=follow?'Śledź położenie':'Mapa swobodna';f.setAttribute('aria-pressed',String(follow))}
  setNight(pref.theme==='dark'||(pref.theme!=='light'&&new Date().getHours()>=19));
 }
 function setNight(value){
  night=!!value;
  node('mapWorkspace')?.classList?.toggle('hg-nav-dark',night);
 }
 function startNavigation(){
  if(active)return true;
  if(!route?.steps?.length){text('mapV2RouteOutput','Najpierw wyznacz trasę samochodową.');return false}
  if(!navigator.geolocation){text('mapV2RouteOutput','GPS niedostępny. Możesz użyć podglądu trasy z wpisanego adresu.');return false}
  active=true;stepIndex=0;lastSpeech='';lastCamera=0;
  node('mapWorkspace')?.classList?.add('map-pro-navigating');
  show('hgProNavigation',true);
  loadOptions();
  text('hgProNavDestination',route.destination);
  text('hgProNavDirection','Czekam na GPS…');text('hgProNavIcon','↑');
  text('hgProNavNext','Pozycja zostanie użyta tylko podczas nawigacji.');
  text('hgProNavDistance',nice(route.meters));
  window.HealthGoMapV2?.close?.();
  try{
   watchId=navigator.geolocation.watchPosition(positionUpdate,err=>{
    const message=err?.code===1?'iPhone odmówił dostępu do GPS. Sprawdź uprawnienia lub wpisz punkt startowy.':'Utracono GPS. Spróbuj na otwartej przestrzeni.';
    text('hgProNavNext',message);
    if(err?.code===1){stopNavigation();text('mapV2RouteOutput',message)}
   },{enableHighAccuracy:true,maximumAge:5000,timeout:17000});
  }catch(_){stopNavigation();return false}
  return true;
 }
 function stopNavigation(){
  active=false;
  if(watchId!==null)try{navigator.geolocation?.clearWatch?.(watchId)}catch(_){}
  watchId=null;position=null;removeArrow();
  show('hgProNavigation',false);
  node('mapWorkspace')?.classList?.remove('map-pro-navigating');
  node('mapWorkspace')?.classList?.remove('hg-nav-dark');
  try{window.speechSynthesis?.cancel?.()}catch(_){}
  window.HealthGoMapV2?.resizeViewport?.();
 }
 function toggleVoice(){
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){
   text('hgProNavNext','Ten telefon nie udostępnia głosowego odczytywania wskazówek.');return false
  }
  voice=!voice;lastSpeech='';
  const b=node('hgProVoice');if(b){b.textContent=voice?'Głos: włączony':'Głos: wyłączony';b.setAttribute('aria-pressed',String(voice))}
  window.HealthGoMap4?.saveSettings?.({voice});
  return voice;
 }
 function toggleFollow(){
  follow=!follow;
  const b=node('hgProFollow');if(b){b.textContent=follow?'Śledź położenie':'Mapa swobodna';b.setAttribute('aria-pressed',String(follow))}
  window.HealthGoMap4?.saveSettings?.({follow});
  return follow;
 }
 function toggleNavigationTheme(){setNight(!night);window.HealthGoMap4?.saveSettings?.({theme:night?'dark':'light'});return night}
 function leaveMap(){stopNavigation()}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopNavigation()});
 window.addEventListener('pagehide',stopNavigation);
 window.HealthGoMapPro={setRoute,clearRoute,startNavigation,stopNavigation,toggleVoice,toggleFollow,
  toggleNavigationTheme,leaveMap,routeRemaining,instruction};
})();
