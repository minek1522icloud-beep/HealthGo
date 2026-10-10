/* HealthGo Navigation Follow 6.0
 * Real GPS location marker, movement-derived heading and active route overlay.
 * Never fabricates device positions, headings, speed, traffic or distances.
 * Leaflet-only: no new WebGL, paid map key, offline model or native plugin.
 */
(function(){
 'use strict';
 const goodPoint=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&
   Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
 const radians=x=>x*Math.PI/180;
 const meters=(a,b)=>{
  const x=Math.sin(radians((Number(b.lat)-Number(a.lat))/2))**2+
   Math.cos(radians(Number(a.lat)))*Math.cos(radians(Number(b.lat)))*
   Math.sin(radians((Number(b.lon)-Number(a.lon))/2))**2;
  return 12742000*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
 };
 const bearing=(a,b)=>{
  if(!goodPoint(a)||!goodPoint(b))return null;
  const delta=radians(Number(b.lon)-Number(a.lon));
  const y=Math.sin(delta)*Math.cos(radians(Number(b.lat)));
  const x=Math.cos(radians(Number(a.lat)))*Math.sin(radians(Number(b.lat)))-
   Math.sin(radians(Number(a.lat)))*Math.cos(radians(Number(b.lat)))*Math.cos(delta);
  if(Math.abs(x)<1e-10&&Math.abs(y)<1e-10)return null;
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
 };
 // Longitude/latitude GeoJSON route from the actual OSRM service.
 function projection(point,geometry){
  if(!goodPoint(point)||!Array.isArray(geometry)||geometry.length<2)return null;
  const lonScale=Math.max(.01,Math.cos(radians(Number(point.lat))))*111320,latScale=111320;
  let travelled=0,best=null;
  for(let i=0;i<geometry.length-1;i++){
   const a=geometry[i],b=geometry[i+1];
   if(!Array.isArray(a)||!Array.isArray(b)||!goodPoint({lat:a[1],lon:a[0]})||
       !goodPoint({lat:b[1],lon:b[0]}))return null;
   const ax=(a[0]-point.lon)*lonScale,ay=(a[1]-point.lat)*latScale;
   const dx=(b[0]-a[0])*lonScale,dy=(b[1]-a[1])*latScale;
   const segmentLen=Math.hypot(dx,dy);
   const t=segmentLen>0?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(segmentLen**2))):0;
   const distance=Math.hypot(ax+t*dx,ay+t*dy);
   const along=travelled+segmentLen*t;
   if(!best||distance<best.distance){
    best={index:i,t,distance,along,point:[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]};
   }
   travelled+=segmentLen;
  }
  if(best){best.total=travelled;best.left=Math.max(0,travelled-best.along);}
  return best;
 }
 function splitRoute(geometry,progress){
  if(!Array.isArray(geometry)||geometry.length<2||!progress)return {travelled:[],remaining:[]};
  const before=geometry.slice(0,progress.index+1);
  const after=geometry.slice(progress.index+1);
  const loc=progress.point;
  return {
   travelled:[...before,loc].map(p=>[p[1],p[0]]),
   remaining:[loc,...after].map(p=>[p[1],p[0]])
  };
 }
 function updateHeading(point,coords,previous,previousHeading){
  const raw=coords?.heading;
  if(typeof raw==='number'&&Number.isFinite(raw)&&raw>=0&&raw<360){
   // Browser/phone-provided course over ground (not compass orientation).
   return {degrees:raw,source:'device'};
  }
  if(previous?.point&&goodPoint(previous.point)){
   const distance=meters(previous.point,point);
   const accuracy=Math.max(Number(coords?.accuracy)||0,Number(previous.accuracy)||0);
   const gap=Date.now()-(previous.at||0);
   if(distance>=Math.max(12,accuracy*1.4)&&gap>0&&gap<60000){
    const direction=bearing(previous.point,point);
    if(direction!==null)return {degrees:direction,source:'movement'};
   }
  }
  return previousHeading||{degrees:null,source:'unknown'};
 }
 const pointLatLon=x=>({lat:Number(x?.latitude),lon:Number(x?.longitude)});
 let active=false,following=true,geometry=[],mapRef=null;
 let arrow=null,remainingLayer=null,passedLayer=null;
 let previous=null,direction={degrees:null,source:'unknown'},displayHeading=null;
 let latestPoint=null,lastFrameAt=0,lastCameraPoint=null,lastProjection=null,lastAlong=0;
 const getMap=()=>typeof healthGoMap==='undefined'?null:healthGoMap;
 function markerHTML(){
  return '<span class="hg-follow-marker" role="img" aria-label="Twoja aktualna pozycja GPS">'+
   '<span class="hg-follow-marker-halo"></span>'+
   '<span class="hg-follow-arrow-shape" aria-hidden="true">'+
    '<svg viewBox="0 0 64 70" width="64" height="70">'+
     '<path d="M32 4 56 56 33 48 9 56Z" fill="#13ddba" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>'+
     '<path d="M32 17 42 42 32 38 22 42Z" fill="#00382b" opacity=".9"/>'+
    '</svg>'+
   '</span><span class="hg-follow-unknown" aria-hidden="true"></span></span>';
 }
 function markerElement(){
  return arrow?.getElement?.()?.querySelector?.('.hg-follow-marker')||null;
 }
 function paintHeading(){
  const element=markerElement();if(!element)return;
  const known=Number.isFinite(direction.degrees);
  element.classList.toggle('hg-follow-heading-unknown',!known);
  if(known){
   if(displayHeading===null)displayHeading=direction.degrees;
   else{
    const delta=(direction.degrees-(displayHeading%360)+540)%360-180;
    displayHeading+=delta;
   }
   const path=element.querySelector('.hg-follow-arrow-shape');
   if(path)path.style.transform='rotate('+displayHeading+'deg)';
  }
 }
 function paintPosition(point){
  const m=getMap();
  if(!m||typeof L==='undefined'||!L.marker||!L.divIcon)return;
  try{
   if(!arrow){
    arrow=L.marker([point.lat,point.lon],{
     icon:L.divIcon({className:'hg-follow-user-icon',html:markerHTML(),
      iconSize:[64,70],iconAnchor:[32,35]}),
     interactive:false,keyboard:false,zIndexOffset:9000
    }).addTo(m);
   }else arrow.setLatLng([point.lat,point.lon]);
   paintHeading();
  }catch(_){
   // If Leaflet is unavailable, never block turn-by-turn or GPS updates.
   if(arrow)try{m.removeLayer?.(arrow)}catch(_){}
   arrow=null;
  }
 }
 function clearOverlay(){
  if(mapRef){
   for(const layer of [remainingLayer,passedLayer,arrow]){
    if(layer)try{mapRef.removeLayer?.(layer)}catch(_){}
   }
  }
  remainingLayer=passedLayer=arrow=null;
  document.body?.classList?.remove('hg-guidance-follow-ready');
 }
 function drawRoute(){
  const m=getMap();
  if(!m||!geometry.length||typeof L==='undefined'||!L.polyline)return false;
  try{
   if(mapRef&&mapRef!==m)clearOverlay();
   mapRef=m;
   if(!passedLayer)passedLayer=L.polyline([],
    {color:'#748d86',weight:8,opacity:.62,interactive:false,className:'hg-follow-passed-route'}).addTo(m);
   if(!remainingLayer)remainingLayer=L.polyline(geometry.map(p=>[p[1],p[0]]),
    {color:'#17e2ba',weight:10,opacity:.98,interactive:false,className:'hg-follow-remaining-route'}).addTo(m);
   document.body?.classList?.add('hg-guidance-follow-ready');
   return true;
  }catch(_){
   // Retain the original OSRM line if overlay creation fails.
   document.body?.classList?.remove('hg-guidance-follow-ready');
   return false;
  }
 }
 function redrawProgress(progress){
  if(!active||!progress||!remainingLayer||!passedLayer)return;
  if(progress.distance>Math.max(90,(Number(previous?.accuracy)||0)*2.5))return;
  if(progress.along+12<lastAlong)return; // Reject jitter travelling backwards.
  if(progress.along<lastAlong)return;
  lastAlong=progress.along;
  lastProjection=progress;
  try{
   const segments=splitRoute(geometry,progress);
   passedLayer.setLatLngs(segments.travelled);
   remainingLayer.setLatLngs(segments.remaining);
  }catch(_){}
 }
 function moveCamera(point,immediate=false){
  if(!active||!following)return false;
  const m=getMap();if(!m?.setView)return false;
  const now=Date.now();
  if(!immediate&&now-lastFrameAt<800)return false;
  if(!immediate&&lastCameraPoint&&meters(lastCameraPoint,point)<3)return false;
  lastFrameAt=now;
  const zoom=Math.max(16,Math.min(17.5,Number(m.getZoom?.())||17));
  let center=[point.lat,point.lon];
  try{
   if(m.project&&m.unproject&&m.getSize){
    const p=m.project(center,zoom),size=m.getSize();
    const ahead=Math.min(110,Math.max(0,Number(size?.y)||0)*.13);
    const shifted=m.unproject([p.x,p.y-ahead],zoom);
    if(goodPoint(shifted))center=[shifted.lat,shifted.lng??shifted.lon];
   }
  }catch(_){center=[point.lat,point.lon];}
  const far=lastCameraPoint?meters(lastCameraPoint,point)>200:false;
  lastCameraPoint=point;
  try{
   const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
   m.setView(center,zoom,{animate:!immediate&&!far&&!reduced,pan:{duration:.75}});
   return true;
  }catch(_){return false;}
 }
 function setRoute(route){
  const coords=route?.geometry?.coordinates||route;
  if(!Array.isArray(coords)||coords.length<2||coords.some(p=>!Array.isArray(p)||
      p.length<2||!goodPoint({lat:p[1],lon:p[0]})))return false;
  geometry=coords.map(p=>[Number(p[0]),Number(p[1])]);
  lastProjection=null;lastAlong=0;
  if(active){
   if(!drawRoute())return false;
   if(passedLayer)try{passedLayer.setLatLngs([])}catch(_){}
   if(remainingLayer)try{remainingLayer.setLatLngs(geometry.map(p=>[p[1],p[0]]))}catch(_){}
  }
  return true;
 }
 function begin(route,settings={}){
  stop();
  if(!setRoute(route))return false;
  active=true;following=settings.follow!==false;
  drawRoute();
  return true;
 }
 function update(pos){
  if(!active)return false;
  const coords=pos?.coords;
  if(!coords||typeof coords.latitude!=='number'||typeof coords.longitude!=='number')return false;
  const p=pointLatLon(coords),accuracy=Number(coords.accuracy);
  if(!goodPoint(p)||!Number.isFinite(accuracy)||accuracy<0||accuracy>150)return false;
  const now=Date.now();
  const heading=updateHeading(p,coords,previous,direction);
  // No synthetic movement: recorded track comes only from GPS callbacks.
  direction=heading;
  const moved=previous?meters(previous.point,p):Infinity;
  if(!previous||moved>=Math.max(3,accuracy*.75)){
   previous={point:p,accuracy,at:now};
  }
  latestPoint=p;
  if(!remainingLayer)drawRoute();
  paintPosition(p);
  if(geometry.length>=2){
   const projected=projection(p,geometry);
   if(projected)redrawProgress(projected);
  }
  moveCamera(p,!lastCameraPoint);
  return true;
 }
 function setFollowing(value){
  following=!!value;
  const recenter=document.getElementById('hgFollowRecenter');
  if(recenter)recenter.hidden=following;
  if(following&&latestPoint){lastFrameAt=0;moveCamera(latestPoint,true)}
  return following;
 }
 function stop(){
  active=false;
  clearOverlay();
  geometry=[];mapRef=null;previous=null;direction={degrees:null,source:'unknown'};
  displayHeading=null;latestPoint=null;lastFrameAt=0;lastCameraPoint=null;
  lastProjection=null;lastAlong=0;following=true;
  const recenter=document.getElementById('hgFollowRecenter');if(recenter)recenter.hidden=true;
 }
 function status(){
  return {active,following,hasGPS:!!latestPoint,
   heading:direction.degrees,headingSource:direction.source,
   progressMeters:lastAlong,routePoints:geometry.length,
   position:latestPoint?{lat:latestPoint.lat,lon:latestPoint.lon}:null};
 }
 window.HealthGoNavigationFollow={
  begin,setRoute,update,stop,setFollowing,status,
  projectOnRoute:projection,splitRoute,bearing,updateHeading
 };
})();
