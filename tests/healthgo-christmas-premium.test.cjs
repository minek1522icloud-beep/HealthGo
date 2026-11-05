'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..','www',name),'utf8');

test('approved holiday dashboard ships original art, accessible real-data cards, and a clickable challenge',()=>{
 const html=read('index.html'),css=read('healthgo-christmas-premium.css'),src=read('healthgo-christmas-premium.js');
 assert.match(html,/healthgo-christmas-premium\.css\?v=1/);
 assert.match(html,/healthgo-christmas-premium\.js\?v=1/);
 assert.ok(html.indexOf('healthgo-christmas-premium.js')>html.indexOf('healthgo-emerald-dashboard.js'));
 assert.match(css,/christmas-hero-premium\.svg/);
 assert.match(css,/christmas-header-premium\.svg/);
 assert.match(src,/Wesołych Świąt!/);
 assert.match(src,/Sprawdź wyzwanie!/);
 assert.match(src,/data-hgc-page="challenges"/);
 for(const label of ['Kroki dzisiaj','Tętno','Sen','Woda','Poziom XP'])assert.ok(src.includes(label));
 for(const metric of ['healthDays','heartRate','sleepMinutes','totalXp'])assert.ok(src.includes(metric));
 assert.doesNotMatch(src,/\b7842\b|\b1420\b|7 842|72 bpm/);
 assert.match(src,/Śledzenie wody w przygotowaniu/);
 assert.match(css,/prefers-reduced-motion/);
 for(const filename of ['assets/christmas-hero-premium.svg','assets/christmas-header-premium.svg']){
  assert.match(read(filename),/<svg/);
  assert.match(read(filename),/<\/svg>/);
 }
});

function harness(state){
 const map=new Map();
 const node=id=>{
  if(!map.has(id))map.set(id,{textContent:'',attrs:{},style:{setProperty(k,v){this[k]=v;}},setAttribute(k,v){this.attrs[k]=v;}});
  return map.get(id);
 };
 let click=null,subscriber=null;
 const classes=new Set();
 const root={
  appendChild(child){map.set(child.id,child);},
  addEventListener(kind,fn){if(kind==='click')click=fn;},
  classList:{toggle(k){if(classes.has(k)){classes.delete(k);return false;}classes.add(k);return true;}}
 };
 map.set('hgStartV3',root);
 for(const id of ['hgcSteps','hgcStepsGoal','hgcStepsRing','hgcStepsPct','hgcHeart','hgcHeartHint','hgcSleep','hgcSleepHint','hgcXp','hgcLevel','hgcXpDetail','hgcXpBar','hgcXpTrack'])node(id);
 for(const id of ['activity','devices','challenges'])node(id);
 const routes=[];
 const services={state,subscribe(fn){subscriber=fn;}};
 const window={HealthGoServices:services,HealthGoEngine:{getLevel(){return {level:12,xp:250,needed:500,percent:50};}},go(page){routes.push(page);}};
 const context={window,Intl,Date,localStorage:{getItem(k){return k==='healthgo_start_steps_goal_v1_user1'?'10000':null;}},document:{
  getElementById(id){return map.get(id)||null;},
  createElement(){return {id:'',className:'',innerHTML:''};},
  addEventListener(){},
  hidden:false
 }};
 vm.runInNewContext(read('healthgo-christmas-premium.js'),context,{timeout:2000});
 return {node,services,routes,click:evt=>click(evt),subscriber,classes,map};
}

test('holiday cards render only health readings associated with the active account and current date',()=>{
 const now=new Date();
 const day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const state={uid:'user1',healthDays:[{id:day,steps:7890,heartRate:68,sleepMinutes:480}],engine:{totalXp:1250}};
 const app=harness(state);
 assert.equal(app.node('hgcSteps').textContent.replace(/\s/g,''),'7890');
 assert.equal(app.node('hgcHeart').textContent,'68 bpm');
 assert.equal(app.node('hgcSleep').textContent,'8 h 00 min');
 assert.equal(app.node('hgcStepsPct').textContent,'79%');
 assert.equal(app.node('hgcLevel').textContent,'♛ Poziom 12');
 assert.equal(app.node('hgcXpTrack').attrs['aria-valuenow'],'50');
 assert.equal(app.node('hgcXp').textContent.replace(/\s/g,''),'1250XP');
 app.services.state={uid:null,healthDays:[],engine:null};
 app.subscriber();
 assert.equal(app.node('hgcSteps').textContent,'Brak danych');
 assert.equal(app.node('hgcHeart').textContent,'Brak danych');
 assert.equal(app.node('hgcSleep').textContent,'Brak danych');
 assert.equal(app.node('hgcXp').textContent,'Brak danych');
});

test('holiday challenge, activity and advanced-details controls remain functional',()=>{
 const app=harness({uid:null,healthDays:[],engine:null});
 app.click({target:{closest(){return {dataset:{hgcPage:'challenges'}};}}});
 app.click({target:{closest(){return {dataset:{hgcPage:'activity'}};}}});
 assert.deepEqual(app.routes,['challenges','activity']);
 const button={dataset:{hgcToggle:'details'},attrs:{},setAttribute(k,v){this.attrs[k]=v;},innerHTML:''};
 app.click({target:{closest(){return button;}}});
 assert.equal(button.attrs['aria-expanded'],'true');
 assert.ok(app.classes.has('hgc-show-details'));
 app.click({target:{closest(){return button;}}});
 assert.equal(button.attrs['aria-expanded'],'false');
 assert.ok(!app.classes.has('hgc-show-details'));
});
