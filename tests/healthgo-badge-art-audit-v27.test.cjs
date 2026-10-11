'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(name,'utf8');
const forgeScript=read('www/healthgo-badge-3d.js');
function forge(){const host={};vm.runInNewContext(forgeScript,{window:host,Math,Float32Array,Array,Map,Number,Set});return host.HealthGoBadge3D;}
const examples=[
 {id:'first_chat',name:'Pierwsza rozmowa',category:'chat',rarity:'common',earned:true},
 {id:'level_2',name:'Poziom 2',category:'xp',rarity:'common',earned:true},
 {id:'xp_250',name:'250 XP',category:'xp',rarity:'common',earned:true},
 {id:'challenge_2',name:'Wyzwania II',category:'badges',rarity:'legendary',earned:true},
 {id:'explorer',name:'Odkrywca',category:'badges',rarity:'rare',earned:true},
 {id:'first_xp',name:'Pierwsze XP',category:'xp',rarity:'common',earned:true},
 {id:'heart',name:'Zdrowe serce',category:'health',rarity:'rare',earned:true},
 {id:'steps',name:'Biegacz',category:'sports',rarity:'rare',earned:true},
 {id:'crown',name:'Korona',category:'cups',rarity:'legendary',earned:true},
 {id:'mountains',name:'Góry',category:'special',rarity:'mythic',earned:true}
];
test('medal geometry is numerically finite and never stretches beyond a bounded silhouette',()=>{
 const api=forge();
 for(const x of api.catalog.concat(examples)){
   const mesh=api.model(x,1),outline=mesh.outline;
   assert.equal(outline.length,72,x.id);
   assert.ok(mesh.vertices.length>1000,x.id);
   assert.equal(mesh.vertices.length,mesh.normals.length,x.id);
   assert.equal(mesh.vertices.length,mesh.colors.length,x.id);
   for(const point of outline){
     assert.ok(Number.isFinite(point[0])&&Number.isFinite(point[1]),x.id);
     assert.ok(Math.hypot(point[0],point[1])>.35&&Math.hypot(point[0],point[1])<1.4,x.id);
   }
   for(const vec of mesh.vertices)assert.ok(Number.isFinite(vec),x.id);
   assert.ok(mesh.depth>0&&mesh.depth<.5,x.id);
 }
});
test('24 silhouette families and actual central pictograms replace generic wavy star medals',()=>{
 const api=forge();
 const keys=new Set(),centers=new Set();
 for(const x of api.catalog){
  const mesh=api.model(x,1);
  keys.add(mesh.form);
  const thumbnail=api.thumbnail(x);
  centers.add((thumbnail.match(/<g transform="scale\(\.67\)">([\s\S]*?)<\/g>/)||[])[1]);
  assert.match(thumbnail,/preserveAspectRatio="xMidYMid meet"/);
  assert.match(thumbnail,/viewBox="-110 -110 220 220"/);
  assert.match(thumbnail,/linearGradient/);
 }
 assert.ok(keys.size>=10,'not enough distinct outlines');
 assert.ok(centers.size>=12,'too few distinct central icons');
 const gallery=examples.map(x=>api.thumbnail(x));
 assert.equal(new Set(gallery).size,examples.length);
 assert.match(gallery[0],/data-model-geometry/);
});
test('medal SVG gradients and fills cannot be overwritten by icon-only CSS rules',()=>{
 const css=read('www/healthgo-pack-pro.css');
 assert.match(css,/#hgPackProRoot svg:not\(\.hgp-medal-svg\):not\(\.hgr-collectible-art\)/);
 assert.doesNotMatch(css,/#hgPackProRoot svg\{width:19px/);
 assert.match(css,/\.hgp-art svg\.hgp-medal-svg\{[^}]*aspect-ratio:1\/1/);
 assert.match(css,/\.hgp-card \.hgp-art\.hgp-medal-stage\{[^}]*aspect-ratio:1 \/ 1/);
 assert.match(read('www/healthgo-profile-pro.css'),/\.hgp-featured-inspect div svg\.hgp-medal-svg\{[^}]*aspect-ratio:1\/1/);
});
test('real 3D projection compensates for wide iPhone canvas aspect ratio',()=>{
 assert.match(forgeScript,/uniform float aspect;/);
 assert.match(forgeScript,/gl\.uniform1f\(aspectLoc,pw\/Math\.max\(1,ph\)\)/);
 assert.match(forgeScript,/v\.x\*zoom\/z\*1\.8\/aspect/);
 assert.doesNotMatch(forgeScript,/gl_Position=vec4\(v\.xy\*zoom\/z/);
 assert.match(forgeScript,/function pointerMove\(/);
});
test('thumbnails avoid full 3D triangulation for every card on phones',()=>{
 const api=forge();
 assert.doesNotMatch(forgeScript,/var geom=model\(item,1\),seed/);
 assert.match(forgeScript,/outline=Array\.from\(\{length:72\}/);
 assert.equal(api.thumbnail(examples[0]),api.thumbnail(examples[0]));
});
test('new app references and service worker are versioned to evict stale PWA assets',()=>{
 const html=read('www/index.html'),sw=read('www/service-worker.js');
 assert.match(html,/healthgo-badge-3d\.js\?v=3/);
 assert.match(html,/healthgo-badge-3d\.css\?v=3/);
 assert.match(html,/healthgo-pack-pro\.css\?v=3/);
 assert.match(html,/healthgo-profile-pro\.css\?v=4/);
 assert.match(sw,/healthgo-pwa-v57-simple-color-badges-20261011/);
 assert.match(html,/healthgo-collector-room\.js\?v=1/);
});
