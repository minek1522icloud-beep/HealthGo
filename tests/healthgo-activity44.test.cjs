'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-activity44.js','utf8');
function fixture(){
 const elements=[],storage=new Map(),events={},gps={watched:0,cleared:0},timers=[];
 class E{
  constructor(tag){this.tag=tag;this.id='';this.children=[];this.events={};this.textContent='';this.className='';
   this.style={};this.value='';this.classList={add(){},toggle(){},remove(){}};elements.push(this);}
  append(...nodes){this.children.push(...nodes)}
  appendChild(x){this.children.push(x);return x}
  replaceChildren(...nodes){this.children=[...nodes]}
  setAttribute(k,v){this.attributes??={};this.attributes[k]=v}
  addEventListener(k,fn){this.events[k]=fn}
  remove(){this.removed=true}
  focus(){}
 }
 const hero={insertAdjacentElement(_,node){node.attached=true}};
 const activity=new E('section');activity.id='activity';activity.querySelector=()=>hero;activity.prepend=node=>{node.attached=true};
 const body=new E('body');
 const document={body,hidden:false,getElementById:id=>elements.find(x=>x.id===id&&!x.removed),
  createElement:tag=>new E(tag),addEventListener(k,fn){events[k]=fn}};
 const readings=[
  {id:'2026-10-13',steps:2850,distanceKm:2.3,activeMinutes:33,source:'Synced wearable'},
  {id:'2026-10-12',steps:0,distanceKm:0,activeMinutes:0,source:'Synced wearable'}
 ];
 const state={uid:'test-user',healthDays:readings};
 const service={state,subscribe(fn){this.refresh=fn},refreshHealth:async()=>{}};
 const window={document,HealthGoServices:service,localStorage:{
  getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  addEventListener(){},navigator:{geolocation:{
   watchPosition(){gps.watched++;return 1},clearWatch(){gps.cleared++}}},
  setInterval(fn){timers.push(fn);return 1},clearInterval(){},confirm(){return false}};
 vm.runInNewContext(source,{window,document,Date,Number,Math,String,Array,JSON,console},{
  filename:'healthgo-activity44.js'});
 return {window,document,storage,elements,state,service,gps,events,timers,
  find:id=>document.getElementById(id),
  byClass:name=>elements.filter(x=>(x.className||'').split(' ').includes(name))};
}
test('Activity PRO mounts, compiles and renders only measured values',()=>{
 new vm.Script(source);
 const f=fixture();
 assert.ok(f.find('hg44Activity'));
 assert.equal(f.byClass('hg44-ring').length,3);
 assert.equal(f.byClass('hg44-column').length,7);
 assert.match(source,/Brak danych/);
 assert.doesNotMatch(source,/HealthGoEngine\.applyEvent|recordProgressEvent|XP_GAINED/);
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(html,/healthgo-activity44\.js\?v=/);
 assert.match(html,/healthgo-activity44\.css\?v=/);
});
test('Activity 44 offers selectable day, 30-day real history and metric details',()=>{
 const f=fixture();
 const calendar=f.byClass('hg44-days')[0];
 assert.equal(calendar.children.length,7);
 assert.equal(f.byClass('hg44-graph')[0].children.length,7);
 const b30=f.byClass('hg44-toolbar')[0].children.find(x=>x.textContent==='30 dni');
 assert.ok(b30);b30.events.click();
 assert.equal(f.find('hg44Activity').children.some(x=>x.className==='hg44-date'),true);
 const graph=f.find('hg44Activity').children.find(x=>x.className==='hg44-card'&&x.children.some(y=>y.className==='hg44-graph-scroll'));
 assert.equal(graph.children.find(y=>y.className==='hg44-graph-scroll').children[0].children.length,30);
 const metrics=f.byClass('hg44-metrics').slice(-1)[0];
 assert.equal(metrics.children.length,5);
 metrics.children[0].events.click();
 assert.ok(f.find('hg44Detail'));
 assert.match(f.find('hg44Detail').children[0].children[1].textContent,/rzeczywiste pomiary/i);
});
test('starting a workout does not request GPS, does not write XP and pauses when hidden',()=>{
 const f=fixture();
 const start=f.byClass('hg44-workout-choices')[0].children[0];
 start.events.click();
 assert.equal(f.window.HealthGoActivity44.getState().run.kind,'walk');
 assert.equal(f.gps.watched,0);
 const panel=f.byClass('hg44-tracker').slice(-1)[0];
 const toolbar=panel.children.find(x=>x.className==='hg44-toolbar');
 toolbar.children.find(x=>x.textContent==='Włącz GPS').events.click();
 assert.equal(f.gps.watched,1);
 f.document.hidden=true;f.events.visibilitychange();
 assert.equal(f.window.HealthGoActivity44.getState().run.paused,true);
 assert.equal(f.gps.cleared,1);
 assert.ok([...f.storage.keys()].every(k=>!k.includes('xp')));
});
test('opt-in activity goal and recorded sessions are stored per account only',()=>{
 const f=fixture();
 const goals=f.byClass('hg44-goal-form')[0];
 goals.children[0].children[0].value='3000';
 goals.children[3].events.click();
 assert.equal(JSON.parse(f.storage.get('healthgo.activity44.test-user')).goals.steps,3000);
 f.state.uid='other-user';f.service.refresh();
 assert.equal(f.storage.get('healthgo.activity44.other-user'),undefined);
});
