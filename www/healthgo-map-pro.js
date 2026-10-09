/* HealthGo Map Pro: optional free building extrusions and opt-in GPS guidance.
 * No paid API key; no photo-realistic houses or live traffic claims.
 * Existing Leaflet map remains the fallback when WebGL is unavailable.
 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const getLeaflet=()=>typeof healthGoMap==='undefined'?null:healthGoMap;
 const osmTiles='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 const mapLibreScript='https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
 const mapLibreStyle='https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css';
 const buildingSource='hg-real-buildings';
 const routeSource='hg-pro-route';
 const drivingLine='hg-pro-route-line';
 let gl=null,threeD=false,libLoading=null,lastRoute=null,follow=true,voice=false;
 let auto3DMap=null,auto3DArmed=true,auto3DLoading=false;
 let watchId=null,activeStep=0,currentPosition=null,lastSpeech='',routeEpoch=0,loadEpoch=0;
 let leafletArrow=null,glArrow=null,glArrowElement=null,buildingAbort=null,preferNav3D=true;
 let activeMapLibre=null;
 let lastCameraTick=0, routeTailMeters=[],navCompletion=false,nav3DAttempted=false;
 const isFinitePoint=p=>p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)&&Math.abs(+p.lat)<=90&&Math.abs(+p.lon)<=180;
 const emptyFC=()=>({type:'FeatureCollection',features:[]});
 const msg=s=>{const node=$('hgProNotice');if(node)node.textContent=s;};
 const navText=(id,s)=>{const node=$(id);if(node)node.textContent=s;};
 const formatMeters=m=>m>=1000?(m/1000).toFixed(1).replace('.',',')+' km':Math.max(0,Math.round(m))+' m';
 const rad=x=>x*Math.PI/180;
 const greatCircle=(a,b)=>{const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 12742000*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));};
 const show=(id,value)=>{const n=$(id);if(n)n.hidden=!value;};
 const announce=s=>{msg(s);if(typeof mapStatus==='function')mapStatus(s);};
 function loadLib(){
  if(libLoading)return libLoading;
  // MapLibre 6 is ES-module only. Import lazily so mobile start stays fast.
  if(!document.querySelector('link[data-hg-maplibre]')){
   const link=document.createElement('link');link.rel='stylesheet';link.href=mapLibreStyle;
   link.dataset.hgMaplibre='1';document.head.appendChild(link);
  }
  libLoading=import(mapLibreScript).then(lib=>{
   if(typeof lib.Map!=='function')throw Error('MAPLIBRE_UNAVAILABLE');
   return lib;
  }).catch(e=>{libLoading=null;throw e});
  return libLoading;
 }
 function osmStyle(){
  return {version:8,name:'HealthGo 3D',sources:{base:{type:'raster',tiles:[osmTiles],tileSize:256,
   attribution:'© OpenStreetMap contributors'}},layers:[{id:'base',source:'base',type:'raster'}]};
 }
 function parseHeight(tags){
  const explicit=Number.parseFloat(String(tags.height||'').replace(',','.'));
  const floors=Number.parseFloat(String(tags['building:levels']||'').replace(',','.'));
  if(Number.isFinite(explicit)&&explicit>=2&&explicit<=450)return {height:explicit,estimated:false};
  if(Number.isFinite(floors)&&floors>=1&&floors<=140)return {height:Math.min(450,floors*3.1),estimated:true};
  return {height:8.5,estimated:true};
 }
 function buildingsToFeatures(elements){
  if(!Array.isArray(elements))return emptyFC();
  const features=[];
  for(const item of elements.slice(0,85)){
   if(item.type!=='way'||!Array.isArray(item.geometry)||item.geometry.length<4)continue;
   const coords=item.geometry.map(p=>[Number(p.lon),Number(p.lat)]);
   if(coords.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))continue;
   const first=coords[0],last=coords[coords.length-1];
   if(first[0]!==last[0]||first[1]!==last[1])coords.push([...first]);
   const h=parseHeight(item.tags||{});
   features.push({type:'Feature',properties:{height:h.height,estimated:h.estimated},
    geometry:{type:'Polygon',coordinates:[coords]}});
  }
  return {type:'FeatureCollection',features};
 }
 function addBuildings(map,features){
  if(map.getSource(buildingSource))map.getSource(buildingSource).setData(features);
  else {
   map.addSource(buildingSource,{type:'geojson',data:features});
   map.addLayer({id:'hg-buildings-3d',type:'fill-extrusion',source:buildingSource,
    minzoom:14,paint:{'fill-extrusion-color':['case',['get','estimated'],'#90b7dc','#547fb3'],
     'fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':.86}});
  }
 }
 async function refreshBuildings(){
  if(!threeD||!gl)return false;
  const center=gl.getCenter();
  if(gl.getZoom()<14.5){msg('Przybliż mapę do ulic (zoom 15), aby pokazać domy 3D.');return false}
  const lat=Number(center.lat),lon=Number(center.lng);
  const dx=.0025,dy=.002;
  // One small bounded region per explicit request: avoid automatic tile-scale
  // Overpass requests or unrestricted public API scraping.
  const box=[lat-dy,lon-dx,lat+dy,lon+dx].map(v=>v.toFixed(6)).join(',');
  const query='[out:json][timeout:14];way["building"]('+box+');out geom 90;';
  const epoch=++loadEpoch;
  msg('Pobieram obrysy prawdziwych budynków OpenStreetMap…');
  if(buildingAbort)buildingAbort.abort();
  const controller=new AbortController();buildingAbort=controller;
  const timer=setTimeout(()=>controller.abort(),16500);
  try {
   const response=await fetch('https://overpass-api.de/api/interpreter',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body:'data='+encodeURIComponent(query),signal:controller.signal
   });
   if(!response.ok)throw Error('OSM_HTTP_'+response.status);
   const data=await response.json();
   if(epoch!==loadEpoch||!threeD||!gl)return false;
   const featureCollection=buildingsToFeatures(data.elements);
   addBuildings(gl,featureCollection);
   const exact=featureCollection.features.filter(x=>!x.properties.estimated).length;
   msg('Budynki 3D: '+featureCollection.features.length+' obrysów OSM · '+exact+' z podaną wysokością. Inne wysokości są szacowane.');
   return true;
  }catch(e){
   if(epoch===loadEpoch)msg('Nie udało się pobrać budynków. Wróć do 2D albo spróbuj odświeżyć później.');
   return false;
  }finally{clearTimeout(timer);if(buildingAbort===controller)buildingAbort=null;}
 }
 function drawRoute(){
  if(!gl||!threeD||!gl.isStyleLoaded?.()||!lastRoute)return;
  const coords=lastRoute.geometry;
  const feature={type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}};
  if(!gl.getSource(routeSource))gl.addSource(routeSource,{type:'geojson',data:feature});
  else gl.getSource(routeSource).setData(feature);
  if(!gl.getLayer(drivingLine))gl.addLayer({id:drivingLine,type:'line',source:routeSource,
   layout:{'line-join':'round','line-cap':'round'},
   paint:{'line-color':'#216dec','line-width':7,'line-opacity':.98}});
 }
 function enableAuto3D(){
  const map=getLeaflet();
  if(!map||typeof map.on!=='function')return false;
  if(auto3DMap===map)return true;
  auto3DMap=map;auto3DArmed=true;
  map.on('zoomend',()=>{
   if(threeD||auto3DLoading||watchId!==null)return;
   const z=Number(map.getZoom());
   if(z<15){auto3DArmed=true;return}
   // Only a deliberate close street-level zoom activates the heavier 3D view.
   if(z<17||!auto3DArmed)return;
   auto3DArmed=false;auto3DLoading=true;
   toggle3D().finally(()=>{auto3DLoading=false});
  });
  return true;
 }
 async function toggle3D(){
  if(threeD){stop3D();return false}
  auto3DArmed=false; // returning to 2D must not cause a repeated toggle loop
  const leaflet=getLeaflet(),host=$('hg3DMap');
  if(!leaflet||!host){msg('Najpierw otwórz mapę.');return false}
  if(leaflet.getZoom()<14){leaflet.setZoom(16);msg('Przybliżam mapę, żeby pokazać budynki 3D.')}
  const button=$('hg3DButton');
  if(button)button.disabled=true;
  try{
   const lib=await loadLib();activeMapLibre=lib;
   if(lib.supported&&!lib.supported())throw Error('WEBGL_NOT_SUPPORTED');
   const center=leaflet.getCenter();
   host.hidden=false;
   gl=new lib.Map({container:host,style:osmStyle(),center:[center.lng,center.lat],
    zoom:Math.max(15.2,leaflet.getZoom()),pitch:58,bearing:-18,
    canvasContextAttributes:{antialias:false},fadeDuration:0,maxTileCacheSize:35});
   threeD=true;document.getElementById('mapWorkspace')?.classList.add('map-pro-3d');
   gl.on('load',()=>{drawRoute();refreshBuildings();if(watchId!==null&&currentPosition){positionMarker(currentPosition,0);setNavigationAppearance(true);}});
   gl.on('zoomend',()=>{if(threeD&&gl&&gl.getZoom()<14.8)stop3D();});
   gl.on('error',e=>{if(e?.error)console.warn('MapLibre 3D:',e.error.message||e.error)});
   if(button)button.textContent='▱ Wróć do mapy 2D';
   msg('Widok 3D włączony. Budynki to rzeczywiste obrysy OSM, nie zdjęcia domów.');
   return true;
  }catch(e){
   stop3D();msg('To urządzenie nie uruchomiło 3D. Pozostaje działająca mapa 2D.');
   return false;
  }finally{if(button)button.disabled=false}
 }
 function visibleCenter(){
  if(gl&&threeD){const c=gl.getCenter();return {lat:c.lat,lon:c.lng};}
  const m=getLeaflet(),c=m?.getCenter?.();return c?{lat:c.lat,lon:c.lng}:null;
 }
 function center3D(){
  if(!threeD||!gl)return false;
  if(!navigator.geolocation)return false;
  navigator.geolocation.getCurrentPosition(pos=>{
   const lat=Number(pos.coords.latitude),lon=Number(pos.coords.longitude);
   if(isFinitePoint({lat,lon})){gl.flyTo({center:[lon,lat],zoom:17,duration:900});msg('Pokazuję Twoją lokalizację w 3D.');}
  },()=>msg('Lokalizacja jest niedostępna lub odmówiono zgody.'),{enableHighAccuracy:true,timeout:14000,maximumAge:15000});
  return true;
 }
 function stop3D(){
  loadEpoch++;
  if(buildingAbort){buildingAbort.abort();buildingAbort=null;}
  removeGlArrow();
  if(gl){
   if(getLeaflet()&&threeD){try{const c=gl.getCenter();getLeaflet().setView([c.lat,c.lng],gl.getZoom())}catch(_){}}
   try{gl.remove()}catch(_){}
  }
  gl=null;threeD=false;
  show('hg3DMap',false);
  $('mapWorkspace')?.classList.remove('map-pro-3d');
  const button=$('hg3DButton');if(button)button.textContent='▤ Pokaż budynki 3D';
  getLeaflet()?.invalidateSize?.({pan:false});
 }
 function nextInstruction(step){
  const man=step?.maneuver||{},road=String(step?.name||'').trim();
  const type=String(man.type||'').toLowerCase(),modifier=String(man.modifier||'');
  if(type==='arrive')return 'Jesteś przy celu';
  if(type==='depart')return 'Rozpocznij prowadzenie';
  if(type==='roundabout'||type==='rotary')return 'Wjedź na rondo';
  const part=modifier==='left'?'Skręć w lewo':modifier==='right'?'Skręć w prawo':
   modifier==='slight left'?'Lekko w lewo':modifier==='slight right'?'Lekko w prawo':
   modifier==='sharp left'?'Ostro w lewo':modifier==='sharp right'?'Ostro w prawo':
   modifier==='uturn'?'Zawróć':'Jedź prosto';
  return part+(road?' w '+road:'');
 }
 function clearRoute(){
  stopNavigation();lastRoute=null;routeTailMeters=[];activeStep=0;show('hgNavStartButton',false);
  if(gl?.getSource?.(routeSource))gl.getSource(routeSource).setData(emptyFC());
 }
 function maneuverIcon(step){
  const m=step?.maneuver||{};
  if(m.type==='arrive')return '◆';
  if(m.type==='roundabout'||m.type==='rotary')return '⟳';
  if(m.modifier==='uturn')return '↶';
  if(m.modifier?.includes('left'))return '↰';
  if(m.modifier?.includes('right'))return '↱';
  return '↑';
 }
 function setRoute(route,destination){
  const coordinates=route?.geometry?.coordinates;
  if(!Array.isArray(coordinates)||coordinates.length<2)return false;
  const steps=(route?.legs||[]).flatMap(leg=>Array.isArray(leg.steps)?leg.steps:[]);
  lastRoute={
   geometry:coordinates,steps,meters:Number(route.distance)||0,
   minutes:Number(route.duration)||0,destination:String(destination||'Cel trasy').slice(0,130)
  };
  activeStep=0;buildRouteLengths(coordinates);drawRoute();
  navText('hgProNavDestination',lastRoute.destination);
  show('hgNavStartButton',steps.length>0);
  navText('hgProNavDistance','Pozostało około '+formatMeters(lastRoute.meters));
  return true;
 }
 function speak(phrase){
  if(!voice||!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window))return;
  if(phrase===lastSpeech)return;lastSpeech=phrase;
  try{window.speechSynthesis.cancel();const u=new window.SpeechSynthesisUtterance(phrase);
   u.lang='pl-PL';u.rate=.96;window.speechSynthesis.speak(u)}catch(_){}
 }
 function routeRemaining(point){
  if(!lastRoute?.geometry?.length)return 0;
  const coords=lastRoute.geometry;let nearest=0,best=Infinity;
  const stride=Math.max(1,Math.floor(coords.length/600));
  for(let i=0;i<coords.length;i+=stride){
   const c=coords[i],a={lat:c[1],lon:c[0]},d=greatCircle(point,a);
   if(d<best){best=d;nearest=i;}
  }
  for(let i=Math.max(0,nearest-stride);i<=Math.min(coords.length-1,nearest+stride);i++){
   const c=coords[i],d=greatCircle(point,{lat:c[1],lon:c[0]});
   if(d<best){best=d;nearest=i;}
  }
  return Math.max(0,routeTailMeters[nearest]||0);
 }
 function buildRouteLengths(coords){
  routeTailMeters=new Array(coords.length).fill(0);
  for(let i=coords.length-2;i>=0;i--){
   const a={lat:coords[i][1],lon:coords[i][0]},b={lat:coords[i+1][1],lon:coords[i+1][0]};
   routeTailMeters[i]=routeTailMeters[i+1]+greatCircle(a,b);
  }
 }
 function setNavigationAppearance(enabled){
  document.body?.classList?.toggle('hg-nav-live',enabled);
  const map=getLeaflet();
  if(map)map.invalidateSize?.({pan:false});
  if(!threeD||!gl||!gl.isStyleLoaded?.())return;
  try{
   gl.setPaintProperty('base','raster-brightness-min',enabled?.07:0);
   gl.setPaintProperty('base','raster-brightness-max',enabled?.48:1);
   gl.setPaintProperty('base','raster-saturation',enabled?-.48:0);
   gl.setPaintProperty('base','raster-contrast',enabled?.18:0);
   if(gl.getLayer('hg-buildings-3d')){
    gl.setPaintProperty('hg-buildings-3d','fill-extrusion-color',
     enabled?'#364967':['case',['get','estimated'],'#90b7dc','#547fb3']);
   }
  }catch(_){}
 }
 function removeGlArrow(){
  if(glArrow){try{glArrow.remove()}catch(_){}glArrow=null;glArrowElement=null}
 }
 function removeNavigationMarkers(){
  removeGlArrow();
  if(leafletArrow){try{getLeaflet()?.removeLayer?.(leafletArrow)}catch(_){}leafletArrow=null}
 }
 function positionMarker(point,heading){
  const angle=Number.isFinite(heading)?heading:0;
  if(threeD&&gl){
   if(leafletArrow){try{getLeaflet()?.removeLayer?.(leafletArrow)}catch(_){}leafletArrow=null}
   if(!glArrow&&activeMapLibre?.Marker&&document.createElement){
    const node=document.createElement('div');
    node.className='hg-pro-position-arrow';
    node.innerHTML='<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><path d="M24 3 42 42 24 33 6 42Z" fill="#ffffff" stroke="#1f6be6" stroke-width="4" stroke-linejoin="round"/></svg>';
    glArrowElement=node;
    glArrow=new activeMapLibre.Marker({element:node,rotationAlignment:'map',pitchAlignment:'viewport'})
      .setLngLat([point.lon,point.lat]).addTo(gl);
   }
   if(glArrow){glArrow.setLngLat([point.lon,point.lat]);glArrow.setRotation?.(angle)}
   return;
  }
  removeGlArrow();
  if(typeof L==='undefined'||!L.marker||!L.divIcon||!getLeaflet())return;
  if(!leafletArrow){
   const icon=L.divIcon({className:'hg-pro-leaflet-arrow',
    html:'<div class="hg-pro-needle">▲</div>',iconSize:[42,42],iconAnchor:[21,21]});
   leafletArrow=L.marker([point.lat,point.lon],{icon,interactive:false,zIndexOffset:2000}).addTo(getLeaflet());
  }else leafletArrow.setLatLng([point.lat,point.lon]);
  const needle=leafletArrow.getElement?.()?.querySelector?.('.hg-pro-needle');
  if(needle)needle.style.transform='rotate('+angle+'deg)';
 }
 function updateJourneyStatus(point,speed){
  const remaining=routeRemaining(point);
  const full=Math.max(lastRoute?.meters||0,routeTailMeters[0]||0,1);
  const seconds=Math.max(0,Math.round((lastRoute?.minutes||0)*Math.min(1,remaining/full)));
  const eta=new Date(Date.now()+seconds*1000);
  navText('hgProNavEta','Przyjazd '+eta.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}));
  navText('hgProNavDistance',formatMeters(remaining)+' · około '+Math.max(1,Math.ceil(seconds/60))+' min');
  navText('hgProNavSpeed',Number.isFinite(speed)&&speed>=0&&speed<100?' '+Math.round(speed*3.6):'—');
 }
 function updatePosition(pos){
  if(watchId===null||!lastRoute)return;
  const c=pos.coords||{},point={lat:Number(c.latitude),lon:Number(c.longitude)};
  if(!isFinitePoint(point)||Number(c.accuracy)>120)return;
  currentPosition=point;
  window.HealthGoMapV2?.rememberPosition?.({lat:point.lat,lon:point.lon,accuracy:c.accuracy});
  const next=lastRoute.steps[activeStep]||lastRoute.steps[lastRoute.steps.length-1];
  const targetLoc=next?.maneuver?.location;
  const target=Array.isArray(targetLoc)?{lat:targetLoc[1],lon:targetLoc[0]}:null;
  let meters=target?greatCircle(point,target):null;
  if(target&&meters<=28&&activeStep<lastRoute.steps.length-1){
   activeStep++;meters=null;
  }
  const selected=lastRoute.steps[activeStep];
  const instruction=nextInstruction(selected);
  navText('hgProNavDirection',instruction);
  navText('hgProNavIcon',maneuverIcon(selected));
  navText('hgProNavNext',meters===null?'Kontynuuj do następnego manewru':formatMeters(meters)+' do manewru');
  updateJourneyStatus(point,Number(c.speed));
  positionMarker(point,Number(c.heading));
  const now=Date.now();
  if(follow&&now-lastCameraTick>=950){
   lastCameraTick=now;
   if(threeD&&gl){
    gl.easeTo({center:[point.lon,point.lat],
     bearing:Number.isFinite(c.heading)&&c.heading>=0?c.heading:gl.getBearing(),
     zoom:Math.max(16.5,gl.getZoom()),pitch:58,duration:750});
   }else{
    getLeaflet()?.setView?.([point.lat,point.lon],Math.max(16,getLeaflet()?.getZoom?.()||16),{animate:true});
   }
  }
  speak(instruction);
  const end=lastRoute.geometry[lastRoute.geometry.length-1],goal={lat:end[1],lon:end[0]};
  if(!navCompletion&&greatCircle(point,goal)<24){
   navCompletion=true;
   navText('hgProNavDirection','Jesteś w pobliżu celu');
   navText('hgProNavNext','Zatrzymaj nawigację po dotarciu na miejsce');
   speak('Jesteś w pobliżu celu');
  }
  // The first GPS fix unlocks optional perspective mode. Never block
  // navigation on heavy 3D loading or restart tracking for the renderer.
  if(preferNav3D&&!threeD&&!nav3DAttempted&&getLeaflet()?.getCenter&&document.getElementById('hg3DMap')){
   nav3DAttempted=true;
   toggle3D().then(ok=>{if(ok&&watchId!==null&&currentPosition){
    setNavigationAppearance(true);positionMarker(currentPosition,Number(c.heading));
   }}).catch(()=>{});
  }
 }
 function startNavigation(){
  if(watchId!==null)return true;
  if(!lastRoute?.steps?.length){msg('Najpierw wyznacz trasę samochodową.');return false}
  if(!navigator.geolocation){msg('GPS nie jest dostępny na tym urządzeniu.');return false}
  const id=++routeEpoch;
  activeStep=0;currentPosition=null;lastSpeech='';follow=true;navCompletion=false;lastCameraTick=0;
  nav3DAttempted=false;
  show('hgProNavigation',true);
  $('mapWorkspace')?.classList.add('map-pro-navigating');
  document.getElementById('map')?.style?.removeProperty?.('height');
  window.HealthGoMapV2?.close?.();
  navText('hgProNavDirection','Ustalam pozycję…');
  navText('hgProNavIcon','↑');
  navText('hgProNavNext','Czekam na sygnał GPS');
  navText('hgProNavDestination',lastRoute.destination);
  navText('hgProNavDistance','Trasa: '+formatMeters(lastRoute.meters)+' · około '+Math.max(1,Math.round(lastRoute.minutes/60))+' min');
  navText('hgProNavEta','Wyznaczam przyjazd');
  navText('hgProNavSpeed','—');
  setNavigationAppearance(true);
  try{
   watchId=navigator.geolocation.watchPosition(pos=>{if(id===routeEpoch)updatePosition(pos)},
    err=>{
     msg(err?.code===1?'Telefon nie zezwolił na nawigację GPS. Sprawdź uprawnienia HealthGo.':'Nie ma aktualnego sygnału GPS. Spróbuj na otwartej przestrzeni.');
     if(err?.code===1)stopNavigation();
    },{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
  }catch(_){stopNavigation();msg('Nie udało się uruchomić GPS.');return false}
  msg('Prowadzenie uruchomione. Mapa nocna i 3D nie wymagają płatnego klucza.');
  return true;
 }
 function stopNavigation(){
  routeEpoch++;nav3DAttempted=false;
  if(watchId!==null&&navigator.geolocation?.clearWatch)navigator.geolocation.clearWatch(watchId);
  watchId=null;currentPosition=null;navCompletion=false;
  show('hgProNavigation',false);
  $('mapWorkspace')?.classList.remove('map-pro-navigating');
  removeNavigationMarkers();setNavigationAppearance(false);
  window.HealthGoMapV2?.resizeViewport?.();
  if('speechSynthesis' in window)try{window.speechSynthesis.cancel()}catch(_){}
  lastSpeech='';
 }
 function toggleNavigation3D(){
  preferNav3D=!preferNav3D;
  const b=$('hgProNav3D');
  if(b){b.textContent=preferNav3D?'3D':'2D';b.setAttribute('aria-pressed',String(preferNav3D))}
  if(!preferNav3D&&threeD)stop3D();
  if(preferNav3D&&watchId!==null&&!threeD){
   nav3DAttempted=false;
   if(currentPosition){
    positionMarker(currentPosition,0);
    if(getLeaflet()?.getCenter)toggle3D().then(ok=>{if(ok){setNavigationAppearance(true);positionMarker(currentPosition,0)}}).catch(()=>{});
   }
  }
  return preferNav3D;
 }
 function toggleVoice(){
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){msg('Głosowa nawigacja nie jest obsługiwana w tej przeglądarce.');return false}
  voice=!voice;
  const button=$('hgProVoice');if(button){button.textContent=voice?'Głos: włączony':'Głos: wyłączony';button.setAttribute('aria-pressed',String(voice))}
  if(voice)speak('Wskazówki głosowe zostały włączone');
  return voice;
 }
 function toggleFollow(){
  follow=!follow;
  const b=$('hgProFollow');if(b){b.textContent=follow?'Śledź położenie':'Mapa swobodna';b.setAttribute('aria-pressed',String(follow))}
  return follow;
 }
 function leaveMap(){stopNavigation();if(threeD)stop3D()}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)leaveMap()});
 window.addEventListener('pagehide',leaveMap);
 window.HealthGoMapPro={toggle3D,stop3D,enableAuto3D,center3D,visibleCenter,refreshBuildings,setRoute,clearRoute,startNavigation,
  stopNavigation,toggleVoice,toggleFollow,toggleNavigation3D,leaveMap,parseHeight,buildingsToFeatures,routeRemaining};
})();
