'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('www/healthgo-game-library.js','utf8');
function harness(uid='alice',store=new Map()){
 const callbacks={},events={},subs=[];
 const nodes=new Map();
 function elt(id){
  return {id,innerHTML:'',hidden:true,events:{},classList:{add(){},remove(){}},
    addEventListener(name,fn){this.events[name]=fn;},
    querySelector(){return null;},replaceChildren(){this.innerHTML='';},
    setAttribute(){},focus(){},contains(){return true;}};
 }
 for(const id of ['hgGameLibrary','hgGameQuestsSummary','hgGameDialog','hgGameViewer'])nodes.set(id,elt(id));
 const document={body:{classList:{add(){},remove(){}}},getElementById(id){return nodes.get(id)||null;},
   addEventListener(name,fn){events[name]=fn;}};
 const earned=[],challenges=[];
 const engine={totalXp:0,metrics:{totalDailyTasks:0,plans:{},healthDays:{},legacyCounts:{plans:0}}};
 const state={uid,engine};
 const api={viewAchievements(){return earned;},viewChallenges(){return challenges;},
   getLevel(x){return {level:x>=400?2:1};}};
 const win={HealthGoServices:{state,subscribe(fn){subs.push(fn);}},HealthGoEngine:api,
   setTimeout(fn){fn();},addEventListener(name,fn){callbacks[name]=fn;},mobileGo(){}};
 const localStorage={getItem(k){return store.get(k)||null;},setItem(k,v){store.set(k,v);}};
 vm.runInNewContext(src,{window:win,document,localStorage,location:{href:'https://example.com/healthgo/'},
  console,Map,Set,Number,JSON,Array,Object,Math,URL,Date}, {filename:'healthgo-game-library.js',timeout:3000});
 return {api:win.HealthGoGameLibrary,root:nodes.get('hgGameLibrary'),contests:nodes.get('hgGameQuestsSummary'),doc:document,state,engine,earned,challenges,store,nodes,callbacks};
}
test('all catalog titles are genuine local licensed games, exactly 3 start unlocked',()=>{
 const h=harness();
 assert.equal(h.api.list.length,28);
 assert.equal(h.api.list.filter(g=>g.starter).length,3);
 assert.deepEqual(Array.from(h.api.list.filter(g=>g.starter).map(g=>g.id)),['fruit-slice','bubble-shooter','2048']);
 assert.equal(h.api.list.filter(g=>h.api.isUnlocked(g.id)).length,3);
 assert.match(h.root.innerHTML,/Fruit Slice/);
 assert.match(h.root.innerHTML,/Bubble Shooter/);
 assert.match(h.root.innerHTML,/Wyszukaj grę/);
 for(const game of h.api.list){
  const path='www/community-games/'+game.id+'/index.html';
  assert.ok(fs.existsSync(path),'missing true HTML5 game '+path);
  const html=fs.readFileSync(path,'utf8');
  assert.match(html,/<html/);
  assert.match(html,/\.\.\/i18n\.js/);
 }
 assert.match(fs.readFileSync('www/community-games/LICENSE','utf8'),/MIT License/);
 assert.match(fs.readFileSync('www/community-games/i18n.js','utf8'),/var GC_SITE = ''/);
});
test('every locked game offers at least one nonphysical milestone option',()=>{
 const h=harness();
 for(const game of h.api.list.filter(g=>!g.starter)){
  assert.ok(game.unlock.length>=2,'missing alternatives for '+game.id);
  assert.ok(game.unlock.some(x=>x.kind!=='steps'),'non-physical alternative missing '+game.id);
  assert.ok(game.unlock.every(x=>Number.isInteger(x.target)&&x.target>0));
  assert.ok(game.mission,'missing verified HealthGo milestone');
 }
});
test('earning a verified badge unlocks game, persists only for this account',()=>{
 const store=new Map(),h=harness('alice',store);
 const game=h.api.list.find(g=>g.id==='helix-drop');
 assert.equal(game.unlock[0].kind,'steps');
 assert.equal(game.unlock[1].kind,'badges');
 assert.equal(h.api.isUnlocked(game.id),false);
 h.earned.push({earned:true});
 h.api.refresh();
 assert.equal(h.api.isUnlocked(game.id),true);
 assert.equal(h.api.getState().unlocks.filter(x=>x===game.id).length,1);
 assert.equal(harness('alice',store).api.isUnlocked(game.id),true);
 assert.equal(harness('bob',store).api.isUnlocked(game.id),false);
});
test('guest can play starter games but cannot store game rewards as account progress',()=>{
 const h=harness('');
 assert.equal(h.api.isUnlocked('2048'),true);
 assert.equal(h.api.isUnlocked('helix-drop'),false);
 assert.equal(h.api.getState().unlocks.length,0);
});
test('sandbox prevents imported games reading HealthGo session and never gives fake XP',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(src,/setAttribute\('sandbox','allow-scripts'\)/);
 assert.doesNotMatch(src,/allow-scripts allow-same-origin/);
 assert.match(src,/event\.source!==viewer\.contentWindow/);
 assert.match(src,/localStorage/);
 assert.match(src,/frame\.srcdoc=patched/);
 assert.doesNotMatch(src,/HealthGoServices\.call\(['"]recordProgressEvent/);
 assert.match(html,/frame-src 'self'/);
 assert.match(html,/id="hgGameLibrary"/);
 assert.match(html,/id="hgGameViewer"/);
 assert.match(html,/healthgo-game-library\.js\?v=1/);
});
test('catalog source is pinned, licensed and never fakes thousands of games',()=>{
 const readme=fs.readFileSync('www/community-games/README.md','utf8');
 assert.match(readme,/38094525ad727f40e3bbc7cfc91eb6dcbe042f11/);
 assert.match(readme,/MIT/);
 assert.equal(harness().api.list.filter(g=>g.starter).length,3);
 assert.equal(harness().api.list.length,28);
});
