'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-arcade40.js','utf8');
function harness(existingStore,uid='player-01'){
 const store=existingStore||new Map(),handlers={},timers=new Map();let nextTimer=0;
 function element(name){
  return {innerHTML:'',events:{},addEventListener(n,fn){this.events[n]=fn;},
   scrollIntoView(){this.wasScrolled=true;},
   contains(){return true;},
   querySelector(sel){if(sel==='.hga-timer b')return {textContent:'16.0 s'};return null;}};
 }
 const maze=element('maze'),aim=element('aim'),contests=element('contests');
 const games={classList:{contains(c){return c==='active';}}};
 const document={visibilityState:'visible',
  getElementById(id){return ({hgArcadeMaze:maze,hgArcadeAim:aim,hgArcadeContestRoot:contests,games})[id]||null;},
  addEventListener(n,fn){handlers[n]=fn;}};
 const host={HealthGoServices:{state:{uid}},mobileGo(){}};
 const localStorage={getItem(key){return store.get(key)||null;},setItem(key,v){store.set(key,v);}};
 vm.runInNewContext(source,{window:host,document,localStorage,Math,Number,JSON,Date,Map,Set,Array,
  setInterval(fn){const id=++nextTimer;timers.set(id,fn);return id;},
  clearInterval(id){timers.delete(id);}}, {filename:'healthgo-arcade40.js',timeout:2000});
 return {api:host.HealthGoArcade40,store,maze,aim,contests,handlers,timers,document};
}
function path(level){
 const maze=level.grid,goal=level.goal,seen=new Set(['1,1']),queue=[[1,1]],from=new Map();
 const offsets=[[1,0],[-1,0],[0,1],[0,-1]];
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const [dx,dy] of offsets){
   const nx=x+dx,ny=y+dy,k=nx+','+ny;
   if(maze[ny]?.[nx]!=='.'||seen.has(k))continue;
   seen.add(k);from.set(k,[x,y]);queue.push([nx,ny]);
  }
 }
 let p=goal,found=[];
 while(p[0]!==1||p[1]!==1){
  found.push(p);p=from.get(p[0]+','+p[1]);
  assert.ok(p,'missing path to finish line '+level.level);
 }
 return [[1,1],...found.reverse()];
}
test('40 maze levels each have a reachable finish and collectible stars',()=>{
 const h=harness();
 for(let level=1;level<=40;level++){
  const m=h.api.mazeLevel(level),route=path(m);
  assert.equal(route.length-1,m.solution);
  assert.ok(route.length>6,'maze is trivial');
  for(const star of m.stars)assert.ok(route.some(([x,y])=>x+','+y===star),'unreachable star '+star);
  if(level%10===1||level===40)assert.ok([9,11,13,15].includes(m.n));
 }
});
test('completing level 40 awards exactly two points once, persists per signed-in user',()=>{
 const storage=new Map(),h=harness(storage);
 for(let l=1;l<=40;l++){
  const route=path(h.api.mazeLevel(l));
  for(let i=1;i<route.length;i++){
   const dx=route[i][0]-route[i-1][0],dy=route[i][1]-route[i-1][1];
   assert.equal(h.api.move(dx===1?'right':dx===-1?'left':dy===1?'down':'up'),true);
  }
  const progress=h.api.getState().maze;
  assert.equal(progress.level,Math.min(40,l+1));
  if(l<40)h.api.refresh();
 }
 assert.equal(h.api.score(),2);
 assert.equal(h.api.getState().maze.completed,true);
 h.api.refresh();assert.equal(h.api.move('right'),false);assert.equal(h.api.score(),2);
 assert.equal(harness(storage).api.score(),2);
 assert.equal(harness(storage,'other-user').api.score(),0);
});
test('40 action stages need successful hits and award two points only on finishing',()=>{
 const h=harness();
 for(let level=1;level<=40;level++){
  assert.equal(h.api.getState().aim.level,level);
  h.api.startAim();assert.equal(h.timers.size,1);
  // Repeated Start should never start multiple clocks or change target.
  h.api.startAim();assert.equal(h.timers.size,1);
  for(let k=0;k<3+Math.floor((level-1)/8);k++){
   const target=Number((h.aim.innerHTML.match(/class="hga-target live" data-hga-hit="(\d+)"/)||[])[1]);
   assert.ok(Number.isInteger(target),'no target on level '+level);
   assert.equal(h.api.hit((target+1)%9),false);
   assert.equal(h.api.hit(target),true);
  }
  assert.equal(h.timers.size,0);
 }
 assert.equal(h.api.score(),2);
 const finished=h.api.getState().aim;
 assert.equal(finished.completed,true);
 assert.equal(finished.level,40);
 h.api.startAim();assert.equal(h.timers.size,0);assert.equal(h.api.score(),2);
});
test('pausing a running game stops timing and offers Resume',()=>{
 const h=harness();h.api.startAim();
 const current=Number((h.aim.innerHTML.match(/class="hga-target live" data-hga-hit="(\d+)"/)||[])[1]);
 assert.ok(Number.isInteger(current));
 assert.equal(h.timers.size,1);h.api.pause();assert.equal(h.timers.size,0);
 assert.equal(h.api.hit(current),false,'paused timer cannot unlock a level');
 assert.match(h.aim.innerHTML,/Wznów/);
 h.api.startAim();assert.equal(h.timers.size,1);
 assert.equal(h.api.hit(current),true,'resumed timer allows legitimate hits');
});
test('contest shows levels and local nature of points; unrelated XP untouched',()=>{
 const h=harness();
 assert.match(h.contests.innerHTML,/0 \/ 40 poziomów/);
 assert.match(h.contests.innerHTML,/punktów gry/);
 assert.doesNotMatch(source,/grantXP|awardXP|upsertPoints|addWalletMoney/);
 assert.match(fs.readFileSync('www/index.html','utf8'),/id="hgArcadeContestRoot"/);
});
