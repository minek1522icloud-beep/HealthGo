'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('www/healthgo-more4.js','utf8');
const styles=fs.readFileSync('www/healthgo-more4.css','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const defined=[
 {id:'series_foundation_1',definitionId:'series_foundation_1',name:'Pierwsza aktywność',category:'series',seriesId:'foundation',stage:1,period:'once',status:'completed',progress:1,target:1,percent:100,xpReward:40,source:'Potwierdzone zdarzenie'},
 {id:'series_foundation_2',definitionId:'series_foundation_2',name:'Spokojny spacer',category:'series',seriesId:'foundation',stage:2,period:'once',status:'active',progress:1,target:1000,percent:.1,xpReward:70,source:'Dane urządzenia'},
 {id:'series_foundation_3',definitionId:'series_foundation_3',name:'Własny rytm',category:'series',seriesId:'foundation',stage:3,period:'once',status:'locked',progress:0,target:3,percent:0,xpReward:120},
 {id:'season_autumn_2026',definitionId:'season_autumn_2026',name:'Jesień w swoim tempie',category:'seasonal',period:'season',status:'active',progress:3,target:8,percent:37.5,xpReward:300,endsAt:'2026-12-01T00:00:00.000Z'},
 {id:'daily_gentle_walk',definitionId:'daily_gentle_walk',name:'Spokojny spacer dziś',category:'activity',period:'daily',status:'active',progress:100,target:1000,percent:10,xpReward:60}
];
function boot(){
 const nodes=[],store=new Map();
 class El{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.style={};this.textContent='';this.className='';
   this.value='';this.checked=false;this.classList={toggle(){},add(){},remove(){}};nodes.push(this);}
  append(...items){this.children.push(...items)}
  appendChild(item){this.children.push(item);return item}
  replaceChildren(...items){this.children=[...items]}
  setAttribute(k,v){this.attrs??={};this.attrs[k]=v}
  addEventListener(type,fn){this.events[type]=fn}
  remove(){this.removed=true}
  focus(){}
 }
 const pages={};
 for(const id of ['challenges','activity','devices','family','settings']){
  pages[id]=new El('section');pages[id].id=id;
 }
 const body=new El('body');body.setAttribute=()=>{};body.classList={toggle(){}};
 const document={body,getElementById:id=>nodes.find(x=>x.id===id&&!x.removed)||null,
  createElement:tag=>new El(tag),addEventListener(){}};
 const engineState={totalXp:150,titles:[],history:[]};
 const service={state:{uid:'account-a',engine:engineState,devices:[],family:{members:[]},healthDays:[],profile:{}},
  subscribe(fn){this.notify=fn},refreshHealth:async()=>{},refreshDevices:async()=>{}};
 const Engine={
  getLevel(total){
   return total>=400?{level:2,xp:total-400,needed:412,remaining:812-total,percent:(total-400)/412*100}:
    {level:1,xp:total,needed:400,remaining:400-total,percent:total/4};
  },
  viewChallenges:()=>defined,
  viewAchievements:()=>[
   {id:'first_plan',name:'Pierwszy plan',icon:'📅',earned:true,percent:100},
   {id:'family_first',name:'Wspólne wyzwanie',icon:'🤝',earned:false,percent:40}
  ]
 };
 const window={document,HealthGoServices:service,HealthGoEngine:Engine,
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  addEventListener(){},requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn()};
 vm.runInNewContext(script,{window,document,Date,Math,Number,String,Array,Map,JSON,console},
  {filename:'healthgo-more4.js'});
 return {window,document,nodes,store,service,pages,find:id=>document.getElementById(id),
  byClass:name=>nodes.filter(x=>(x.className||'').split(' ').includes(name))};
}
test('XP 3.0 shows a ring and 7-day graph derived only from account engine',()=>{
 new vm.Script(script);
 const h=boot();
 assert.ok(h.find('hg4XpDashboard'));
 assert.equal(h.byClass('hg4-xp-ring').length,1);
 assert.equal(h.byClass('hg4-xp-day').length,7);
 const ring=h.byClass('hg4-xp-ring')[0];
 assert.match(ring.style.background,/37%/);
 assert.match(script,/Engine\.viewAchievements\(e\)/);
 assert.match(script,/Engine\.getLevel\(safeNumber\(e\.totalXp\)\)/);
 assert.match(styles,/hg4-xp-ring/);
 assert.match(html,/healthgo-more4\.js\?v=/);
});
test('3 real story stages and one verified season are rendered without minting client XP',()=>{
 const h=boot();
 const list=h.byClass('hg4-journey-step');
 assert.equal(list.length,3);
 assert.equal(h.byClass('hg4-season-card').length,1);
 assert.match(script,/Engine\.viewChallenges\(e,new Date\(\)\.toISOString\(\)\)/);
 assert.doesNotMatch(script,/Engine\.applyEvent\(|grantXP\(|awardXP\(/);
 assert.match(script,/FAMILY_CHALLENGE_COMPLETED/);
});
test('personal mission pinning is voluntary, capped at 3 and account scoped',()=>{
 const h=boot(),list=h.find('hg4MissionPeriods').children.find(x=>x.className==='hg4-mission-list');
 assert.equal(list.children.length,5);
 const controls=list.children[0].children.find(x=>x.className==='hg4-mission-actions');
 const pin=controls.children.find(x=>x.textContent==='☆ Przypnij cel');
 assert.ok(pin);pin.events.click();
 const key='healthgo.challenges3.goals.account-a';
 assert.deepEqual(JSON.parse(h.store.get(key)),['series_foundation_1']);
 h.service.state.uid='account-b';h.service.notify();
 assert.equal(h.store.get('healthgo.challenges3.goals.account-b'),undefined);
 const buttons=h.byClass('hg4-button');
 assert.ok(buttons.some(x=>x.textContent==='⭐ Moje cele'));
});
test('level up only celebrates newly observed, confirmed increase in level',()=>{
 const h=boot();
 assert.equal(h.find('hg4LevelUp'),null);
 h.service.state.engine={totalXp:450,titles:['Zdobywca'],history:[]};h.service.notify();
 assert.equal(h.find('hg4LevelUp'),null,'no level-up event means no celebratory UI');
 h.service.state.engine={totalXp:850,titles:['Zdobywca'],history:[
  {id:'earned-level-2',type:'LEVEL_UP',occurredAt:'2026-10-13T12:00:00Z',payload:{level:3}}
 ]};
 h.service.notify();
 assert.ok(h.find('hg4LevelUp'),'verified event after a level change triggers celebration');
 assert.match(styles,/prefers-reduced-motion/);
});
