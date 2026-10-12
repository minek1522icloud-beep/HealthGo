/* HealthGo Map Tools 2026 — opt-in features, no new bottom navigation tab.
 * Uses existing Leaflet map, OSRM routes and moderated HealthGo treasure data.
 * External data access occurs only after pressing the appropriate control.
 */
(function(w){
 'use strict';
 const $=id=>document.getElementById(id),panel=$('hgMapExtrasPanel'),trigger=$('hgMapExtrasToggle');
 if(!panel||!trigger)return;
 const map=()=>w.healthGoMapInstance?.()||null;
 const nav=()=>w.HealthGoMapV2;
 const point=o=>o&&Number.isFinite(+o.lat)&&Number.isFinite(+o.lon)&&Math.abs(+o.lat)<=90&&Math.abs(+o.lon)<=180;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const meter=(a,b)=>{
  const rad=Math.PI/180,dl=(b.lat-a.lat)*rad,do_=(b.lon-a.lon)*rad;
  const h=Math.sin(dl/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(do_/2)**2;
  return 12742000*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
 };
 let trails=null,treasures=null,open=false,request=null,gl=null,last3D=null,buildingFetch=null,buildingAt=0,buildingPosition=null,buildingsEnabled=false;
 const controller=id=>$(id);
 function status(message){const el=controller('hgMapExtrasStatus');if(el)el.textContent=message;}
 function log(message){status(message);}
 function visibleMap(){
  const m=map();
  if(!m||typeof L==='undefined'){log('Najpierw otwórz mapę i poczekaj na jej załadowanie.');return null}
  return m;
 }
 function toggle(){
  if(document.body?.classList?.contains?.('hg-navigation-active'))return;
  if(open){close();return}
  nav()?.close?.();open=true;panel.hidden=false;
  trigger.setAttribute('aria-expanded','true');
  controller('hgMapExtrasHeading')?.focus?.({preventScroll:true});
  status('Narzędzia działają w obrębie mapy. Żadne dodatkowe śledzenie GPS nie jest uruchamiane.');
 }
 function close(){
  open=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');
 }
 function turnVisible(type){
  if(document.body?.classList?.contains?.('hg-navigation-active'))return;
  const m=visibleMap();if(!m)return;
  if(type==='satellite'||type==='street'){
   nav()?.chooseLayer?.(type);
   log(type==='satellite'?'Mapa satelitarna Esri. Źródło podane w atrybucji mapy.':'Mapa ulic OpenStreetMap.');
   return;
  }
  if(type==='saved'){close();nav()?.toggle?.('saved');return;}
  if(type==='settings'){close();nav()?.toggle?.('settings');return;}
  if(type==='treasurePage'){close();w.mobileGo?.('explore');return;}
  if(type==='streetview'){streetView();return;}
  if(type==='radar'){
   const el=controller('hgMapWeatherRadar');
   if(el)el.textContent='Radar i oficjalne ostrzeżenia pogodowe otwieramy w zewnętrznym serwisie IMGW. HealthGo nie przedstawia modelowej prognozy jako radaru na żywo.';
   w.open?.('https://meteo.imgw.pl/','_blank','noopener,noreferrer');return;
  }
 }
 function streetView(){
  const p=visibleMap()?.getCenter?.();
  if(!p||!point({lat:p.lat,lon:p.lng})){log('Najpierw wskaż miejsce na mapie.');return false}
  const link='https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='+
   encodeURIComponent(Number(p.lat).toFixed(6)+','+Number(p.lng).toFixed(6));
  const opened=w.open?.(link,'_blank','noopener,noreferrer');
  if(!opened)log('Jeśli panorama się nie otworzyła, zezwól na otwieranie odnośników w przeglądarce.');
  else log('Otworzono panoramę ulicy. Zdjęcia są dostępne tylko w niektórych miejscach.');
  return true;
 }
 function clearTrails(){
  if(request){request.abort();request=null}
  try{if(trails&&map()?.hasLayer?.(trails))map().removeLayer(trails)}catch(_){}
  trails=null;log('Ukryto szlaki i ścieżki.');
 }
 async function showTrails(){
  const m=visibleMap();if(!m)return false;
  if(trails){clearTrails();return true}
  const center=m.getCenter?.(),zoom=m.getZoom?.();
  if(!center||!point({lat:center.lat,lon:center.lng})||zoom<13){
   log('Przybliż mapę do dzielnicy lub parku (zoom 13+) i ponów wyszukiwanie ścieżek.');return false;
  }
  if(request)request.abort();
  const ctl=new AbortController();request=ctl;
  const lat=+center.lat,lon=+center.lng;
  const dx=Math.min(.016,.008/Math.max(.25,Math.cos(lat*Math.PI/180)));
  const dy=.008,bbox=[lat-dy,lon-dx,lat+dy,lon+dx].map(x=>x.toFixed(5)).join(',');
  // A small explicit viewport fetch, never a background scan or tile prefetch.
  const query='[out:json][timeout:14];(way["highway"~"^(path|footway|pedestrian|bridleway)$"]('+bbox+');way["route"="hiking"]('+bbox+'););out geom 100;';
  const timer=setTimeout(()=>ctl.abort(),17000);
  log('Pobieram pobliskie, publicznie oznaczone ścieżki OSM…');
  try{
   const res=await fetch('https://overpass-api.de/api/interpreter',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'data='+encodeURIComponent(query),signal:ctl.signal});
   if(!res.ok)throw Error('OVERPASS_'+res.status);
   const json=await res.json();
   if(request!==ctl)return false;
   const layer=L.layerGroup();
   let total=0;
   for(const way of (Array.isArray(json.elements)?json.elements:[]).slice(0,100)){
    const path=(way.geometry||[]).map(q=>[Number(q.lat),Number(q.lon)]).filter(q=>q.every(Number.isFinite));
    if(path.length<2)continue;
    const line=L.polyline(path,{color:'#19af85',weight:5,opacity:.83,dashArray:'9 7'}).addTo(layer);
    const name=String(way.tags?.name||'Ścieżka piesza').slice(0,80);
    if(typeof document.createElement==='function'){
     const content=document.createElement('div');content.textContent=name+' · OpenStreetMap, sprawdź warunki na miejscu';
     line.bindPopup?.(content);
    }
    ++total;
   }
   trails=layer;
   if(!document.body?.classList?.contains?.('hg-navigation-active'))trails.addTo(m);
   log(total?'Pokazuję '+total+' ścieżek oznaczonych w OSM. To nie jest gwarancja dostępności ani bezpieczeństwa.':'Brak oznaczonych ścieżek w tej okolicy.');
   return true;
  }catch(e){
   if(ctl===request)log('Nie udało się pobrać ścieżek. Serwer OSM jest chwilowo niedostępny.');
   return false;
  }finally{clearTimeout(timer);if(request===ctl)request=null}
 }
 function clearTreasures(){
  try{if(treasures&&map()?.hasLayer?.(treasures))map().removeLayer(treasures)}catch(_){}
  treasures=null;
  log('Ukryto skarby na mapie.');
 }
 function showTreasures(){
  const m=visibleMap();if(!m)return false;
  if(treasures){clearTreasures();return true}
  const sites=w.HealthGoPoints?.getState?.()?.sites||[];
  const available=sites.filter(p=>point({lat:p.lat,lon:p.lon}));
  if(!available.length){
   log('Nie ma jeszcze zatwierdzonych skarbów. Dodamy je po sprawdzeniu publicznych i bezpiecznych miejsc.');return false;
  }
  if(!L?.layerGroup||!L?.marker||!L?.divIcon){log('Brak warstwy znaczników mapy.');return false}
  const layer=L.layerGroup(),visible=available.slice(0,150);
  for(const p of visible){
   const marker=L.marker([Number(p.lat),Number(p.lon)],{icon:L.divIcon({
    className:'hg-map-treasure-marker',html:'<span aria-hidden="true">💎</span>',
    iconSize:[38,38],iconAnchor:[19,38]})}).addTo(layer);
   const card=document.createElement('div');card.className='hg-map-treasure-popup';
   const title=document.createElement('strong');title.textContent=String(p.name||'Skarb').slice(0,90);card.appendChild(title);
   const detail=document.createElement('p');detail.textContent=String(p.description||'Znajdź obiekt, zrób zdjęcie i potwierdź GPS.').slice(0,220);card.appendChild(detail);
   const button=document.createElement('button');button.type='button';button.textContent=p.claimed?'✓ Odkryto':'Otwórz wyprawę';
   button.addEventListener('click',()=>{w.mobileGo?.('explore')});card.appendChild(button);
   marker.bindPopup?.(card);
  }
  treasures=layer;
  if(!document.body?.classList?.contains?.('hg-navigation-active'))layer.addTo(m);
  log('Wyświetlono '+visible.length+' zatwierdzonych skarbów. Dotknij znacznika, aby zobaczyć misję.');
  return true;
 }
 function routeGeometry(){
  const route=nav()?.getSelectedRoute?.();
  const coords=route?.geometry?.coordinates;
  return Array.isArray(coords)?coords.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90):[];
 }
 function sampledRoute(coords,count=25){
  if(coords.length<2)return [];
  const cumulative=[0];for(let i=1;i<coords.length;i++)
   cumulative.push(cumulative[i-1]+meter({lat:coords[i-1][1],lon:coords[i-1][0]},{lat:coords[i][1],lon:coords[i][0]}));
  const total=cumulative[cumulative.length-1];if(total<1)return[];
  const points=[];let segment=1;
  for(let i=0;i<count;i++){
   const goal=total*i/(count-1);
   while(segment<cumulative.length-1&&cumulative[segment]<goal)segment++;
   const prev=cumulative[segment-1],next=cumulative[segment],t=Math.max(0,Math.min(1,(goal-prev)/Math.max(.001,next-prev)));
   const a=coords[segment-1],b=coords[segment];
   points.push({lat:a[1]+(b[1]-a[1])*t,lon:a[0]+(b[0]-a[0])*t,distance:goal});
  }
  return points;
 }
 function graph(values){
  const root=controller('hgMapElevationResults');
  if(!root)return;
  const nums=values.filter(Number.isFinite);
  if(nums.length!==values.length||values.length<2){root.textContent='Serwer nie zwrócił pełnego profilu wysokości.';return}
  const min=Math.min(...nums),max=Math.max(...nums),spread=Math.max(1,max-min),W=600,H=115;
  const points=nums.map((v,i)=>[10+(W-20)*i/(nums.length-1),10+(H-30)*(1-(v-min)/spread)]);
  const commands=points.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' ');
  const svg='<svg viewBox="0 0 600 115" role="img" aria-label="Profil wysokości nad poziomem morza" preserveAspectRatio="none">'+
   '<path d="'+commands+'" fill="none" stroke="#12c798" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // SVG path is generated only from finite numeric API values.
  root.innerHTML='<div class="hg-map-elevation-values"><span>Nisko: '+Math.round(min)+' m</span><span>Wysoko: '+Math.round(max)+' m</span></div>'+
   svg+'<small>Orientacyjne wysokości terenu, model Copernicus DEM GLO-90 (~90 m), źródło: Open-Meteo. Nie jest to pomiar dokładności GPS.</small>';
 }
 async function elevation(){
  const root=controller('hgMapElevationResults');if(!root)return false;
  const coords=routeGeometry();
  if(coords.length<2){root.textContent='Najpierw wyznacz trasę samochodową w Nawigacji, następnie wróć tutaj po profil wysokości.';return false}
  const points=sampledRoute(coords,25);
  if(points.length<2){root.textContent='Trasa jest za krótka dla profilu wysokości.';return false}
  root.textContent='Pobieram prawdziwe dane wysokości dla wybranej trasy…';
  const query=new URLSearchParams({
   latitude:points.map(p=>p.lat.toFixed(5)).join(','),
   longitude:points.map(p=>p.lon.toFixed(5)).join(',')
  });
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);
  try{
   const res=await fetch('https://api.open-meteo.com/v1/elevation?'+query,{signal:ctl.signal});
   if(!res.ok)throw Error('ELEVATION_HTTP');
   const result=await res.json();
   if(!Array.isArray(result.elevation)||result.elevation.length!==points.length)throw Error('ELEVATION_DATA');
   graph(result.elevation);return true;
  }catch(_){root.textContent='Nie udało się pobrać wysokości trasy. Sprawdź połączenie.';return false}
  finally{clearTimeout(timer)}
 }
 // Optional building extrusion, using a strictly local bounded OSM query.
 // True OSM outlines; heights are approximate unless explicitly tagged.
 function settingKey(){const uid=String(w.HealthGoServices?.state?.uid||'');return uid?'healthgo.map.buildings.v1.'+uid:null}
 function readBuildings(){const key=settingKey();try{return key?localStorage.getItem(key)==='true':false}catch(_){return false}}
 function persistBuildings(){const key=settingKey();if(key)try{localStorage.setItem(key,String(buildingsEnabled))}catch(_){}}
 function buildingStatus(msg){const e=controller('hgMapBuildingsStatus');if(e)e.textContent=msg;}
 function toggleBuildings(){
  buildingsEnabled=!buildingsEnabled;persistBuildings();
  const btn=controller('hgMapBuildingsButton');if(btn)btn.setAttribute('aria-pressed',String(buildingsEnabled));
  if(!buildingsEnabled){
   buildingFetch?.abort?.();buildingFetch=null;
   try{if(gl?.getLayer?.('hg-buildings'))gl.removeLayer('hg-buildings');
    if(gl?.getSource?.('hg-buildings'))gl.removeSource('hg-buildings')}catch(_){}
   buildingStatus('Budynki 3D wyłączone.');return;
  }
  buildingStatus('Włącz nawigację 3D. Za Twoją zgodą pobierzemy z OSM tylko budynki w najbliższej okolicy.');
  if(gl&&last3D)fetchBuildings(last3D);
 }
 function attach3D(instance){
  gl=instance;last3D=null;buildingAt=0;buildingPosition=null;
  buildingsEnabled=readBuildings();
  const btn=controller('hgMapBuildingsButton');if(btn)btn.setAttribute('aria-pressed',String(buildingsEnabled));
 }
 function detach3D(){
  buildingFetch?.abort?.();buildingFetch=null;
  gl=null;last3D=null;buildingAt=0;buildingPosition=null;
 }
 function gps3D(p){
  if(!point(p))return;
  last3D={lat:+p.lat,lon:+p.lon};
  if(!gl||!buildingsEnabled||buildingFetch)return;
  if(buildingPosition&&meter(buildingPosition,last3D)<650&&Date.now()-buildingAt<120000)return;
  if(Date.now()-buildingAt<120000)return;
  fetchBuildings(last3D);
 }
 async function fetchBuildings(p){
  if(!gl||!buildingsEnabled||!point(p))return false;
  const current=gl;buildingAt=Date.now();buildingPosition={...p};
  buildingFetch?.abort?.();
  const ctl=new AbortController();buildingFetch=ctl;
  const dlat=.005,dlon=Math.min(.018,.005/Math.max(.3,Math.cos(p.lat*Math.PI/180)));
  const box=[p.lat-dlat,p.lon-dlon,p.lat+dlat,p.lon+dlon].map(n=>n.toFixed(5)).join(',');
  const query='[out:json][timeout:13];(way["building"]('+box+'););out geom 85;';
  buildingStatus('Pobieram rzeczywiste obrysy budynków OSM w promieniu ok. 500 m…');
  const timer=setTimeout(()=>ctl.abort(),16000);
  try{
   const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query),signal:ctl.signal});
   if(!res.ok)throw Error('BUILDINGS_HTTP');
   const json=await res.json();
   if(gl!==current||!buildingsEnabled||ctl!==buildingFetch)return false;
   const features=[];
   for(const way of (json.elements||[]).slice(0,85)){
    const ring=(way.geometry||[]).map(c=>[Number(c.lon),Number(c.lat)]).filter(c=>c.every(Number.isFinite));
    if(ring.length<4||ring.length>600)continue;
    const first=ring[0],last=ring[ring.length-1];
    if(first[0]!==last[0]||first[1]!==last[1])ring.push(first);
    const heightRaw=String(way.tags?.height||'').replace(',','.').replace(/\s*m\s*$/,'');
    const explicit=Number(heightRaw),levels=Number(String(way.tags?.['building:levels']||''));
    const height=Number.isFinite(explicit)&&explicit>1&&explicit<250?explicit:
     Number.isFinite(levels)&&levels>0&&levels<70?levels*3:9;
    features.push({type:'Feature',geometry:{type:'Polygon',coordinates:[ring]},properties:{height}});
   }
   if(!current.getSource?.('hg-buildings')){
    current.addSource('hg-buildings',{type:'geojson',data:{type:'FeatureCollection',features}});
    current.addLayer({id:'hg-buildings',type:'fill-extrusion',source:'hg-buildings',
     paint:{'fill-extrusion-color':'#69bda0','fill-extrusion-height':['get','height'],
      'fill-extrusion-base':0,'fill-extrusion-opacity':.48}},'hg-route-outline');
   }else current.getSource('hg-buildings').setData({type:'FeatureCollection',features});
   buildingStatus(features.length?
    'Pokazuję '+features.length+' budynków OSM. Niektóre wysokości są szacowane z liczby pięter.':
    'Brak dostępnych obrysów budynków 3D w tej okolicy.');
   return true;
  }catch(_){if(ctl===buildingFetch)buildingStatus('Nie udało się pobrać budynków 3D. Trasa nadal działa.');return false}
  finally{clearTimeout(timer);if(buildingFetch===ctl)buildingFetch=null}
 }
 function navigationStarted(){
  close();
  for(const layer of [trails,treasures]){
   try{if(layer&&map()?.hasLayer?.(layer))map().removeLayer(layer)}catch(_){}
  }
 }
 function navigationStopped(){
  if(!map())return;
  for(const layer of [trails,treasures]){
   try{if(layer&&!map().hasLayer?.(layer))layer.addTo(map())}catch(_){}
  }
 }
 function stopAll(){
  clearTrails();clearTreasures();detach3D();close();
 }
 trigger.addEventListener('click',toggle);
 panel.addEventListener('click',event=>{
  if(event.target.closest('[data-hg-extras-close]')){close();return;}
  const b=event.target.closest('button[data-hg-map-action]');if(!b)return;
  const action=b.dataset.hgMapAction;
  if(action==='paths')showTrails();
  else if(action==='hidePaths')clearTrails();
  else if(action==='treasures')showTreasures();
  else if(action==='hideTreasures')clearTreasures();
  else if(action==='elevation')elevation();
  else if(action==='buildings')toggleBuildings();
  else turnVisible(action);
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&open)close()});
 buildingsEnabled=readBuildings();
 w.HealthGoMapExtras=Object.freeze({
  toggle,close,showTrails,clearTrails,showTreasures,clearTreasures,streetView,
  elevation,sampledRoute,attach3D,detach3D,gps3D,navigationStarted,navigationStopped,stopAll
 });
})(window);