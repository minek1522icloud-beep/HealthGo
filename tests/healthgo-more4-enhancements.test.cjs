'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('www/healthgo-more4.js','utf8');
const css=fs.readFileSync('www/healthgo-more4.css','utf8');
const html=fs.readFileSync('www/index.html','utf8');
function boot(){
 const elements=[],store=new Map(),attrs=new Map(),classes=new Set();
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.style={};this.value='';this.checked=false;this.classList={toggle(){},add(){},remove(){}};elements.push(this);}
  append(...children){this.children.push(...children)}
  appendChild(child){this.children.push(child);return child}
  replaceChildren(...children){this.children=[...children]}
  setAttribute(k,v){this.attrs??={};this.attrs[k]=v}
  addEventListener(event,fn){this.events[event]=fn}
  remove(){}
  click(){this.events.click?.()}
  scrollIntoView(){}
 }
 const parents={};
 for(const id of ['challenges','activity','devices','family','settings']){parents[id]=new Element('section');parents[id].id=id;}
 const body=new Element('body');
 body.setAttribute=(k,v)=>attrs.set(k,v);
 body.classList={toggle:(k,active)=>active?classes.add(k):classes.delete(k)};
 const document={body,createElement:tag=>new Element(tag),getElementById:id=>elements.find(e=>e.id===id)||null,
  querySelector:()=>null};
 const state={uid:'tester',engine:{totalXp:120,history:[]},healthDays:[],devices:[],family:{members:[]},profile:{}};
 const S={state,subscribe(){},refreshHealth:async()=>{},refreshDevices:async()=>{}};
 const Engine={getLevel:()=>({level:2,xp:120,needed:300,remaining:180,percent:40}),
  viewChallenges:()=>[
    {id:'daily-a',period:'daily',name:'Spokojna przerwa',description:'Krótki odpoczynek',status:'active',
     percent:20,xpReward:20,requirement:{type:'rest'},source:'Potwierdzony plan'},
    {id:'week-b',period:'weekly',name:'Zaplanuj tydzień',description:'Ułóż własny plan',status:'completed',
     percent:100,xpReward:30,requirement:{type:'plan'},source:'Historia'}]};
 const window={document,HealthGoServices:S,HealthGoEngine:Engine,localStorage:{
  getItem:key=>store.get(key)||null,setItem:(k,v)=>store.set(k,v)},
  addEventListener(){},requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn(),navigator:{userAgent:'iPhone'},
  Notification:null,location:{href:''},confirm:()=>false};
 vm.runInNewContext(src,{window,document,Date,Math,Number,String,Array,Map,JSON,console},{filename:'healthgo-more4.js'});
 return {window,state,elements,store,attrs,classes,find:id=>elements.find(e=>e.id===id),
  all:cl=>elements.filter(e=>(e.className||'').split(' ').includes(cl))};
}
test('HealthGo More 4.1 compiles and is loaded in the existing app without changing map or badges',()=>{
 new vm.Script(src);assert.match(html,/healthgo-more4\.js\?v=/);
 assert.match(css,/hg4-mission-tools/);assert.match(css,/hg4-chart-scroll/);
 assert.doesNotMatch(src,/\bnavigator\.geolocation\.watchPosition\b/);
 assert.doesNotMatch(src,/XP_GAINED.*?recordProgressEvent/);
});
test('mission board supports search, completion filter, and truthful XP sources',()=>{
 const h=boot();const search=h.all('hg4-search')[0],status=h.all('hg4-select')[0];
 assert.ok(search);assert.ok(status);
 assert.equal(h.all('hg4-mission').length,2);
 search.value='przerwa';search.events.input();
 assert.equal(h.find('hg4MissionPeriods').children.some(x=>x.className==='hg4-mission-list'),true);
 const list=h.find('hg4MissionPeriods').children.find(x=>x.className==='hg4-mission-list');
 assert.equal(list.children.length,1);
 search.value='';search.events.input();
 status.value='completed';status.events.change();
 assert.equal(list.children.length,1);
 assert.match(list.children[0].children[0].children[0].textContent,/Zaplanuj/);
});
test('7/30 day real-data analytics supports metric switch with missing data markers',()=>{
 const h=boot();assert.equal(h.all('hg4-chart-cell').length,7);
 const stats=h.find('hg4Stats'),tools=stats.children.find(x=>x.className==='hg4-stat-toolbar');
 const b30=tools.children.find(x=>x.textContent==='30 dni');
 assert.ok(b30);b30.click();
 assert.equal(h.find('hg4Stats').children.find(x=>x.className==='hg4-chart-scroll').children[0].children.length,30);
 assert.match(css,/overflow-x:auto/);
});
test('accessibility preferences are scoped to one account and never invent data',()=>{
 const h=boot(),api=h.window.HealthGoMore4;
 assert.equal(api.preferences().density,'comfortable');
 const toggle=h.all('hg4-toggle').find(n=>n.children[0]?.textContent==='Zwiększony kontrast kart „Więcej”');
 assert.ok(toggle);toggle.children[1].checked=true;toggle.children[1].events.change();
 assert.equal(api.preferences().contrast,true);
 assert.equal(h.classes.has('hg4-contrast'),true);
 h.state.uid='another';assert.equal(api.preferences().contrast,false);
 assert.match(src,/Tylko z synchronizacji/);
 assert.match(src,/Nieudostępniony pomiar oznaczamy kreską, nigdy zerem/);
});

test('daily habits persist only in account-scoped local settings without awarding XP',()=>{
 const h=boot();
 const panel=h.find('hg4Habits');assert.ok(panel);
 const rows=panel.children.find(x=>x.className==='hg4-toggle-list').children;
 assert.equal(rows.length,3);
 rows[0].children[1].checked=true;rows[0].children[1].events.change();
 assert.match(panel.children.find(x=>x.className==='hg4-habit-summary').textContent,/1 \/ 3/);
 assert.ok([...h.store.keys()].some(k=>k.includes('more4.habits.tester.')));
 assert.doesNotMatch(src,/grantXP\(|awardXP\(/);
});
