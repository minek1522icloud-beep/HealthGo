/* HealthGo Activity 4.4 — verified measurements, local workout diary, accessible detail views.
 * No client-side XP, simulated health records, silent GPS or background tracking. */
(function(w){
 'use strict';
 const d=w.document,S=w.HealthGoServices;
 if(!d||!S)return;
 const $=id=>d.getElementById(id);
 const el=(tag,cls,text)=>{const x=d.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;};
 const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 const fmt=x=>valid(x)?x.toLocaleString('pl-PL',{maximumFractionDigits:1}):'—';
 const isoDay=dt=>[dt.getFullYear(),String(dt.getMonth()+1).padStart(2,'0'),String(dt.getDate()).padStart(2,'0')].join('-');
 const key=()=>S.state?.uid?'healthgo.activity44.'+encodeURIComponent(S.state.uid):null;
 const schema={steps:'Kroki',distanceKm:'Dystans',activeMinutes:'Czas aktywności',heartRate:'Tętno',sleepMinutes:'Sen'};
 const unit={steps:'kroków',distanceKm:'km',activeMinutes:'min',heartRate:'bpm',sleepMinutes:'min'};
 const workouts={walk:'Spacer',run:'Bieganie',bike:'Rower',other:'Inna aktywność'};
 let owner=null,chosen=isoDay(new Date()),span=7,metric='steps',detail=null,run=null,tick=null,gpsWatch=null,lastFix=null,notices='',busy=false;
 const copy=v=>v&&typeof v==='object'?v:{};
 function storage(){
  const name=key();if(!name)return {goals:{},records:[]};
  try{
   const input=copy(JSON.parse(w.localStorage?.getItem(name)||'{}'));
   const goals={};for(const k of ['steps','distanceKm','activeMinutes'])if(valid(input.goals?.[k])&&input.goals[k]>0)goals[k]=input.goals[k];
   const records=(Array.isArray(input.records)?input.records:[]).filter(r=>r&&workouts[r.kind]&&/^\d{4}-\d\d-\d\d$/.test(r.day)&&valid(r.seconds)&&valid(r.distanceKm)).slice(-250);
   return {goals,records};
  }catch(_){return {goals:{},records:[]};}
 }
 function save(next){
  const name=key();if(!name)return false;
  try{w.localStorage?.setItem(name,JSON.stringify(next));return true;}
  catch(_){notice('Nie udało się zapisać danych na tym urządzeniu.');return false;}
 }
 function readings(){return Array.isArray(S.state?.healthDays)?S.state.healthDays.filter(x=>x&&typeof x.id==='string'):[];}
 function dayData(day){return readings().find(r=>r.id===day)||null;}
 function value(row,k){return valid(row?.[k])?row[k]:null;}
 function notice(text){notices=String(text||'').slice(0,350);const target=$('hg44Notice');if(target)target.textContent=notices;}
 function button(text,fn,secondary=false){const b=el('button','hg44-btn'+(secondary?' secondary':''),text);b.type='button';b.addEventListener('click',fn);return b;}
 function targetDate(offset){const t=new Date();return new Date(t.getFullYear(),t.getMonth(),t.getDate()-offset,12);}
 function selectedText(row,k){
  const v=value(row,k);
  if(v===null)return 'Brak danych';
  if(k==='sleepMinutes')return Math.floor(v/60)+' h '+Math.round(v%60)+' min';
  return fmt(v)+(k==='steps'?'':k==='distanceKm'?' km':k==='heartRate'?' bpm':' min');
 }
 function ring(root,label,number,percent){
  const wrap=el('div','hg44-ring-wrap'),chart=el('div','hg44-ring');
  chart.style.background=percent===null?'conic-gradient(#275943 0 100%)':'conic-gradient(#73f3bd 0 '+Math.min(100,percent)+'%,#275943 '+Math.min(100,percent)+'% 100%)';
  chart.setAttribute('role','img');
  chart.setAttribute('aria-label',label+': '+number+(percent===null?', bez ustalonego celu':', '+Math.round(percent)+'% celu'));
  const inside=el('div','hg44-ring-inside');
  inside.append(el('strong','',number),el('small','',label));chart.appendChild(inside);
  wrap.appendChild(chart);
  return wrap;
 }
 function daysFor(count){
  const list=[];const today=new Date();
  for(let off=count-1;off>=0;off--){
   const when=new Date(today.getFullYear(),today.getMonth(),today.getDate()-off,12);
   list.push({key:isoDay(when),date:when,record:dayData(isoDay(when))});
  }
  return list;
 }
 function elapsed(){return !run?0:run.elapsed+(run.paused?0:Math.max(0,(Date.now()-run.started)/1000));}
 function stopGps(){
  if(gpsWatch!==null){try{w.navigator?.geolocation?.clearWatch(gpsWatch);}catch(_){}gpsWatch=null;}
  lastFix=null;
 }
 function radians(v){return v*Math.PI/180;}
 function meters(a,b){
  const dy=radians(b.lat-a.lat),dx=radians(b.lon-a.lon),c=Math.sin(dy/2)**2+
   Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dx/2)**2;
  return 12742000*Math.atan2(Math.sqrt(Math.max(0,c)),Math.sqrt(Math.max(0,1-c)));
 }
 function startGps(){
  if(!run||run.paused||!run.gpsAllowed||gpsWatch!==null||!w.navigator?.geolocation?.watchPosition)return;
  lastFix=null;
  try{
   gpsWatch=w.navigator.geolocation.watchPosition(p=>{
    if(!run||run.paused||!run.gpsAllowed)return;
    const c=p.coords,fix={lat:Number(c.latitude),lon:Number(c.longitude),accuracy:Number(c.accuracy),time:Number(p.timestamp)||Date.now()};
    if(!Number.isFinite(fix.lat)||Math.abs(fix.lat)>90||!Number.isFinite(fix.lon)||Math.abs(fix.lon)>180||
       !valid(fix.accuracy)||fix.accuracy>35)return;
    if(lastFix){
     const distance=meters(lastFix,fix),seconds=(fix.time-lastFix.time)/1000;
     if(seconds>0&&seconds<180&&distance<=150&&distance/seconds<=12&&distance>=3){
      run.distanceKm+=distance/1000;
     }
    }
    lastFix=fix;updateRunStatus();
   },()=>{notice('GPS jest niedostępny. Możesz dalej rejestrować czas bez trasy.');stopGps();},
   {enableHighAccuracy:true,maximumAge:0,timeout:16000});
  }catch(_){notice('Urządzenie nie pozwala uruchomić GPS.');}
 }
 function pause(){
  if(!run||run.paused)return;
  run.elapsed=elapsed();run.paused=true;stopGps();updateRunStatus();
 }
 function resume(){if(!run||!run.paused)return;run.paused=false;run.started=Date.now();startGps();updateRunStatus();}
 function endRun(saveIt){
  if(!run)return;
  const total=Math.max(0,Math.round(elapsed())),kind=run.kind,distance=Math.max(0,run.distanceKm);
  pause();
  if(saveIt&&total>=5){
   const state=storage(),record={kind,day:isoDay(new Date()),seconds:total,distanceKm:Number(distance.toFixed(3)),createdAt:new Date().toISOString(),gps:run.gpsAllowed};
   if(!save({...state,records:[...state.records,record].slice(-250)})){updateRunStatus();return;}
   notice('Aktywność zapisana tylko na tym urządzeniu. Nie przyznano XP.');
  }else notice(saveIt?'Zapis wymaga co najmniej 5 sekund rzeczywistego pomiaru.':'Aktywność odrzucona.');
  run=null;stopGps();if(tick){w.clearInterval?.(tick);tick=null;}render();
 }
 function updateRunStatus(){
  const time=$('hg44Clock'),distance=$('hg44LiveDistance'),status=$('hg44RunStatus');
  if(!run)return;
  const t=Math.floor(elapsed()),hh=Math.floor(t/3600),mm=Math.floor(t%3600/60),ss=t%60;
  if(time)time.textContent=[hh,mm,ss].map(n=>String(n).padStart(2,'0')).join(':');
  if(distance)distance.textContent=run.gpsAllowed?fmt(run.distanceKm)+' km':'GPS wyłączony';
  if(status)status.textContent=run.paused?'Pauza — nie rejestrujemy czasu ani GPS.':
   'Rejestrowanie działa, kiedy HealthGo jest aktywne. iPhone może wstrzymać GPS w tle.';
 }
 function trackPanel(root){
  const panel=el('section','hg44-card hg44-tracker');
  panel.append(el('h3','','Rozpocznij aktywność'),el('p','hg44-muted','Spacer, bieganie, rower lub własna aktywność. Rejestrujemy czas; GPS tylko po Twojej zgodzie.'));
  if(!run){
   const options=el('div','hg44-workout-choices');
   for(const [id,name] of Object.entries(workouts)){
    options.appendChild(button(name,()=>{
     if(!S.state?.uid){notice('Zaloguj się, aby zapisać aktywność.');return;}
     run={kind:id,elapsed:0,paused:false,started:Date.now(),distanceKm:0,gpsAllowed:false};
     if(!tick)tick=w.setInterval?.(updateRunStatus,1000);
     render();
    },true));
   }
   panel.appendChild(options);
  }else{
   panel.append(el('p','hg44-live-kind',workouts[run.kind]),el('strong','hg44-live-clock','00:00:00'));
   const clock=panel.children[panel.children.length-1];clock.id='hg44Clock';
   const dst=el('p','hg44-live-distance');dst.id='hg44LiveDistance';panel.appendChild(dst);
   const status=el('p','hg44-muted');status.id='hg44RunStatus';panel.appendChild(status);
   const actions=el('div','hg44-toolbar');
   actions.appendChild(run.paused?button('Wznów',()=>{resume();render();}):
    button('Pauza',()=>{pause();render();},true));
   actions.appendChild(button('Zakończ i zapisz',()=>endRun(true)));
   actions.appendChild(button('Odrzuć',()=>{
    if(w.confirm?.('Odrzucić niezapisaną aktywność?')!==true)return;endRun(false);
   },true));
   if(!run.gpsAllowed){
    actions.appendChild(button('Włącz GPS',()=>{
     run.gpsAllowed=true;startGps();render();notice('GPS działa wyłącznie w aktywnej sesji. Nie zapisujemy dokładnych współrzędnych.');
    },true));
   }else actions.appendChild(button('Wyłącz GPS',()=>{
    run.gpsAllowed=false;stopGps();render();
   },true));
   panel.appendChild(actions);updateRunStatus();
  }
  root.appendChild(panel);
 }
 function modal(kind){
  if(!schema[kind])return;
  detail=kind;
  let overlay=$('hg44Detail');
  if(overlay)overlay.remove();
  overlay=el('div','hg44-overlay');overlay.id='hg44Detail';
  const card=el('section','hg44-detail');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
  card.setAttribute('aria-label','Statystyki: '+schema[kind]);
  card.append(el('h2','',schema[kind]),el('p','hg44-muted','Tylko rzeczywiste pomiary. Brak synchronizacji jest oznaczony kreską.'));
  const rows=el('div','hg44-detail-list');
  for(const day of daysFor(30).reverse().slice(0,30)){
   const item=el('div','hg44-detail-row');
   item.append(el('span','',day.date.toLocaleDateString('pl-PL',{day:'numeric',month:'short'})),
    el('strong','',selectedText(day.record,kind)));rows.appendChild(item);
  }
  card.appendChild(rows);
  card.appendChild(button('Zamknij',()=>{detail=null;overlay.remove();}));
  overlay.addEventListener('click',e=>{if(e.target===overlay){detail=null;overlay.remove();}});
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){detail=null;overlay.remove();}});
  overlay.appendChild(card);d.body.appendChild(overlay);
  card.querySelector?.('button')?.focus?.();
 }
 function metricsPanel(root,reading,goals){
  const panel=el('section','hg44-card');
  panel.append(el('h3','','Dzisiejsze wskaźniki'),el('p','hg44-muted','Postęp względem Twoich własnych celów. Nie ustaliliśmy ich automatycznie.'));
  const rings=el('div','hg44-rings');
  for(const [k,label] of [['steps','Kroki'],['distanceKm','Dystans'],['activeMinutes','Minuty']]){
   const val=value(reading,k),goal=goals[k],pct=val!==null&&valid(goal)&&goal>0?Math.min(100,val/goal*100):null;
   const display=val===null?'—':k==='distanceKm'?fmt(val):fmt(Math.round(val));
   rings.appendChild(ring(root,label,display,pct));
  }
  panel.appendChild(rings);
  const grid=el('div','hg44-metrics');
  for(const [kind,name] of Object.entries(schema)){
   const b=button(name+' · '+selectedText(reading,kind),()=>modal(kind),true);
   b.className+=' hg44-metric';b.setAttribute('aria-label','Otwórz statystyki: '+name);
   grid.appendChild(b);
  }
  panel.appendChild(grid);
  const note=el('p','hg44-muted',reading?
   'Źródło: '+String(reading.source||'Nieznane').slice(0,90)+
   (reading.updatedAt||reading.timestamp?' · Zapis '+new Date(reading.updatedAt||reading.timestamp).toLocaleDateString('pl-PL'):''):
   'Brak pomiarów z urządzenia dla tego dnia.');panel.appendChild(note);
  root.appendChild(panel);
 }
 function calendar(root){
  const panel=el('section','hg44-card');
  panel.appendChild(el('h3','','Wybierz dzień'));
  const strip=el('div','hg44-days');
  for(const x of daysFor(7)){
   const day=button(x.date.toLocaleDateString('pl-PL',{weekday:'short'})+' '+x.date.getDate(),
    ()=>{chosen=x.key;render();},x.key!==chosen);
   day.setAttribute('aria-pressed',String(x.key===chosen));strip.appendChild(day);
  }
  panel.appendChild(strip);root.appendChild(panel);
 }
 function graph(root){
  const panel=el('section','hg44-card');
  panel.appendChild(el('h3','','Statystyki i historia'));
  const bar=el('div','hg44-toolbar');
  for(const [days,name] of [[7,'7 dni'],[30,'30 dni']]){
   const b=button(name,()=>{span=days;render();},span!==days);
   b.setAttribute('aria-pressed',String(span===days));bar.appendChild(b);
  }
  const select=el('select','hg44-select');select.setAttribute('aria-label','Wskaźnik wykresu');
  for(const k of ['steps','distanceKm','activeMinutes']){
   const o=el('option','',schema[k]);o.value=k;select.appendChild(o);
  }
  select.value=metric;select.addEventListener('change',()=>{metric=select.value;render();});
  bar.appendChild(select);panel.appendChild(bar);
  const days=daysFor(span),values=days.map(x=>value(x.record,metric)),max=Math.max(1,...values.filter(valid));
  const scroller=el('div','hg44-graph-scroll'),chart=el('div','hg44-graph');
  chart.style.gridTemplateColumns='repeat('+span+',minmax('+(span===7?36:25)+'px,1fr))';
  for(let i=0;i<days.length;i++){
   const cell=el('div','hg44-column'),v=values[i],wrap=el('div','hg44-bar-wrap'),mark=el('span','hg44-bar');
   mark.style.height=v===null?'0%':Math.max(2,v/max*100)+'%';mark.classList.toggle('missing',v===null);
   wrap.appendChild(mark);
   cell.append(el('small','',v===null?'—':fmt(v)),wrap,
    el('small','',days[i].date.toLocaleDateString('pl-PL',{day:'numeric',month:'short'})));
   cell.setAttribute('aria-label',days[i].key+': '+(v===null?'brak pomiaru':fmt(v)+' '+unit[metric]));
   chart.appendChild(cell);
  }
  scroller.appendChild(chart);panel.appendChild(scroller);
  panel.appendChild(el('p','hg44-muted','Kreska to brak danych, a nie zero. Wykres porównuje tylko Twoje zapisane wyniki.'));
  root.appendChild(panel);
 }
 function goals(root,data){
  const panel=el('details','hg44-card hg44-goals');
  const summary=el('summary','','Moje cele (opcjonalne)');panel.appendChild(summary);
  panel.appendChild(el('p','hg44-muted','Wybierz własne wartości, jeśli chcesz. Możesz je też wyczyścić. Zero presji.'));
  const form=el('form','hg44-goal-form');
  const inputs={};
  for(const [k,label] of [['steps','Kroki'],['distanceKm','Dystans (km)'],['activeMinutes','Minuty aktywności']]){
   const field=el('label','',label),input=el('input');input.type='number';input.min='0';input.max=k==='steps'?'50000':k==='distanceKm'?'100':'1440';
   input.step=k==='distanceKm'?'0.1':'1';input.placeholder='Bez celu';input.value=data.goals[k]??'';
   field.appendChild(input);form.appendChild(field);inputs[k]=input;
  }
  const submit=button('Zapisz moje cele',()=>{const next={};
   for(const k of Object.keys(inputs)){
    const raw=String(inputs[k].value||'').trim();
    if(!raw)continue;
    const v=Number(raw),limit=k==='steps'?50000:k==='distanceKm'?100:1440;
    if(!Number.isFinite(v)||v<=0||v>limit){notice('Sprawdź podane wartości celu.');return;}
    next[k]=v;
   }
   if(save({...storage(),goals:next})){notice('Zapisano dobrowolne cele na tym urządzeniu.');render();}
  });
  form.addEventListener('submit',e=>{e.preventDefault();submit.click?.();});
  form.appendChild(submit);panel.appendChild(form);root.appendChild(panel);
 }
 function historyPanel(root,records){
  const panel=el('section','hg44-card');
  panel.appendChild(el('h3','','Historia zapisanych aktywności'));
  if(!records.length)panel.appendChild(el('p','hg44-muted','Nie zapisano jeszcze żadnej aktywności na tym urządzeniu.'));
  else for(const record of records.slice(-12).reverse()){
   const line=el('div','hg44-history-row');
   line.append(el('strong','',workouts[record.kind]),
    el('span','',record.day+' · '+Math.round(record.seconds/60)+' min'+(record.gps?' · '+fmt(record.distanceKm)+' km GPS':'')));
   panel.appendChild(line);
  }
  panel.appendChild(el('p','hg44-muted','Ta historia jest lokalna i przypisana do konta. Nie synchronizuje się automatycznie z innymi telefonami i nie przyznaje XP.'));
  root.appendChild(panel);
 }
 function render(){
  const page=$('activity');if(!page)return;
  let root=$('hg44Activity');
  if(!root){root=el('div','hg44-root');root.id='hg44Activity';
   const hero=page.querySelector?.('.hero');if(hero?.insertAdjacentElement)hero.insertAdjacentElement('afterend',root);
   else page.prepend?.(root);
  }
  d.body?.classList?.add?.('hg44-ready');
  const current=String(S.state?.uid||'');
  if(current!==owner){stopGps();if(tick){w.clearInterval?.(tick);tick=null;}run=null;owner=current;chosen=isoDay(new Date());detail=null;notices='';}
  root.replaceChildren();
  const head=el('header','hg44-header');
  head.append(el('span','hg44-kicker','HEALTHGO ACTIVITY 4.4'),
   el('h2','','Twoja aktywność'),
   el('p','hg44-muted','Prawdziwe pomiary, przejrzysta historia i odpoczynek we własnym tempie.'));
  root.appendChild(head);
  calendar(root);
  const record=dayData(chosen),data=storage();
  const caption=el('p','hg44-date',new Date(chosen+'T12:00:00').toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'}));
  root.appendChild(caption);
  metricsPanel(root,record,data.goals);graph(root);
  goals(root,data);
  trackPanel(root);historyPanel(root,data.records);
  const status=el('p','hg44-notice',notices);status.id='hg44Notice';status.setAttribute('role','status');root.appendChild(status);
  const footer=el('div','hg44-footer');
  footer.append(button('Odśwież dane',async()=>{
   if(busy)return;busy=true;notice('Synchronizuję dane…');
   try{await S.refreshHealth?.();notice('Odświeżono pomiary z konta.');}
   catch(_){notice('Nie udało się odświeżyć pomiarów.');}
   finally{busy=false;}
  }),button('Urządzenia',()=>{if(typeof w.mobileGo==='function')w.mobileGo('devices');else w.go?.('devices');},true));
  root.appendChild(footer);
 }
 S.subscribe?.(render);
 d.addEventListener?.('visibilitychange',()=>{
  if(d.hidden&&run&&!run.paused){pause();notice('Aktywność wstrzymana po przejściu aplikacji do tła. Wznów po powrocie.');}
  if(!d.hidden)render();
 });
 w.addEventListener?.('pageshow',render);
 w.HealthGoActivity44=Object.freeze({render,getState:()=>({owner,chosen,run:run?{kind:run.kind,paused:run.paused,gpsAllowed:run.gpsAllowed}:null})});
 render();
})(window);
