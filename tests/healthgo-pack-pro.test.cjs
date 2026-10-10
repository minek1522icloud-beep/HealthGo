'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-pack-pro.js','utf8');
const medalSource=fs.readFileSync('www/healthgo-medals.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const css=fs.readFileSync('www/healthgo-pack-pro.css','utf8');

function harness(){
  const storage=new Map(),handlers={},root={
    id:'',innerHTML:'',
    addEventListener(type,fn){handlers[type]=fn;},
    insertAdjacentHTML(_where,s){this.dialog=s;},
    querySelector(){return null;},
    contains(){return true;}
  };
  const page={
    children:[],classList:{values:new Set(),add(k){this.values.add(k);}},
    appendChild(el){this.children.push(el);}
  };
  const svc={state:{uid:'alice',engine:{totalXp:600}},subscriber:null,
    subscribe(fn){this.subscriber=fn;fn(this.state);return ()=>{};}
  };
  const badges=[
    {id:'earned',name:'Ukończone',description:'Zdobyto w wyzwaniu',rarity:'rare',category:'badges',earned:true,earnedAt:'2026-10-10T00:00:00Z',progress:1,target:1,requirementText:'Zrób wyzwanie'},
    {id:'locked',name:'Nieodkryte',description:'Nagroda',rarity:'legendary',category:'cups',earned:false,progress:0,target:2,requirementText:'Ukończ wyzwanie'}
  ];
  const engine={getLevel(total){return {level:2,needed:410,xp:total-400,remaining:610-total,percent:50};},
    viewAchievements(){return badges;}};
  const window={HealthGoEngine:engine,HealthGoServices:svc,
    healthGoCurrentUid:'',addEventListener(){},modal(){},confirm(){return true;},console};
  const document={getElementById(id){return id==='backpack'?page:null;},createElement(){return root;},
    addEventListener(){}};
  const localStorage={getItem(k){return storage.has(k)?storage.get(k):null;},setItem(k,v){storage.set(k,v);}};
  const navigator={};
  vm.runInNewContext(medalSource,{window,Math});
  vm.runInNewContext(source,{window,document,localStorage,navigator,console,Date,Math,encodeURIComponent});
  function action(name,attrs={}){
    const btn={getAttribute(k){if(k==='data-action')return name;return attrs[k]||null;}};
    handlers.click({target:{classList:{contains(){return false;}},closest(){return btn;}}});
  }
  function checkbox(list,id,done){
    const attrs={'data-change':'toggle-item','data-list':list,'data-id':id};
    handlers.change({target:{getAttribute(k){return attrs[k];},checked:done}});
  }
  return {root,page,svc,storage,action,checkbox};
}
test('Plecak 2.0 loads after the existing app without removing achievement nodes',()=>{
  assert.match(html,/healthgo-pack-pro\.css\?v=2/);
  assert.match(html,/healthgo-pack-pro\.js\?v=5/);
  assert.match(css,/#backpack\.hgpack-ready/);
  const app=harness();
  assert.match(app.root.innerHTML,/Mój plecak/);
  assert.match(app.root.innerHTML,/Poziom 2/);
  assert.match(app.root.innerHTML,/Ukończone/);
  assert.equal(app.page.children.length,1);
});
test('Templated packing lists remain private to an account on this device',()=>{
  const app=harness();
  app.action('tab',{'data-value':'daily'});
  app.action('template',{'data-value':'school'});
  const alice='healthgo.pack.pro.2.alice',bob='healthgo.pack.pro.2.bob';
  assert.match(app.storage.get(alice),/Do szkoły/);
  assert.match(app.root.innerHTML,/Moje listy \(1\)/);
  app.svc.state.uid='bob';app.svc.subscriber();
  assert.match(app.root.innerHTML,/Moje listy \(0\)/);
  app.action('template',{'data-value':'pool'});
  assert.match(app.storage.get(bob),/Na basen/);
  app.svc.state.uid='alice';app.svc.subscriber();
  assert.match(app.root.innerHTML,/Moje listy \(1\)/);
  assert.match(app.storage.get(alice),/Do szkoły/);
  assert.doesNotMatch(app.storage.get(alice),/Na basen/);
});
test('Checking items persists but cannot alter XP or earn locked achievements',()=>{
  const app=harness();
  app.action('tab',{'data-value':'daily'});
  app.action('template',{'data-value':'sport'});
  const before=JSON.parse(app.storage.get('healthgo.pack.pro.2.alice'));
  app.checkbox(before.lists[0].id,before.lists[0].items[0].id,true);
  const after=JSON.parse(app.storage.get('healthgo.pack.pro.2.alice'));
  assert.equal(after.lists[0].items[0].done,true);
  assert.equal(app.svc.state.engine.totalXp,600);
  app.action('favorite',{'data-id':'locked'});
  const noFav=JSON.parse(app.storage.get('healthgo.pack.pro.2.alice'));
  assert.deepEqual(noFav.favorites,[]);
  app.action('favorite',{'data-id':'earned'});
  const withFav=JSON.parse(app.storage.get('healthgo.pack.pro.2.alice'));
  assert.deepEqual(withFav.favorites,['earned']);
});

test('Plecak has original metal medals, locked states, large artwork and no invented XP',()=>{
  const app=harness();
  assert.match(html,/healthgo-medals\.js\?v=1/);
  assert.match(app.root.innerHTML,/hgp-medal-svg/);
  assert.match(app.root.innerHTML,/HEALTHGO/);
  assert.match(app.root.innerHTML,/data-medal-category="cups"/);
  assert.match(app.root.innerHTML,/is-locked/);
  assert.match(app.root.innerHTML,/linearGradient/);
  assert.match(css,/hgp-detail-medal/);
  assert.equal(app.svc.state.engine.totalXp,600);
});
test('Medal art is deterministic and varies by achievement and category',()=>{
  const window={};
  vm.runInNewContext(medalSource,{window,Math});
  const badge={id:'first',name:'Odznaka',category:'sports',rarity:'rare',earned:true};
  const a=window.HealthGoMedalArt.render(badge,false);
  assert.equal(a,window.HealthGoMedalArt.render(badge,false));
  assert.match(a,/is-earned/);
  assert.match(a,/data-medal-category="sports"/);
  assert.notEqual(a,window.HealthGoMedalArt.render({...badge,category:'cups',rarity:'legendary'},false));
  assert.match(window.HealthGoMedalArt.render({id:'secret',category:'secret',rarity:'epic',earned:false},false),/is-locked/);
});
