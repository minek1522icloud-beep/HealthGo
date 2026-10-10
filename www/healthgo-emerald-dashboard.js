/* HealthGo Emerald dashboard — presentation layer only.
 * Real XP and challenge status come from the existing HealthGoEngine.
 * Do not manufacture steps, weather readings, family data or GPS positions.
 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const service=window.HealthGoServices;
 const engine=window.HealthGoEngine;
 const start=$('start');
 if(!start)return;
 const hero=start.querySelector('.dashboard-hero');
 const stats=$('healthStats');
 if(!hero||!stats)return;

 const week=document.createElement('div');
 week.id='healthGoEmeraldWeek';
 week.className='hg-emerald-week';
 week.setAttribute('aria-label','Bieżący tydzień');
 hero.insertAdjacentElement('afterend',week);

 const section=document.createElement('div');
 section.id='healthGoEmeraldDashboard';
 section.className='hg-emerald-dash';
 section.setAttribute('aria-label','Szybki dostęp do HealthGo');
 stats.insertAdjacentElement('afterend',section);

 function card(title,value,description,label,handler){
  const root=document.createElement('article');
  root.className='hg-emerald-dash-card';
  const h=document.createElement('h3');
  h.textContent=title;
  const metric=document.createElement('strong');
  metric.className='hg-emerald-dash-value';
  metric.textContent=value;
  const copy=document.createElement('p');
  copy.textContent=description;
  const button=document.createElement('button');
  button.type='button';
  button.textContent=label;
  button.addEventListener('click',handler);
  root.append(h,metric,copy,button);
  return root;
 }

 function openPage(page){
  if(typeof window.go==='function')window.go(page);
  else if(typeof window.mobileGo==='function')window.mobileGo(page);
 }
 function openWeather(){
  openPage('map');
  window.setTimeout(function(){
   if($('map')?.classList.contains('active'))window.HealthGoMapV2?.toggle?.('weather');
  },100);
 }
 function openRestaurant(){
  openPage('map');
  window.setTimeout(function(){
   if(!$('map')?.classList.contains('active'))return;
   const selector=document.querySelector('#map .map-category[onclick*="restaurants"]');
   if(typeof window.selectMapCategory==='function')window.selectMapCategory('restaurants',selector||null);
  },100);
 }

 function renderWeek(){
  const now=new Date(),dayIndex=(now.getDay()+6)%7;
  const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dayIndex);
  const days=['Pn','Wt','Śr','Cz','Pt','So','Nd'];
  const fragment=document.createDocumentFragment();
  for(let i=0;i<7;i++){
   const d=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+i);
   const item=document.createElement('div');
   item.className='hg-emerald-day';
   const short=document.createElement('span');
   short.textContent=days[i];
   const number=document.createElement('strong');
   number.textContent=d.getDate();
   if(d.toDateString()===now.toDateString())item.setAttribute('aria-current','date');
   item.append(short,number);
   fragment.appendChild(item);
  }
  week.replaceChildren(fragment);
 }

 function renderData(){
  const state=service?.state;
  const progress=state?.engine||null;
  let level='—',levelCopy='Poziom pojawi się po synchronizacji konta.';
  let missionValue='—',missionCopy='Misje pojawią się po wczytaniu konta.';
  if(progress&&engine){
   try{
    const result=engine.getLevel(progress.totalXp||0);
    level=String(result.level);
    levelCopy=result.needed
      ? 'Zebrano '+Math.round(result.xp)+' z '+Math.round(result.needed)+' XP do następnego poziomu.'
      : 'Najwyższy poziom HealthGo.';
   }catch(_){level='—';}
   try{
    const challenges=engine.viewChallenges(progress,new Date().toISOString());
    if(Array.isArray(challenges)){
     const completed=challenges.filter(item=>item.status==='completed').length;
     missionValue=completed+' / '+challenges.length;
     missionCopy='Ukończone wyzwania spośród aktualnie dostępnych.';
    }
   }catch(_){missionValue='—';}
  }
  const familyReady=!!$('family');
  const cards=[
   card('⚡ Twój poziom',level,levelCopy,'Otwórz XP i wyzwania',()=>openPage('challenges')),
   card('🎯 Wyzwania',missionValue,missionCopy,'Zobacz zadania',()=>openPage('challenges')),
   card('🌤 Pogoda','Na żywo','Prognoza z Open-Meteo dla wybranego obszaru mapy.','Sprawdź pogodę',openWeather),
   card('🎒 Plecak','Kolekcja','Zdobyte odznaki i nagrody za rzeczywiste osiągnięcia.','Otwórz plecak',()=>openPage('backpack')),
   card('🍽 Restauracje','W okolicy','Wyszukuj rzeczywiste miejsca na mapie.','Szukaj restauracji',openRestaurant),
   card('✨ HealthGo AI','Asystent','Rozmowy i planowanie, gdy połączenie AI jest dostępne.','Otwórz AI',()=>openPage('ai'))
  ];
  if(familyReady)cards.push(card('👨‍👩‍👧 Rodzina','Wspólnie','Oddzielne profile, zgody i rodzinne wyzwania.','Otwórz rodzinę',()=>openPage('family')));
  section.replaceChildren(...cards);
 }

 renderWeek();
 renderData();
 if(service&&typeof service.subscribe==='function')service.subscribe(renderData);
 document.addEventListener('visibilitychange',function(){if(!document.hidden)renderWeek();});
})();
