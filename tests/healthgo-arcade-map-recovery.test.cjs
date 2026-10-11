'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function harness(){
 const nodes={};
 for(const id of ['hgArcadeMaze','hgArcadeAim','hgArcadeContestRoot']){
  nodes[id]={innerHTML:'',addEventListener(){},contains(){return true},querySelector(){return null},
   scrollIntoView(){},classList:{contains(){return true}}};
 }
 const memory=new Map(),nav=[];
 const document={visibilityState:'visible',getElementById:id=>nodes[id]||null,addEventListener(){}};
 const localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const win={HealthGoServices:{state:{uid:'user1'}},mobileGo:p=>nav.push(p),setTimeout(){}};
 const context={window:win,document,localStorage,setInterval:()=>1,clearInterval(){},console,Math,Date,Set,Map,Number,JSON};
 function run(){vm.runInNewContext(read('www/healthgo-arcade40.js'),context,{filename:'arcade40.js'});return win.HealthGoArcade40;}
 return {run,win,nodes,memory,nav};
}
function shortest(level){
 const n=level.n,goal=level.goal,q=[[1,1]],parents=new Map([['1,1',null]]);
 const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
 for(let i=0;i<q.length;i++){
  const p=q[i];
  for(const [dx,dy] of dirs){
   const x=p[0]+dx,y=p[1]+dy,k=x+','+y;
   if(level.grid[y]&&level.grid[y][x]==='.'&&!parents.has(k)){
    parents.set(k,p);q.push([x,y]);
   }
  }
 }
 const route=[];let p=goal;
 while(p){route.push(p);p=parents.get(p[0]+','+p[1]);}
 return route.reverse();
}
test('40 deterministic solvable maze stages, stars on a real route and growing difficulty',()=>{
 const api=harness().run();
 for(let i=1;i<=40;i++){
  const board=api.mazeLevel(i),path=shortest(board);
  assert.ok(path.length>=2,'Unreachable maze '+i);
  assert.equal(path.length-1,board.solution);
  for(const star of board.stars)assert.ok(path.some(p=>p.join(',')===star),'Star off goal route at '+i);
  assert.equal(board.grid.length,9+2*Math.floor((i-1)/10));
 }
});
test('forty maze levels reward exactly 2 local points, once',()=>{
 const h=harness(),api=h.run();
 assert.equal(api.score(),0);
 for(let level=1;level<=40;level++){
  const path=shortest(api.mazeLevel(level));
  for(let i=1;i<path.length;i++){
   const dx=path[i][0]-path[i-1][0],dy=path[i][1]-path[i-1][1];
   const d=dx===1?'right':dx===-1?'left':dy===1?'down':'up';
   assert.equal(api.move(d),true,'Move failure at level '+level+' step '+i);
  }
  const state=api.getState();
  if(level<40){assert.equal(state.maze.level,level+1);assert.equal(api.score(),0);api.refresh();}
 }
 assert.equal(api.getState().maze.completed,true);
 assert.equal(api.getState().maze.claimed,true);
 assert.equal(api.score(),2);
 assert.equal(api.move('up'),false);
 assert.equal(api.score(),2);
 const restored=h.run();assert.equal(restored.score(),2,'Persistent score on relaunch');
});
test('forty reflex stages require real target hits and award another 2 points',()=>{
 const h=harness(),api=h.run();
 for(let level=1;level<=40;level++){
  api.startAim();
  const targetCount=3+Math.floor((level-1)/8);
  for(let t=0;t<targetCount;t++){
   let hit=false;for(let cell=0;cell<9;cell++)if(api.hit(cell)){hit=true;break;}
   assert.equal(hit,true,'No available target at level '+level+' hit '+t);
  }
  const s=api.getState();
  if(level<40)assert.equal(s.aim.level,level+1);
 }
 assert.equal(api.getState().aim.completed,true);
 assert.equal(api.score(),2);
 api.startAim();assert.equal(api.score(),2,'No repeat reward');
});
test('both campaigns award 4 points at most, not account XP or cash',()=>{
 const source=read('www/healthgo-arcade40.js');
 assert.match(source,/const MAX=40,COINS=2/);
 assert.doesNotMatch(source,/grantXP|updateEngine|awardXP|checkout|creditCard|realMoney|walletTransfer/);
 assert.match(source,/localStorage\.setItem/);
 const html=read('www/index.html');
 assert.match(html,/id="hgArcadeMaze"/);assert.match(html,/id="hgArcadeAim"/);
 assert.match(html,/id="hgArcadeContestRoot"/);
 assert.match(html,/healthgo-arcade40\.js\?v=2/);
});
test('map recovery uses remote tiles for hosted sites and switches on tile errors',()=>{
 const source=read('www/healthgo-map-recovery.js'),listeners={},layers=[],status=[];
 const node={hidden:true,textContent:''};
 const document={
  getElementById:()=>node,
  querySelector:()=>null,
  createElement:()=>({dataset:{}}),
  head:{appendChild(){}}
 };
 const map={removeLayer(){},invalidateSize(){}};
 const win={
  location:{hostname:'minek1522icloud-beep.github.io',protocol:'https:'},
  setTimeout(){return 1},clearTimeout(){},
  L:{tileLayer(url){const layer={url,on(k,fn){listeners[k]=fn;return this;},addTo(){layers.push(this);return this;}};return layer;}}
 };
 vm.runInNewContext(source,{window:win,document,Promise});
 const api=win.HealthGoMapRecovery;
 assert.match(api.tileUrl(),/tile\.openstreetmap\.org/);
 api.attach({on(k,fn){listeners[k]=fn;}},map);
 listeners.tileerror();listeners.tileerror();listeners.tileerror();
 assert.equal(layers.length,1);
 assert.match(api.tileUrl(),/World_Street_Map/);
 assert.match(api.tileAttribution(),/Esri/);
 assert.doesNotMatch(source,/geolocation\.watchPosition|geolocation\.getCurrentPosition/);
});
test('mobile shell provides map recovery and alternate CDN CSP permissions',()=>{
 const html=read('www/index.html'),map=read('www/healthgo-map-v2.js');
 assert.match(html,/healthgo-map-recovery\.js\?v=2/);
 assert.match(html,/id="hgMapRecoveryPanel"/);
 assert.match(html,/HealthGoMapRecovery\.retry\(\)/);
 assert.match(html,/https:\/\/cdn\.jsdelivr\.net/);
 assert.match(html,/HealthGoMapRecovery\?\.loadLeaflet/);
 assert.match(map,/HealthGoMapRecovery\?\.tileUrl/);
 assert.match(map,/HealthGoMapRecovery\?\.attach/);
});
