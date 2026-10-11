/* HealthGo Arcade 40 v1 — original, offline-ready touch games.
 * Local progress is not a certified online leaderboard. Do not grant account XP here.
 * Two local points awarded once per completed 40-level campaign. */
(function(host){
'use strict';
if(typeof document==='undefined')return;
const mazeHost=document.getElementById('hgArcadeMaze');
const aimHost=document.getElementById('hgArcadeAim');
const contestHost=document.getElementById('hgArcadeContestRoot');
if(!mazeHost||!aimHost||!contestHost)return;
const MAX=40,COINS=2;
const labels={maze:'Labirynt 40',aim:'Celność 40'};
let owner='',state=null,maze=null,aim=null,aimTimer=null,aimPaused=false,aimLastTick=0;
function id(){return String(host.HealthGoServices?.state?.uid||'guest');}
function storeKey(){return 'healthgo.arcade40.v1.'+id();}
function empty(){return {maze:{level:1,completed:false,claimed:false,bestSteps:{}},aim:{level:1,completed:false,claimed:false,bestTime:{}},history:[]};}
function load(){
 let v;try{v=JSON.parse(localStorage.getItem(storeKey())||'null');}catch(_){}
 if(!v||typeof v!=='object')v={};
 const e=empty();
 for(const g of ['maze','aim']){
  const s=v[g]||{};e[g].level=Math.max(1,Math.min(MAX,Math.floor(Number(s.level)||1)));
  e[g].completed=s.completed===true;e[g].claimed=s.claimed===true&&e[g].completed;
  e[g].bestSteps=s.bestSteps&&typeof s.bestSteps==='object'?s.bestSteps:{};
  e[g].bestTime=s.bestTime&&typeof s.bestTime==='object'?s.bestTime:{};
  if(e[g].completed)e[g].level=MAX;
 }
 e.history=Array.isArray(v.history)?v.history.filter(h=>h&&['maze','aim'].includes(h.game)&&Number(h.level)>=1&&Number(h.level)<=MAX).slice(-60):[];
 return e;
}
function ensure(){
 const next=id();if(state&&owner===next)return;
 stopAim();owner=next;state=load();maze=null;aim=null;
}
function save(){try{localStorage.setItem(storeKey(),JSON.stringify(state));return true;}catch(_){return false;}}
function score(){ensure();return (state.maze.claimed?COINS:0)+(state.aim.claimed?COINS:0);}
function done(game,level,metric){
 ensure();const item=state[game];if(!item||item.completed||level!==item.level)return false;
 if(game==='maze')item.bestSteps[level]=metric;
 else item.bestTime[level]=metric;
 state.history.push({game,level,at:new Date().toISOString()});state.history=state.history.slice(-60);
 if(level===MAX){item.completed=true;item.claimed=true;} else item.level=level+1;
 save();renderContests();return true;
}
function rng(seed){let x=seed|0;return ()=>{x|=0;x=x+0x6d2b79f5|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function keyOf(x,y){return x+','+y;}
function mazeLevel(level){
 level=Math.max(1,Math.min(MAX,Math.floor(level)));
 const n=9+2*Math.min(3,Math.floor((level-1)/10)),random=rng(level*7907+17);
 const grid=Array.from({length:n},()=>Array(n).fill('#')),stack=[[1,1]];
 grid[1][1]='.';
 const dirs=[[2,0],[-2,0],[0,2],[0,-2]];
 while(stack.length){
  const top=stack[stack.length-1],options=[];
  for(const d of dirs){let nx=top[0]+d[0],ny=top[1]+d[1];if(nx>0&&ny>0&&nx<n-1&&ny<n-1&&grid[ny][nx]==='#')options.push([nx,ny,d[0],d[1]]);}
  if(!options.length){stack.pop();continue;}
  const [nx,ny,dx,dy]=options[Math.floor(random()*options.length)];
  grid[top[1]+dy/2][top[0]+dx/2]='.';grid[ny][nx]='.';stack.push([nx,ny]);
 }
 const goal=[n-2,n-2],queue=[[1,1]],from=new Map([['1,1',null]]),steps=[[1,0],[-1,0],[0,1],[0,-1]];
 for(let qi=0;qi<queue.length;qi++){
  const [x,y]=queue[qi];
  for(const [dx,dy] of steps){
   const nx=x+dx,ny=y+dy,k=keyOf(nx,ny);
   if(nx>=0&&ny>=0&&nx<n&&ny<n&&grid[ny][nx]==='.'&&!from.has(k)){from.set(k,[x,y]);queue.push([nx,ny]);}
  }
 }
 const path=[];let point=goal;
 while(point){path.push(point);point=from.get(keyOf(point[0],point[1]));}
 path.reverse();
 const amount=1+Math.floor((level-1)/15),stars=[];
 for(let i=1;i<=amount;i++){
  const index=Math.max(1,Math.min(path.length-2,Math.floor((path.length-1)*i/(amount+1))));
  const p=path[index],name=keyOf(p[0],p[1]);
  if(!stars.includes(name))stars.push(name);
 }
 return {level,n,grid,goal,stars,solution:path.length-1};
}
function startMaze(){
 ensure();const layout=mazeLevel(state.maze.level);
 maze={...layout,x:1,y:1,steps:0,taken:new Set(),win:false};
 drawMaze();
}
function drawMaze(){
 ensure();if(!maze)startMaze();
 const m=maze,record=state.maze;
 const rows=m.grid.map((row,y)=>row.map((cell,x)=>{
  const key=keyOf(x,y);
  const wall=cell==='#',player=m.x===x&&m.y===y,star=m.stars.includes(key)&&!m.taken.has(key);
  const exit=m.goal[0]===x&&m.goal[1]===y;
  return '<span role="img" aria-label="'+(player?'Gracz':star?'Gwiazdka':exit?'Meta':wall?'Ściana':'Przejście')+'" class="hga-maze-cell '+(wall?'wall':'floor')+(player?' player':'')+(star?' star':'')+(exit?' exit':'')+'">'+(player?'●':star?'★':exit?'⚑':'')+'</span>';
 }).join('')).join('');
 mazeHost.innerHTML='<div class="hga-heading"><div><h3>🧭 Labirynt 40</h3><span>Poziom '+m.level+' / 40 · ruchy: '+m.steps+'</span></div><span class="hga-coin">+2 punkty po 40</span></div>'+
 '<div class="hga-progress"><span style="width:'+(record.completed?100:(m.level-1)/MAX*100)+'%"></span></div>'+
 '<p class="hga-note">Zbierz wszystkie gwiazdki i dotrzyj do flagi. Użyj strzałek albo przesuń palcem po planszy.</p>'+
 '<div class="hga-maze" role="group" tabindex="0" aria-label="Labirynt, poziom '+m.level+'" style="--hga-columns:'+m.n+'">'+rows+'</div>'+
 '<div class="hga-playbar"><div class="hga-dpad" aria-label="Sterowanie labiryntem">'+
 '<button type="button" data-hga-move="up" aria-label="W górę">↑</button>'+
 '<div><button type="button" data-hga-move="left" aria-label="W lewo">←</button>'+
 '<button type="button" data-hga-move="down" aria-label="W dół">↓</button>'+
 '<button type="button" data-hga-move="right" aria-label="W prawo">→</button></div></div>'+
 '<div class="hga-status" role="status" aria-live="polite">'+
 (record.completed?'<strong>Ukończono kampanię!</strong><span>Zdobyte punkty gry: 2</span>':
  m.win?'<strong>Poziom ukończony!</strong><span>Nowy poziom jest już odblokowany.</span>':
 '<strong>Gwiazdki: '+m.taken.size+' / '+m.stars.length+'</strong><span>Najkrótsza ścieżka: '+m.solution+' pól</span>')+
 '<button type="button" data-hga-restart="maze">Powtórz poziom</button></div></div>';
}
function move(direction){
 ensure();if(!maze||maze.win||state.maze.completed)return false;
 const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[direction];if(!d)return false;
 const x=maze.x+d[0],y=maze.y+d[1];
 if(!maze.grid[y]||maze.grid[y][x]!=='.')return false;
 maze.x=x;maze.y=y;maze.steps++;
 const key=keyOf(x,y);if(maze.stars.includes(key))maze.taken.add(key);
 if(x===maze.goal[0]&&y===maze.goal[1]&&maze.taken.size===maze.stars.length){
  const passed=done('maze',maze.level,maze.steps);if(passed)maze.win=true;
 }
 drawMaze();
 return true;
}
function stopAim(){if(aimTimer!==null){clearInterval(aimTimer);aimTimer=null;}}
function seconds(level){return Math.max(8,21-Math.floor((level-1)/4));}
function requirements(level){return 3+Math.floor((level-1)/8);}
function createAim(){
 ensure();stopAim();aim={level:state.aim.level,remaining:requirements(state.aim.level),seconds:seconds(state.aim.level),elapsed:0,hit:null,fail:false,win:false,started:false,previous:-1};
 drawAim();
}
function nextTarget(){
 if(!aim)return;
 let target=Math.floor(Math.random()*9);
 if(target===aim.previous)target=(target+1+Math.floor(Math.random()*8))%9;
 aim.previous=target;aim.hit=target;
}
function tick(){
 if(!aim||!aim.started||aim.win||aim.fail)return;
 const now=Date.now(),delta=Math.min(1,Math.max(0,(now-aimLastTick)/1000));aimLastTick=now;
 if(document.visibilityState==='hidden'){stopAim();aimPaused=true;return;}
 aim.elapsed+=delta;if(aim.elapsed>=aim.seconds){aim.elapsed=aim.seconds;aim.fail=true;stopAim();}
 if(aim.fail)drawAim();
 else{const counter=aimHost.querySelector('.hga-timer b');if(counter)counter.textContent=Math.max(0,aim.seconds-aim.elapsed).toFixed(1)+' s';}
}
function startAim(){
 ensure();if(state.aim.completed)return;
 if(!aim||aim.fail||aim.win)createAim();
 if(aimTimer!==null)return;
 const resuming=aimPaused&&aim.started;
 aim.started=true;aimPaused=false;aimLastTick=Date.now();
 if(!resuming||aim.hit===null)nextTarget();
 stopAim();aimTimer=setInterval(tick,100);
 drawAim();
}
function drawAim(full=true){
 ensure();if(!aim)createAim();
 const s=state.aim,remain=Math.max(0,aim.seconds-aim.elapsed);
 const board=Array.from({length:9},(_,i)=>'<button type="button" class="hga-target'+(aim.hit===i&&aim.started&&!aim.fail&&!aimPaused?' live':'')+'" data-hga-hit="'+i+'" aria-label="Pole '+(i+1)+(aim.hit===i&&aim.started&&!aimPaused?' — cel':'')+'" '+(aim.hit===i&&aim.started&&!aim.fail&&!aimPaused?'':'disabled')+'>'+(aim.hit===i&&aim.started&&!aim.fail&&!aimPaused?'🎯':'')+'</button>').join('');
 // Complete board refresh is small and avoids accumulating event handlers.
 aimHost.innerHTML='<div class="hga-heading"><div><h3>🎯 Celność 40</h3><span>Poziom '+s.level+' / 40 · trafienia: '+(requirements(aim.level)-aim.remaining)+'/'+requirements(aim.level)+'</span></div><span class="hga-coin">+2 punkty po 40</span></div>'+
 '<div class="hga-progress"><span style="width:'+(s.completed?100:(s.level-1)/MAX*100)+'%"></span></div>'+
 '<p class="hga-note">Dotykaj świecących celów, zanim skończy się czas. Każdy kolejny etap jest trudniejszy.</p>'+
 '<div class="hga-timer" role="status">Pozostały czas: <b>'+remain.toFixed(1)+' s</b></div>'+
 '<div class="hga-target-board" role="group" aria-label="Plansza celności">'+board+'</div>'+
 '<div class="hga-aim-end" role="status" aria-live="polite">'+
 (s.completed?'🏆 Kampania ukończona! Zdobyto 2 punkty.':aim.win?'Brawo! Poziom zaliczony.':aim.fail?'Koniec czasu. Spróbuj ponownie.':aimPaused?'Gra wstrzymana — naciśnij Wznów.':aim.started?'Cel jest podświetlony — dotknij go.':'Przygotuj się i naciśnij Start.')+
 '</div><button class="hga-primary" type="button" data-hga-aim-start '+(aimTimer!==null?'disabled':'')+'>'+((aim.fail||aim.win)?'Następna próba':aimTimer!==null?'Gra trwa':aimPaused?'Wznów':'Start')+'</button>';
}
function hit(index){
 ensure();
 if(!aim||!aim.started||aimPaused||aimTimer===null||aim.fail||aim.win||index!==aim.hit)return false;
 aim.remaining--;
 if(aim.remaining<=0){
  aim.win=done('aim',aim.level,Math.round(aim.elapsed*100)/100);
  stopAim();if(!state.aim.completed)createAim();
  else drawAim();
 }else{nextTarget();drawAim();}
 return true;
}
function renderContests(){
 if(!state)return;
 const points=score();
 const tiles=['maze','aim'].map(g=>{
  const p=state[g],doneCount=p.completed?40:p.level-1,percent=Math.round(doneCount/MAX*100);
  return '<article class="hga-contest-card"><div class="hga-contest-top"><strong>'+labels[g]+'</strong><span>'+(p.completed?'Ukończone':'W toku')+'</span></div>'+
  '<p>Ukończ 40 prawdziwych poziomów, aby jednorazowo odebrać 2 punkty gry.</p>'+
  '<div class="hga-progress"><span style="width:'+percent+'%"></span></div>'+
  '<div class="hga-contest-bottom"><b>'+doneCount+' / 40 poziomów</b><b>'+(p.claimed?'2 / 2 punktów':'0 / 2 punktów')+'</b></div>'+
  '<button type="button" data-hga-play="'+g+'" class="hga-primary">Otwórz grę</button></article>';
 }).join('');
 const history=state.history.slice(-6).reverse().map(h=>'<li>'+labels[h.game]+' · poziom '+Math.floor(h.level)+'</li>').join('');
 contestHost.innerHTML='<section class="hga-contest-head"><div><small>HEALTHGO ARCADE</small><h3>Konkursy i nagrody</h3><p>Zdobywaj punkty za ukończone kampanie. Wyniki i punkty przechowywane są lokalnie na Twoim urządzeniu.</p></div>'+
 '<div class="hga-total"><strong>'+points+'</strong><span>punktów gry</span></div></section>'+
 '<div class="hga-contest-grid">'+tiles+'</div>'+
 '<section class="hga-contest-history"><h3>Ostatnie ukończone poziomy</h3>'+(history?'<ul>'+history+'</ul>':'<p>Jeszcze nie ukończono żadnego poziomu.</p>')+
 '<p class="hga-note">To prawdziwy postęp Twoich gier, ale nie jest internetowym rankingiem innych osób. Punkty nie są wymienialne na pieniądze ani nagrody rzeczowe.</p></section>';
}
function refresh(){
 ensure();if(!maze||maze.level!==state.maze.level)startMaze();
 else drawMaze();
 if(!aim||aim.level!==state.aim.level)createAim();else drawAim();
 renderContests();
}
mazeHost.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||!mazeHost.contains(b))return;
 if(b.dataset.hgaMove)move(b.dataset.hgaMove);
 if(b.dataset.hgaRestart==='maze')startMaze();
});
mazeHost.addEventListener('keydown',e=>{
 const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
 if(d){e.preventDefault();e.stopPropagation();move(d);}
});
let touchStart=null;
mazeHost.addEventListener('touchstart',e=>{touchStart=null;if(e.touches.length===1&&e.target.closest?.('.hga-maze'))touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
mazeHost.addEventListener('touchend',e=>{
 if(!touchStart||!e.changedTouches.length)return;
 const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;touchStart=null;
 if(Math.max(Math.abs(dx),Math.abs(dy))<28)return;
 move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
},{passive:true});
aimHost.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||!aimHost.contains(b))return;
 if(b.hasAttribute('data-hga-hit'))hit(Number(b.getAttribute('data-hga-hit')));
 if(b.hasAttribute('data-hga-aim-start'))startAim();
});
contestHost.addEventListener('click',e=>{
 const b=e.target.closest('[data-hga-play]');if(!b||!contestHost.contains(b))return;
 const game=b.getAttribute('data-hga-play');
 if(typeof host.mobileGo==='function')host.mobileGo('games');
 else if(typeof host.go==='function')host.go('games');
 const target=game==='maze'?mazeHost:aimHost;
 target.scrollIntoView?.({block:'start',behavior:'smooth'});
});
document.addEventListener('keydown',e=>{
 if(!gamesIsActive()||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||''))return;
 const direction={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
 if(direction){e.preventDefault();move(direction);}
});
function gamesIsActive(){return document.getElementById('games')?.classList?.contains('active');}
function pause(){if(aim?.started&&!aim.fail&&!aim.win){stopAim();aimPaused=true;drawAim();}}
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden'){if(aim?.started&&!aim.fail&&!aim.win){stopAim();aimPaused=true;}}
 else if(aimPaused&&aim?.started&&!aim.fail&&!aim.win&&gamesIsActive()){aimPaused=false;aimLastTick=Date.now();aimTimer=setInterval(tick,100);drawAim();}
});
host.HealthGoArcade40=Object.freeze({refresh,pause,mazeLevel,move,hit,startAim,score,getState:function(){ensure();return JSON.parse(JSON.stringify(state));}});
refresh();
})(window);
