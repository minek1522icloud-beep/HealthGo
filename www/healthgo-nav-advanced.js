/* HealthGo Navigation Pro HUD v2.
 * OSRM for maneuvers/lane metadata, GPS from existing MapPro, opt-in OSM maxspeed.
 * Never invent road lanes, speed limits, incidents, traffic or directions.
 * Speed-limit lookup sends approximate position to Overpass ONLY when user enables it.
 */
(function(w){
 'use strict';
 const $=id=>document.getElementById(id);
 const clean=x=>String(x??'').trim().replace(/\s+/g,' ').slice(0,85);
 let active=false,route=null,steps=[],startedAt=0,lastPos=null,arrived=false,summary=null,sessionStats={maxSpeed:null,gpsDistance:0,readings:0,last:null};
 let minimal=false,limitsEnabled=false,limitLastAt=0,limitLastPos=null,limitRequest=null,limitDisplay=null,limitStatus='',limitNonce=0,lastLane='',lastStep=-1,weatherInfo=null,mode='3d';
 let currentStreet='',nextStreet='',lastDistance=null,heading=null;
 const key=(name)=>{const user=String(w.HealthGoServices?.state?.uid||'').trim();return user?'healthgo.nav.advanced.'+name+'.'+user:null;};
 const getPref=(name)=>{const k=key(name);try{return k?localStorage.getItem(k)==='1':false}catch(_){return false}};
 const setPref=(name,yes)=>{const k=key(name);if(k)try{localStorage.setItem(k,yes?'1':'0')}catch(_){}};
 const norm=x=>clean(x).toLocaleLowerCase('pl').replace(/[^\p{L}0-9]/gu,'');
 const deg=Math.PI/180;
 function distance(a,b){
  if(!a||!b)return Infinity;
  const dy=(b.lat-a.lat)*deg,dx=(b.lon-a.lon)*deg;
  const h=Math.sin(dy/2)**2+Math.cos(a.lat*deg)*Math.cos(b.lat*deg)*Math.sin(dx/2)**2;
  return 12742000*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
 }
 function pointToSegment(p,a,b){
  const latScale=111320,lonScale=Math.max(.2,Math.cos(p.lat*deg))*111320;
  const ax=(a.lon-p.lon)*lonScale,ay=(a.lat-p.lat)*latScale;
  const bx=(b.lon-p.lon)*lonScale,by=(b.lat-p.lat)*latScale;
  const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len)):0;
  return Math.hypot(ax+t*dx,ay+t*dy);
 }
 function speedLimitValue(raw){
  if(typeof raw!=='string'&&typeof raw!=='number')return null;
  const s=String(raw).trim();
  // Exclude conditional, advisory, seasonal, jurisdictional and unit-ambiguous values.
  const m=/^(\d{1,3})(?:\s*km\/h)?$/i.exec(s);
  const n=m?Number(m[1]):NaN;
  return Number.isInteger(n)&&n>=5&&n<=140?n:null;
 }
 function matchMaxspeed(data,position,road){
  const name=norm(road);
  if(!name||!position||!Array.isArray(data?.elements))return null;
  const candidates=[];
  for(const way of data.elements.slice(0,45)){
   if(way?.type!=='way')continue;
   const n=speedLimitValue(way.tags?.maxspeed);
   if(!n||norm(way.tags?.name)!==name)continue;
   const geo=way.geometry;
   if(!Array.isArray(geo)||geo.length<2||geo.length>300)continue;
   let nearest=Infinity;
   for(let i=1;i<geo.length;i++){
    const a={lat:Number(geo[i-1].lat),lon:Number(geo[i-1].lon)};
    const b={lat:Number(geo[i].lat),lon:Number(geo[i].lon)};
    if(!Number.isFinite(a.lat)||!Number.isFinite(a.lon)||!Number.isFinite(b.lat)||!Number.isFinite(b.lon))continue;
    nearest=Math.min(nearest,pointToSegment(position,a,b));
   }
   if(nearest<=18)candidates.push({n,distance:nearest});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  // Parallel or crossing roads can report conflicting limits. Never guess.
  if(!candidates.length)return null;
  const local=candidates.filter(x=>x.distance-candidates[0].distance<7);
  if(new Set(local.map(x=>x.n)).size!==1)return null;
  return {kmh:local[0].n,meters:Math.round(local[0].distance)};
 }
 function laneInfo(step){
  const junction=(Array.isArray(step?.intersections)?step.intersections:[]).find(i=>
   Array.isArray(i.lanes)&&i.lanes.length>=2&&i.lanes.some(l=>typeof l.valid==='boolean'));
  if(!junction)return null;
  const directions={left:'↰',slight_left:'↖',sharp_left:'↰',straight:'↑',right:'↱',slight_right:'↗',
   sharp_right:'↱',uturn:'↶'};
  const laneRows=junction.lanes.slice(0,7).map(l=>{
   const raw=Array.isArray(l.indications)?l.indications:[];
   const indicators=[...new Set(raw.map(x=>directions[String(x).replace(/-/g,'_')]).filter(Boolean))];
   return {arrow:indicators.join(' ')||'│',valid:l.valid===true,known:typeof l.valid==='boolean'};
  });
  if(laneRows.some(x=>!x.known)||!laneRows.some(x=>x.valid))return null;
  return laneRows;
 }
 function safeText(id,content){const node=$(id);if(node)node.textContent=content;}
 function visible(id,flag){const n=$(id);if(n)n.hidden=!flag;}
 function updateMode(modeName){mode=modeName==='2d'?'2d':'3d';}
 function renderLanes(list){
  const root=$('hgNavLaneAssistant');if(!root)return;
  root.replaceChildren();
  if(!list||minimal){root.hidden=true;return;}
  const title=document.createElement('small');title.textContent='Pasy wg danych trasy · obserwuj znaki na drodze';
  root.appendChild(title);
  const lanes=document.createElement('div');lanes.className='hgna-lanes';
  for(const lane of list){
   const block=document.createElement('span');block.className='hgna-lane'+(lane.valid?' valid':'');
   block.textContent=lane.arrow;block.setAttribute('aria-label',lane.valid?'Pas oznaczony jako możliwy':'Inny pas');
   lanes.appendChild(block);
  }
  root.appendChild(lanes);root.hidden=false;
 }
 function updateRoads(index){
  const last=steps[Math.max(0,index-1)];
  const next=steps[index];
  currentStreet=clean(last?.name);
  nextStreet=clean(next?.name);
  const copy=[$('hgNavCurrentRoad'),$('hgNavNextRoad')];
  if(copy[0])copy[0].textContent=currentStreet||'Brak nazwy ulicy w danych trasy';
  if(copy[1])copy[1].textContent=nextStreet||'Brak nazwy kolejnej ulicy';
 }
 function writeLimit(){
  const text=$('hgNavSpeedLimit'),hint=$('hgNavLimitHint');
  if(text)text.textContent=limitsEnabled&&limitDisplay?String(limitDisplay.kmh):'—';
  if(hint)hint.textContent=limitsEnabled
   ?(limitDisplay?'OSM · '+limitDisplay.meters+' m od oznaczonej drogi':limitStatus||'Brak potwierdzonych danych OSM')
   :'Włącz dobrowolne sprawdzanie limitów OSM w opcjach';
  const button=$('hgNavLimitEnable');
  if(button){button.textContent=limitsEnabled?'Limity OSM: włączone':'Sprawdzaj limity OSM';button.setAttribute('aria-pressed',String(limitsEnabled));}
 }
 function setLimits(enabled){
  limitsEnabled=!!enabled;setPref('limits',limitsEnabled);limitLastAt=0;limitLastPos=null;limitDisplay=null;limitStatus='';
  if(!limitsEnabled&&limitRequest){limitRequest.abort();limitRequest=null;}
  writeLimit();
  if(limitsEnabled&&active&&lastPos)void fetchLimit(lastPos,currentStreet);
  return limitsEnabled;
 }
 async function fetchLimit(pos,road){
  if(!active||!limitsEnabled||!pos||!norm(road)||!w.fetch||typeof AbortController==='undefined')return;
  if(limitRequest)return;
  const now=Date.now();
  if(now-limitLastAt<150000&&(limitLastPos&&distance(limitLastPos,pos)<350))return;
  limitLastAt=now;limitLastPos={...pos};
  limitDisplay=null;limitStatus='Weryfikacja oznaczeń drogi OSM…';writeLimit();
  const controller=new AbortController();limitRequest=controller;const nonce=++limitNonce;
  const lat=pos.lat,lon=pos.lon;
  // Limited 90m viewport; Overpass is not queried in the background without opt-in.
  const d=.0008,dlon=d/Math.max(.35,Math.cos(lat*deg));
  const box=[lat-d,lon-dlon,lat+d,lon+dlon].map(x=>x.toFixed(5)).join(',');
  const query='[out:json][timeout:10];way["highway"]["maxspeed"]('+box+');out geom 45;';
  const timer=setTimeout(()=>controller.abort(),11000);
  try{
   const res=await w.fetch('https://overpass-api.de/api/interpreter',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'data='+encodeURIComponent(query),signal:controller.signal
   });
   if(!res.ok)throw new Error('HTTP');
   const parsed=await res.json();
   if(!active||!limitsEnabled||nonce!==limitNonce||controller!==limitRequest)return;
   limitDisplay=matchMaxspeed(parsed,pos,road);
   limitStatus=limitDisplay?'':'Brak pewnego dopasowania prędkości do ulicy';
   writeLimit();
  }catch(_){
   if(controller===limitRequest&&active&&limitsEnabled){
    limitDisplay=null;limitStatus='Brak danych OSM (serwer niedostępny)';writeLimit();
   }
  }finally{clearTimeout(timer);if(limitRequest===controller)limitRequest=null}
 }
 function onRoute(value){
  route=value||null;steps=Array.isArray(route?.steps)?route.steps:[];
  lastStep=-1;lastDistance=null;limitDisplay=null;limitLastAt=0;renderLanes(null);writeLimit();
 }
 function onStart(value){
  active=true;arrived=false;startedAt=Date.now();lastPos=null;summary=null;
  sessionStats={maxSpeed:null,gpsDistance:0,readings:0,last:null};
  minimal=getPref('minimal');limitsEnabled=getPref('limits');
  onRoute(value);
  document.body?.classList?.toggle('hg-nav-minimal',minimal);
  visible('hgNavAdvancedTools',true);
  visible('hgNavStreetChip',true);
  visible('hgNavArrivalSummary',false);
  updateControls();
 }
 function onGPS(detail){
  if(!active||!detail||!Number.isFinite(detail.accuracy)||detail.accuracy>100)return;
  const pos=detail.position;
  if(!pos||!Number.isFinite(pos.lat)||!Number.isFinite(pos.lon))return;
  lastPos={lat:pos.lat,lon:pos.lon};
  if(Number.isFinite(detail.heading)&&detail.heading>=0&&detail.heading<360)heading=detail.heading;
  safeText('hgNavCompassBearing',Number.isFinite(heading)?Math.round((360-heading)%360)+'° N':'N');
  const speed=Number.isFinite(detail.speed)&&detail.speed>=0?detail.speed*3.6:null;
  if(speed!==null)sessionStats.maxSpeed=Math.max(sessionStats.maxSpeed??0,speed);
  const prev=sessionStats.last;
  // Conservative GPS distance: ignore jumps/noisy fixes and reject unrealistic speed.
  if(prev&&detail.accuracy<=35&&prev.accuracy<=35){
   const d=distance(prev,lastPos),elapsed=(Date.now()-prev.at)/1000;
   if(elapsed>=.5&&d>1&&d/Math.max(elapsed,1)<34&&d<450)sessionStats.gpsDistance+=d;
  }
  sessionStats.last={...lastPos,accuracy:detail.accuracy,at:Date.now()};
  sessionStats.readings++;
  const nextStep=Math.max(0,Math.min(steps.length-1,Number(detail.stepIndex)||0));
  if(nextStep!==lastStep){lastStep=nextStep;updateRoads(nextStep);renderLanes(laneInfo(steps[nextStep]));limitDisplay=null;limitLastAt=0;}
  lastDistance=Number(detail.distanceTo);
  const sign=$('hgNavCurrentRoad');if(sign)sign.hidden=minimal;
  const lane=$('hgNavLaneAssistant');if(lane&&minimal)lane.hidden=true;
  writeLimit();
  const showSpeed=$('hgNavCurrentSpeed');if(showSpeed)showSpeed.textContent=speed===null?'—':String(Math.round(speed));
  const rel=$('hgNavUpcomingRoad');if(rel)rel.textContent=nextStreet||'Nawigacja GPS';
  if(limitsEnabled)void fetchLimit(lastPos,currentStreet);
  w.HealthGoNavigationLive?.setApproach?.(lastDistance);
 }
 function setWeather(weather){
  if(!active||!weather)return;
  weatherInfo=weather;
  const n=$('hgNavWeatherRisk'),temp=$('hgNavCompactWeather');
  const degc=Number(weather.temp),rain=Number(weather.rain),wind=Number(weather.wind);
  if(temp&&Number.isFinite(degc))temp.textContent=Math.round(degc)+'°C';
  if(n){
   const risks=[];
   if(Number.isFinite(rain)&&rain>=2)risks.push('Opady '+rain.toFixed(1)+' mm');
   if(Number.isFinite(wind)&&wind>=45)risks.push('Silniejszy wiatr '+Math.round(wind)+' km/h');
   n.textContent=risks.length?'Warunki pogodowe przy bieżącej pozycji: '+risks.join(' · '):'';
   n.hidden=!risks.length||minimal;
  }
 }
 function updateControls(){
  const button=$('hgNavMinimal');
  if(button){button.setAttribute('aria-pressed',String(minimal));button.textContent=minimal?'Pokaż dodatki':'Tryb minimalistyczny';}
  document.body?.classList?.toggle('hg-nav-minimal',active&&minimal);
  visible('hgNavWeatherRisk',active&&!minimal&&!!$('hgNavWeatherRisk')?.textContent);
  visible('hgNavStreetChip',active&&!minimal);
  visible('hgNavAdvancedTools',active&&!minimal);
  if(active&&minimal)renderLanes(null);
  else if(active)renderLanes(laneInfo(steps[lastStep]));
  writeLimit();
 }
 function setMinimal(next){
  minimal=!!next;setPref('minimal',minimal);updateControls();return minimal;
 }
 function showOverview(){
  if(!active||!route)return false;
  const ok=w.HealthGoNavigationLive?.overview?.()||w.HealthGoNavigationFollow?.showEntireRoute?.()||false;
  if(!ok){
   const map=w.healthGoMapInstance?.();
   const coords=route?.geometry;
   if(typeof L!=='undefined'&&map&&Array.isArray(coords)&&coords.length>1){
    const bounds=L.latLngBounds(coords.map(x=>[x[1],x[0]]));
    map.fitBounds?.(bounds,{padding:[42,42],maxZoom:16});
   }
  }
  safeText('hgNavControlStatus','Podgląd trasy. Dotknij „Śledź GPS”, aby wrócić za strzałką.');
  return true;
 }
 function follow(){
  w.HealthGoNavigationLive?.recenter?.();
  w.HealthGoMapPro?.resumeFollow?.();
  safeText('hgNavControlStatus','Kamera ponownie śledzi pozycję GPS.');
 }
 function north(){
  w.HealthGoNavigationLive?.orientNorth?.();
  safeText('hgNavControlStatus','Kamera wskazuje północ. Aby ponownie śledzić kierunek, użyj „Śledź GPS”.');
 }
 function repeat(){
  if(!active)return;
  w.HealthGoMapPro?.repeatInstruction?.();
 }
 function summarize(routeOverride){
  if(arrived)return;
  arrived=true;
  const elapsed=Math.max(0,Date.now()-startedAt),dateM=Math.round(elapsed/60000);
  const routeM=routeOverride?.meters||route?.meters||0;
  const title=$('hgNavSummaryTitle'),tim=$('hgNavSummaryTime'),len=$('hgNavSummaryDistance');
  if(title)title.textContent='Dotarłeś do celu';
  if(tim)tim.textContent=dateM+' min';
  if(len)len.textContent=routeM>=1000?(routeM/1000).toFixed(1).replace('.',',')+' km':Math.round(routeM)+' m';
  visible('hgNavArrivalSummary',true);
 }
 function stop(){
  active=false;
  if(limitRequest){limitRequest.abort();limitRequest=null}limitNonce++;
  lastPos=null;lastStep=-1;lastDistance=null;limitDisplay=null;heading=null;
  route=null;steps=[];limitLastAt=0;limitLastPos=null;weatherInfo=null;sessionStats.last=null;
  document.body?.classList?.remove('hg-nav-minimal');
  visible('hgNavAdvancedTools',false);visible('hgNavStreetChip',false);renderLanes(null);
  writeLimit();
 }
 const box=$('hgProNavigation');
 box?.addEventListener?.('click',e=>{
  const btn=e.target?.closest?.('[data-hgna]');
  if(!btn)return;
  const action=btn.dataset.hgna;
  if(action==='limits')setLimits(!limitsEnabled);
  else if(action==='minimal')setMinimal(!minimal);
  else if(action==='overview')showOverview();
  else if(action==='follow')follow();
  else if(action==='north')north();
  else if(action==='repeat')repeat();
  else if(action==='arrival-close')visible('hgNavArrivalSummary',false);
 });
 // The arrival overlay persists after the HUD hides; close it independently.
 $('hgNavArrivalSummary')?.addEventListener?.('click',e=>{
  if(e.target?.closest?.('[data-hgna-close-arrival]'))visible('hgNavArrivalSummary',false);
 });
 const api=Object.freeze({
  start:onStart,route:onRoute,gps:onGPS,weather:setWeather,arrived:summarize,stop,
  lanes:laneInfo,speedLimitValue,matchMaxspeed,setLimits,setMinimal,showOverview,
  follow,north,repeat,getState:()=>({active,minimal,limitsEnabled,currentStreet,nextStreet,limitDisplay,arrived})
 });
 w.HealthGoNavAdvanced=api;
})(window);