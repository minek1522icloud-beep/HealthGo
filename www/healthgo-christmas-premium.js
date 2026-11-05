/* Premium Christmas start surface: uses real HealthGo state, never example readings. */
(() => {
 'use strict';
 const root=document.getElementById('hgStartV3');
 const Services=window.HealthGoServices;
 const Engine=window.HealthGoEngine;
 if(!root || !Services) return;
 if(document.getElementById('hgcPremium')) return;
 const view=document.createElement('div');
 view.id='hgcPremium';
 view.className='hgc-premium';
 view.innerHTML=[
  '<header class="hgc-heading" aria-label="Świąteczny ekran HealthGo">',
   '<div class="hgc-logo"><span class="hgc-logo-heart" aria-hidden="true">♥<span class="hgc-logo-pulse">⌁</span></span><span>Health<strong>Go</strong></span></div>',
   '<h1>Wesołych Świąt!</h1>',
   '<p>Zadbaj o zdrowie w świątecznym stylu</p>',
   '<div class="hgc-heading-ribbon" aria-hidden="true">✧ <span>🎀</span> ✧</div>',
  '</header>',
  '<section class="hgc-banner" aria-labelledby="hgcBannerTitle">',
   '<div class="hgc-ribbon" aria-hidden="true">🎀</div>',
   '<div class="hgc-banner-copy">',
    '<h2 id="hgcBannerTitle">Świąteczna<br>forma z HealthGo</h2>',
    '<p>Ruch, sen i dobre nawyki<br>także w święta!</p>',
    '<button type="button" class="hgc-banner-action" data-hgc-page="challenges">Sprawdź wyzwanie! <span aria-hidden="true">›</span></button>',
   '</div>',
  '</section>',
  '<section class="hgc-overview" aria-label="Dzisiejsze dane zdrowotne">',
   '<button class="hgc-tile hgc-tile-steps" type="button" data-hgc-page="activity" aria-label="Przejdź do aktywności i kroków">',
    '<span class="hgc-tile-icon" aria-hidden="true">👟</span>',
    '<span class="hgc-tile-copy"><span class="hgc-tile-label">Kroki dzisiaj</span><strong id="hgcSteps">Brak danych</strong><small id="hgcStepsGoal">Cel nieustawiony</small></span>',
    '<span class="hgc-ring" id="hgcStepsRing" role="img" aria-label="Brak danych o celu"><span id="hgcStepsPct">—</span></span>',
   '</button>',
   '<button class="hgc-tile hgc-tile-heart" type="button" data-hgc-page="devices" aria-label="Przejdź do danych tętna i urządzeń">',
    '<span class="hgc-tile-icon" aria-hidden="true">♡</span>',
    '<span class="hgc-tile-copy"><span class="hgc-tile-label">Tętno</span><strong id="hgcHeart">Brak danych</strong><small id="hgcHeartHint">Brak dzisiejszego pomiaru</small></span>',
    '<span class="hgc-pulse" aria-hidden="true">⌁</span>',
   '</button>',
   '<button class="hgc-tile hgc-tile-sleep" type="button" data-hgc-page="activity" aria-label="Przejdź do informacji o śnie">',
    '<span class="hgc-tile-icon" aria-hidden="true">☾</span>',
    '<span class="hgc-tile-copy"><span class="hgc-tile-label">Sen</span><strong id="hgcSleep">Brak danych</strong><small id="hgcSleepHint">Brak danych z urządzenia</small></span>',
    '<span class="hgc-decoration" aria-hidden="true">☾</span>',
   '</button>',
   '<div class="hgc-tile hgc-tile-water" aria-label="Woda. Pomiar nie jest jeszcze obsługiwany">',
    '<span class="hgc-tile-icon" aria-hidden="true">💧</span>',
    '<span class="hgc-tile-copy"><span class="hgc-tile-label">Woda</span><strong>Brak danych</strong><small>Śledzenie wody w przygotowaniu</small></span>',
    '<span class="hgc-water-mark" aria-hidden="true">◌</span>',
   '</div>',
  '</section>',
  '<section class="hgc-xp" aria-labelledby="hgcXpTitle">',
   '<span class="hgc-xp-gift" aria-hidden="true">🎁</span>',
   '<div class="hgc-xp-top"><div><span class="hgc-xp-label" id="hgcXpTitle">⭐ Poziom XP</span><strong id="hgcXp">Brak danych</strong></div><span class="hgc-level" id="hgcLevel">Poziom —</span></div>',
   '<div class="hgc-xp-bottom"><div class="hgc-xp-track" role="progressbar" aria-label="Postęp do następnego poziomu" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="hgcXpTrack"><span id="hgcXpBar"></span></div><small id="hgcXpDetail">Zaloguj się, aby zobaczyć XP</small></div>',
  '</section>',
  '<button type="button" class="hgc-details-toggle" data-hgc-toggle="details" aria-expanded="false">Pokaż więcej statystyk, pogodę i wyzwania <span aria-hidden="true">⌄</span></button>'
 ].join('');
 root.appendChild(view);
 const el=id=>document.getElementById(id);
 const format=new Intl.NumberFormat('pl-PL',{maximumFractionDigits:0});
 function numeric(n) {return typeof n==='number' && Number.isFinite(n) && n>=0 ? n:null;}
 function today(){
  const date=new Date();
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
 }
 function getToday(state){
  if(!state || !state.uid || !Array.isArray(state.healthDays))return null;
  return state.healthDays.find(row=>row && (row.day||row.id)===today())||null;
 }
 function goal(state){
  if(!state?.uid)return null;
  try{
   const n=Number(localStorage.getItem('healthgo_start_steps_goal_v1_'+state.uid));
   return Number.isInteger(n)&&n>=100&&n<=20000?n:null;
  }catch(_){return null;}
 }
 function text(id,value){const node=el(id);if(node)node.textContent=String(value);}
 function render(){
  const state=Services.state;
  const item=getToday(state);
  const steps=item?numeric(item.steps):null;
  const target=goal(state);
  text('hgcSteps',steps===null?'Brak danych':format.format(steps));
  text('hgcStepsGoal',target===null?'Cel nieustawiony':'z '+format.format(target)+' kroków');
  const ratio=target!==null&&steps!==null?Math.round(steps/target*100):null;
  const percent=ratio===null?0:Math.max(0,Math.min(100,ratio));
  el('hgcStepsRing')?.style.setProperty('--hgc-pct',percent+'%');
  text('hgcStepsPct',ratio===null?'—':ratio+'%');
  el('hgcStepsRing')?.setAttribute('aria-label',ratio===null?'Brak pomiaru lub celu kroków':ratio+' procent celu kroków');
  const heart=item?numeric(item.heartRate):null;
  text('hgcHeart',heart===null?'Brak danych':format.format(heart)+' bpm');
  text('hgcHeartHint',heart===null?'Brak dzisiejszego pomiaru':'Ostatni odczyt z dziś');
  const sleep=item?numeric(item.sleepMinutes):null;
  text('hgcSleep',sleep===null?'Brak danych':Math.floor(sleep/60)+' h '+String(Math.floor(sleep%60)).padStart(2,'0')+' min');
  text('hgcSleepHint',sleep===null?'Brak danych z urządzenia':'Zapis z połączonego urządzenia');
  const progress=state?.uid?state.engine:null;
  if(progress && Engine && typeof Engine.getLevel==='function'){
   try{
    const level=Engine.getLevel(progress.totalXp||0);
    text('hgcXp',format.format(numeric(progress.totalXp)||0)+' XP');
    text('hgcLevel','♛ Poziom '+level.level);
    text('hgcXpDetail',level.needed?format.format(level.xp)+' / '+format.format(level.needed)+' XP':'Najwyższy poziom');
    const pct=Math.min(100,Math.max(0,numeric(level.percent)||0));
    el('hgcXpBar').style.width=pct+'%';
    el('hgcXpTrack').setAttribute('aria-valuenow',String(Math.round(pct)));
   }catch(_){resetXp();}
  }else resetXp();
 }
 function resetXp(){
  text('hgcXp','Brak danych');
  text('hgcLevel','Poziom —');
  text('hgcXpDetail','Zaloguj się, aby zobaczyć XP');
  el('hgcXpBar').style.width='0%';
  el('hgcXpTrack').setAttribute('aria-valuenow','0');
 }
 root.addEventListener('click',event=>{
  const action=event.target.closest('[data-hgc-page], [data-hgc-toggle]');
  if(!action)return;
  if(action.dataset.hgcPage){
   const page=action.dataset.hgcPage;
   if(document.getElementById(page)&&typeof window.go==='function')window.go(page);
   return;
  }
  if(action.dataset.hgcToggle==='details'){
   const visible=root.classList.toggle('hgc-show-details');
   action.setAttribute('aria-expanded',String(visible));
   action.innerHTML=visible?'Ukryj dodatkowe statystyki <span aria-hidden="true">⌃</span>':'Pokaż więcej statystyk, pogodę i wyzwania <span aria-hidden="true">⌄</span>';
  }
 });
 el('hgsGoalForm')?.addEventListener('submit',()=>queueMicrotask(render));
 el('hgsGoalClear')?.addEventListener('click',()=>queueMicrotask(render));
 window.addEventListener('storage',event=>{if(event.key?.startsWith('healthgo_start_steps_goal_v1_'))render();});
 if(typeof Services.subscribe==='function')Services.subscribe(render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
 render();
})();
