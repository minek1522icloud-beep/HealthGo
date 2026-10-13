'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-gps-visual.js','utf8');
function harness(){
 let now=0,next=1;const callbacks=new Map(),points=[];
 const win={
  requestAnimationFrame:fn=>{const id=next++;callbacks.set(id,fn);return id},
  cancelAnimationFrame:id=>callbacks.delete(id),
  performance:{now:()=>now},
  matchMedia:()=>({matches:false})
 };
 vm.runInNewContext(source,{window:win,Date,Number,Math,String});
 const api=win.HealthGoGpsVisual.create(p=>points.push({lat:p.lat,lon:p.lon}));
 function frame(delta=25){now+=delta;const current=[...callbacks.entries()];callbacks.clear();for(const [id,callback] of current)callback(now);}
 return {api,win,points,frame,pending:()=>callbacks.size};
}
test('visual smoother never invents a GPS fix or opens another geolocation watch',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.doesNotMatch(source,/navigator\.geolocation|watchPosition|setInterval|localStorage|indexedDB|fetch\(/);
 const h=harness();
 h.frame(1000);
 assert.equal(h.points.length,0,'No sample => no animation');
 h.api.fix({lat:52,lon:21},12);
 assert.equal(h.points.length,1);
 assert.equal(h.pending(),0,'One true position requires no further artificial samples');
});
test('between two real GPS samples, the marker smoothly reaches exactly the second fix',()=>{
 const h=harness();h.api.fix({lat:52,lon:21},7);
 h.api.fix({lat:52,lon:21.00015},7);
 assert.ok(h.pending()>0);
 h.frame(90);
 const partial=h.points.at(-1);
 assert.ok(partial.lon>21&&partial.lon<21.00015);
 for(let i=0;i<30;i++)h.frame(30);
 assert.ok(Math.abs(h.points.at(-1).lon-21.00015)<1e-9);
 assert.equal(h.pending(),0,'Animation ends at the real fix');
 h.frame(5000);
 assert.ok(Math.abs(h.points.at(-1).lon-21.00015)<1e-9,'No extrapolation after GPS silence');
});
test('GPS jump or low accuracy snaps to the actual measured point and stops previous animation',()=>{
 const h=harness();h.api.fix({lat:52,lon:21},8);
 h.api.fix({lat:52,lon:21.0002},8);assert.ok(h.pending()>0);
 h.api.fix({lat:52.01,lon:21.01},10);
 assert.equal(h.points.at(-1).lat,52.01);
 assert.equal(h.pending(),0);
 h.api.fix({lat:52.01001,lon:21.01001},95);
 assert.equal(h.pending(),0);
});
test('stop cancels outstanding animation and discarded fixes cannot move marker',()=>{
 const h=harness();h.api.fix({lat:52,lon:21},8);
 h.api.fix({lat:52,lon:21.00015},8);h.api.stop();
 const prior=h.points.length;
 h.frame(1000);assert.equal(h.points.length,prior);
 assert.equal(h.api.fix({lat:52.1,lon:21.2}),false);
});
test('2D and 3D visual GPS smoothing are both wired to real markers, not route totals',()=>{
 const f=fs.readFileSync('www/healthgo-navigation-follow-v1.js','utf8');
 const gl=fs.readFileSync('www/healthgo-navigation-live.js','utf8');
 const html=fs.readFileSync('www/index.html','utf8');
 const mapPro=fs.readFileSync('www/healthgo-map-pro.js','utf8');
 assert.match(f,/HealthGoGpsVisual\?\.create/);
 assert.match(gl,/HealthGoGpsVisual\?\.create/);
 assert.match(gl,/lastView>580/);
 assert.match(f,/lastFrameAt<380/);
 assert.match(mapPro,/resumeGpsAfterForeground/);
 assert.match(mapPro,/function armGpsWatcher\(\)/);
 assert.match(mapPro,/navigator\.geolocation\.watchPosition\(positionUpdate/);
 assert.doesNotMatch(mapPro,/visibilitychange',\(\)=>\{if\(document\.hidden\)stopNavigation\(\)/);
 assert.match(html,/healthgo-gps-visual\.js\?v=1/);
 assert.match(html,/healthgo-gps-smooth\.css\?v=1/);
});
test('speed gauge displays real GPS speed and only opted-in validated OSM limits',()=>{
 const advanced=fs.readFileSync('www/healthgo-nav-advanced.js','utf8');
 const html=fs.readFileSync('www/index.html','utf8');
 const css=fs.readFileSync('www/healthgo-gps-smooth.css','utf8');
 assert.match(html,/id="hgNavSpeedGauge"/);
 assert.match(html,/id="hgNavGaugeLimit"[^>]*hidden/);
 assert.match(advanced,/speed===null\?'0':String\(Math\.min\(1,speed\/130\)\)/);
 assert.match(advanced,/sign\.hidden=!active/);
 assert.match(advanced,/sign\.textContent=limitsEnabled&&limitDisplay\?String\(limitDisplay\.kmh\):'—'/);
 assert.match(advanced,/sign\.classList\?\.toggle\?\.\('hg-limit-unknown'/);
 assert.match(advanced,/speedLimitValue\(way\.tags\?\.maxspeed\)/);
 assert.match(css,/#map #hgNavLimitBadge\{display:none!important\}/);
});
