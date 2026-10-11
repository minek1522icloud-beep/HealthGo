'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-badge-3d.js','utf8');
function forge(){const window={};vm.runInNewContext(source,{window,Math,Array,Number,Map,Float32Array});return window.HealthGoBadge3D;}
test('a public gallery of 240 distinct, non-earned 3D medal model prototypes',()=>{
 const api=forge(),catalog=api.catalog;
 assert.equal(catalog.length,240);
 assert.equal(new Set(Array.from(catalog,x=>x.id)).size,240);
 assert.ok(catalog.every(x=>x.prototype&&x.earned===false));
 assert.equal(catalog[0].index,1);assert.equal(catalog[239].index,240);
 assert.ok(!api.definition(241));
 assert.ok(!api.definition(0));
});
test('all 240 models have individually generated 3D mesh geometry, not just different colors',()=>{
 const api=forge(),signatures=new Set(),frontProfiles=new Set(),motifs=new Set();
 for(const item of api.catalog){
  const mesh=api.model(Object.assign({},item,{rarity:'rare'}),1);
  assert.ok(mesh.vertices.length>1800,'no geometry '+item.id);
  assert.equal(mesh.vertices.length,mesh.normals.length);
  assert.equal(mesh.vertices.length,mesh.colors.length);
  assert.ok(mesh.depth>0);
  assert.equal(mesh.outline.length,72);
  assert.ok(mesh.triangles>700);
  signatures.add(mesh.signature);
  frontProfiles.add(mesh.outline.map(p=>p.map(v=>v.toFixed(3)).join(',')).join(';'));
  const thumb=api.thumbnail(item);
  assert.match(thumb,/hgb3d-thumbnail/);
  assert.match(thumb,/linearGradient/);
  assert.match(thumb,/data-model-geometry/);
  motifs.add(thumb);
 }
 assert.equal(signatures.size,240);
 assert.equal(frontProfiles.size,240);
 assert.equal(motifs.size,240);
});
test('real achievement unlocks determine appearance stages without creating XP',()=>{
 const api=forge();
 const item={id:'real-1',earned:true,rarity:'epic',category:'badges'};
 assert.equal(api.achievedStage({earned:false,categoryEarnedCount:17}),0);
 assert.equal(api.achievedStage({...item,categoryEarnedCount:1}),1);
 assert.equal(api.achievedStage({...item,categoryEarnedCount:3}),2);
 assert.equal(api.achievedStage({...item,categoryEarnedCount:10}),3);
 assert.notEqual(api.model(item,1).signature,api.model(item,3).signature);
 assert.ok(api.model(item,3).depth>api.model(item,1).depth);
});
test('chests use actual 3D box/lid mesh, not only a CSS picture',()=>{
 const api=forge();
 const chest=api.chestModel('starter');
 assert.ok(chest.vertices.length>450);
 assert.ok(chest.triangles>80);
 assert.notEqual(api.chestModel('starter').signature,api.chestModel('daily').signature);
 assert.match(source,/function context\(canvas,mesh\)/);
 assert.match(source,/gl\.drawArrays\(gl\.TRIANGLES/);
});
test('iPhone and desktop inspect allow touch orbit, pinch, wheel zoom and keyboard controls',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const css=fs.readFileSync('www/healthgo-badge-3d.css','utf8');
 const pack=fs.readFileSync('www/healthgo-pack-pro.js','utf8');
 const profile=fs.readFileSync('www/healthgo-profile-pro.js','utf8');
 assert.match(html,/healthgo-badge-3d\.js\?v=2/);
 assert.match(html,/healthgo-badge-3d\.css\?v=2/);
 assert.match(source,/pointerdown/);
 assert.match(source,/pointermove/);
 assert.match(source,/pointercancel/);
 assert.match(source,/Math\.hypot\(p\.x-other\.x/);
 assert.match(source,/event\.key==='Escape'|ev\.key==='Escape'/);
 assert.match(source,/wheel/);
 assert.match(source,/aria-modal/);
 assert.match(source,/prefers-reduced-motion/);
 assert.match(css,/touch-action:none/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(pack,/data-action="inspect-model"/);
 assert.match(pack,/data-action="inspect-3d"/);
 assert.match(pack,/Katalog 240 modeli 3D/);
 assert.match(profile,/data-profile-inspect/);
 assert.match(profile,/maksymalnie 6 zdobytych odznak/);
});
test('profile six slots remain validated by original database-backed achievements',()=>{
 const migration=fs.readFileSync('supabase/migrations/20261011_healthgo_showcase_six.sql','utf8');
 assert.match(migration,/cardinality\(featured\) <= 6/);
 assert.match(migration,/healthgo_profile_save/);
 assert.match(migration,/limit 3/);
 assert.match(migration,/limit 6/);
 assert.doesNotMatch(migration,/grant .*to anon/i);
});
