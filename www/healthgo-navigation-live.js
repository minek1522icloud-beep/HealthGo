/* HealthGo Live Guidance: GPS-driven perspective view, zero synthetic positions.
 * Load MapLibre only after the user starts route guidance; fall back to Leaflet.
 * Weather comes from live Open-Meteo responses, never fabricated values. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const GL_URL='https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
 const STYLE_URL='https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css';
 let gl=null,libPromise=null,marker=null,markerVisual=null,active=false,ready=false,generation=0;
 let coords=[],lastView=0,lastWeather=0,weatherController=null,lastHeading=null,lastPoint=null;
 let inFlight=false,glDisabled=false,approachDistance=null;
 const good=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
 const rad=n=>n*Math.PI/180;
 const meters=(a,b)=>{
  const x=Math.sin(rad((b.lat-a.lat)/2))**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad((b.lon-a.lon)/2))**2;
  return 12742000*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
 };
 const bearing=(a,b)=>{
  const d=rad(b.lon-a.lon),y=Math.sin(d)*Math.cos(rad(b.lat));
  const x=Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(d);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
 };
 const line=arr=>({type:'Feature',geometry:{type:'LineString',coordinates:arr},properties:{}});
 const colorStyle={
  version:8,
  sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'}},
  layers:[{id:'osm',type:'raster',source:'osm'}]
 };
 function setRoute(route){
  const c=route?.geometry?.coordinates;
  coords=Array.isArray(c)?c.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])):[];
  if(ready&&gl?.getSource?.('hg-route'))try{gl.getSource('hg-route').setData(line(coords))}catch(_){}
  if(ready)window.HealthGoRoute3DOverlay?.setRoute?.(coords);
 }
 function showLayer(on){
  const box=$('hgNavigationPerspective');
  if(box){box.hidden=!on;box.classList?.toggle?.('hg-live-loading',false)}
  document.body?.classList?.toggle?.('hg-live-perspective',!!on);
 }
 function stop(){
  approachDistance=null;
  window.HealthGoRoute3DOverlay?.detach?.();
  window.HealthGoMapExtras?.detach3D?.();
  active=false;ready=false;generation++;lastHeading=null;lastPoint=null;
  if(weatherController){weatherController.abort();weatherController=null}
  inFlight=false;lastView=0;lastWeather=0;
  showLayer(false);
  markerVisual?.stop?.();markerVisual=null;
  if(marker){try{marker.remove()}catch(_){}marker=null}
  if(gl){try{gl.remove()}catch(_){}gl=null}
  const hint=$('hgLiveWeather');if(hint){hint.hidden=true;hint.textContent=''}
 }
 async function getLibrary(){
  if(libPromise)return libPromise;
  if(!document.querySelector?.('link[data-healthgo-maplibre]')){
   const link=document.createElement('link');link.rel='stylesheet';link.href=STYLE_URL;
   link.dataset.healthgoMaplibre='1';document.head.appendChild(link);
  }
  libPromise=import(GL_URL).then(mod=>{
   if(typeof mod.Map!=='function'||typeof mod.Marker!=='function')throw Error('MAPLIBRE_NOT_SUPPORTED');
   if(typeof mod.supported==='function'&&!mod.supported())throw Error('NO_WEBGL');
   return mod;
  }).catch(error=>{libPromise=null;throw error});
  return libPromise;
 }
 function makeCar(){
  const node=document.createElement('div');
  node.className='hg-live-car';
  node.setAttribute('aria-label','Strzałka bieżącej pozycji GPS');
  // Decorative geometry only; position always comes from the actual GPS fix.
  node.innerHTML='<svg width="34" height="38" viewBox="0 0 40 44" aria-hidden="true">'+
   '<circle cx="20" cy="23" r="17" fill="#4285f4" opacity=".12"/>'+
   '<path d="M20 4 35 35 20 29 5 35Z" fill="#4285f4" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>'+
   '<path d="M20 14 26 27 20 25 14 27Z" fill="#194d9c" opacity=".92"/>'+
   '</svg>';
  return node;
 }
 async function mount(point,heading,token){
  if(!active||glDisabled||!good(point))return false;
  try{
   const lib=await getLibrary();
   if(!active||token!==generation)return false;
   const container=$('hgNavigationPerspective');
   if(!container)return false;
   container.hidden=false;container.classList?.add?.('hg-live-loading');
   gl=new lib.Map({
    container,style:colorStyle,center:[point.lon,point.lat],zoom:16.5,
    pitch:52,bearing:Number.isFinite(heading)?heading:0,
    attributionControl:true,interactive:false,antialias:false,
    maxZoom:19,minZoom:3,fadeDuration:0
   });
   gl.on('load',()=>{
    if(!active||token!==generation||!gl)return;
    try{
     gl.addSource('hg-route',{type:'geojson',data:line(coords)});
     gl.addLayer({id:'hg-route-outline',type:'line',source:'hg-route',
      paint:{'line-color':'#f1fff7','line-width':12,'line-opacity':.92}});
     gl.addLayer({id:'hg-route',type:'line',source:'hg-route',
      paint:{'line-color':'#11dfb2','line-width':8,'line-opacity':1}});
     marker=new lib.Marker({element:makeCar(),rotationAlignment:'viewport',pitchAlignment:'viewport'})
      .setLngLat([point.lon,point.lat]).addTo(gl);
     markerVisual=window.HealthGoGpsVisual?.create?.(shown=>{
      if(marker&&gl)marker.setLngLat([shown.lon,shown.lat]);
     },{maxGap:85})||null;
     markerVisual?.fix?.(point,15);
     if(Number.isFinite(heading))marker.setRotation(0); // With the camera bearing the heading, the forward arrow stays upright.
     ready=true;showLayer(true);gl.resize();
     window.HealthGoRoute3DOverlay?.attach?.(gl,coords);
     window.HealthGoMapExtras?.attach3D?.(gl);
     if(lastPoint)window.HealthGoMapExtras?.gps3D?.(lastPoint);
     const status=$('hgLiveMapStatus');if(status){status.hidden=true;status.textContent='';}
    }catch(_){fail()}
   });
   gl.on('error',e=>{
    // Temporary tile failures should not stop navigation; only fatal renderer
    // errors on first load cause the 2D fallback.
    if(!ready&&e?.error?.message?.includes('WebGL'))fail();
   });
   return true;
  }catch(_){fail();return false}
 }
 function fail(){
  glDisabled=true;
  showLayer(false);
  markerVisual?.stop?.();markerVisual=null;
  if(marker){try{marker.remove()}catch(_){}marker=null}
  if(gl){try{gl.remove()}catch(_){}gl=null}
  ready=false;window.HealthGoRoute3DOverlay?.detach?.();
  const warning=$('hgLiveMapStatus');
  if(warning){warning.hidden=false;warning.textContent='Widok 2D — mapa perspektywiczna niedostępna na tym telefonie.'}
  window.HealthGoNavigationMode?.fallback?.();
 }
 function begin(route){
  stop();active=true;glDisabled=false;coords=[];
  setRoute(route);const warning=$('hgLiveMapStatus');if(warning)warning.hidden=true;
  return true;
 }
 function update(pos){
  if(!active||!pos?.coords)return;
  const c=pos.coords,p={lat:Number(c.latitude),lon:Number(c.longitude)};
  const accuracy=Number(c.accuracy);
  if(!good(p)||!Number.isFinite(accuracy)||accuracy>100)return;
  let heading=c.heading==null?NaN:Number(c.heading);
  if(!Number.isFinite(heading)||heading<0||heading>=360){
   const distance=lastPoint?meters(lastPoint,p):0;
   if(distance>Math.max(12,accuracy*1.3)&&Number(c.speed)>1.2)heading=bearing(lastPoint,p);
   else heading=lastHeading??NaN;
  }
  if(Number.isFinite(heading))lastHeading=heading;
  lastPoint=p;
  if(!gl&&!inFlight&&!glDisabled){
   inFlight=true;const token=generation;
   mount(p,heading,token).finally(()=>{inFlight=false});
  }
  if(ready&&gl){
   try{
    if(!markerVisual?.fix?.(p,accuracy))marker?.setLngLat([p.lon,p.lat]);
    window.HealthGoMapExtras?.gps3D?.(p);
    if(Number.isFinite(heading))marker?.setRotation((heading-(Number(gl.getBearing?.())||0)+360)%360);
    if(Date.now()-lastView>580){
     lastView=Date.now();
     const follows=$('hgProFollow')?.getAttribute?.('aria-pressed')!=='false';
     if(follows)gl.easeTo({center:[p.lon,p.lat],
      ...(Number.isFinite(heading)?{bearing:heading}:{}),
      pitch:52,zoom:Number.isFinite(approachDistance)?
       (approachDistance<100?17.6:approachDistance<300?17.0:16.2):
       Math.max(16,Math.min(17.6,gl.getZoom())),
      duration:680,essential:true});
    }
   }catch(_){fail()}
  }
  if(Date.now()-lastWeather>600000){lastWeather=Date.now();loadWeather(p)}
 }
 async function loadWeather(p){
  if(!active||!good(p)||typeof fetch!=='function')return;
  if(weatherController)weatherController.abort();
  const ctl=new AbortController();weatherController=ctl;
  const chip=$('hgLiveWeather');if(chip){chip.hidden=false;chip.textContent='Pogoda: pobieranie…'}
  const args=new URLSearchParams({
   latitude:p.lat.toFixed(3),longitude:p.lon.toFixed(3),
   current:'temperature_2m,precipitation,weather_code,wind_speed_10m',timezone:'auto'
  });
  const timer=setTimeout(()=>ctl.abort(),10000);
  try{
   const r=await fetch('https://api.open-meteo.com/v1/forecast?'+args,{signal:ctl.signal});
   if(!r.ok)throw Error('WEATHER_HTTP');
   const data=await r.json();
   if(!active||ctl!==weatherController)return;
   const temp=Number(data?.current?.temperature_2m);
   const rain=Number(data?.current?.precipitation);
   if(!Number.isFinite(temp)||!Number.isFinite(rain))throw Error('WEATHER_INVALID');
   if(chip){chip.hidden=false;chip.textContent='Pogoda · '+Math.round(temp)+'°C · opad '+rain.toFixed(1)+' mm · Open-Meteo'}
   window.HealthGoNavAdvanced?.weather?.({
    temp,rain,wind:Number(data?.current?.wind_speed_10m)
   });
  }catch(_){if(chip&&active&&ctl===weatherController)chip.textContent='Pogoda chwilowo niedostępna'}
  finally{clearTimeout(timer);if(weatherController===ctl)weatherController=null}
 }
 function setApproach(value){
  approachDistance=Number.isFinite(value)&&value>=0?value:null;
 }
 function overview(){
  if(!active||!ready||!gl||coords.length<2)return false;
  let west=180,east=-180,south=90,north=-90;
  for(const p of coords){if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
   west=Math.min(west,p[0]);east=Math.max(east,p[0]);
   south=Math.min(south,p[1]);north=Math.max(north,p[1]);}
  if(!Number.isFinite(west)||!Number.isFinite(east)||east<west||north<south)return false;
  try{
   const followButton=$('hgProFollow');
   if(followButton?.getAttribute?.('aria-pressed')!=='false')window.HealthGoMapPro?.toggleFollow?.();
   gl.fitBounds([[west,south],[east,north]],{
    padding:{top:Math.min(190,gl.getCanvas().clientHeight/4),bottom:150,left:45,right:45},
    maxZoom:16.2,pitch:35,duration:700
   });return true;
  }catch(_){return false}
 }
 function recenter(){
  if(!active||!ready||!gl||!lastPoint)return false;
  try{gl.easeTo({center:[lastPoint.lon,lastPoint.lat],zoom:16.4,pitch:52,duration:500});return true}
  catch(_){return false}
 }
 function orientNorth(){
  if(!active||!ready||!gl)return false;
  try{
   const btn=$('hgProFollow');
   if(btn?.getAttribute?.('aria-pressed')!=='false')window.HealthGoMapPro?.toggleFollow?.();
   gl.easeTo({bearing:0,duration:500});return true;
  }catch(_){return false}
 }
 function enableVoiceTip(){
  const el=$('hgLiveMapStatus');
  if(el){el.hidden=false;el.textContent='Wskazówki głosowe działają podczas otwartej nawigacji. Nie używaj telefonu w ruchu.'}
 }
 window.HealthGoNavigationLive={begin,stop,update,setRoute,loadWeather,bearing,setApproach,overview,recenter,orientNorth};
})();
