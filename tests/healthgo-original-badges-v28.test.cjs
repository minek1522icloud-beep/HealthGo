'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-badge-gallery.js','utf8');
function gallery(){
 const host={HealthGoBadge3D:{catalog:Array.from({length:240},(_,i)=>({id:'hg-model-'+String(i+1).padStart(3,'0'),name:'Wzór '+i,earned:false,prototype:true})),model:()=>({}),openChest:()=>true}};
 vm.runInNewContext(source,{window:host,Math,Number,String,Array,Object,Set,Map});
 return host;
}
test('real user-supplied atlas is present in the repository as optimized AVIF artwork',()=>{
 const file=fs.readFileSync('www/assets/healthgo-badges-collection.avif');
 assert.ok(file.length>20000,'image atlas suspiciously small');
 assert.ok(file.length<400000,'atlas should be optimized for mobile');
 assert.equal(file.subarray(4,12).toString('ascii'),'ftypavif');
});
test('all 240 catalogue entries refer to 240 different source pictures from user art',()=>{
 const host=gallery(),api=host.HealthGoBadge3D;
 assert.equal(host.HealthGoBadgeGallery.count,252);
 const collection=api.catalog;
 const used=new Set();
 for(const item of collection){
  const n=host.HealthGoBadgeGallery.indexOf(item);
  assert.ok(n>=0&&n<252);
  used.add(n);
  const html=api.thumbnail(item);
  assert.match(html,/hgai-badge/);
  assert.match(html,/data-atlas-index="/);
  assert.match(html,/--hgai-x:[0-9.]+%;--hgai-y:[0-9.]+%/);
  assert.ok(!html.includes('<svg'),'this edition should display actual artwork, not generated SVG');
 }
 assert.equal(used.size,240);
});
test('real achievements have stable themed artwork, locked state stays locked',()=>{
 const a=gallery().HealthGoBadge3D;
 const x={id:'level_2',name:'Poziom 2',category:'level',earned:true};
 const y={id:'chat_intro',name:'Pierwsza rozmowa',category:'chat',earned:true};
 assert.notEqual(a.artIndex(x),a.artIndex(y));
 assert.equal(a.thumbnail(x),a.thumbnail(x));
 assert.match(a.thumbnail({id:'locked',name:'Tajemnica',earned:false}),/is-locked/);
 assert.doesNotMatch(a.thumbnail(x),/is-locked/);
 assert.equal(a.artIndex({id:'hg-model-001',prototype:true}),0);
 assert.equal(a.artIndex({id:'hg-model-240',prototype:true}),239);
 assert.ok(a.openChest,'chest preview from previous 3D module must remain intact');
});
test('the new touch viewer supports 360 rotation, zoom, pinch, escape, accessibility, reduced-motion',()=>{
 const css=fs.readFileSync('www/healthgo-badge-gallery.css','utf8');
 const pack=fs.readFileSync('www/healthgo-pack-pro.js','utf8');
 const profile=fs.readFileSync('www/healthgo-profile-pro.js','utf8');
 const room=fs.readFileSync('www/healthgo-collector-room.js','utf8');
 assert.match(source,/pointerdown/);
 assert.match(source,/pointermove/);
 assert.match(source,/pointercancel/);
 assert.match(source,/Math\.hypot/);
 assert.match(source,/rotateX\(/);
 assert.match(source,/rotateY\(/);
 assert.match(source,/data-hgai="details"/);
 assert.match(source,/aria-modal="true"/);
 assert.match(source,/prefers-reduced-motion/);
 assert.match(css,/background-size:1400% 1800%/);
 assert.match(css,/touch-action:none/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(pack,/HealthGoBadge3D\.open\(selected\)/);
 assert.match(pack,/openBadgeDetails:/);
 assert.match(profile,/HealthGoBadge3D\.open/);
 assert.match(room,/HealthGoBadge3D\?\.open/);
});
test('PWA loads new gallery after legacy 3D and before profile and backpack',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const sw=fs.readFileSync('www/service-worker.js','utf8');
 const find=x=>html.indexOf(x);
 assert.ok(find('healthgo-badge-3d.js?v=3')<find('healthgo-badge-gallery.js?v=1'));
 assert.ok(find('healthgo-badge-gallery.js?v=1')<find('healthgo-pack-pro.js?v=7'));
 assert.ok(find('healthgo-badge-gallery.js?v=1')<find('healthgo-profile-pro.js?v=4'));
 assert.match(html,/healthgo-badge-gallery\.css\?v=1/);
 assert.match(sw,/healthgo-pwa-v49-photo-badge-collection-offline-20261011/);
 assert.match(sw,/avif\|webp/);
});
