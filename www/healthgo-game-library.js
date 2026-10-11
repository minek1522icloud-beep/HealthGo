/* HealthGo Game Library v1 — real, prebuilt, MIT-licensed browser games.
 * Only HealthGoEngine verified metrics unlock titles. No invented XP, in-game scores
 * or fake rankings. Cross-origin sandbox protects HealthGo account information.
 */
(function(host){
'use strict';
const root=document.getElementById('hgGameLibrary');
const contests=document.getElementById('hgGameQuestsSummary');
if(!root||!contests)return;
const raw=[
 ['fruit-slice','Fruit Slice','🍉','Zręcznościowe','Przecinaj owoce gestem palca.'],
 ['bubble-shooter','Bubble Shooter','🫧','Logiczne','Celuj, dopasowuj i usuwaj grupy baniek.'],
 ['2048','2048','🔢','Logiczne','Łącz kafelki i zdobywaj coraz większe liczby.'],
 ['helix-drop','Helix Drop','🌀','Zręcznościowe','Przeprowadź piłkę przez wieżę.'],
 ['dino-run','Dino Run','🦖','Zręcznościowe','Biegnij i omijaj przeszkody.'],
 ['sudoku','Sudoku','🧩','Logiczne','Rozwiązuj klasyczne łamigłówki.'],
 ['water-sort','Water Sort','🧪','Logiczne','Segreguj barwy w probówkach.'],
 ['gem-match','Gem Match','💎','Logiczne','Łącz kolorowe klejnoty.'],
 ['stack-tower','Stack Tower','🏗️','Zręcznościowe','Układaj piętra wieży.'],
 ['snake','Snake','🐍','Klasyczne','Zbieraj jedzenie i rośnij.'],
 ['tic-tac-toe','Kółko i krzyżyk','⭕','Klasyczne','Rozegraj partię przeciwko komputerowi.'],
 ['connect-four','Connect Four','🔴','Klasyczne','Ułóż cztery pionki w jednym rzędzie.'],
 ['memory-match','Memory Match','🃏','Logiczne','Zapamiętuj i odnajduj pary.'],
 ['cross-road','Cross Road','🐸','Zręcznościowe','Przemieszczaj się przez ruchliwe plansze.'],
 ['slide-puzzle','Slide Puzzle','🧠','Logiczne','Przesuwaj kafelki na właściwe miejsca.'],
 ['merge-drop','Merge Drop','🍊','Logiczne','Łącz spadające owoce.'],
 ['lights-out','Lights Out','💡','Logiczne','Zgaś wszystkie lampki.'],
 ['sokoban','Sokoban','📦','Logiczne','Przesuń skrzynie na pola docelowe.'],
 ['piano-tap','Piano Tap','🎹','Zręcznościowe','Dotykaj odpowiednich klawiszy w rytmie.'],
 ['ant-flap','Ant Flap','🐜','Zręcznościowe','Steruj małym owadem między przeszkodami.'],
 ['ant-jump','Ant Jump','🦗','Zręcznościowe','Skacz coraz wyżej.'],
 ['air-hockey','Air Hockey','🏒','Sportowe','Rozegraj hokejową partię przy stole.'],
 ['reversi','Reversi','⚪','Klasyczne','Strategiczna gra planszowa.'],
 ['block-drop','Block Drop','🧱','Logiczne','Układaj spadające klocki.'],
 ['maze-muncher','Maze Muncher','🟡','Klasyczne','Odkrywaj labirynt i zbieraj punkty.'],
 ['paddle-duel','Paddle Duel','🏓','Sportowe','Odbijaj piłkę i wygraj pojedynek.'],
 ['breakout','Breakout','🌈','Zręcznościowe','Rozbij wszystkie klocki.'],
 ['whack-a-mole','Whack-a-Mole','🎯','Zręcznościowe','Sprawdzaj refleks w kolorowej grze.']
];
const categories=['Wszystkie','Z zadaniami','Odblokowane','Ulubione','Zręcznościowe','Logiczne','Klasyczne','Sportowe'];
const STARTERS=new Set(['fruit-slice','bubble-shooter','2048']);
const GAMES=Object.freeze(raw.map((r,i)=>Object.freeze({
 id:r[0],title:r[1],icon:r[2],category:r[3],description:r[4],starter:STARTERS.has(r[0]),recommended:[0,1,2,3,4,7,9,16].includes(i),
 // A verified HealthGo milestone OR an accessible alternative. Not a claim about in-game progress.
 unlock:STARTERS.has(r[0])?[]:questOptions(i),
 mission:missionFor(i)
})));
let uid=null,storage=null,active=null,filter='Wszystkie',query='',viewer=null,loadingRequest=0;
function questOptions(i){
 const badgeTarget=1+Math.floor((i-3)%9/3);
 const challengeTarget=1+Math.floor((i-3)%12/4);
 const levelTarget=2+Math.floor((i-3)%15/5)*2;
 switch(i%5){
  case 0:return [{kind:'badges',target:badgeTarget},{kind:'dailyTasks',target:challengeTarget}];
  case 1:return [{kind:'challenges',target:challengeTarget},{kind:'badges',target:badgeTarget}];
  case 2:return [{kind:'level',target:levelTarget},{kind:'dailyTasks',target:challengeTarget}];
  case 3:return [{kind:'steps',target:500},{kind:'badges',target:badgeTarget}];
  default:return [{kind:'plans',target:challengeTarget},{kind:'badges',target:badgeTarget}];
 }
}
function missionFor(i){
 const type=['badges','challenges','dailyTasks','plans','level'][i%5];
 const value=type==='level'?2+Math.floor(i/9):type==='badges'?1+Math.floor(i/10):1+Math.floor(i/12);
 return {kind:type,target:value};
}
function currentUid(){return String(host.HealthGoServices?.state?.uid||'');}
function stateKey(user){return 'healthgo.game-library.v1.'+user;}
function empty(){return {unlocks:[],favourites:[],plays:{},gameStorage:{}};}
function ensureOwner(){
 const next=currentUid();
 if(uid===next&&storage)return;
 closeGame();
 uid=next;storage=empty();
 if(!uid)return;
 try{
  const previous=JSON.parse(localStorage.getItem(stateKey(uid))||'null');
  if(!previous||typeof previous!=='object')return;
  for(const field of ['unlocks','favourites'])if(Array.isArray(previous[field]))
   storage[field]=previous[field].filter(x=>GAMES.some(g=>g.id===x)).slice(0,GAMES.length);
  if(previous.plays&&typeof previous.plays==='object'){
   for(const g of GAMES){const n=Number(previous.plays[g.id]);if(Number.isSafeInteger(n)&&n>=0)storage.plays[g.id]=Math.min(n,100000);}
  }
  if(previous.gameStorage&&typeof previous.gameStorage==='object'){
   for(const g of GAMES){
    const record=previous.gameStorage[g.id];if(!record||typeof record!=='object')continue;
    storage.gameStorage[g.id]={};
    for(const [key,val] of Object.entries(record).slice(0,35)){
     if(typeof key==='string'&&key.length<=90&&/^[\w.:-]+$/.test(key)&&typeof val==='string'&&val.length<=2000)
      storage.gameStorage[g.id][key]=val;
    }
   }
  }
 }catch(_){}
}
function persist(){if(!uid)return false;try{localStorage.setItem(stateKey(uid),JSON.stringify(storage));return true;}catch(_){return false;}}
function metrics(){
 const state=host.HealthGoServices?.state,engine=state?.engine,api=host.HealthGoEngine;
 const empty={badges:0,challenges:0,dailyTasks:0,plans:0,level:1,steps:0};
 if(!uid||!engine||!api)return empty;
 const m=engine.metrics||{};
 let badges=0,challenges=0;
 try{badges=api.viewAchievements(engine).filter(x=>x.earned===true).length;}catch(_){}
 try{challenges=api.viewChallenges(engine).filter(x=>x.status==='completed'&&x.category!=='daily').length;}catch(_){}
 const days=m.healthDays||{};
 const steps=Object.values(days).reduce((sum,d)=>sum+(Number.isFinite(d?.steps)?Math.max(0,d.steps):0),0);
 let level=1;try{level=api.getLevel(Math.max(0,Number(engine.totalXp)||0)).level;}catch(_){}
 return {badges,challenges,dailyTasks:Math.max(0,Number(m.totalDailyTasks)||0),
  plans:Math.max(Object.keys(m.plans||{}).length,Number(m.legacyCounts?.plans)||0),
  level,steps};
}
function progress(q,s){return Math.max(0,Math.min(q.target,Number(s[q.kind])||0));}
function meets(q,s){return progress(q,s)>=q.target;}
function label(q){
 const names={badges:'odznak',challenges:'wyzwań',dailyTasks:'zadań dnia',plans:'punktów Planu Dnia',level:'poziom konta',steps:'kroków z potwierdzonych danych'};
 return (q.kind==='level'?'Osiągnij poziom ':'Zdobądź ')+q.target+' '+(q.kind==='level'?'konta HealthGo':names[q.kind]||'osiągnięć');
}
function unlocked(game){return game.starter||storage.unlocks.includes(game.id);}
function refreshUnlocks(){
 if(!uid||!host.HealthGoServices?.state?.engine)return;
 const m=metrics();
 let changed=false;
 for(const g of GAMES){
  if(unlocked(g)||!g.unlock.length)continue;
  if(g.unlock.some(q=>meets(q,m))){storage.unlocks.push(g.id);changed=true;}
 }
 if(changed)persist();
}
function escape(v){return String(v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
function tile(g){
 const unlockedNow=unlocked(g),favorite=storage.favourites.includes(g.id),q=g.unlock;
 const m=metrics();
 const shortest=q.length?q.reduce((best,x)=>Math.max(best,Math.min(1,progress(x,m)/x.target)),0):1;
 const requirement=q.length?'Zadanie: '+label(q[0]):'Dostępna od początku';
 const hasMission=!!g.mission;
 return '<article class="hgl-card '+(unlockedNow?'ready':'locked')+'" data-id="'+g.id+'">'+
 '<div class="hgl-cover hgl-bg-'+(GAMES.indexOf(g)%8)+'"><span aria-hidden="true">'+g.icon+'</span>'+
 (g.starter?'<small>STARTOWA</small>':unlockedNow?'<small>ODBLOCKOWANA</small>':'<small>🔒 DO ODBLOKOWANIA</small>')+'</div>'+
 '<div class="hgl-card-body"><strong>'+escape(g.title)+'</strong><small>'+escape(g.category)+'</small>'+
 '<div class="hgl-task"><span>'+escape(requirement)+'</span>'+
 (!unlockedNow?'<div class="hgl-progress"><i style="width:'+Math.round(shortest*100)+'%"></i></div>':'')+'</div>'+
 '<div class="hgl-card-actions"><button type="button" class="hgl-play" data-hgl-play="'+g.id+'">'+(unlockedNow?'Zagraj':'Zobacz zadania')+'</button>'+
 '<button type="button" class="hgl-fav" data-hgl-fav="'+g.id+'" aria-label="'+(favorite?'Usuń z ulubionych':'Dodaj do ulubionych')+'" aria-pressed="'+favorite+'">'+(favorite?'♥':'♡')+'</button></div></div></article>';
}
function listGames(){
 const term=query.trim().toLocaleLowerCase('pl');
 return GAMES.filter(g=>{
  const pass=filter==='Wszystkie'||filter==='Z zadaniami'||(filter==='Odblokowane'&&unlocked(g))||
    (filter==='Ulubione'&&storage.favourites.includes(g.id))||g.category===filter;
  const found=!term||(g.title+' '+g.category+' '+g.description).toLocaleLowerCase('pl').includes(term);
  return pass&&found;
 }).sort((a,b)=>Number(unlocked(b))-Number(unlocked(a))||Number(b.recommended)-Number(a.recommended));
}
function render(){
 ensureOwner();refreshUnlocks();
 const cards=listGames(),m=metrics();
 const owned=GAMES.filter(unlocked).length;
 root.innerHTML='<div class="hgl-hero"><div><span class="hgl-eyebrow">HEALTHGO GAMES</span><h2>Gry za osiągnięcia</h2>'+
 '<p>Prawdziwe gry HTML5, bez tworzenia ich od zera. Trzy tytuły są dostępne od początku, kolejne odblokujesz przez różne zadania HealthGo.</p></div>'+
 '<div class="hgl-hero-number"><b>'+owned+'</b><span>odblokowane / '+GAMES.length+'</span></div></div>'+
 '<div class="hgl-stats"><span><b>'+m.badges+'</b> odznak</span><span><b>'+m.level+'</b> poziom konta</span>'+
 '<span><b>'+m.challenges+'</b> ukończonych wyzwań</span></div>'+
 '<div class="hgl-controls"><label class="hgl-search"><span aria-hidden="true">⌕</span><input id="hgGameSearch" type="search" placeholder="Wyszukaj grę..." value="'+escape(query)+'" autocomplete="off" aria-label="Szukaj gier"></label>'+
 '<div class="hgl-filters" role="group" aria-label="Filtruj gry">'+categories.map(name=>'<button type="button" class="'+(filter===name?'selected':'')+'" data-hgl-filter="'+escape(name)+'" aria-pressed="'+(filter===name)+'">'+escape(name)+'</button>').join('')+'</div></div>'+
 '<div class="hgl-list-title"><h3>'+escape(filter==='Wszystkie'?'Polecane i wszystkie gry':filter)+'</h3><span>'+cards.length+' gier</span></div>'+
 (cards.length?'<div class="hgl-grid">'+cards.map(tile).join('')+'</div>':'<div class="hgl-empty">Nie znaleziono gier. Spróbuj innej nazwy lub kategorii.</div>')+
 '<p class="hgl-credit">Gry: <a href="https://github.com/mashukui/web-games" target="_blank" rel="noopener noreferrer">Web Games by mashukui</a> · licencja MIT. Postęp odblokowania zapisujemy lokalnie dla zalogowanego konta; synchronizacja między telefonami wymaga osobnej usługi.</p>';
 renderContests();
}
function renderContests(){
 if(!storage)return;
 const m=metrics(),total=GAMES.filter(unlocked).length;
 const next=GAMES.filter(g=>!unlocked(g)).slice(0,3);
 const summaries=next.map(g=>{
  const q=g.unlock[0],p=progress(q,m),pct=Math.round(p/q.target*100);
  return '<article class="hgl-mission-card"><strong>'+escape(g.icon+' '+g.title)+'</strong>'+
  '<span>'+escape(label(q))+'</span><div class="hgl-progress"><i style="width:'+pct+'%"></i></div>'+
  '<small>'+p+' / '+q.target+' · alternatywna misja również dostępna</small>'+
  '<button type="button" data-hgl-details="'+g.id+'">Sprawdź zadania →</button></article>';
 }).join('');
 contests.innerHTML='<div class="hgl-contest-hero"><h3>🏆 Misje i gry HealthGo</h3>'+
 '<p>Odblokowano '+total+' z '+GAMES.length+' gotowych gier. Zadania opierają się na Twoich odznakach i potwierdzonych postępach HealthGo.</p></div>'+
 (next.length?'<div class="hgl-mission-grid">'+summaries+'</div>':'<p class="hgl-finished">Wszystkie dostępne gry są odblokowane!</p>')+
 '<p class="hgl-credit">Wyniki wewnątrz cudzych gier nie przyznają automatycznie XP. System HealthGo nalicza XP wyłącznie za zdarzenia zatwierdzone przez backend. Ranking graczy wymaga oddzielnej, bezpiecznej integracji.</p>';
}
function detail(game){
 const m=metrics(),open=unlocked(game);
 const qlist=game.unlock.map(q=>{
  const p=progress(q,m),done=meets(q,m);
  return '<li class="'+(done?'done':'')+'"><div><strong>'+escape(label(q))+'</strong>'+
  '<span>'+p+' / '+q.target+(done?' · Ukończono':'')+'</span></div><div class="hgl-progress"><i style="width:'+Math.round(p/q.target*100)+'%"></i></div></li>';
 }).join('');
 const mission=game.mission,complete=meets(mission,m);
 const box=document.getElementById('hgGameDialog');
 if(!box)return;
 box.innerHTML='<div class="hgl-dialog-backdrop" data-hgl-close></div><section class="hgl-dialog-panel" role="dialog" aria-modal="true" aria-label="'+escape(game.title)+'">'+
 '<header><div class="hgl-dialog-icon">'+game.icon+'</div><div><small>'+escape(game.category)+'</small><h2>'+escape(game.title)+'</h2></div>'+
 '<button type="button" data-hgl-close class="hgl-close" aria-label="Zamknij">×</button></header>'+
 '<p>'+escape(game.description)+'</p>'+
 (!open?'<h3>Wybierz JEDNO z zadań, aby odblokować grę:</h3>'+
 '<ul class="hgl-quest-list">'+qlist+'</ul><p class="hgl-dialog-note">Zadania nie wymagają wykonywania wszystkich aktywności; możesz wybrać alternatywę. Nie musisz udostępniać danych GPS ani ćwiczyć, aby zdobyć tę grę.</p>'+
 '<button type="button" data-hgl-challenges class="hgl-mainbtn">Przejdź do Wyzwań HealthGo</button>':
 '<h3>Twoja misja w HealthGo</h3><ul class="hgl-quest-list"><li class="'+(complete?'done':'')+'"><div><strong>'+escape(label(mission))+'</strong><span>'+progress(mission,m)+' / '+mission.target+(complete?' · Zaliczone':'')+'</span></div>'+
 '<div class="hgl-progress"><i style="width:'+Math.round(progress(mission,m)/mission.target*100)+'%"></i></div></li></ul>'+
 '<p class="hgl-dialog-note">Nagrody XP za potwierdzone osiągnięcia przyznaje istniejący system HealthGo. Nie naliczamy dodatkowego XP za samo otwarcie gry.</p>'+
 '<button type="button" class="hgl-mainbtn" data-hgl-launch="'+game.id+'">▶ Uruchom prawdziwą grę</button>')+
 '<div class="hgl-source">Autor gier: mashukui · <a href="https://github.com/mashukui/web-games/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT</a></div></section>';
 box.hidden=false;document.body.classList.add('hgl-dialog-open');
 box.querySelector('[data-hgl-close]')?.focus?.({preventScroll:true});
}
function closeDialog(){
 const el=document.getElementById('hgGameDialog');
 if(el){el.hidden=true;el.replaceChildren();}
 document.body.classList.remove('hgl-dialog-open');
}
function gameKey(id){return 'healthgo.game.library.source.'+id;}
function gameStorage(id){return storage.gameStorage[id]||{};}
function safeStorageMessage(event){
 if(!active||!viewer||event.source!==viewer.contentWindow)return;
 const d=event.data;
 if(!d||d.type!=='HEALTHGO_GAME_STORAGE'||d.game!==active.id||!uid)return;
 if(typeof d.key!=='string'||!(/^[\w.:-]{1,90}$/).test(d.key)||typeof d.value!=='string'||d.value.length>2000)return;
 const data=storage.gameStorage[active.id]||{};
 if(Object.keys(data).length>=35&&!Object.prototype.hasOwnProperty.call(data,d.key))return;
 data[d.key]=d.value;storage.gameStorage[active.id]=data;
 persist();
}
function injection(game){
 // Games stay in opaque-origin sandbox. They see only their own public game-state
 // keys; HealthGo session, localStorage, health data, auth and parent DOM are inaccessible.
 return '<script>(function(){ "use strict"; var values={};'+
 'try {var name=String(window.name||""); if(name.indexOf("HGL:")===0) values=JSON.parse(decodeURIComponent(name.slice(4)))||{};}catch(e){}'+
 'var game='+JSON.stringify(game.id)+';'+
 'var shim={getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(values,k)?values[k]:null;},'+
 'setItem:function(k,v){k=String(k);v=String(v);values[k]=v;try{parent.postMessage({type:"HEALTHGO_GAME_STORAGE",game:game,key:k,value:v},"*");}catch(e){}},'+
 'removeItem:function(k){delete values[String(k)];},clear:function(){values={};}};'+
 'try{Object.defineProperty(window,"localStorage",{configurable:true,value:shim});}catch(e){}'+
 '})();<\/script>';
}
async function launch(game){
 ensureOwner();refreshUnlocks();
 if(!unlocked(game))return detail(game);
 const ticket=++loadingRequest;
 closeDialog();
 active=game;
 const modal=document.getElementById('hgGameViewer');
 if(!modal)return;
 modal.hidden=false;document.body.classList.add('hgl-playing');
 modal.innerHTML='<div class="hgl-player-head"><button type="button" data-hgl-exit>← Wróć do gier</button><strong>'+escape(game.title)+'</strong><span>Gra zewnętrznego autora</span></div>'+
 '<p class="hgl-player-status" role="status">Wczytywanie prawdziwej gry…</p><div class="hgl-frame-container"></div>';
 try{
  // One verified, local source. No remote game feed or unauthorised embeds.
  const path='./community-games/'+game.id+'/index.html';
  const response=await fetch(path,{cache:'force-cache'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const html=await response.text();
  if(ticket!==loadingRequest||active?.id!==game.id)return;
  if(!html.includes('<html')||!html.includes('../i18n.js'))throw Error('Niewłaściwy format gry');
  const base=new URL('./community-games/'+game.id+'/',location.href).href;
  const patched=html.replace(/<head>/i,'<head><base href="'+base+'">'+injection(game));
  const frame=document.createElement('iframe');
  frame.className='hgl-game-frame';
  frame.setAttribute('title','Gra '+game.title);
  frame.setAttribute('sandbox','allow-scripts');
  frame.setAttribute('referrerpolicy','no-referrer');
  frame.setAttribute('allow','fullscreen');
  frame.name='HGL:'+encodeURIComponent(JSON.stringify(gameStorage(game.id)));
  frame.addEventListener('load',()=>{const state=modal.querySelector('.hgl-player-status');if(state)state.textContent='Gra gotowa. Użyj dotyku lub klawiatury.';});
  frame.srcdoc=patched;viewer=frame;
  modal.querySelector('.hgl-frame-container')?.appendChild(frame);
  if(uid){storage.plays[game.id]=Math.min(100000,(storage.plays[game.id]||0)+1);persist();}
 }catch(e){
  if(ticket!==loadingRequest)return;
  const state=modal.querySelector('.hgl-player-status');
  if(state)state.textContent='Nie można otworzyć gry. Sprawdź połączenie lub spróbuj ponownie.';
 }
}
function closeGame(){
 loadingRequest++;
 if(!active)return;
 active=null;viewer=null;
 const el=document.getElementById('hgGameViewer');
 if(el){el.hidden=true;el.replaceChildren();}
 document.body.classList.remove('hgl-playing');
}
root.addEventListener('click',e=>{
 const filterButton=e.target.closest('[data-hgl-filter]');
 if(filterButton){filter=filterButton.dataset.hglFilter;render();return;}
 const fav=e.target.closest('[data-hgl-fav]');
 if(fav){ensureOwner();const id=fav.dataset.hglFav;if(!GAMES.some(g=>g.id===id)||!uid)return;
  storage.favourites=storage.favourites.includes(id)?storage.favourites.filter(x=>x!==id):storage.favourites.concat(id);
  persist();render();return;}
 const play=e.target.closest('[data-hgl-play]');
 if(play){const game=GAMES.find(g=>g.id===play.dataset.hglPlay);if(game)detail(game);}
});
root.addEventListener('input',e=>{
 if(e.target.id!=='hgGameSearch')return;
 query=e.target.value;
 // Preserve focus/caret on Safari by only rerendering the cards.
 const cards=listGames();
 const grid=root.querySelector('.hgl-grid'),empty=root.querySelector('.hgl-empty'),heading=root.querySelector('.hgl-list-title span');
 if(heading)heading.textContent=cards.length+' gier';
 if(grid){grid.innerHTML=cards.map(tile).join('');grid.hidden=cards.length===0;}
 if(empty)empty.hidden=cards.length!==0;
});
document.getElementById('hgGameDialog')?.addEventListener('click',e=>{
 if(e.target.closest('[data-hgl-close]')){closeDialog();return;}
 if(e.target.closest('[data-hgl-challenges]')){closeDialog();host.mobileGo?.('challenges');return;}
 const b=e.target.closest('[data-hgl-launch]');
 if(b){const game=GAMES.find(g=>g.id===b.dataset.hglLaunch);if(game)launch(game);}
});
document.getElementById('hgGameViewer')?.addEventListener('click',e=>{if(e.target.closest('[data-hgl-exit]')){closeGame();render();}});
contests.addEventListener('click',e=>{
 const b=e.target.closest('[data-hgl-details]');if(!b)return;
 const game=GAMES.find(g=>g.id===b.dataset.hglDetails);
 if(game){host.mobileGo?.('games');detail(game);}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(active)closeGame();else closeDialog();}});
host.addEventListener('message',safeStorageMessage);
let renderScheduled=false;
function scheduleRender(){if(renderScheduled)return;renderScheduled=true;host.setTimeout(()=>{renderScheduled=false;if(!active)render();},70);}
host.HealthGoServices?.subscribe?.(scheduleRender);
host.HealthGoServices?.events?.addEventListener?.('SESSION_CHANGED',scheduleRender);
host.HealthGoGameLibrary=Object.freeze({refresh:render,closeGame,list:GAMES,metrics,questProgress:progress,isUnlocked:function(id){ensureOwner();refreshUnlocks();const g=GAMES.find(x=>x.id===id);return !!(g&&unlocked(g));},getState:function(){ensureOwner();return JSON.parse(JSON.stringify(storage));}});
render();
})(window);