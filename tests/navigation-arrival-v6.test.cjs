'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-map-pro.js','utf8');
function harness(){
 const elements=new Map(),classes=new Set(),timers=[],counts={clear:0,watch:0};
 const element=id=>{
  if(!elements.has(id))elements.set(id,{id,hidden:true,textContent:'',style:{setProperty(){},width:''},
   classList:{add(){},remove(){},toggle(){}},attributes:{},setAttribute(k,v){this.attributes[k]=v}});
  return elements.get(id);
 };
 let gps;
 const document={body:{classList:{add(x){classes.add(x)},remove(x){classes.delete(x)}}},
  getElementById:element,querySelectorAll:()=>[],addEventListener(){},hidden:false};
 const window={addEventListener(){},setTimeout(fn,ms){timers.push({fn,ms});return timers.length},
  clearTimeout(){},speechSynthesis:{cancel(){}},
  HealthGoMapV2:{close(){},resizeViewport(){},rememberPosition(){}},
  HealthGoMap4:{getSettings(){return {voice:false,follow:true}}}
 };
 const navigator={geolocation:{watchPosition(cb){gps=cb;counts.watch++;return 4},clearWatch(){counts.clear++}}};
 const map={getZoom(){return 16},setView(){return this},removeLayer(){}};
 vm.runInNewContext(source,{window,document,navigator,healthGoMap:map,console,Number,Math,Date});
 return {api:window.HealthGoMapPro,element,classes,timers,counts,
  emit(lat,lon,accuracy=8){gps({coords:{latitude:lat,longitude:lon,accuracy,speed:null,heading:null}})}};
}
function sample(){
 return {geometry:{coordinates:[[21,52],[21.001,52],[21.002,52]]},
  distance:140,duration:38,legs:[{steps:[
   {name:'Start',maneuver:{type:'depart',location:[21,52]}},
   {name:'Cel',maneuver:{type:'arrive',location:[21.002,52]}}
  ]}]};
}
test('One close GPS fix is insufficient to end a route',()=>{
 const h=harness();h.api.setRoute(sample(),'Cel');h.api.startNavigation();
 h.emit(52,21.002);
 assert.equal(h.timers.filter(x=>x.ms===4500).length,0);
 assert.equal(h.element('hgProNavigation').hidden,false);
 h.api.stopNavigation();
});
test('Two accurate independent GPS fixes near destination schedule automatic return to map',()=>{
 const h=harness();h.api.setRoute(sample(),'Cel');h.api.startNavigation();
 h.emit(52,21.002);
 h.emit(52,21.002);
 const end=h.timers.filter(x=>x.ms===4500);
 assert.equal(end.length,1,'must schedule exactly one arrival exit');
 assert.equal(h.element('hgProNavDirection').textContent,'Dotarcie do celu');
 assert.equal(h.element('hgProNavigation').hidden,false);
 end[0].fn();
 assert.equal(h.element('hgProNavigation').hidden,true);
 assert.equal(h.counts.clear,1);
});
test('Inaccurate GPS never confirms arrival',()=>{
 const h=harness();h.api.setRoute(sample(),'Cel');h.api.startNavigation();
 h.emit(52,21.002,120);
 h.emit(52,21.002,120);
 assert.equal(h.timers.filter(x=>x.ms===4500).length,0);
 assert.equal(h.element('hgProNavigation').hidden,false);
 h.api.stopNavigation();
});
