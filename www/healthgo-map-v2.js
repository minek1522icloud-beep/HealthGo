/* HealthGo Mapa 2.0: opt-in GPS, real map data, honest provider availability. */
(function(){
 'use strict';
 const el=id=>document.getElementById(id);
 let mounted=false,activePanel='',tileLayer=null,tileKind='street',destination=null,destinationMarker=null,routeLayer=null;
 let tracker=null,traceLayer=null,trackingStarted=0,lastFix=null,trackedMeters=0,routeMode='car';
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
  if(getMap())getMap().invalidateSize({pan:false});
  const fav=el('mapV2FavouriteCount');if(fav)fav.textContent=String(read('favorites').length);
 }
 function toggle(name){
  mount();
  const valid=['route','layers','favorites','activity','tools'];
  if(!valid.includes(name)){close();return}
  if(activePanel===name){close();return}
  activePanel=name;
  document.querySelectorAll('.map-v2-panel').forEach(panel=>{panel.hidden=panel.dataset.mapPanel!==name;});
  document.querySelectorAll('.map-v2-tab,.map-v2-actions button[data-panel]').forEach(btn=>btn.classList.toggle('active',btn.dataset.panel===name));
  if(name==='favorites')drawFavorites();
  if(name==='activity')drawActivity();
  setTimeout(()=>getMap()?.invalidateSize({pan:false}),80);
 }
 function close(){activePanel='';document.querySelectorAll('.map-v2-panel').forEach(p=>p.hidden=true);document.querySelectorAll('.map-v2-tab,.map-v2-actions button[data-panel]').forEach(b=>b.classList.remove('active'));}
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
  const center=map.getCenter();savePlace({name:'Moje miejsce '+new Date().toLocaleDateString('pl-PL'),lat:center.lat,lon:center.lng});
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
  const field=el('mapV2RouteTo');if(field)field.value=p.name;
  const map=getMap();
  if(map&&typeof L!=='undefined'){
   if(destinationMarker)map.removeLayer(destinationMarker);
   destinationMarker=L.marker([p.lat,p.lon]).addTo(map).bindPopup('📍 '+(typeof healthGoEscape==='function'?healthGoEscape(p.name):p.name));
  }
  toggle('route'); // Opens or closes only when already on route
  if(activePanel!=='route')toggle('route');
  say('Cel trasy: '+p.name+'. Aby zaplanować trasę, kliknij „Wyznacz trasę”.');
 }
 async function locateByName(query){
  if(!query)return null;
  const res=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(query),{headers:{Accept:'application/json'}});
  if(!res.ok)throw new Error('NOMINATIM_'+res.status);
  const rows=await res.json();if(!Array.isArray(rows)||!rows.length)return null;
  const p={name:clean(rows[0].display_name||query),lat:Number(rows[0].lat),lon:Number(rows[0].lon)};
  return validPoint(p)?p:null;
 }
 function locateOptIn(){
  return new Promise((resolve,reject)=>{
   if(!navigator.geolocation){reject(new Error('GPS_UNAVAILABLE'));return}
   navigator.geolocation.getCurrentPosition(pos=>resolve({lat:pos.coords.latitude,lon:pos.coords.longitude}),
     err=>reject(new Error(err?.code===1?'GPS_DENIED':'GPS_UNAVAILABLE')),
     {enableHighAccuracy:true,timeout:15000,maximumAge:20000});
  });
 }
 function chooseMode(mode){
  if(!['car','foot','bike'].includes(mode))return;
  if(routeMode!==mode){
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
 async function planRoute(){
  const field=el('mapV2RouteTo'),output=el('mapV2RouteOutput'),external=el('mapV2External');
  if(output)output.textContent='Szukam trasy…';
  if(external)external.hidden=true;
  const raw=clean(field?.value,180);
  if(!raw){if(output)output.textContent='Wpisz cel lub wybierz pinezkę miejsca.';return}
  try{
   if(!destination||raw!==destination.name){destination=await locateByName(raw);}
   if(!destination){if(output)output.textContent='Nie znalazłem takiego miejsca. Doprecyzuj adres.';return}
   const start=await locateOptIn(); // Only when the user requested route
   if(!validPoint(start))throw new Error('GPS_UNAVAILABLE');
   if(routeMode!=='car'){
    const mode=routeMode==='foot'?'fossgis_osrm_foot':'fossgis_osrm_bike';
    const params=new URLSearchParams({engine:mode,route:start.lat+','+start.lon+';'+destination.lat+','+destination.lon});
    if(external){external.href='https://www.openstreetmap.org/directions?'+params.toString();external.hidden=false;external.textContent='Otwórz trasę w OpenStreetMap ↗';}
    if(output)output.textContent='Trasa '+(routeMode==='foot'?'piesza':'rowerowa')+' jest dostępna w zewnętrznej nawigacji. Nie wyświetlam zmyślonego czasu.';
    return;
   }
   const url=routeUrl+encodeURIComponent(start.lon)+','+encodeURIComponent(start.lat)+';'+encodeURIComponent(destination.lon)+','+encodeURIComponent(destination.lat)+'?overview=full&geometries=geojson&steps=true';
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
   let json;
   try{const res=await fetch(url,{signal:controller.signal});if(!res.ok)throw new Error('ROUTE_HTTP_'+res.status);json=await res.json();}finally{clearTimeout(timer)}
   const route=json?.routes?.[0],geometry=route?.geometry?.coordinates;
   if(!Array.isArray(geometry)||geometry.length<2)throw new Error('ROUTE_EMPTY');
   if(!getMap()||typeof L==='undefined')return;
   if(routeLayer)getMap().removeLayer(routeLayer);
   routeLayer=L.polyline(geometry.filter(pt=>Array.isArray(pt)&&pt.length>=2).map(pt=>[pt[1],pt[0]]),{color:'#1869ee',weight:6,opacity:.94,className:'map-v2-route-line'}).addTo(getMap());
   getMap().fitBounds(routeLayer.getBounds(),{padding:[42,42],maxZoom:16});
   const km=(Number(route.distance)/1000).toFixed(1),min=Math.max(1,Math.round(Number(route.duration)/60));
   if(output)output.textContent='Samochodem: około '+km+' km · '+min+' min. Czas orientacyjny, bez bieżących korków.';
   say('Wyznaczono trasę samochodową do: '+destination.name);
   if(external){const q=new URLSearchParams({engine:'fossgis_osrm_car',route:start.lat+','+start.lon+';'+destination.lat+','+destination.lon});external.href='https://www.openstreetmap.org/directions?'+q;external.textContent='Otwórz wskazówki dojazdu ↗';external.hidden=false;}
  }catch(err){
   const msg=String(err?.message||err);
   if(output)output.textContent=msg==='GPS_DENIED'?'Bez zgody na GPS nie wyznaczę trasy od Twojego położenia.':msg==='GPS_UNAVAILABLE'?'Nie udało się ustalić lokalizacji. Sprawdź uprawnienia telefonu.':'Nie udało się wyznaczyć trasy. Publiczny serwer może być zajęty — spróbuj później.';
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
  lastFix=null;updateTracking();if(activePanel==='activity')drawActivity();
 }
 function drawActivity(){
  updateTracking();const root=el('mapV2Activities');if(!root)return;root.replaceChildren();
  const list=read('activities').filter(x=>Number.isFinite(Number(x.meters))&&Number.isFinite(Number(x.minutes)));
  if(!list.length){child(root,'p','Brak zapisanych aktywności. Włącz GPS tylko podczas spaceru, a potem zatrzymaj i zapisz podsumowanie.','map-v2-muted');return}
  list.slice(0,8).forEach(row=>{const item=child(root,'div',undefined,'map-v2-item');
   const label=child(item,'span',(Number(row.meters)/1000).toFixed(2)+' km · '+Number(row.minutes)+' min');child(label,'small',new Date(row.at).toLocaleString('pl-PL'));});
 }
 function notice(topic){const labels={traffic:'Warstwa korków wymaga zewnętrznego dostawcy bieżących danych. Nie pokazujemy fikcyjnego ruchu.',weather:'Radar i ostrzeżenia pogodowe wymagają aktualnego źródła danych. Nie pokazujemy fikcyjnej pogody.',threeD:'Widok 3D wymaga osobnego silnika map. Obecna mapa Leaflet działa płynnie w 2D.'};say(labels[topic]||'Funkcja wymaga konfiguracji danych.');}
 function centerGPS(){if(typeof useMyLocation==='function')useMyLocation();}
 if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',mount,{once:true})}else mount();
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopTracking(false);say('Rejestrowanie zatrzymano po ukryciu aplikacji. Nie zapisano trasy.')}});
 window.addEventListener('pagehide',()=>stopTracking(false));
 window.HealthGoMapV2={mount,toggle,close,chooseLayer,savePlace,saveCenter,selectDestination,chooseMode,planRoute,showFamily,startTracking,stopTracking,notice,centerGPS};
})();
