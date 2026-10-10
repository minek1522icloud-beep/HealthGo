/* HealthGo START 3.0 — real account health metrics, weather and achievements.
 * The approved illustration is a design reference, not a source of sample data.
 * Reuses existing HealthGoServices/HealthGoEngine, leaves other pages intact.
 */
(function(){
 'use strict';
 const el=id=>document.getElementById(id);
 const Services=window.HealthGoServices;
 const Engine=window.HealthGoEngine;
 const start=el('start');
 if(!start || !Services || !Engine)return;
 const formatNumber=new Intl.NumberFormat('pl-PL',{maximumFractionDigits:0});
 const formatDistance=new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2});
 const names=['Pon','Wt','Śr','Czw','Pt','Sob','Nd'];
 const DAY=86400000;
 let chartRange='week';
 let weatherPending=false,weatherFetchedAt=0,weatherPointKey='',weatherController=null;
 let weatherStatus='unavailable';
 let goalCacheUid='',goalCacheValue=null;
 let scheduled=false;
 const icons=[
 '<svg aria-hidden="true" width="0" height="0" style="position:absolute;overflow:hidden" xmlns="http://www.w3.org/2000/svg">',
 '<symbol id="hgs-foot" viewBox="0 0 24 24"><path d="M8 18.5c-3-.5-5-3-5-6.5V9c0-1.5 1-2.5 2.5-2.5S8 7.5 8 9v3c0 2 1.5 3.5 3.5 4l1 .4M12.5 6.7c0-1.5 1-2.7 2.5-2.7S17.5 5.2 17.5 7c0 3-1.5 5.3-4 7M5 20.5h.01M8 22h.01" /></symbol>',
 '<symbol id="hgs-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21a2 2 0 0 0 4 0"/></symbol>',
 '<symbol id="hgs-calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></symbol>',
 '<symbol id="hgs-arrow" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol>',
 '<symbol id="hgs-dots" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></symbol>',
 '<symbol id="hgs-heart" viewBox="0 0 24 24"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></symbol>',
 '<symbol id="hgs-pin" viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></symbol>',
 '<symbol id="hgs-fire" viewBox="0 0 24 24"><path d="M12 22a8 8 0 0 0 8-8c0-4-2-6-4-8-.1 2.4-1.4 3.5-2 3.7C13 7 11 5 9 2 9 6 8 7 6 10c-1.3 1.9-2 3.4-2 5.1A8 8 0 0 0 12 22Z"/></symbol>',
 '<symbol id="hgs-star" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 7 1-5.1 5 1.2 7-6.2-3.3L5.8 21l1.2-7-5.1-5 7-1Z"/></symbol>',
 '<symbol id="hgs-chart" viewBox="0 0 24 24"><path d="M4 21V12m6 9V7m6 14V3m5 18V10"/></symbol>',
 '<symbol id="hgs-cloud" viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11-1.2A4.6 4.6 0 0 0 7 18Z"/></symbol>',
 '</svg>'
 ].join('');
 const icon=function(name,extra){
  return '<svg class="hgs-icon '+(extra||'')+'" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><use href="#hgs-'+name+'"></use></svg>';
 };
 const html=[
  icons,
  '<div class="hgs-header">',
   '<button type="button" id="hgsProfileButton" class="hgs-profile" aria-label="Otwórz profil">',
    '<span class="hgs-avatar" id="hgsAvatar">H</span>',
    '<span class="hgs-profile-name"><span>Cześć,</span><strong id="hgsName">HealthGo!</strong></span>',
   '</button>',
   '<button type="button" id="hgsNotifications" class="hgs-notification" aria-label="Powiadomienia">',
    icon('bell'),'<span class="hgs-unread" id="hgsUnread" hidden></span>',
   '</button>',
  '</div>',
  '<div class="hgs-brandrow">',
   '<div><h1 class="hgs-wordmark">Health<span>Go</span></h1><p class="hgs-tagline">Twój dzień</p><div class="hgs-underline"></div></div>',
   '<button type="button" id="hgsDateButton" class="hgs-date" aria-label="Przejdź do planu dnia">',icon('calendar','mint'),'<span id="hgsDate">Dzisiaj</span>',icon('arrow'),'</button>',
  '</div>',
  '<div class="hgs-topgrid">',
   '<article class="hgs-panel hgs-steps" aria-labelledby="hgsStepsTitle">',
    '<div class="hgs-panel-heading"><h2 id="hgsStepsTitle">',icon('foot','mint'),'Kroki dzisiaj</h2>',
    '<button type="button" id="hgsGoalButton" class="hgs-ghostbtn" aria-label="Ustaw własny cel kroków">',icon('dots'),'</button></div>',
    '<button type="button" id="hgsStepDetails" class="hgs-ring-button" aria-label="Zobacz szczegóły kroków">',
     '<span class="hgs-ring" id="hgsRing" role="img" aria-label="Brak danych o krokach">',
      '<span class="hgs-ring-center"><span class="hgs-shoe-icon">',icon('foot','mint'),'</span>',
       '<strong id="hgsSteps">Brak danych</strong><small>kroków</small>',
      '</span>',
     '</span>',
    '</button>',
    '<div class="hgs-ring-foot"><span id="hgsGoalLabel">Cel: nie ustawiono</span><span id="hgsStepPercent" class="hgs-pill">—</span></div>',
    '<p id="hgsSource" class="hgs-source">Połącz źródło danych, aby zobaczyć pomiary.</p>',
   '</article>',
   '<div class="hgs-metrics-stack">',
    '<button type="button" id="hgsCaloriesAction" class="hgs-metric" aria-label="Zobacz źródła danych kalorii">',
     '<span class="hgs-metric-copy"><span class="hgs-metric-label">',icon('fire'),'Kalorie</span><strong id="hgsCalories">—</strong><small id="hgsCaloriesSub">Brak danych</small></span>',
     '<span class="hgs-metric-orb">',icon('fire'),'</span>',
    '</button>',
    '<button type="button" id="hgsDistanceAction" class="hgs-metric" aria-label="Zobacz szczegóły dystansu">',
     '<span class="hgs-metric-copy"><span class="hgs-metric-label">',icon('pin','mint'),'Dystans</span><strong id="hgsDistance">Brak danych</strong><small id="hgsDistanceSub">Brak pomiaru</small></span>',
     '<span class="hgs-metric-orb">',icon('pin'),'</span>',
    '</button>',
    '<button type="button" id="hgsHeartAction" class="hgs-metric" aria-label="Zobacz pomiar tętna">',
     '<span class="hgs-metric-copy"><span class="hgs-metric-label">',icon('heart'),'Tętno</span><strong id="hgsHeart">Brak danych</strong><small id="hgsHeartSub">Brak pomiaru</small></span>',
     '<span class="hgs-metric-orb">',icon('heart'),'</span>',
    '</button>',
   '</div>',
  '</div>',
  '<div class="hgs-midgrid">',
   '<article class="hgs-panel hgs-weather" aria-labelledby="hgsWeatherTitle">',
    '<div class="hgs-panel-heading"><h2 id="hgsWeatherTitle">',icon('cloud'),'Pogoda</h2></div>',
    '<div class="hgs-weather-main"><div><strong class="hgs-weather-temp" id="hgsWeatherTemp">—°</strong><div class="hgs-weather-desc" id="hgsWeatherDesc">Wybierz lokalizację</div></div><span class="hgs-weather-sun" id="hgsWeatherIcon" aria-hidden="true">☀</span></div>',
    '<div class="hgs-weather-bottom"><span id="hgsWeatherPlace">Prognoza na żywo po Twojej zgodzie</span>',
     '<button type="button" class="hgs-weather-cta" id="hgsWeatherAction"><span id="hgsWeatherActionText">Sprawdź pogodę</span>',icon('arrow'),'</button>',
    '</div>',
   '</article>',
   '<article class="hgs-panel hgs-xp" aria-labelledby="hgsXpTitle">',
    '<div class="hgs-panel-heading"><h2 id="hgsXpTitle">',icon('star','gold'),'Twój poziom</h2></div>',
    '<div class="hgs-xp-main"><strong id="hgsLevel">Poziom —</strong><span class="hgs-xp-emblem">',icon('star'),'</span></div>',
    '<p id="hgsXpDetail" class="hgs-xp-detail">XP pojawi się po synchronizacji.</p>',
    '<div class="hgs-progress" id="hgsXpTrack" role="progressbar" aria-label="Postęp poziomu" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="hgsXpFill"></span></div>',
    '<button type="button" id="hgsXpAction" class="hgs-xp-cta">Otwórz XP i nagrody ',icon('arrow'),'</button>',
   '</article>',
  '</div>',
  '<section class="hgs-panel hgs-chart-panel" aria-labelledby="hgsChartTitle">',
   '<div class="hgs-chart-heading"><h2 id="hgsChartTitle">',icon('chart','mint'),'Twoja aktywność</h2>',
    '<select id="hgsChartRange" class="hgs-range" aria-label="Zakres wykresu kroków"><option value="week">Tydzień</option><option value="month">4 tygodnie</option></select>',
   '</div>',
   '<div class="hgs-chart" id="hgsChart" role="img" aria-label="Brak danych o krokach w tym okresie">',
     '<div class="hgs-axis"><span id="hgsAxisTop">—</span><span id="hgsAxisMid">—</span><span>0</span></div>',
     '<div class="hgs-bars" id="hgsBars" style="--hgs-count:7"></div>',
   '</div>',
   '<p class="hgs-chart-note" id="hgsChartNote">Wykres pokaże tylko otrzymane pomiary. Brakujące dni nie są zerami.</p>',
  '</section>',
  '<button type="button" id="hgsChallengeAction" class="hgs-challenge" aria-label="Otwórz wyzwania">',
   '<span class="hgs-challenge-medal" aria-hidden="true">🏆</span>',
   '<span class="hgs-challenge-copy"><small>Dzisiejsze wyzwanie</small><strong id="hgsChallengeTitle">Sprawdzanie wyzwań…</strong>',
    '<span class="hgs-challenge-foot"><span class="hgs-progress"><span id="hgsChallengeFill"></span></span><span class="hgs-challenge-numbers" id="hgsChallengeProgress">—</span></span>',
   '</span>',
   '<span class="hgs-arrow">',icon('arrow'),'</span>',
  '</button>',
  '<dialog id="hgsGoalDialog" class="hgs-goal-dialog" aria-labelledby="hgsGoalTitle">',
   '<form id="hgsGoalForm" novalidate><h2 id="hgsGoalTitle">Twój cel kroków</h2>',
    '<p>Cel jest opcjonalny. Możesz go zmienić albo usunąć w dowolnej chwili, bez żadnych kar.</p>',
    '<label for="hgsGoalInput">Liczba kroków</label><input id="hgsGoalInput" inputmode="numeric" type="number" min="100" max="20000" step="100" placeholder="Wpisz własny cel">',
    '<p class="hgs-error" id="hgsGoalError" role="alert"></p>',
    '<div class="hgs-dialog-actions"><button type="button" id="hgsGoalCancel">Anuluj</button><button type="button" id="hgsGoalClear">Usuń cel</button><button type="submit" class="primary">Zapisz</button></div>',
   '</form>',
  '</dialog>'
 ].join('');
 const root=document.createElement('div');
 root.id='hgStartV3';
 root.innerHTML=html;
 start.prepend(root);
 start.classList.add('hg-start-v3');

 function localDate(value){
  const d=value||new Date();
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
 }
 function dateFromOffset(days){
  const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()+days);
 }
 function currentHealth(state){
  if(!state||!state.uid)return null;
  const list=Array.isArray(state.healthDays)?state.healthDays:[];
  return list.find(x=>x && (x.day||x.id)===localDate())||null;
 }
 function number(value){return typeof value==='number' && Number.isFinite(value) && value>=0 ? value:null;}
 function fmt(value){return formatNumber.format(value);}
 function compact(value){
  if(value===null)return '—';
  if(value>=1000)return new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(value/1000)+'k';
  return fmt(value);
 }
 function currentGoal(){
  const uid=Services.state?.uid;
  if(!uid)return null;
  if(uid!==goalCacheUid){
   goalCacheUid=uid;goalCacheValue=null;
   try{
    const value=Number(localStorage.getItem('healthgo_start_steps_goal_v1_'+uid));
    if(Number.isInteger(value)&&value>=100&&value<=20000)goalCacheValue=value;
   }catch(_){}
  }
  return goalCacheValue;
 }
 function storeGoal(value){
  const uid=Services.state?.uid;
  if(!uid)return false;
  try{
   const key='healthgo_start_steps_goal_v1_'+uid;
   if(value===null)localStorage.removeItem(key);
   else localStorage.setItem(key,String(value));
   goalCacheUid=uid;goalCacheValue=value;
   return true;
  }catch(_){return false;}
 }
 function openPage(name){
  if(typeof window.go==='function')window.go(name);
 }
 function openWeatherPage(){
  openPage('map');
  setTimeout(function(){if(el('map')?.classList.contains('active'))window.HealthGoMapV2?.toggle?.('weather');},120);
 }
 function putText(id,value){const n=el(id);if(n)n.textContent=String(value);}
 function setProgress(id,pct){
  const n=el(id);if(n)n.style.setProperty('--hgs-progress',Math.max(0,Math.min(100,pct))+'%');
 }
 function renderIdentity(state){
  const name=String(state?.profile?.nickname||'HealthGo').trim().slice(0,30)||'HealthGo';
  putText('hgsName',name+'!');
  putText('hgsAvatar',name.charAt(0).toUpperCase());
  const unread=Array.isArray(state?.notifications)&&state.notifications.some(x=>x&&!x.read&&!x.readAt);
  el('hgsUnread').hidden=!unread;
  const now=new Date();
  putText('hgsDate',now.toLocaleDateString('pl-PL',{weekday:'short',day:'numeric',month:'short'}));
 }
 function renderSteps(state){
  const h=currentHealth(state),steps=h?number(h.steps):null;
  const goal=currentGoal();
  putText('hgsSteps',steps===null?'Brak danych':fmt(steps));
  putText('hgsGoalLabel',goal===null?'Cel: nie ustawiono':'Cel: '+fmt(goal));
  const percent=goal!==null&&steps!==null?Math.round(steps/goal*100):null;
  putText('hgsStepPercent',percent===null?'—':percent+'%');
  setProgress('hgsRing',percent===null?0:percent);
  el('hgsRing').setAttribute('aria-label',steps===null?'Brak danych o krokach':fmt(steps)+' kroków'+(goal===null?'':', '+percent+'% celu'));
  const source=h?.source||'';
  const sync=h&&(h.updatedAt||h.timestamp);
  const time=sync&&Number.isFinite(new Date(sync).getTime())?new Date(sync).toLocaleString('pl-PL',{dateStyle:'short',timeStyle:'short'}):null;
  putText('hgsSource',steps===null?'Brak dzisiejszych pomiarów. Połącz urządzenie w HealthGo.':'Źródło: '+(source||'Połączona usługa')+(time?' · Zapis: '+time:''));
  const distance=h?number(h.distanceKm):null;
  putText('hgsDistance',distance===null?'Brak danych':formatDistance.format(distance)+' km');
  putText('hgsDistanceSub',distance===null?'Brak pomiaru':'Zapis z dzisiaj');
  const heart=h?number(h.heartRate):null;
  putText('hgsHeart',heart===null?'Brak danych':fmt(heart)+' bpm');
  putText('hgsHeartSub',heart===null?'Brak pomiaru':'Ostatni zapis z dzisiaj');
  // The currently connected health-data schema has no calories field.
  // Never derive calories from steps or create a synthetic calorie goal.
  putText('hgsCalories','—');
  putText('hgsCaloriesSub','Brak źródła pomiaru');
 }
 function renderXpAndChallenge(state){
  const progress=state?.uid?state.engine:null;
  if(!progress){
   putText('hgsLevel','Poziom —');
   putText('hgsXpDetail','XP pojawi się po synchronizacji.');
   el('hgsXpFill').style.width='0%';
   el('hgsXpTrack').setAttribute('aria-valuenow','0');
   putText('hgsChallengeTitle','Brak danych o wyzwaniach');
   putText('hgsChallengeProgress','—');
   el('hgsChallengeFill').style.width='0%';
   return;
  }
  try{
   const level=Engine.getLevel(progress.totalXp||0);
   putText('hgsLevel','Poziom '+level.level);
   putText('hgsXpDetail',level.needed?fmt(level.xp)+' / '+fmt(level.needed)+' XP':'Najwyższy poziom');
   el('hgsXpFill').style.width=Math.min(100,Math.max(0,level.percent))+'%';
   el('hgsXpTrack').setAttribute('aria-valuenow',String(Math.round(level.percent)));
  }catch(_){putText('hgsLevel','Poziom —');putText('hgsXpDetail','Nie można odczytać XP');}
  try{
   const all=Engine.viewChallenges(progress,new Date().toISOString());
   const daily=Array.isArray(all)?all.filter(x=>x&&x.category==='daily'):[];
   const chosen=daily.find(x=>x.status==='active')||daily.find(x=>x.status==='completed')||null;
   putText('hgsChallengeTitle',chosen?.name||'Brak dzisiejszych wyzwań');
   const p=chosen&&number(chosen.progress),t=chosen&&number(chosen.target);
   const pct=chosen&&number(chosen.percent);
   putText('hgsChallengeProgress',p===null||t===null?'—':fmt(p)+' / '+fmt(t));
   el('hgsChallengeFill').style.width=(pct===null?0:Math.min(100,pct))+'%';
  }catch(_){
   putText('hgsChallengeTitle','Nie można pobrać wyzwań');
   putText('hgsChallengeProgress','—');el('hgsChallengeFill').style.width='0%';
  }
 }
 function chartEntries(state){
  const rows=state?.uid&&Array.isArray(state.healthDays)?state.healthDays:[];
  const byDate=new Map(rows.filter(x=>x && typeof(x.day||x.id)==='string').map(x=>[x.day||x.id,x]));
  if(chartRange==='month'){
   const weeks=[];
   for(let block=0;block<4;block++){
    let found=false,total=0;
    const startOffset=-27+block*7;
    for(let day=0;day<7;day++){
     const row=byDate.get(localDate(dateFromOffset(startOffset+day)));
     const value=row?number(row.steps):null;
     if(value!==null){found=true;total+=value;}
    }
    const first=localDate(dateFromOffset(startOffset)),last=localDate(dateFromOffset(startOffset+6));
    weeks.push({label:'T'+(block+1),value:found?total:null,description:first+' – '+last});
   }
   return weeks;
  }
  const now=new Date(),weekday=(now.getDay()+6)%7;
  return names.map((name,i)=>{
   const date=localDate(dateFromOffset(i-weekday)),row=byDate.get(date);
   return {label:name,value:row?number(row.steps):null,description:date};
  });
 }
 function renderChart(state){
  const entries=chartEntries(state);
  const known=entries.map(x=>x.value).filter(x=>x!==null);
  const maximum=Math.max(1,...known);
  const ceiling=maximum<=100?100:Math.ceil(maximum/1000)*1000;
  putText('hgsAxisTop',compact(ceiling));
  putText('hgsAxisMid',compact(ceiling/2));
  const root=el('hgsBars'),fragment=document.createDocumentFragment();
  root.style.setProperty('--hgs-count',entries.length);
  entries.forEach(function(item){
   const col=document.createElement('div');col.className='hgs-bar-col';
   const val=document.createElement('span');val.className='hgs-bar-val';
   val.textContent=item.value===null?'—':compact(item.value);
   const bar=document.createElement('span');bar.className='hgs-bar'+(item.value===null?' missing':'');
   bar.style.setProperty('--hgs-height',item.value===null?'0%':Math.max(0,Math.round(item.value/ceiling*100))+'%');
   bar.setAttribute('title',item.description+': '+(item.value===null?'Brak danych':fmt(item.value)+' kroków'));
   const day=document.createElement('span');day.className='hgs-bar-day';day.textContent=item.label;
   col.append(val,bar,day);fragment.appendChild(col);
  });
  root.replaceChildren(fragment);
  const sum=known.reduce((a,b)=>a+b,0);
  const description=known.length?known.length+' zapisanych '+(known.length===1?'okres':'okresów')+', łącznie '+fmt(sum)+' kroków.':'Brak danych w wybranym okresie.';
  el('hgsChart').setAttribute('aria-label','Wykres kroków: '+description);
  putText('hgsChartNote',known.length?'Dane z połączonych urządzeń. Puste dni oznaczają brak odczytu.':'Brak pomiarów w tym okresie. Połącz źródło aktywności.');
 }
 function render(state){
  renderIdentity(state);
  renderSteps(state);
  renderXpAndChallenge(state);
  renderChart(state);
  maybeRecentWeather();
 }
 function scheduleRender(state){
  if(scheduled)return;
  scheduled=true;
  queueMicrotask(function(){scheduled=false;render(Services.state);});
 }
 const codelabel=function(code){
  if(code===0)return['Słonecznie','☀'];
  if([1,2,3].includes(code))return['Częściowe zachmurzenie','⛅'];
  if([45,48].includes(code))return['Mgła','☁'];
  if([51,53,55,56,57].includes(code))return['Mżawka','☂'];
  if([61,63,65,66,67,80,81,82].includes(code))return['Deszcz','☂'];
  if([71,73,75,77,85,86].includes(code))return['Śnieg','❄'];
  if([95,96,99].includes(code))return['Burza','⚡'];
  return['Zmienna pogoda','☁'];
 };
 function validCoords(p){
  return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
 }
 function weatherText(message){
  putText('hgsWeatherDesc',message);
  putText('hgsWeatherActionText',weatherPending?'Pobieranie…':'Sprawdź pogodę');
  el('hgsWeatherAction').disabled=weatherPending;
 }
 async function fetchWeather(point){
  if(!validCoords(point)||weatherPending)return false;
  const key=Number(point.lat).toFixed(2)+','+Number(point.lon).toFixed(2);
  if(key===weatherPointKey && Date.now()-weatherFetchedAt<20*60000)return true;
  weatherPending=true;weatherStatus='loading';weatherText('Pobieranie pogody…');
  const controller=new AbortController();weatherController=controller;
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const params=new URLSearchParams({latitude:Number(point.lat).toFixed(2),longitude:Number(point.lon).toFixed(2),current:'temperature_2m,weather_code',timezone:'auto'});
   const response=await fetch('https://api.open-meteo.com/v1/forecast?'+params.toString(),{signal:controller.signal});
   if(!response.ok)throw new Error('Pogoda jest chwilowo niedostępna.');
   const json=await response.json();
   const temp=json?.current?.temperature_2m;
   if(typeof temp!=='number'||!Number.isFinite(temp))throw new Error('Serwis nie przekazał temperatury.');
   if(controller!==weatherController||!Services.state.uid)return false;
   const forecast=codelabel(Number(json.current.weather_code));
   putText('hgsWeatherTemp',Math.round(temp)+'°C');
   putText('hgsWeatherDesc',forecast[0]);
   putText('hgsWeatherIcon',forecast[1]);
   putText('hgsWeatherPlace','Twoja okolica · dane Open-Meteo');
   weatherPointKey=key;weatherFetchedAt=Date.now();weatherStatus='ready';
   return true;
  }catch(error){
   if(controller===weatherController){
    weatherStatus='error';
    weatherText(error?.name==='AbortError'?'Przekroczono czas pobierania.':'Nie udało się pobrać prognozy.');
    putText('hgsWeatherPlace','Możesz sprawdzić pogodę na mapie.');
   }
   return false;
  }finally{
   clearTimeout(timeout);
   if(controller===weatherController){
    weatherPending=false;
    putText('hgsWeatherActionText','Sprawdź pogodę');
    el('hgsWeatherAction').disabled=false;
   }
  }
 }
 function maybeRecentWeather(){
  if(!Services.state.uid||weatherPending||!el('start')?.classList.contains('active'))return;
  if(weatherStatus==='ready'&&Date.now()-weatherFetchedAt<20*60000)return;
  if(weatherStatus==='error')return;
  const point=window.HealthGoMapV2?.getRecentPosition?.(300000);
  if(validCoords(point))fetchWeather(point);
 }
 function askWeather(){
  if(weatherPending)return;
  const recent=window.HealthGoMapV2?.getRecentPosition?.(300000);
  if(validCoords(recent)){fetchWeather(recent);return;}
  if(!navigator.geolocation){
   weatherText('Lokalizacja niedostępna. Wybierz okolicę na mapie.');
   putText('hgsWeatherActionText','Pokaż mapę');
   el('hgsWeatherAction').onclick=openWeatherPage;
   return;
  }
  weatherPending=true;weatherText('Czekam na zgodę lokalizacji…');
  navigator.geolocation.getCurrentPosition(function(pos){
   weatherPending=false;
   fetchWeather({lat:pos.coords.latitude,lon:pos.coords.longitude});
  },function(){
   weatherPending=false;weatherStatus='error';
   weatherText('Brak dostępu do lokalizacji.');
   putText('hgsWeatherPlace','Możesz wybrać okolicę w Mapie.');
   putText('hgsWeatherActionText','Otwórz mapę');
   el('hgsWeatherAction').onclick=openWeatherPage;
  },{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
 }
 function showGoalDialog(){
  const dialog=el('hgsGoalDialog');
  const goal=currentGoal();
  el('hgsGoalInput').value=goal===null?'':goal;
  putText('hgsGoalError','');
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
 }
 function closeGoalDialog(){
  const dialog=el('hgsGoalDialog');
  if(typeof dialog.close==='function')dialog.close();
  else dialog.removeAttribute('open');
 }
 function onGoalSubmit(event){
  event.preventDefault();
  const input=el('hgsGoalInput');
  const value=Number(input.value);
  if(!input.value||!Number.isInteger(value)||value<100||value>20000){
   putText('hgsGoalError','Wpisz liczbę kroków od 100 do 20 000.');return;
  }
  if(!storeGoal(value)){putText('hgsGoalError','Nie można zapisać celu.');return;}
  closeGoalDialog();scheduleRender();
 }
 el('hgsProfileButton').addEventListener('click',()=>openPage('settings'));
 el('hgsNotifications').addEventListener('click',()=>openPage('notifications'));
 el('hgsDateButton').addEventListener('click',()=>openPage('plan'));
 el('hgsStepDetails').addEventListener('click',()=>openPage('activity'));
 el('hgsDistanceAction').addEventListener('click',()=>openPage('activity'));
 el('hgsHeartAction').addEventListener('click',()=>openPage('devices'));
 el('hgsCaloriesAction').addEventListener('click',()=>openPage('devices'));
 el('hgsXpAction').addEventListener('click',()=>openPage('challenges'));
 el('hgsChallengeAction').addEventListener('click',()=>openPage('challenges'));
 el('hgsGoalButton').addEventListener('click',showGoalDialog);
 el('hgsGoalCancel').addEventListener('click',closeGoalDialog);
 el('hgsGoalClear').addEventListener('click',()=>{
  if(storeGoal(null)){closeGoalDialog();scheduleRender();}
  else putText('hgsGoalError','Nie można usunąć celu.');
 });
 el('hgsGoalForm').addEventListener('submit',onGoalSubmit);
 el('hgsWeatherAction').addEventListener('click',askWeather);
 el('hgsChartRange').addEventListener('change',function(){
  chartRange=this.value==='month'?'month':'week';scheduleRender();
 });
 document.addEventListener('visibilitychange',function(){if(!document.hidden)scheduleRender();});
 if(typeof Services.subscribe==='function')Services.subscribe(scheduleRender);
 scheduleRender();
})();
