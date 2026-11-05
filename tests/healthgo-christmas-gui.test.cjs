'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..','www',name),'utf8');

test('holiday theme replaces the permanent Halloween override without breaking navigation',()=>{
 const html=read('index.html');
 assert.match(html,/healthgo-light-theme\.css/);
 assert.match(html,/healthgo-gui-fix\.css/);
 assert.match(html,/healthgo-christmas\.css/);
 assert.match(html,/healthgo-christmas-premium\.css/);
 assert.match(html,/healthgo-christmas-premium\.js/);
 assert.doesNotMatch(html,/href="\.\/healthgo-halloween\.css/);
 assert.ok(html.indexOf('healthgo-gui-fix.css')>html.indexOf('healthgo-light-theme.css'));
 assert.match(html,/<body class="hg-emerald" data-dark="0"/);
 assert.match(html,/id="hgChristmasToggle"[^>]*onclick="HealthGoChristmas\.toggle\(\)"/);
 assert.match(html,/icon-christmas\.svg/);
 assert.match(read('manifest.webmanifest'),/icon-christmas\.svg/);
 assert.match(read('service-worker.js'),/healthgo-pwa-v62-christmas-premium-20261105/);
});
test('visible modern dashboard has three working quick-access targets',()=>{
 const src=read('healthgo-emerald-dashboard.js');
 for(const page of ['activity','plan','map'])assert.ok(src.includes('data-hgs-quick="'+page+'"'));
 assert.match(src,/root\.addEventListener\('click'/);
 assert.match(src,/typeof window\.go==='function'/);
 assert.match(src,/hgs-holiday-message/);
});
function launch(dateIso,override){
 const storage=new Map();
 if(override)storage.set('healthgo.christmas.enabled',override);
 const classes=new Set();
 const toggle=(name,on)=>on?classes.add(name):classes.delete(name);
 const button={textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
 const FixedDate=class extends Date{constructor(...args){super(...(args.length?args:[dateIso]));}};
 const context={
  Date:FixedDate,window:{},
  localStorage:{getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}},
  document:{readyState:'complete',body:{classList:{toggle,contains:n=>classes.has(n)}},getElementById:k=>k==='hgChristmasToggle'?button:null}
 };
 vm.runInNewContext(read('healthgo-christmas.js'),context,{timeout:2000});
 return {classes,button,storage,api:context.window.HealthGoChristmas};
}
test('Christmas is the default from November until 6 January and never forces a dark screen',()=>{
 assert.ok(launch('2026-11-05T12:00:00').classes.has('hg-christmas'));
 assert.ok(launch('2027-01-06T12:00:00').classes.has('hg-christmas'));
 assert.ok(!launch('2027-01-07T12:00:00').classes.has('hg-christmas'));
 assert.ok(!launch('2027-03-11T12:00:00').classes.has('hg-christmas'));
 assert.ok(!launch('2026-12-24T12:00:00','off').classes.has('hg-christmas'));
});
test('holiday decoration can be toggled without disabling the app',()=>{
 const ui=launch('2026-12-24T12:00:00');
 assert.equal(ui.button.attrs['aria-pressed'],'true');
 ui.api.toggle();
 assert.equal(ui.button.attrs['aria-pressed'],'false');
 assert.equal(ui.storage.get('healthgo.christmas.enabled'),'off');
 ui.api.toggle();
 assert.equal(ui.button.attrs['aria-pressed'],'true');
 assert.equal(ui.storage.get('healthgo.christmas.enabled'),'on');
});
