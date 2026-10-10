/* HealthGo Map 4.0: live Open-Meteo weather, on-demand OSM works, route bookmarks.
 * No weather/rain radar simulation, traffic speed data or location upload on startup.
 */
(function(){
 'use strict';
 const el=id=>document.getElementById(id);
 const map=()=>typeof healthGoMap==='undefined'?null:healthGoMap;
 const valid=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
 const label=(id,s)=>{const e=el(id);if(e)e.textContent=String(s)};
 const clean=s=>String(s||'').trim().slice(0,180);
 const currentUser=()=>String(window.HealthGoServices?.state?.uid||'');
 let worksLayer=null,weatherController=null,worksController=null,lastWorksAt=0;
 let activeWeather=null,activeWeatherAt=0,selectedWeatherCity=null;
 const isNumber=v=>typeof v==='number'&&Number.isFinite(v);
 const fmtValue=(v,u='')=>isNumber(v)?Math.round(v)+u:'—';
 const settingDefaults={theme:'auto',voice:true,follow:true,avoidMotorways:false,mode:'car'};
 function storeName(suffix){const uid=currentUser();return uid?'healthgo.map4.'+suffix+'.'+uid:null}
 function load(key,fallback){try{const k=storeName(key);return k?JSON.parse(localStorage.getItem(k)||'null')??fallback:fallback}catch(_){return fallback}}
 function store(key,data){const k=storeName(key);if(!k)return false;try{localStorage.setItem(k,JSON.stringify(data));return true}catch(_){return false}}
 function getSettings(){return {...settingDefaults,...load('settings',{})}}
 function saveSettings(changes){
  const next={...getSettings(),...changes};
  if(!['auto','light','dark'].includes(next.theme))next.theme='auto';
  if(!['car','foot','bike'].includes(next.mode))next.mode='car';
  next.voice=!!next.voice;next.follow=!!next.follow;next.avoidMotorways=!!next.avoidMotorways;
  if(!store('settings',next)){label('hg4SettingsNote','Zaloguj się, aby zapisywać ustawienia na tym telefonie.');return false}
  label('hg4SettingsNote','Ustawienia zapisane na tym telefonie.');
  return true;
 }
 function settingsChanged(){
  const theme=el('hg4Theme')?.value,mode=el('hg4DefaultMode')?.value;
  const changes={theme,mode,voice:!!el('hg4Voice')?.checked,follow:!!el('hg4Follow')?.checked,
   avoidMotorways:!!el('hg4AvoidMotorways')?.checked};
  saveSettings(changes);
  window.HealthGoMapV2?.chooseMode?.(mode);
 }
 function renderSettings(){
  const p=getSettings();
  if(el('hg4Theme'))el('hg4Theme').value=p.theme;
  if(el('hg4DefaultMode'))el('hg4DefaultMode').value=p.mode;
  if(el('hg4Voice'))el('hg4Voice').checked=p.voice;
  if(el('hg4Follow'))el('hg4Follow').checked=p.follow;
  if(el('hg4AvoidMotorways'))el('hg4AvoidMotorways').checked=p.avoidMotorways;
 }
 function weatherLabel(code){
  if(code===0)return ['Słonecznie','☀'];
  if([1,2,3].includes(code))return ['Częściowe zachmurzenie','⛅'];
  if([45,48].includes(code))return ['Mgła','☁'];
  if([51,53,55,56,57].includes(code))return ['Mżawka','☂'];
  if([61,63,65,66,67,80,81,82].includes(code))return ['Deszcz','☂'];
  if([71,73,75,77,85,86].includes(code))return ['Śnieg','❄'];
  if([95,96,99].includes(code))return ['Burza','⚡'];
  return ['Warunki zmienne','☁'];
 }
 function formatHour(iso){return String(iso||'').split('T')[1]?.slice(0,5)||'—'}
 function weatherPoint(){
  if(selectedWeatherCity&&valid(selectedWeatherCity))return selectedWeatherCity;
  // Use an already consented recent GPS fix when available; never trigger
  // an extra permission prompt just to look at the weather.
  const recent=window.HealthGoMapV2?.getRecentPosition?.(300000);
  if(recent&&valid(recent))return {lat:recent.lat,lon:recent.lon,source:'GPS'};
  const c=map()?.getCenter?.();
  return c&&valid({lat:c.lat,lon:c.lng})?{lat:c.lat,lon:c.lng,source:'mapa'}:null;
 }
 async function refreshWeather(){
  const p=weatherPoint(),root=el('hg4WeatherCurrent'),hours=el('hg4WeatherHours');
  if(!p){label('hg4WeatherStatus','Otwórz mapę i wybierz okolicę.');return false}
  if(!root||!hours)return false;
  if(weatherController)weatherController.abort();
  weatherController=new AbortController();
  const ctl=weatherController;
  label('hg4WeatherStatus','Pobieram aktualną pogodę dla środka mapy…');
  const params=new URLSearchParams({
   latitude:String(p.lat.toFixed(4)),longitude:String(p.lon.toFixed(4)),
   current:'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure,weather_code',
   hourly:'temperature_2m,precipitation_probability,weather_code,uv_index',
   daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset,uv_index_max',
   forecast_days:'7',timezone:'auto'
  });
  const timeout=setTimeout(()=>ctl.abort(),14000);
  try{
   const response=await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal:ctl.signal});
   if(!response.ok)throw Error('WEATHER_HTTP_'+response.status);
   const json=await response.json();
   if(ctl!==weatherController)return false;
   const cur=json?.current;
   if(!cur||!isNumber(cur.temperature_2m))throw Error('WEATHER_DATA');
   activeWeather=json;activeWeatherAt=Date.now();
   const [desc,symbol]=weatherLabel(Number(cur.weather_code));
   root.replaceChildren();
   const heading=document.createElement('div');heading.className='hg4-weather-summary';
   const icon=document.createElement('span');icon.className='hg4-weather-icon';icon.textContent=symbol;heading.appendChild(icon);
   const details=document.createElement('div');
   const temp=document.createElement('strong');temp.textContent=fmtValue(cur.temperature_2m,'°C');details.appendChild(temp);
   const condition=document.createElement('span');condition.textContent=desc;details.appendChild(condition);
   heading.appendChild(details);root.appendChild(heading);
   const where=document.createElement('p');where.className='hg5-weather-location';
   where.textContent=p.source==='miasto'?(p.name||'Wybrane miasto'):p.source==='GPS'?'Twoja okolica — GPS':'Środek widocznej mapy';
   root.appendChild(where);
   const meta=document.createElement('p');meta.className='map-v2-muted';
   meta.textContent='Odczuwalna: '+fmtValue(cur.apparent_temperature,'°C')+' · Opady: '+(isNumber(cur.precipitation)?cur.precipitation.toFixed(1)+' mm':'—');
   root.appendChild(meta);
   const detailGrid=el('hg5WeatherDetails');
   if(detailGrid){
    detailGrid.replaceChildren();
    function cell(name,value,note){
     const card=document.createElement('div');card.className='hg5-weather-stat';
     const label=document.createElement('span');label.textContent=name;card.appendChild(label);
     const val=document.createElement('strong');val.textContent=value;card.appendChild(val);
     if(note){const small=document.createElement('small');small.textContent=note;card.appendChild(small)}
     detailGrid.appendChild(card);
    }
    const wind=isNumber(cur.wind_direction_10m)?['N','NE','E','SE','S','SW','W','NW'][Math.round((cur.wind_direction_10m+360)%360/45)%8]:'—';
    cell('Wiatr',fmtValue(cur.wind_speed_10m,' km/h'),wind);
    cell('Wilgotność',fmtValue(cur.relative_humidity_2m,'%'));
    cell('Ciśnienie',fmtValue(cur.surface_pressure,' hPa'));
    const uv=json.daily?.uv_index_max?.[0];
    cell('UV dzisiaj (maks.)',isNumber(uv)?String(Math.round(uv*10)/10).replace('.',','):'—','Prognoza modelowa');
    const sun=raw=>String(raw||'').split('T')[1]?.slice(0,5)||'—';
    cell('Wschód słońca',sun(json.daily?.sunrise?.[0]));
    cell('Zachód słońca',sun(json.daily?.sunset?.[0]));
   }
   hours.replaceChildren();
   const times=json.hourly?.time||[],rain=json.hourly?.precipitation_probability||[],temps=json.hourly?.temperature_2m||[],codes=json.hourly?.weather_code||[];
   const start=times.findIndex(time=>String(time)>=String(cur.time||'').slice(0,13));
   for(let j=Math.max(0,start);j<Math.min(times.length,Math.max(0,start)+12);j++){
    const item=document.createElement('div');item.className='hg4-hour';
    const time=document.createElement('b');time.textContent=formatHour(times[j]);item.appendChild(time);
    const symbol=document.createElement('span');symbol.className='hg5-hour-icon';
    symbol.textContent=isNumber(codes[j])?weatherLabel(codes[j])[1]:'☁';item.appendChild(symbol);
    const deg=document.createElement('span');deg.textContent=fmtValue(temps[j],'°C');item.appendChild(deg);
    const prob=document.createElement('small');prob.textContent='Opady '+fmtValue(rain[j],'%');item.appendChild(prob);
    hours.appendChild(item);
   }
   const days=el('hg4WeatherDaily');
   if(days){
    days.replaceChildren();
    const d=json.daily||{},dates=d.time||[],high=d.temperature_2m_max||[],low=d.temperature_2m_min||[],rainDays=d.precipitation_probability_max||[],dayCodes=d.weather_code||[];
    for(let i=0;i<Math.min(7,dates.length);i++){
     // Show unavailable values as dashes rather than pretending missing data are zero.
     const row=document.createElement('div');row.className='hg4-day';
     const date=document.createElement('b');
     const dateObj=new Date(String(dates[i])+'T12:00:00');
     date.textContent=Number.isNaN(dateObj.getTime())?'—':dateObj.toLocaleDateString('pl-PL',{weekday:'short',day:'numeric',month:'short'});
     row.appendChild(date);
     const symbol=document.createElement('span');symbol.className='hg5-day-icon';
     symbol.textContent=isNumber(dayCodes[i])?weatherLabel(dayCodes[i])[1]:'—';row.appendChild(symbol);
     const temp=document.createElement('span');temp.textContent=fmtValue(high[i],'°')+' / '+fmtValue(low[i],'°');row.appendChild(temp);
     const chance=document.createElement('small');chance.textContent='Opady '+fmtValue(rainDays[i],'%');row.appendChild(chance);
     days.appendChild(row);
    }
   }
   label('hg4WeatherStatus','Open-Meteo · '+(p.source==='GPS'?'zatwierdzony GPS':p.source==='miasto'?'wybrane miasto':'środek mapy')+' · prognoza na '+String(cur.time||'—').replace('T',' ')+' · pobrano teraz.');
   return true;
  }catch(e){
   if(ctl!==weatherController)return false;
   label('hg4WeatherStatus','Nie udało się pobrać pogody. Sprawdź internet i spróbuj ponownie.');
   return false;
  }finally{clearTimeout(timeout);if(weatherController===ctl)weatherController=null}
 }

 async function searchWeatherCity(){
  const query=clean(el('hg5WeatherCity')?.value,90);
  if(!query){label('hg4WeatherStatus','Wpisz miasto lub miejscowość.');return false}
  label('hg4WeatherStatus','Szukam miejscowości…');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
  try{
   const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(query);
   const response=await fetch(url,{signal:ctl.signal,headers:{Accept:'application/json'}});
   if(!response.ok)throw Error('CITY_UNAVAILABLE');
   const rows=await response.json(),match=Array.isArray(rows)?rows[0]:null;
   const point=match?{lat:Number(match.lat),lon:Number(match.lon),source:'miasto',name:clean(match.display_name||query,90)}:null;
   if(!point||!valid(point))throw Error('CITY_NOT_FOUND');
   selectedWeatherCity=point;
   return await refreshWeather();
  }catch(e){
   label('hg4WeatherStatus',String(e?.message)==='CITY_NOT_FOUND'?'Nie znaleziono miasta — podaj dokładniejszą nazwę.':'Wyszukiwanie miasta jest chwilowo niedostępne. Spróbuj ponownie.');
   return false;
  }finally{clearTimeout(timer)}
 }
 function resetWeatherCity(){
  selectedWeatherCity=null;const input=el('hg5WeatherCity');if(input)input.value='';
  return refreshWeather();
 }
 function boundsNearCenter(){
  const c=map()?.getCenter?.();
  if(!c||!valid({lat:c.lat,lon:c.lng}))return null;
  const delta=0.025;
  return [c.lat-delta,c.lng-delta,c.lat+delta,c.lng+delta].map(x=>Number(x).toFixed(5)).join(',');
 }
 function clearWorks(){
  if(worksController){worksController.abort();worksController=null}
  if(worksLayer&&map())try{map().removeLayer(worksLayer)}catch(_){}
  worksLayer=null;
  label('hg4WorksStatus','Warstwa remontów wyłączona.');
 }
 async function refreshWorks(){
  if(Date.now()-lastWorksAt<30000){label('hg4WorksStatus','Odczekaj chwilę przed kolejnym sprawdzeniem remontów.');return false}
  const bbox=boundsNearCenter();
  if(!bbox||typeof L==='undefined'){label('hg4WorksStatus','Otwórz mapę, aby sprawdzić oznaczone remonty.');return false}
  lastWorksAt=Date.now();
  if(worksController)worksController.abort();
  const ctl=new AbortController();worksController=ctl;
  label('hg4WorksStatus','Sprawdzam oznaczone remonty dróg w OpenStreetMap…');
  const query='[out:json][timeout:15];(way["highway"="construction"]('+bbox+');way["construction"]["highway"]('+bbox+'););out geom 35;';
  const timer=setTimeout(()=>ctl.abort(),18000);
  try{
   const res=await fetch('https://overpass-api.de/api/interpreter',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'data='+encodeURIComponent(query),signal:ctl.signal
   });
   if(!res.ok)throw Error('OVERPASS_'+res.status);
   const data=await res.json();
   if(ctl!==worksController)return false;
   if(worksLayer&&map())map().removeLayer(worksLayer);
   worksLayer=L.layerGroup().addTo(map());
   let count=0;
   for(const way of (data.elements||[]).slice(0,35)){
    const coords=(way.geometry||[]).map(p=>[Number(p.lat),Number(p.lon)]).filter(p=>p.every(Number.isFinite));
    if(coords.length<2)continue;
    const poly=L.polyline(coords,{color:'#e78a36',weight:5,opacity:.85}).addTo(worksLayer);
    poly.bindPopup?.('Remont oznaczony w OpenStreetMap'+(way.tags?.name?' — '+String(way.tags.name).slice(0,80):''));
    count++;
   }
   label('hg4WorksStatus',count?
    'Znaleziono '+count+' oznaczonych remontów. Dane społeczności OSM mogą być nieaktualne — to NIE są korki na żywo.':
    'Brak oznaczonych remontów w tej okolicy. To nie oznacza, że ruch jest płynny.');
   return true;
  }catch(_){
   if(ctl===worksController)label('hg4WorksStatus','Serwer danych OSM jest niedostępny. Spróbuj później.');
   return false;
  }finally{clearTimeout(timer);if(worksController===ctl)worksController=null}
 }
 function savedRoutes(){return load('routes',[]).filter(r=>r&&typeof r.to==='string')}
 function saveCurrentRoute(){
  const start=clean(el('mapV2RouteFrom')?.value),to=clean(el('mapV2RouteTo')?.value);
  const mode=el('hg4DefaultMode')?.value||getSettings().mode;
  if(!to){label('hg4SavedStatus','Najpierw wpisz cel w Nawigacji.');return false}
  if(!currentUser()){label('hg4SavedStatus','Zaloguj się, aby zapisywać trasy na telefonie.');return false}
  const rows=savedRoutes();const record={from:start,to,mode};
  const key=JSON.stringify(record);
  const filtered=rows.filter(r=>JSON.stringify(r)!==key);
  const ok=store('routes',[record,...filtered].slice(0,25));
  label('hg4SavedStatus',ok?'Zapisano plan trasy — bez współrzędnych GPS.':'Nie można zapisać tej trasy.');
  drawRoutes();return ok;
 }
 function drawRoutes(){
  const root=el('hg4SavedRoutes');if(!root)return;
  root.replaceChildren();
  const routes=savedRoutes();
  if(!routes.length){const empty=document.createElement('p');empty.className='map-v2-muted';
   empty.textContent='Brak zapisanych tras. Otwórz Nawigację, wpisz cel i zapisz trasę.';root.appendChild(empty);return}
  routes.forEach((r,i)=>{
   const item=document.createElement('div');item.className='map-v2-item';
   const title=document.createElement('span');title.textContent=(r.from||'Moja lokalizacja')+' → '+r.to;item.appendChild(title);
   const buttons=document.createElement('div');buttons.className='map-v2-buttons';
   const open=document.createElement('button');open.type='button';open.textContent='Otwórz';open.addEventListener('click',()=>{
    if(el('mapV2RouteFrom'))el('mapV2RouteFrom').value=r.from||'';
    if(el('mapV2RouteTo'))el('mapV2RouteTo').value=r.to;
    window.HealthGoMapV2?.chooseMode?.(r.mode||'car');window.HealthGoMapV2?.toggle?.('route');
   });
   buttons.appendChild(open);
   const del=document.createElement('button');del.type='button';del.textContent='Usuń';del.addEventListener('click',()=>{
    const copy=savedRoutes();copy.splice(i,1);store('routes',copy);drawRoutes();
   });
   buttons.appendChild(del);item.appendChild(buttons);root.appendChild(item);
  });
 }
 function init(){renderSettings();window.HealthGoMapV2?.chooseMode?.(getSettings().mode)}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){weatherController?.abort();worksController?.abort();}});
 window.addEventListener('pagehide',()=>{weatherController?.abort();worksController?.abort()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.HealthGoMap4={getSettings,saveSettings,renderSettings,settingsChanged,refreshWeather,weatherLabel,searchWeatherCity,resetWeatherCity,
  refreshWorks,clearWorks,saveCurrentRoute,drawRoutes,savedRoutes};
})();
