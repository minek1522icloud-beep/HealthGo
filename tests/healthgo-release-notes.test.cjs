'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-release-notes.js','utf8');
function fixture(){
 const map=new Map(),timers=[],buttons=[];
 const build='f'.repeat(40);
 const styles={add(){},remove(){}};
 let modal=null;
 const doc={
  querySelector(selector){
   if(selector==='meta[name="healthgo-build"]')return{getAttribute(){return build;}};
   if(selector==='.app')return{classList:{contains(){return false;}}};
   return null;
  },
  getElementById(id){
   if(id==='settingsHelp')return{appendChild(node){buttons.push(node);}};
   if(id==='hguOpenNotes')return buttons.find(b=>b.id==='hguOpenNotes')||null;
   if(id==='hguReleaseOverlay')return modal;
   return null;
  },
  createElement(){
   return {id:'',className:'',innerHTML:'',listeners:{},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},
     querySelector(){return{focus(){}};},remove(){if(this===modal)modal=null;}};
  },
  get activeElement(){return null;},
  body:{classList:styles,appendChild(node){modal=node;}}
 };
 const s={state:{uid:'alice',loading:false},subscribe(fn){fn(this.state);}};
 const store={getItem(k){return map.get(k)||null;},setItem(k,v){map.set(k,v);}};
 const win={HealthGoServices:s,addEventListener(){}};
 vm.runInNewContext(source,{document:doc,window:win,localStorage:store,setTimeout(fn){timers.push(fn);},MutationObserver:undefined});
 return{win,doc,timers,map,buttons,build,get modal(){return modal;}};
}
test('patch notes display once per deployed build and can be reopened manually',()=>{
 const x=fixture();
 assert.equal(x.buttons.length,1);
 assert.ok(x.timers.length);
 x.timers.shift()();
 assert.ok(x.modal);
 assert.match(x.modal.innerHTML,/AKTUALIZACJA 2.2/);
 assert.match(x.modal.innerHTML,/Skrzynia może zawierać naklejkę/);
 assert.match(x.modal.innerHTML,/HEALTHGO/);
 assert.ok(x.modal.listeners.click);
 x.modal.listeners.click({target:x.modal});
 assert.equal(x.modal,null);
 assert.equal(x.map.get('healthgo.release-notes.last-build.v1'),x.build);
 assert.equal(x.win.HealthGoWhatsNew.maybeShow(),undefined);
 assert.equal(x.modal,null);
 assert.equal(x.win.HealthGoWhatsNew.show(),true);
 assert.ok(x.modal);
});
test('mobile changelog is shipped with safe-area and scroll support',()=>{
 const css=fs.readFileSync('www/healthgo-release-notes.css','utf8');
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(html,/healthgo-release-notes\.js\?v=2/);
 assert.match(html,/healthgo-release-notes\.css\?v=1/);
 assert.match(source,/healthgo-build/);
 assert.match(source,/localStorage\.setItem\(KEY,build\(\)\)/);
 assert.match(source,/aria-modal="true"/);
 assert.match(css,/overflow:auto/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(source,/Co nowego w HealthGo/);
});
