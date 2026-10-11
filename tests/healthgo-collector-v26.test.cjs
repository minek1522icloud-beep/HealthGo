'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const roomSource=read('www/healthgo-collector-room.js');
const profileSource=read('www/healthgo-profile-pro.js');
const inspectSource=read('www/healthgo-badge-3d.js');
test('room includes only actually earned and specifically selected medals, at most six',()=>{
 const win={};vm.runInNewContext(roomSource,{window:win,Set,Array,String});
 const api=win.HealthGoCollectorRoom;
 assert.equal(api.themes.length,3);
 const candidates=[
  {id:'real1',name:'Pierwszy',earned:true},{id:'real2',name:'Drugi',earned:true},
  {id:'locked',name:'Nieodkryty',earned:false},{id:'unknown',name:'Brak potwierdzenia'},
  {id:'real1',name:'Duplikat',earned:true},
  ...Array.from({length:9},(_,i)=>({id:'extra-'+i,name:'Odznaka '+i,earned:true}))
 ];
 const accepted=api.uniqueEarned(candidates);
 assert.equal(accepted.length,6);
 assert.equal(new Set(Array.from(accepted,x=>x.id)).size,6);
 assert.ok(Array.from(accepted,x=>x.id).includes('real1'));
 assert.ok(!Array.from(accepted,x=>x.id).includes('locked'));
 assert.ok(!Array.from(accepted,x=>x.id).includes('unknown'));
 assert.ok(accepted.every(x=>x.earned===true));
});
test('Start avatar and sidebar avatar open account rather than settings',()=>{
 const html=read('www/index.html');
 assert.match(html,/class="account-pill" type="button" onclick="window\.HealthGoProfile\?window\.HealthGoProfile\.open\('me'\)/);
 assert.match(html,/class="sidebar-account" type="button" onclick="window\.HealthGoProfile\?window\.HealthGoProfile\.open\('me'\)/);
 assert.match(profileSource,/menuButton\('settings','Ustawienia'/);
 assert.match(profileSource,/data-profile-action="room"/);
 assert.match(profileSource,/roomLaunch\(false\)/);
 assert.match(profileSource,/roomLaunch\(true\)/);
 assert.match(profileSource,/HealthGoCollectorRoom\.open/);
 assert.match(profileSource,/getState|selectedShowcase/);
 assert.match(profileSource,/healthgo_profile_save/);
});
test('room offers three themes, six vitrines, verified friend galleries and local photo card',()=>{
 const css=read('www/healthgo-collector-room.css');
 const html=read('www/index.html');
 assert.match(html,/healthgo-collector-room\.js\?v=1/);
 assert.match(html,/healthgo-collector-room\.css\?v=1/);
 assert.match(roomSource,/HEALTHGO COLLECTOR EDITION/);
 assert.match(roomSource,/data-hgcr-medal/);
 assert.match(roomSource,/Array\.from\(\{length:6\}/);
 assert.match(roomSource,/data-hgcr-theme/);
 assert.match(roomSource,/HealthGoBadge3D\?\.open/);
 assert.match(roomSource,/image\/svg\+xml/);
 assert.match(roomSource,/current\.theme/);
 assert.match(css,/safe-area-inset-top/);
 assert.match(css,/hgcr-spotlight/);
 assert.match(css,/hgcr-podium/);
 assert.doesNotMatch(roomSource,/totalXp|heartRate|stepsToday|geolocation|latitude|longitude/);
});
test('premium Inspect has a glass case, true WebGL, 3 lighting presets and photo capture',()=>{
 const css=read('www/healthgo-badge-3d.css');
 assert.match(inspectSource,/hgb3d-glass-case/);
 assert.match(inspectSource,/hgb3d-pedestal/);
 assert.match(inspectSource,/lightSource/);
 assert.match(inspectSource,/data-hgb3d="light"/);
 assert.match(inspectSource,/data-hgb3d="showcase"/);
 assert.match(inspectSource,/data-hgb3d="photo"/);
 assert.match(inspectSource,/preserveDrawingBuffer:true/);
 assert.match(inspectSource,/toDataURL\('image\/png'\)/);
 assert.match(inspectSource,/gl\.drawArrays\(gl\.TRIANGLES/);
 assert.match(inspectSource,/pointerdown/);
 assert.match(inspectSource,/Math\.hypot\(p\.x-other\.x/);
 assert.match(css,/hgb3d-glass-case/);
 assert.match(css,/hgb3d-stage\[data-hgb3d-light="2"\]/);
});
test('icons are distinct by achievement identity, beyond recolored generic stars',()=>{
 const win={};vm.runInNewContext(inspectSource,{window:win,Math,Array,Float32Array,Map,Number});
 const fn=win.HealthGoBadge3D.thumbnail;
 const labels=['Zdrowe serce','Biegacz','Kryształ','Korona','Odkrywca','Strażnik','Liść natury','Gwiazda','Puchar','Woda','Książka','Płomień'];
 const icons=labels.map((name,i)=>fn({id:'case-'+i,name,earned:true,rarity:'rare'}));
 assert.equal(new Set(icons).size,icons.length);
 assert.ok(icons.every(s=>s.includes('hgb3d-thumbnail')&&s.includes('data-model-geometry')));
 assert.match(inspectSource,/crestIndex/);
 assert.match(inspectSource,/CRESTS\[/);
 assert.equal(win.HealthGoBadge3D.catalog.length,240);
});
