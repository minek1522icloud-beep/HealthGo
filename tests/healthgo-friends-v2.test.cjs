'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const friends=fs.readFileSync('www/healthgo-friends.js','utf8');
const gifts=fs.readFileSync('www/healthgo-rewards.js','utf8');
async function tick(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}
test('Friend requests are backed by authenticated RPC and require acceptance',async()=>{
 let root=null;const calls=[];
 const snapshot={code:'ABCDEF0123456789AB',friends:[],incoming:[{id:'request1',nickname:'Przyjaciel'}],outgoing:[],blocked:[]};
 const svc={state:{uid:'alice'},subscribe(fn){fn(this.state);}};
 const db={async rpc(name,data){calls.push({name,data});return name==='healthgo_friends_snapshot'?snapshot:{ok:true};}};
 const parent={appendChild(x){root=x;}};
 const document={
   getElementById(id){return id==='settingsAccount'?parent:id==='hgFriendsPanel'?root:null;},
   createElement(){return{className:'',innerHTML:'',listeners:{},addEventListener(k,fn){this.listeners[k]=fn;}};}
 };
 const win={HealthGoSupabase:{db},HealthGoServices:svc,confirm(){return true;}};
 vm.runInNewContext(friends,{window:win,document,navigator:{},console,Promise});
 await tick();
 assert.ok(root);
 assert.match(root.innerHTML,/Znajomi/);
 assert.match(root.innerHTML,/ABCDEF0123456789AB/);
 assert.match(root.innerHTML,/Akceptuj/);
 assert.doesNotMatch(root.innerHTML,/email|lokalizacja użytkownika/i);
 root.listeners.submit({preventDefault(){},target:{matches:()=>true,elements:{friendCode:{value:'ABCDEF0123456789AB'}}}});
 await tick();
 assert.ok(calls.some(c=>c.name==='healthgo_friend_send'&&c.data.p_code==='ABCDEF0123456789AB'));
 assert.match(root.innerHTML,/Zaproszenie wysłane/);
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(html,/healthgo-friends\.js\?v=1/);
 assert.match(html,/healthgo-friends\.css\?v=1/);
});
test('80 stickers, account welcome chest, and skip are real UI paths',async()=>{
 const storage=new Map();const times=[];
 const svc={state:{uid:'alice',engine:null,profile:{nickname:'Tester'}},subscribe(fn){fn(this.state);}};
 const db={async rpc(name){if(name==='healthgo_starter_status')return{available:true,opened:false};if(name==='healthgo_starter_open')return{available:false,opened:true,reward_kind:'sticker',reward_item:'s01'};throw Error('unknown rpc');}};
 const win={HealthGoServices:svc,HealthGoEngine:{viewAchievements(){return[];}},HealthGoSupabase:{db}};
 const localStorage={getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}};
 const document={getElementById(){return null;}};
 const timers=[];
 vm.runInNewContext(gifts,{window:win,localStorage,document,Math,Date,console,encodeURIComponent,setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){}});
 const api=win.HealthGoRewards;
 await tick();
 assert.equal(api.stickerCount(),80);
 assert.equal(api.getStarter().available,true);
 assert.match(api.starterBanner(),/pierwsza darmowa skrzynia/i);
 assert.equal(await api.openStarter(),true);
 assert.match(api.renderGifts(),/Pomiń animację/);
 assert.equal(api.handle('gift-skip'),true);
 assert.match(api.renderGifts(),/Nowa naklejka profilowa/);
 assert.equal(api.getState().claimed.starter.item,'s01');
 assert.equal(api.handle('gift-equip-sticker','s01'),true);
 assert.equal(api.getState().sticker,'s01');
 assert.doesNotMatch(api.starterBanner(),/Otwórz skrzynię/);
});
test('Starter and friends SQL are backed by account-based policies and RPC operations',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261010_healthgo_welcome_friends.sql','utf8');
 assert.match(sql,/healthgo_starter_chests/);
 assert.match(sql,/primary key references public\.profiles\(id\)/);
 assert.match(sql,/healthgo_starter_open\(\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/healthgo_friend_links/);
 assert.match(sql,/healthgo_friend_blocks/);
 assert.match(sql,/healthgo_friend_send\(p_code text\)/);
 assert.match(sql,/healthgo_friend_action\(p_action text,p_id uuid/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/alter table public\.healthgo_friend_links enable row level security/);
 assert.match(sql,/grant execute on function public\.healthgo_friends_snapshot\(\) to authenticated/);
 assert.doesNotMatch(sql,/grant.*to anon;/i);
});