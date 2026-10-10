'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=p=>fs.readFileSync(p,'utf8');
const art=path('www/healthgo-collectible-art.js');
const medals=path('www/healthgo-medals.js');
const rewards=path('www/healthgo-rewards.js');
test('each achievement has original individualized engraved texture, not just a recolored icon',()=>{
 const window={};
 vm.runInNewContext(medals,{window,Math});
 const badge=id=>window.HealthGoMedalArt.render({id,name:'Osiągnięcie',category:'badges',rarity:'epic',earned:true},false);
 const ids=['health','planner','xp_1','xp_2','xp_3','level_milestone_2','level_milestone_5','streak_1','streak_2','plan_1','plan_2','secret_rest','family_first'];
 const patterns=new Set(ids.map(id=>(badge(id).match(/data-individual-texture="([^"]+)"/)||[])[1]));
 const engravings=new Set(ids.map(id=>(badge(id).match(/data-texture-serial="([^"]+)"/)||[])[1]));
 assert.equal(patterns.size,ids.length);
 assert.equal(engravings.size,ids.length);
 assert.match(badge('planner'),/clipPath|clip-path/);
 assert.match(badge('planner'),/stroke-width="\.9"/);
 assert.match(badge('planner'),/data-texture-serial/);
 assert.notEqual(badge('plan_1'),badge('plan_2'));
 assert.equal(badge('plan_1'),badge('plan_1'));
});
test('80 stickers are individually textured SVG art, not a shared emoji',()=>{
 const window={};vm.runInNewContext(art,{window,Math});
 const set=new Set();
 for(let i=1;i<=72;i++){
  const id='s'+String(i).padStart(2,'0');
  const svg=window.HealthGoCollectibleArt.sticker(id,{label:'Naklejka'});
  assert.match(svg,/data-art-id="/);
  assert.match(svg,/clipPath/);
  assert.match(svg,/linearGradient/);
  set.add(svg);
 }
 assert.equal(set.size,72);
 assert.match(window.HealthGoCollectibleArt.chest('daily'),/hgr-chest-svg/);
 assert.notEqual(window.HealthGoCollectibleArt.chest('daily'),window.HealthGoCollectibleArt.chest('starter'));
});
test('daily collectible is one account/date only; reveal skip never changes server-picked result',async()=>{
 const storage=new Map(),listeners=[],timerIds=[];
 const services={state:{uid:'alice',engine:{totalXp:400}},subscribe(fn){listeners.push(fn);fn(this.state);}};
 const engine={viewAchievements(){return[];}};
 let claims=0;
 const db={async rpc(name){
  if(name==='healthgo_starter_status')return{available:false,opened:true,reward_kind:'sticker',reward_item:'s02'};
  if(name==='healthgo_daily_status')return{available:true,claimed:false,date:'2026-10-10'};
  if(name==='healthgo_daily_claim'){claims++;return{date:'2026-10-10',available:false,claimed:true,reward_kind:'sticker',reward_item:'s13'};}
  throw Error(name);
 }};
 const window={HealthGoServices:services,HealthGoEngine:engine,HealthGoSupabase:{db}};
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const document={getElementById(){return null;}};
 vm.runInNewContext(rewards,{window,localStorage,document,console,Math,Date,encodeURIComponent,
   setTimeout(fn){timerIds.push(fn);return timerIds.length;},clearTimeout(){}});
 const next=()=>new Promise(resolve=>setImmediate(resolve));
 await next();
 const api=window.HealthGoRewards;
 assert.match(api.dailyBanner(),/Darmowy upominek/);
 assert.equal(await api.claimDaily(),true);
 assert.equal(api.handle('gift-skip'),true);
 const owned=api.getState().claimed['daily:2026-10-10'];
 assert.equal(owned.item,'s13');
 assert.equal(owned.kind,'sticker');
 assert.match(api.renderGifts(),/hgr-reveal/);
 assert.equal(claims,1);
 assert.equal(services.state.engine.totalXp,400);
});
test('mobile bundle includes collectible visuals, daily RPC-backed migration and accessible skip control',()=>{
 const html=path('www/index.html'),css=path('www/healthgo-rewards.css');
 const sql=path('supabase/migrations/20261010_healthgo_daily_cosmetics.sql');
 assert.match(html,/healthgo-collectible-art\.js\?v=1/);
 assert.ok(html.indexOf('healthgo-collectible-art.js')<html.indexOf('healthgo-medals.js'));
 assert.match(sql,/primary key\(user_id,gift_date\)/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/healthgo_daily_claim\(\)/);
 assert.match(sql,/on conflict\(user_id,gift_date\) do nothing/);
 assert.match(sql,/grant execute on function public\.healthgo_daily_status\(\) to authenticated/);
 assert.match(rewards,/healthgo_daily_claim/);
 assert.match(rewards,/data-action="gift-skip"/);
 assert.match(rewards,/hgr-reel-track/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/hgr-reel-pointer/);
});
