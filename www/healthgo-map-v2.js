/* HealthGo Mapa 2.0: opt-in GPS, real map data, honest provider availability. */
(function(){
 'use strict';
 const el=id=>document.getElementById(id);
 let mounted=false,activePanel='',tileLayer=null,tileKind='street',destination=null,destinationMarker=null,routeLayer=null;
 let tracker=null,traceLayer=null,trackingStarted=0,lastFix=null,trackedMeters=0,routeMode='car';
 let measuring=false,measurePoints=[],measureLine=null,measureDots=[],mapSpacious=false;
 let mapEntryLocated=false,mapWelcomeShown=false,locationWelcomeObserver=null;
 let routeChoices=[],routeChosen=0,routeStartWasManual=false;
 let routeRequestTicket=0; // async responses from an obsolete destination are ignored
 let recentFix=null; // precise GPS fix stays in memory; never persisted
 let mapLocationCheckBusy=false;
 const satellite='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
 const routeUrl='https://router.project-osrm.org/route/v1/driving/';
 const getMap=()=>typeof healthGoMap!=='undefined'?healthGoMap:null;
 const say=message=>{if(typeof mapStatus==='function')mapStatus(message);};
 function currentUid(){return String(window.HealthGoServices?.state?.uid||'');}
 function key(suffix){const uid=currentUid();return uid?'healthgo.map2.'+suffix+'.'+uid:null;}
 function read(suffix){try{const k=key(suffix);return k?JSON.parse(localStorage.getItem(k)||'[]'):[]}catch(_){return[];}}
 function write(suffix,rows){const k=key(suffix);if(!k)return false;try{localStorage.setItem(k,JSON.stringify(rows));return true}catch(_){return false;}}
 function validPoint(p){return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;}
 function clean(s,n=100){return String(s||'').trim().slice(0,n);}
 function distance(a,b){const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
 function child(parent,tag,text,className){const item=document.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;parent.appendChild(item);return item;}
 function mount(){
  const shell=el('mapWorkspace');if(!shell)return;
  if(!mounted){mounted=true;
   const field=el('mapV2RouteTo');
   if(field)field.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();planRoute();}});
  }
  resizeViewport();
  if(getMap()){
   getMap().invalidateSize({pan:false});
   if(!mapEntryLocated){
    const recent=getRecentPosition();
    if(recent){mapEntryLocated=true;centerFromConsent(recent);}
    else if(['allowed','denied'].includes(localStorageGet('healthgo.location.welcome.v1')))centerIfSystemGranted();
   }
  }
  const fav=el('mapV2FavouriteCount');if(fav)fav.textContent=String(read('favorites').length);
 }
 function localStorageGet(name){try{return localStorage.getItem(name)}catch(_){return null}}
 function localStorageSet(name,value){try{localStorage.setItem(name,value)}catch(_){}}
 function noteSystemLocationGranted(){localStorageSet('healthgo.location.welcome.v1','allowed')}
 function noteSystemLocationDenied(){localStorageSet('healthgo.location.welcome.v1','denied')}
 function resizeViewport(){
  const panel=el('map'),nav=document.querySelector?.('.mobile-nav');
  if(!panel||!panel.classList?.contains?.('active')||!nav)return;
  if(window.innerWidth>900){panel.style.removeProperty('height');return}
  const top=panel.getBoundingClientRect?.().top,navTop=nav.getBoundingClientRect?.().top;
  if(!Number.isFinite(top)||!Number.isFinite(navTop)||navTop<=top+300)return;
  const space=Math.round(navTop-top-5);
  if(space>=380){
   panel.style.setProperty('height',space+'px','important');
   if(getMap())getMap().invalidateSize({pan:false});
  }
 }
 function centerFromConsent(point){
  if(!validPoint(point)||!getMap()||!el('map')?.classList?.contains?.('active'))return false;
  getMap().setView([Number(point.lat),Number(point.lon)],16,{animate:true});
  return true;
 }
 async function centerIfSystemGranted(){
  if(mapLocationCheckBusy||mapEntryLocated)return false;
  mapLocationCheckBusy=true;
  try{
   // App consent is not a substitute for browser/iOS permission.
   // In unsupported browsers, never provoke an automatic system prompt.
   if(!navigator.permissions?.query)return false;
   const status=await navigator.permissions.query({name:'geolocation'});
   if(status?.state!=='granted'){
    if(status?.state==='denied')localStorageSet('healthgo.location.welcome.v1','denied');
    return false;
   }
   if(!navigator.geolocation)return false;
   return await new Promise(resolve=>{
    navigator.geolocation.getCurrentPosition(pos=>{
     const point={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};
     if(rememberPosition(point)){
      noteSystemLocationGranted();
      const centered=centerFromConsent(point);
      if(centered)mapEntryLocated=true;
      resolve(centered);
     }else resolve(false);
    },err=>{
     if(err?.code===1)localStorageSet('healthgo.location.welcome.v1','denied');
     resolve(false);
    },{enableHighAccuracy:true,maximumAge:30000,timeout:14000});
   });
  }catch(_){return false}
  finally{mapLocationCheckBusy=false}
 }
 function welcomeShouldOpen(){
  if(mapWelcomeShown||localStorageGet('healthgo.location.welcome.v1')!==null)return false;
  const app=document.querySelector?.('.app'),signin=el('authScreen');
  if(!app||app.classList.contains('auth-hidden')||signin?.classList?.contains?.('show'))return false;
  return true;
 }
 function showLocationWelcome(){
  if(!welcomeShouldOpen())return false;
  const dialog=el('hgLocationWelcome');
  if(!dialog)return false;
  mapWelcomeShown=true;dialog.hidden=false;
  dialog.querySelector('button')?.focus?.({preventScroll:true});
  return true;
 }
 function chooseWelcomeLocation(allowed){
  const dialog=el('hgLocationWelcome');
  if(dialog)dialog.hidden=true;
  if(!allowed){localStorageSet('healthgo.location.welcome.v1','later');return}
  if(!navigator.geolocation){say('Lokalizacja nie jest obsługiwana na tym telefonie.');return}
  // This is a direct user-gesture callback; the browser owns the real OS prompt.
  navigator.geolocation.getCurrentPosition(position=>{
   const pos=position.coords;
   if(!Number.isFinite(pos?.latitude)||!Number.isFinite(pos?.longitude))return;
   localStorageSet('healthgo.location.welcome.v1','allowed');
   rememberPosition({lat:pos.latitude,lon:pos.longitude,accuracy:pos.accuracy});
   if(centerFromConsent({lat:pos.latitude,lon:pos.longitude}))mapEntryLocated=true;
   // Do not retain or send coordinates until the user actually opens the map.
  },err=>{
   localStorageSet('healthgo.location.welcome.v1',err?.code===1?'denied':'later');
   if(err?.code===1)say('iPhone odmawia dostępu do GPS. Sprawdź Ustawienia → Prywatność i ochrona → Usługi lokalizacji → HealthGo lub Witryny Safari.');
  },{enableHighAccuracy:false,maximumAge:60000,timeout:12000});
 }
 function askLocationAgain(){
  mapWelcomeShown=false;
  if(!navigator.geolocation){say('Lokalizacja niedostępna.');return}
  if(typeof useMyLocation==='function'){useMyLocation();}
 }
 function watchWelcome(){
  if(showLocationWelcome())return;
  const app=document.querySelector('.app');
  if(!app||localStorageGet('healthgo.location.welcome.v1')!==null||typeof MutationObserver==='undefined')return;
  if(locationWelcomeObserver)return;
  locationWelcomeObserver=new MutationObserver(()=>{
   if(showLocationWelcome()){locationWelcomeObserver?.disconnect();locationWelcomeObserver=null;}
  });
  locationWelcomeObserver.observe(app,{attributes:true,attributeFilter:['class']});
 }
 function toggle(name){
  if(measuring)stopMeasure();
  mount();
  const valid=['route','layers','favorites','activity','tools','weather','saved','settings'];
  if(name==='map'){close();return}
  if(!valid.includes(name)){close();return}
  if(activePanel===name){close();return}
  // Stay in the same map tab: route is a full-screen planner, not a new page.
  document.body?.classList?.toggle?.('hg-route-planner-open',name==='route');
  activePanel=name;
  document.querySelectorAll('.map-v2-panel').forEach(panel=>{panel.hidden=panel.dataset.mapPanel!==name;});
  document.querySelectorAll('.map-v2-tab,.map-v2-actions button[data-panel]').forEach(btn=>btn.classList.toggle('active',btn.dataset.panel===name));
  if(name==='favorites')drawFavorites();
  if(name==='activity')drawActivity();
  if(name==='weather')window.HealthGoMap4?.refreshWeather?.();
  if(name==='saved'){window.HealthGoMap4?.drawRoutes?.();drawRecentDestinations();}
  if(name==='settings')window.HealthGoMap4?.renderSettings?.();
  setTimeout(()=>getMap()?.invalidateSize({pan:false}),80);
 }
 function close(){
  activePanel='';
  document.body?.classList?.remove?.('hg-route-planner-open');
  document.querySelectorAll('.map-v2-panel').forEach(p=>p.hidden=true);
  document.querySelectorAll('.map-v2-tab,.map-v2-actions button[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel==='map'));
  setTimeout(()=>getMap()?.invalidateSize?.({pan:false}),65);
 }
 function swapRoute(){
  const from=el('mapV2RouteFrom'),to=el('mapV2RouteTo');
  if(!from||!to)return false;
  if(!clean(from.value)||!clean(to.value)){
   const result=el('mapV2RouteOutput');
   if(result)result.textContent='Aby zamienić trasę, wpisz oba adresy. Punkt GPS nie ma nazwy do zamiany.';
   return false;
  }
  const previousStart=from.value;from.value=to.value;to.value=previousStart;
  destination=null;window.HealthGoMapPro?.clearRoute?.();
  routeChoices=[];const choices=el('hg4RouteAlternatives');if(choices)choices.replaceChildren();
  const result=el('mapV2RouteOutput');
  if(result)result.textContent='Zamieniono adresy. Kliknij „Znajdź najlepszą trasę”, aby przeliczyć.';
  return true;
 }
 function useGPSStart(){
  const from=el('mapV2RouteFrom');if(!from)return false;
  from.value='';
  window.HealthGoMapPro?.clearRoute?.();
  routeChoices=[];const choices=el('hg4RouteAlternatives');if(choices)choices.replaceChildren();
  const result=el('mapV2RouteOutput');
  if(result)result.textContent='Punkt startowy: GPS. Telefon zapyta o lokalizację dopiero po wyznaczeniu trasy.';
  return true;
 }
 function chooseLayer(kind){
  if(!['street','satellite'].includes(kind))return;
  if(typeof L==='undefined'||!getMap()){say('Otwórz mapę, aby zmienić warstwę.');return}
  if(kind===tileKind)return;
  const map=getMap();
  const url=kind==='satellite'?satellite:(typeof isHostedMobileHealthGo==='function'&&isHostedMobileHealthGo()?'https://tile.openstreetmap.org/{z}/{x}/{y}.png':'/map-tiles/{z}/{x}/{y}.png');
  const attribution=kind==='satellite'?'Tiles © Esri — źródła: Esri, Maxar, Earthstar Geographics':'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const fresh=L.tileLayer(url,{maxZoom:kind==='satellite'?18:19,attribution});
  fresh.addTo(map);fresh.bringToBack();
  map.eachLayer(layer=>{
   if(layer!==fresh&&layer instanceof L.TileLayer)map.removeLayer(layer);
  });
  tileLayer=fresh;tileKind=kind;
  document.querySelectorAll('[data-map-layer]').forEach(btn=>{const selected=btn.dataset.mapLayer===kind;btn.classList.toggle('active',selected);btn.setAttribute('aria-pressed',String(selected));});
  say(kind==='satellite'?'Widok satelitarny — zdjęcia © Esri.':'Widok ulic i parków — OpenStreetMap.');
 }
 function savePlace(p){
  if(!validPoint(p)){say('Nie mogę zapisać tego miejsca bez współrzędnych.');return false}
  const name=clean(p.name||'Zapisane miejsce',100);
  if(!currentUid()){say('Zaloguj się, aby zapisywać miejsca osobno dla swojego konta.');return false}
  const record={name,lat:Number(p.lat),lon:Number(p.lon)};
  const all=read('favorites').filter(x=>validPoint(x));
  const existing=all.find(x=>Math.abs(x.lat-record.lat)<0.00001&&Math.abs(x.lon-record.lon)<0.00001);
  if(existing){say('To miejsce już jest w ulubionych.');return false}
  if(!write('favorites',[record,...all].slice(0,50))){say('Telefon nie pozwolił zapisać miejsca.');return false}
  say('Zapisano w ulubionych: '+name);if(activePanel==='favorites')drawFavorites();
  mount();return true;
 }
 function saveCenter(){const map=getMap();if(!map){say('Najpierw otwórz mapę.');return}
  const center=map.getCenter();
  savePlace({name:'Moje miejsce '+new Date().toLocaleDateString('pl-PL'),lat:center.lat,lon:center.lng});
 }
 function drawFavorites(){
  const root=el('mapV2Favorites');if(!root)return;root.replaceChildren();
  const rows=read('favorites').filter(validPoint);
  if(!currentUid()){child(root,'p','Zaloguj się, żeby zapisywać ulubione miejsca.','map-v2-muted');return}
  if(!rows.length){child(root,'p','Nie masz jeszcze ulubionych miejsc. Wybierz pinezkę lub zapisz środek mapy.','map-v2-muted');return}
  rows.forEach((p,i)=>{
   const item=child(root,'div',undefined,'map-v2-item'),copy=child(item,'span',p.name||'Miejsce');
   child(copy,'small',Number(p.lat).toFixed(4)+', '+Number(p.lon).toFixed(4));
   const controls=child(item,'div',undefined,'map-v2-buttons');
   const show=child(controls,'button','Pokaż');show.type='button';show.addEventListener('click',()=>{getMap()?.setView([p.lat,p.lon],16);close()});
   const route=child(controls,'button','Trasa');route.type='button';route.addEventListener('click',()=>selectDestination(p.name,p.lat,p.lon));
   const del=child(controls,'button','Usuń');del.type='button';del.addEventListener('click',()=>{const newer=read('favorites');newer.splice(i,1);write('favorites',newer);drawFavorites();mount()});
  });
 }
 function selectDestination(name,lat,lon){
  const p={name:clean(name||'Wybrane miejsce'),lat:Number(lat),lon:Number(lon)};
  if(!validPoint(p))return;
  destination=p;
  rememberDestination(p);
  drawRecentDestinations();
  window.HealthGoMapPro?.clearRoute();
  const field=el('mapV2RouteTo');if(field)field.value=p.name;
  const map=getMap();
  if(map&&typeof L!=='undefined'){
   if(destinationMarker)map.removeLayer(destinationMarker);
   destinationMarker=L.marker([p.lat,p.lon]).addTo(map).bindPopup('📍 '+(typeof healthGoEscape==='function'?healthGoEscape(p.name):p.name));
  }
  // Choosing a destination is an explicit request to navigate from phone GPS.
  const from=el('mapV2RouteFrom');if(from)from.value='';
  if(activePanel!=='route')toggle('route');
  say('Wybrano '+p.name+'. Ustalam aktualną pozycję i przygotowuję prowadzenie…');
  return planRoute({autoStart:true});
 }
 function navigateToAddress(query){
  const address=clean(query,180);
  if(!address){say('Wpisz adres lub miasto.');return false}
  destination=null;routeRequestTicket++;
  const field=el('mapV2RouteTo');if(field)field.value=address;
  const from=el('mapV2RouteFrom');if(from)from.value='';
  if(activePanel!=='route')toggle('route');
  say('Ustalam pozycję GPS i szukam drogi do '+address+'…');
  return planRoute({autoStart:true});
 }
 // Opt-in per-account recent destinations, never passive location tracking.
 function rememberedDestinations(){
  const rows=read('recent');
  return Array.isArray(rows)?rows.filter(x=>validPoint(x)&&clean(x.name)).slice(0,12):[];
 }
 function rememberDestination(point){
  if(!currentUid()||!validPoint(point))return false;
  const item={name:clean(point.name,100),lat:Number(point.lat),lon:Number(point.lon),at:new Date().toISOString()};
  const all=rememberedDestinations().filter(x=>Math.abs(Number(x.lat)-item.lat)>0.00001||Math.abs(Number(x.lon)-item.lon)>0.00001);
  return write('recent',[item,...all].slice(0,12));
 }
 function homePlace(){
  const data=read('home');
  return Array.isArray(data)?data.find(validPoint)||null:null;
 }
 function saveHomeFromCenter(){
  if(!currentUid()){say('Zaloguj się, aby zapisać Dom osobno dla swojego konta.');return false}
  const center=getMap()?.getCenter?.();
  if(!center||!validPoint({lat:center.lat,lon:center.lng})){say('Najpierw wskaż miejsce na mapie.');return false}
  const record={name:'Dom',lat:Number(center.lat),lon:Number(center.lng)};
  if(!write('home',[record])){say('Nie udało się zapisać miejsca Dom.');return false}
  say('Zapisano Dom — środek widocznej mapy. Lokalizacja pozostaje na Twoim urządzeniu.');
  drawRecentDestinations();return true;
 }
 function goHome(){
  const home=homePlace();
  if(!home){say('Najpierw zapisz Dom ze środka widocznej mapy.');return false}
  selectDestination('Dom',home.lat,home.lon);return true;
 }
 function clearHome(){
  if(!write('home',[])){say('Nie udało się usunąć zapisanego miejsca.');return false}
  drawRecentDestinations();say('Usunięto zapisaną lokalizację Dom.');return true;
 }
 function clearRecent(){
  if(!write('recent',[])){say('Nie udało się usunąć historii miejsc.');return false}
  drawRecentDestinations();say('Usunięto historię wybieranych celów.');return true;
 }
 function drawRecentDestinations(){
  const root=el('hgMapRecentDestinations');if(!root)return;
  root.replaceChildren();
  if(!currentUid()){child(root,'p','Zaloguj się, aby zobaczyć ostatnio wybierane cele.','hg-map-recent-empty');return}
  const places=rememberedDestinations();
  if(!places.length){child(root,'p','Nie ma jeszcze wybieranych celów. Wyszukaj miejsce lub wybierz restaurację.','hg-map-recent-empty');return}
  const list=child(root,'div',undefined,'hg-map-recent-list');
  places.forEach(p=>{
   const item=child(list,'div',undefined,'map-v2-item');
   const name=child(item,'span',p.name);
   child(name,'small',p.at?new Date(p.at).toLocaleString('pl-PL'):'Wybrane miejsce');
   const controls=child(item,'div',undefined,'map-v2-buttons');
   const route=child(controls,'button','Wyznacz trasę');
   route.type='button';route.addEventListener('click',()=>selectDestination(p.name,p.lat,p.lon));
  });
 }
 async function locateByName(query){
  if(!query)return null;
  const res=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(query),{headers:{Accept:'application/json'}});
  if(!res.ok)throw new Error('NOMINATIM_'+res.status);
  const rows=await res.json();if(!Array.isArray(rows)||!rows.length)return null;
  const p={name:clean(rows[0].display_name||query),lat:Number(rows[0].lat),lon:Number(rows[0].lon)};
  return validPoint(p)?p:null;
 }
 function rememberPosition(p){
  if(!validPoint(p))return false;
  const accuracy=Number(p.accuracy);
  recentFix={lat:Number(p.lat),lon:Number(p.lon),accuracy:Number.isFinite(accuracy)?accuracy:150,at:Date.now()};
  return true;
 }
 function getRecentPosition(maxAge=120000){
  return recentFix&&Date.now()-recentFix.at<maxAge&&recentFix.accuracy<=150?
   {lat:recentFix.lat,lon:recentFix.lon,accuracy:recentFix.accuracy}:null;
 }
 function locateOptIn(){
  // Reuse a recent fix from a previous user-authorized location request,
  // avoiding repeated system permission prompts when planning a route.
  const known=getRecentPosition(10000);
  if(known)return Promise.resolve(known);
  return new Promise((resolve,reject)=>{
   if(!navigator.geolocation){reject(new Error('GPS_UNAVAILABLE'));return}
   navigator.geolocation.getCurrentPosition(pos=>{
     const point={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};
     if(!validPoint(point)||!Number.isFinite(point.accuracy)||point.accuracy>150){
      reject(new Error('GPS_INACCURATE'));return;
     }
     rememberPosition(point);noteSystemLocationGranted();
     resolve({lat:point.lat,lon:point.lon,accuracy:point.accuracy});
   },err=>{
     const fallback=getRecentPosition(300000);
     if(fallback&&err?.code!==1){resolve(fallback);return;}
     if(err?.code===1)localStorageSet('healthgo.location.welcome.v1','denied');
     reject(new Error(err?.code===1?'GPS_DENIED':err?.code===3?'GPS_TIMEOUT':'GPS_UNAVAILABLE'));
   },{enableHighAccuracy:true,timeout:18000,maximumAge:5000});
  });
 }
 function chooseMode(mode){
  if(!['car','foot','bike'].includes(mode))return;
  if(routeMode!==mode){
    routeChoices=[];routeChosen=0;const variants=el('hg4RouteAlternatives');if(variants)variants.replaceChildren();
    window.HealthGoMapPro?.clearRoute();
    if(routeLayer&&getMap())getMap().removeLayer(routeLayer);
    routeLayer=null;
    const routeOutput=el('mapV2RouteOutput');
    if(routeOutput)routeOutput.textContent='Kliknij „Wyznacz trasę”, aby pobrać trasę dla wybranego środka transportu.';
    const link=el('mapV2External');if(link)link.hidden=true;
  }
  routeMode=mode;
  document.querySelectorAll('[data-map-mode]').forEach(b=>{const selected=b.dataset.mapMode===mode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  const helper=el('mapV2RouteModeHint');
  if(helper)helper.textContent=mode==='car'?'Trasa drogowa z publicznej usługi OSRM — orientacyjna.':'Trasa piesza lub rowerowa otworzy się w OpenStreetMap (wymaga zewnętrznego planera).';
 }
 function updateLiveRoute(item){
  const geometry=item?.geometry?.coordinates;
  if(!Array.isArray(geometry)||geometry.length<2||!getMap()||typeof L==='undefined')return false;
  const pts=geometry.filter(pt=>Array.isArray(pt)&&Number.isFinite(pt[0])&&Number.isFinite(pt[1])).map(pt=>[pt[1],pt[0]]);
  if(pts.length<2)return false;
  if(routeLayer)try{getMap().removeLayer(routeLayer)}catch(_){}
  routeLayer=L.polyline(pts,{color:'#216be8',weight:7,opacity:.95,className:'map-v2-route-line'}).addTo(getMap());
  // Preserve GPS-centred live guidance; never fitBounds in the middle of driving.
  return true;
 }
 function chooseRoute(index,options={}){
  if(!Number.isInteger(index)||index<0||index>=routeChoices.length)return false;
  const route=routeChoices[index],geometry=route?.geometry?.coordinates;
  if(!Array.isArray(geometry)||geometry.length<2)return false;
  routeChosen=index;
  window.HealthGoMapPro?.setRoute?.(route,destination?.name||'Cel');
  if(routeStartWasManual){const nav=el('hgNavStartButton');if(nav)nav.hidden=true;}
  if(routeLayer&&getMap())getMap().removeLayer(routeLayer);
  if(getMap()&&typeof L!=='undefined'){
   routeLayer=L.polyline(geometry.filter(p=>Array.isArray(p)&&p.length>=2).map(p=>[p[1],p[0]]),
    {color:'#216be8',weight:7,opacity:.95,className:'map-v2-route-line'}).addTo(getMap());
   if(options.fitBounds!==false)getMap().fitBounds(routeLayer.getBounds(),{padding:[42,42],maxZoom:16});
  }
  const box=el('hg4RouteAlternatives');
  if(box){box.replaceChildren();routeChoices.forEach((item,i)=>{
   const button=document.createElement('button');button.type='button';
   button.className='hg4-alternative'+(i===index?' active':'');
   button.textContent=(i===0?'Polecana':'Wariant '+(i+1))+' · '+(Number(item.distance)/1000).toFixed(1).replace('.',',')+
    ' km · '+Math.max(1,Math.round(Number(item.duration)/60))+' min';
   button.setAttribute('aria-pressed',String(i===index));
   button.addEventListener('click',()=>chooseRoute(i));
   box.appendChild(button);
  })}
  const out=el('mapV2RouteOutput');if(out)out.textContent='Samochodem: '+(Number(route.distance)/1000).toFixed(1).replace('.',',')+
   ' km · około '+Math.max(1,Math.round(Number(route.duration)/60))+' min. '+
   (routeStartWasManual?'Podgląd trasy z wpisanego adresu startowego, bez śledzenia GPS.':
    'Prowadzenie GPS dostępne po kliknięciu Rozpocznij. Bez danych o korkach na żywo.');
  return true;
 }
 async function planRoute(options={}){
  const ticket=++routeRequestTicket;
  const field=el('mapV2RouteTo'),output=el('mapV2RouteOutput'),external=el('mapV2External');
  routeChoices=[];routeChosen=0;
  const container=el('hg4RouteAlternatives');if(container)container.replaceChildren();
  window.HealthGoMapPro?.clearRoute?.();
  const help=el('mapV2GpsHelp');if(help)help.hidden=true;
  if(output)output.textContent='Ustalam pozycję GPS i szukam trasy…';
  if(external)external.hidden=true;
  const raw=clean(field?.value,180),manualStart=clean(el('mapV2RouteFrom')?.value,180);
  if(!raw){if(output)output.textContent='Wpisz cel lub wybierz pinezkę miejsca.';return false}
  try{
   // Begin GPS while the destination-selection gesture is still active.
   // Awaiting address geocoding first could delay iOS location permission.
   const startPromise=manualStart?locateByName(manualStart):locateOptIn();
   const targetPromise=destination&&raw===destination.name?Promise.resolve(destination):locateByName(raw);
   const [start,target]=await Promise.all([startPromise,targetPromise]);
   if(ticket!==routeRequestTicket)return false;
   if(!target){if(output)output.textContent='Nie znalazłem celu. Sprawdź adres lub nazwę miejsca.';return false}
   destination=target;
   if(!validPoint(start))throw new Error(manualStart?'START_NOT_FOUND':'GPS_UNAVAILABLE');
   if(routeMode!=='car'){
    const mode=routeMode==='foot'?'fossgis_osrm_foot':'fossgis_osrm_bike';
    const params=new URLSearchParams({engine:mode,route:start.lat+','+start.lon+';'+destination.lat+','+destination.lon});
    if(external){external.href='https://www.openstreetmap.org/directions?'+params.toString();external.hidden=false;external.textContent='Otwórz trasę w OpenStreetMap ↗';}
    if(output)output.textContent='Trasa '+(routeMode==='foot'?'piesza':'rowerowa')+' jest dostępna w zewnętrznej nawigacji. Nie wyświetlam zmyślonego czasu.';
    return false;
   }
   const url=routeUrl+encodeURIComponent(start.lon)+','+encodeURIComponent(start.lat)+';'+encodeURIComponent(destination.lon)+','+encodeURIComponent(destination.lat)+'?overview=full&geometries=geojson&steps=true&alternatives=true';
   const avoid=!!window.HealthGoMap4?.getSettings?.().avoidMotorways;
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),17000);
   let json,fellBack=false;
   try{
    let res=await fetch(url+(avoid?'&exclude=motorway':''),{signal:controller.signal});
    if(!res.ok&&avoid){fellBack=true;res=await fetch(url,{signal:controller.signal});}
    if(!res.ok)throw new Error('ROUTE_HTTP_'+res.status);
    json=await res.json();
   }finally{clearTimeout(timer)}
   if(ticket!==routeRequestTicket)return false;
   routeChoices=(Array.isArray(json?.routes)?json.routes:[]).filter(r=>r?.geometry?.coordinates?.length>=2).slice(0,3);
   if(!routeChoices.length)throw new Error('ROUTE_EMPTY');
   routeStartWasManual=!!manualStart;
   chooseRoute(0,{fitBounds:false});
   if(fellBack&&output)output.textContent+=' Serwer nie obsłużył omijania autostrad; pokazano standardową trasę.';
   say('Wyznaczono '+routeChoices.length+' wariantów do: '+destination.name);
   if(external){const q=new URLSearchParams({engine:'fossgis_osrm_car',route:start.lat+','+start.lon+';'+destination.lat+','+destination.lon});external.href='https://www.openstreetmap.org/directions?'+q;external.textContent='Otwórz wskazówki dojazdu ↗';external.hidden=false;}
   // A real GPS route closes the planner and shows turn guidance immediately.
   // A typed emergency origin is only a preview, never fake live tracking.
   if(!manualStart&&options.autoStart!==false&&activePanel==='route'){
    const started=window.HealthGoMapPro?.startNavigation?.(start);
    if(started){say('Prowadzenie GPS: '+destination.name);return true}
    if(output)output.textContent='Trasa gotowa, ale prowadzenie nie wystartowało. Sprawdź uprawnienia i wybierz „Rozpocznij prowadzenie”.';
    return false;
   }
   return true;
  }catch(err){
   if(ticket!==routeRequestTicket)return false;
   const msg=String(err?.message||err);
   if(help)help.hidden=msg!=='GPS_DENIED';
   if(output)output.textContent=
    msg==='GPS_DENIED'?'Telefon zablokował GPS. Sprawdź uprawnienia lokalizacji lub rozwiń awaryjny punkt startowy.':
    msg==='GPS_TIMEOUT'?'GPS nie odpowiedział na czas. Spróbuj ponownie, będąc na otwartej przestrzeni.':
    msg==='GPS_INACCURATE'?'Sygnał GPS jest zbyt słaby, aby rozpocząć prowadzenie. Spróbuj ponownie.':
    msg==='START_NOT_FOUND'?'Nie znaleziono punktu startowego. Wpisz pełniejszy adres.':
    msg==='GPS_UNAVAILABLE'?'Nie można ustalić pozycji. Włącz usługi lokalizacji w telefonie i spróbuj ponownie.':
    'Nie udało się wyznaczyć trasy. Sprawdź adres i połączenie z usługą tras.';
   return false;
  }
 }
 function showFamily(){close();if(typeof showFamilyOnMap==='function')showFamilyOnMap();}
 function startTracking(){
  if(tracker!==null)return;
  if(!currentUid()){say('Zaloguj się przed rozpoczęciem aktywności.');return}
  if(!navigator.geolocation){say('Telefon nie udostępnia GPS.');return}
  trackedMeters=0;lastFix=null;trackingStarted=Date.now();
  if(traceLayer&&getMap())getMap().removeLayer(traceLayer);traceLayer=null;
  try{tracker=navigator.geolocation.watchPosition(pos=>{
   const p={lat:Number(pos.coords.latitude),lon:Number(pos.coords.longitude)};
   if(!validPoint(p)||Number(pos.coords.accuracy)>150)return;
   if(lastFix&&distance(lastFix,p)>3&&distance(lastFix,p)<200){
    trackedMeters+=distance(lastFix,p);
    if(getMap()&&typeof L!=='undefined'){
     if(!traceLayer)traceLayer=L.polyline([],{color:'#1fad78',weight:5}).addTo(getMap());
     traceLayer.addLatLng([p.lat,p.lon]);
    }
   }else if(!lastFix&&getMap()&&typeof L!=='undefined'){
    traceLayer=L.polyline([[p.lat,p.lon]],{color:'#1fad78',weight:5}).addTo(getMap());
   }
   lastFix=p;updateTracking();
  },err=>{say(err?.code===1?'Odmówiono dostępu do lokalizacji. Rejestracja została zatrzymana.':'Utracono GPS. Rejestracja została zatrzymana.');stopTracking(false);},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }catch(_){tracker=null;say('Nie udało się włączyć GPS. Sprawdź uprawnienia lokalizacji.');return;}
  say('Rejestrowanie rozpoczęte. Zatrzymaj je przyciskiem; działa tylko przy otwartej aplikacji.');
  updateTracking();
 }
 function updateTracking(){
  const label=el('mapV2TrackState');if(!label)return;
  if(tracker===null){label.textContent='Rejestrowanie wyłączone.';label.classList.remove('map-v2-recording');return}
  const minutes=Math.max(0,Math.round((Date.now()-trackingStarted)/60000));
  label.textContent='● Nagrywanie: '+(trackedMeters/1000).toFixed(2)+' km · '+minutes+' min';label.classList.add('map-v2-recording');
 }
 function stopTracking(save=true){
  if(tracker===null)return;
  navigator.geolocation.clearWatch(tracker);tracker=null;
  const minutes=Math.max(1,Math.ceil((Date.now()-trackingStarted)/60000));
  if(save&&currentUid()){
   const all=read('activities');
   write('activities',[{at:new Date().toISOString(),meters:Math.round(trackedMeters),minutes},...all].slice(0,15));
   say('Zapisano podsumowanie aktywności bez historii współrzędnych.');
  }
  if(!save&&traceLayer&&getMap()){getMap().removeLayer(traceLayer);traceLayer=null;}
  lastFix=null;updateTracking();if(activePanel==='activity')drawActivity();
 }
 function drawActivity(){
  updateTracking();const root=el('mapV2Activities');if(!root)return;root.replaceChildren();
  const list=read('activities').filter(x=>Number.isFinite(Number(x.meters))&&Number.isFinite(Number(x.minutes)));
  if(!list.length){child(root,'p','Brak zapisanych aktywności. Włącz GPS tylko podczas spaceru, a potem zatrzymaj i zapisz podsumowanie.','map-v2-muted');return}
  list.slice(0,8).forEach(row=>{const item=child(root,'div',undefined,'map-v2-item');
   const label=child(item,'span',(Number(row.meters)/1000).toFixed(2)+' km · '+Number(row.minutes)+' min');child(label,'small',new Date(row.at).toLocaleString('pl-PL'));});
 }

 function measureDistanceText(meters){
  if(!Number.isFinite(meters)||meters<=0)return '0 m';
  return meters<1000?Math.round(meters)+' m':(meters/1000).toFixed(2).replace('.',',')+' km';
 }
 function measuredMeters(){
  return measurePoints.slice(1).reduce((sum,point,index)=>sum+distance(measurePoints[index],point),0);
 }
 function renderMeasure(){
  const map=getMap(),label=el('mapV2MeasureDistance'),hint=el('mapV2MeasureHint');
  if(measureLine&&map){map.removeLayer(measureLine);measureLine=null}
  if(map)measureDots.forEach(dot=>map.removeLayer(dot));
  measureDots=[];
  if(label)label.textContent=measureDistanceText(measuredMeters());
  if(hint)hint.textContent=measurePoints.length===0?'Dotknij mapy, aby wybrać pierwszy punkt.'
   :measurePoints.length===1?'Wybierz drugi punkt, aby poznać dystans.'
   :'Punkty: '+measurePoints.length+' · pomiar po prostej między punktami, nie po ulicach.';
  if(map&&typeof L!=='undefined'&&measurePoints.length){
   if(typeof L.circleMarker==='function'){
    measurePoints.forEach((point,index)=>{
     const dot=L.circleMarker([point.lat,point.lon],{
      radius:index===0?7:5,color:'#0c5edb',weight:2,fillColor:'#fff',fillOpacity:1
     }).addTo(map);
     measureDots.push(dot);
    });
   }
   if(measurePoints.length>1&&typeof L.polyline==='function'){
    measureLine=L.polyline(measurePoints.map(p=>[p.lat,p.lon]),{
     color:'#1265ed',weight:4,opacity:.85,dashArray:'8,7',interactive:false
    }).addTo(map);
   }
  }
 }
 function measureClick(event){
  if(!measuring||!event?.latlng)return;
  const point={lat:Number(event.latlng.lat),lon:Number(event.latlng.lng)};
  if(!validPoint(point))return;
  if(measurePoints.length>=30){say('Maksymalnie 30 punktów pomiaru. Cofnij punkt lub wyczyść pomiar.');return}
  measurePoints.push(point);
  renderMeasure();
 }
 function startMeasure(){
  mount();
  const map=getMap();
  if(!map||typeof map.on!=='function'){
   say('Najpierw otwórz mapę, aby zmierzyć dystans.');return false;
  }
  if(measuring)return true;
  close();
  if(typeof toggleMapResults==='function')toggleMapResults(false);
  measuring=true;measurePoints=[];
  map.on('click',measureClick);
  el('mapWorkspace')?.classList.add('measure-active');
  const hud=el('mapV2MeasureHud');if(hud)hud.hidden=false;
  renderMeasure();
  say('Pomiar odległości w linii prostej — dotknij mapy, aby dodać punkty.');
  return true;
 }
 function undoMeasure(){
  if(!measuring||!measurePoints.length)return;
  measurePoints.pop();renderMeasure();
 }
 function clearMeasure(){
  if(!measuring)return;
  measurePoints=[];renderMeasure();
 }
 function stopMeasure(){
  const map=getMap();
  if(map&&typeof map.off==='function')map.off('click',measureClick);
  measuring=false;measurePoints=[];
  if(measureLine&&map)map.removeLayer(measureLine);
  if(map)measureDots.forEach(dot=>map.removeLayer(dot));
  measureLine=null;measureDots=[];
  el('mapWorkspace')?.classList.remove('measure-active');
  const hud=el('mapV2MeasureHud');if(hud)hud.hidden=true;
  const label=el('mapV2MeasureDistance');if(label)label.textContent='0 m';
  say('Pomiar zakończony. Nie zapisano lokalizacji ani współrzędnych.');
 }
 function toggleSpacious(){
  mapSpacious=!mapSpacious;
  el('mapWorkspace')?.classList.toggle('map-v2-spacious',mapSpacious);
  const button=el('mapV2SpaciousButton');
  if(button){
   button.textContent=mapSpacious?'▤ Pokaż filtry mapy':'▣ Więcej miejsca na mapę';
   button.setAttribute('aria-pressed',String(mapSpacious));
  }
  setTimeout(()=>getMap()?.invalidateSize({pan:false}),80);
  return mapSpacious;
 }
 function notice(topic){const labels={traffic:'Korki na żywo wymagają odrębnego dostawcy. W zakładce Pogoda sprawdzisz rzeczywiste remonty z OSM.',weather:'Prognoza Open-Meteo jest dostępna w zakładce Pogoda. Radar na żywo wymaga osobnej usługi.'};say(labels[topic]||'Sprawdź odpowiednią zakładkę mapy.');}
 function centerGPS(){if(typeof useMyLocation==='function')useMyLocation();}
 if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{mount();setTimeout(watchWelcome,1000);},{once:true});
 }else{mount();setTimeout(watchWelcome,1000)}
 window.addEventListener('resize',()=>{if(el('map')?.classList.contains('active'))resizeViewport()});
 if(window.visualViewport)window.visualViewport.addEventListener('resize',()=>{if(el('map')?.classList.contains('active'))resizeViewport()});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body?.classList?.contains?.('hg-route-planner-open')){
   event.preventDefault();close();
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(tracker!==null||measuring)){
  const wasTracking=tracker!==null;stopTracking(false);if(measuring)stopMeasure();
  say(wasTracking?'GPS zatrzymany po ukryciu aplikacji. Nie zapisano trasy.':'Pomiar zakończony po ukryciu aplikacji.');
 }});
 window.addEventListener('pagehide',()=>{stopTracking(false);if(measuring)stopMeasure()});
 window.HealthGoMapV2={mount,toggle,close,chooseLayer,savePlace,saveCenter,selectDestination,navigateToAddress,chooseMode,planRoute,showFamily,startTracking,stopTracking,notice,centerGPS,startMeasure,undoMeasure,clearMeasure,stopMeasure,toggleSpacious,resizeViewport,showLocationWelcome,chooseWelcomeLocation,askLocationAgain,rememberPosition,getRecentPosition,centerIfSystemGranted,noteSystemLocationGranted,noteSystemLocationDenied,chooseRoute,swapRoute,useGPSStart,updateLiveRoute,drawRecentDestinations,saveHomeFromCenter,goHome,clearHome,clearRecent,homePlace};
})();
