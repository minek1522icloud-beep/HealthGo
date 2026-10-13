'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-release-notes.js','utf8');
function fixture(){
 const stored=new Map(),timers=[],nodes=[],build='f'.repeat(40);
 const doc={
  activeElement:null,
  body:{classList:{add(){},remove(){}},appendChild(x){nodes.push(x);x.attached=true;}},
  querySelector(selector){
   if(selector==='meta[name="healthgo-build"]')return{getAttribute:()=>build};
   if(selector==='.app')return{classList:{contains:()=>false}};
   return null;
  },
  getElementById(id){return nodes.find(x=>x.id===id&&x.attached!==false)||null;},
  createElement(tag){
   const x={tag,children:[],listeners:{},id:'',className:'',textContent:'',innerHTML:'',
    append(...items){this.children.push(...items)},
    appendChild(item){this.children.push(item);nodes.push(item);item.attached=true},
    replaceChildren(...items){this.children=[...items]},
    setAttribute(){},
    addEventListener(ev,fn){this.listeners[ev]=fn},
    querySelector(){return{focus(){}}},
    remove(){this.attached=false;},
    focus(){},
   };
   nodes.push(x);return x;
  }
 };
 const page=doc.createElement('section');page.id='notifications';page.attached=true;
 page.insertBefore=function(node){nodes.push(node);node.attached=true;};
 const help=doc.createElement('section');help.id='settingsHelp';help.attached=true;
 const store={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
 let subscriber;
 const state={uid:'alice',loading:false};
 const services={state,subscribe(fn){subscriber=fn;fn(state)}};
 const win={document:doc,HealthGoServices:services,localStorage:store,setTimeout(fn){timers.push(fn)},
  addEventListener(){}};
 vm.runInNewContext(source,{window:win,document:doc,console},
  {filename:'healthgo-release-notes.js'});
 return{win,doc,stored,timers,nodes,state,subscriber,build};
}
test('HealthGo 4.4 shows the latest real release, not the stale 3.2 patch notes',()=>{
 new vm.Script(source);
 const x=fixture();
 assert.equal(x.win.HealthGoWhatsNew.release,'4.4');
 assert.ok(x.timers.length>0);
 x.timers.splice(0).forEach(fn=>fn());
 const modal=x.doc.getElementById('hguReleaseOverlay');
 assert.ok(modal);
 assert.match(modal.innerHTML,/AKTUALIZACJA 4\.4/);
 assert.match(modal.innerHTML,/Aktywność PRO/);
 assert.doesNotMatch(modal.innerHTML,/AKTUALIZACJA 3\.2/);
 assert.match(modal.innerHTML,/Historia wersji/);
 assert.equal(x.win.HealthGoWhatsNew.unreadCount(),1);
 modal.listeners.click({target:modal});
 assert.equal(x.doc.getElementById('hguReleaseOverlay'),null);
 assert.equal(x.win.HealthGoWhatsNew.unreadCount(),0);
 assert.ok(x.stored.has('healthgo.updates44.seen.alice'));
 assert.equal(x.win.HealthGoWhatsNew.maybeShow(),undefined);
 assert.equal(x.doc.getElementById('hguReleaseOverlay'),null);
 assert.equal(x.win.HealthGoWhatsNew.show(),true);
 assert.ok(x.doc.getElementById('hguReleaseOverlay'),'the user can reopen the archive manually');
});
test('local in-app update inbox is per account and only admits real remote SHAs',()=>{
 const x=fixture();
 x.win.HealthGoWhatsNew.addPending('not-a-sha');
 assert.equal(x.win.HealthGoWhatsNew.unreadCount(),1);
 x.win.HealthGoWhatsNew.addPending('a'.repeat(40));
 assert.equal(x.win.HealthGoWhatsNew.unreadCount(),2);
 assert.equal(JSON.parse(x.stored.get('healthgo.updates44.pending.alice')).version,'a'.repeat(40));
 x.state.uid='bob';x.subscriber(x.state);
 assert.equal(x.win.HealthGoWhatsNew.unreadCount(),1);
 assert.equal(x.stored.has('healthgo.updates44.pending.bob'),false);
});
test('changelog and inbox work with safe areas without promising fake push',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const css=fs.readFileSync('www/healthgo-release-notes.css','utf8');
 assert.match(html,/healthgo-release-notes\.js\?v=18/);
 assert.match(html,/healthgo-release-notes\.css\?v=3/);
 assert.match(html,/healthgo:update-available/);
 assert.match(source,/aria-modal="true"/);
 assert.match(source,/localStorage\?\.getItem|localStorage\?\.setItem/);
 assert.match(source,/id='hguInbox'/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/hgu-inbox/);
 assert.doesNotMatch(source,/new Notification\(/);
});
