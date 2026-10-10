'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-rewards.js','utf8');
function harness(){
 const storage=new Map();
 const badges=[
  {id:'award-1',name:'Pierwszy sukces',earned:true},
  {id:'award-2',name:'Drugi sukces',earned:true},
  {id:'not-earned',name:'Jeszcze nie',earned:false}
 ];
 const services={state:{uid:'alice',engine:{totalXp:1234},profile:{nickname:'Tester'}},fn:null,subscribe(fn){this.fn=fn;fn(this.state);}};
 const win={HealthGoServices:services,HealthGoEngine:{viewAchievements(){return badges;}},healthGoCurrentUid:'alice'};
 const document={getElementById(){return null;},createElement(){throw Error('Unexpected DOM interaction');}};
 const localStorage={getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}};
 vm.runInNewContext(source,{window:win,document,localStorage,encodeURIComponent,Math,console});
 return{win,services,storage,badges};
}
test('profile gifts only follow real earned achievements and are never paid',()=>{
 const app=harness(),api=app.win.HealthGoRewards;
 assert.equal(api.countAvailable(),2);
 assert.match(api.renderGifts(),/Pierwszy sukces/);
 assert.doesNotMatch(api.renderGifts(),/Jeszcze nie/);
 assert.equal(api.handle('gift-open','not-earned'),false);
 assert.equal(api.handle('gift-open','fake-id'),false);
 assert.equal(api.handle('gift-open','award-1'),true);
 assert.equal(api.handle('gift-open','award-1'),false);
 const saved=JSON.parse(app.storage.get('healthgo.rewards.v1.alice'));
 assert.ok(saved.claimed['award-1']);
 assert.ok(['sticker','wallpaper'].includes(saved.claimed['award-1'].kind));
 assert.equal(api.countAvailable(),1);
 assert.equal(app.services.state.engine.totalXp,1234);
 assert.doesNotMatch(source,/purchase|checkout|credit.card/i);
});
test('profile decorations equip only genuinely claimed items, and cannot be added to another account',()=>{
 const app=harness(),api=app.win.HealthGoRewards;
 assert.equal(api.handle('gift-equip-wallpaper','aurora'),false);
 assert.equal(api.handle('gift-equip-sticker','mint-star'),false);
 api.handle('gift-open','award-1');
 const item=JSON.parse(app.storage.get('healthgo.rewards.v1.alice')).claimed['award-1'];
 assert.equal(api.handle('gift-equip-'+item.kind,item.item),true);
 assert.equal(api.getState()[item.kind],item.item);
 app.services.state.uid='bob';
 assert.equal(api.countAvailable(),2);
 assert.equal(api.getState().sticker,'');
 assert.equal(api.getState().wallpaper,'');
 assert.equal(api.handle('gift-equip-'+item.kind,item.item),false);
 app.services.state.uid='alice';
 assert.equal(api.getState()[item.kind],item.item);
 assert.equal(api.handle('gift-clear-'+item.kind),true);
 assert.equal(api.getState()[item.kind],'');
});
test('reward styles and shipping code contain actual profile rendering and third tab',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const pack=fs.readFileSync('www/healthgo-pack-pro.js','utf8');
 const css=fs.readFileSync('www/healthgo-rewards.css','utf8');
 assert.match(html,/healthgo-rewards\.js\?v=2/);
 assert.match(html,/healthgo-rewards\.css\?v=2/);
 assert.match(pack,/data-value="gifts"/);
 assert.match(pack,/HealthGoRewards\.renderGifts/);
 assert.match(pack,/HealthGoRewards\.handle/);
 assert.match(html,/HealthGoRewards\?\.decorateProfile/);
 assert.match(source,/settingsAccount/);
 assert.match(css,/hgr-profile-preview/);
});
