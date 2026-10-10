'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-profile-pro.js','utf8');
const css=fs.readFileSync('www/healthgo-profile-pro.css','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const migration=fs.readFileSync('supabase/migrations/20261010_healthgo_profile_pro.sql','utf8');
function fixture(){
 let dialog=null;
 const storage=new Map();
 const avatars={};
 for(const id of ['topAvatar','sidebarAvatar'])avatars[id]={classList:{add(){}},innerHTML:''};
 const panelButtons={};
 for(const name of ['.top .account-pill','.sidebar-account']){
  panelButtons[name]={attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
 }
 const document={
  activeElement:null,
  getElementById(id){return id==='hgProfileProOverlay'?dialog:avatars[id]||null;},
  querySelector(q){
   if(q==='#hgProfileProOverlay .hgp-x')return{focus(){}};
   return panelButtons[q]||null;
  },
  createElement(tag){
   const x={id:'',className:'',innerHTML:'',eventHandlers:{},
    addEventListener(name,fn){this.eventHandlers[name]=fn;},
    remove(){if(dialog===this)dialog=null;}};
   return x;
  },
  body:{classList:{add(){},remove(){}},appendChild(el){dialog=el;}}
 };
 const services={state:{uid:'alice',profile:{nickname:'Tester',accountType:'standard'},engine:{totalXp:500}},subscribe(fn){this.callback=fn;fn(this.state);}};
 const engine={getLevel(){return{level:4};},viewAchievements(){return[{id:'earned1',name:'Pionier',category:'badges',rarity:'epic',earned:true}];}};
 let saveArgs=null;
 const db={async rpc(name,data){
  if(name==='healthgo_profile_get')return{available:true,user_id:'alice',visibility:'friends',about:'Mój profil',avatar:'leaf',frame:'mint',wallpaper:'default',sticker:'',featured:[]};
  if(name==='healthgo_profile_save'){saveArgs=data;return{saved:true};}
  throw Error('unexpected RPC: '+name);
 }};
 const window={HealthGoServices:services,HealthGoEngine:engine,HealthGoSupabase:{db},
  HealthGoRewards:{getState(){return{claimed:{},sticker:'',wallpaper:''};},handle(){return true;}},
  HealthGoMedalArt:{render(){return'<svg class="hgp-medal-svg"></svg>';}}};
 const localStorage={getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);},removeItem(k){storage.delete(k);}};
 vm.runInNewContext(source,{window,document,localStorage,console,encodeURIComponent});
 return{window,document,services,avatars,panelButtons,storage,get dialog(){return dialog;},get saveArgs(){return saveArgs;}};
}
test('profile script mounts the actual avatar menu and preserves account scope',async()=>{
 const x=fixture();
 assert.match(x.panelButtons['.top .account-pill'].attrs.onclick,/HealthGoProfile.*open/);
 assert.match(x.avatars.topAvatar.innerHTML,/<svg/);
 x.window.HealthGoProfile.open('me');
 assert.ok(x.dialog);
 assert.match(x.dialog.innerHTML,/HEALTHGO PROFILE/);
 assert.match(x.dialog.innerHTML,/Moja kolekcja/);
 assert.match(x.dialog.innerHTML,/Edytuj profil/);
 await Promise.resolve();await Promise.resolve();
 assert.match(x.dialog.innerHTML,/Moja kolekcja/);
 x.window.HealthGoProfile.close(true);
 x.services.state.uid='bob';
 x.services.callback(x.services.state);
 assert.doesNotMatch(String(x.storage.get('healthgo.profile.pro.1.bob')||''),/Tester/);
});
test('profile code includes custom local photo, editable appearance, privacy and preset looks',()=>{
 new vm.Script(source);
 assert.match(source,/data-profile-photo/);
 assert.match(source,/canvas\.toDataURL/);
 assert.match(source,/profile\.pro\.1/);
 assert.match(source,/data-profile-frame/);
 assert.match(source,/data-profile-avatar/);
 assert.match(source,/data-profile-wall/);
 assert.match(source,/data-profile-sticker/);
 assert.match(source,/data-profile-badge/);
 assert.match(source,/maksymalnie 3/i);
 assert.match(source,/healthgo_profile_get/);
 assert.match(source,/healthgo_profile_save/);
 assert.match(source,/window\.HealthGoProfile/);
 assert.match(source,/data-profile-visitor/);
 assert.match(css,/safe-area-inset-top/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(html,/healthgo-profile-pro\.js\?v=1/);
 assert.match(html,/healthgo-profile-pro\.css\?v=1/);
 assert.match(migration,/healthgo_profile_cards/);
 assert.match(migration,/healthgo_friend_blocks/);
 assert.match(migration,/account_type/);
 assert.match(migration,/healthgo_profile_get\(p_user_id uuid/);
 assert.match(migration,/healthgo_profile_save/);
 assert.match(migration,/auth\.uid\(\)/);
 assert.doesNotMatch(migration,/grant select on public\.healthgo_profile_cards to anon/i);
 assert.doesNotMatch(source,/\.select\('activity_daily'|\.select\('family_locations'/);
});
