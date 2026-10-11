'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const source=read('www/healthgo-badge-vector.js');
function harness(){
 const win={HealthGoBadge3D:{catalog:Array.from({length:240},(_,i)=>({id:'hg-model-'+String(i+1).padStart(3,'0'),name:'Wzór '+i,earned:false,prototype:true})),model:()=>({}),openChest:()=>true}};
 vm.runInNewContext(source,{window:win,Math,Number,String,Array,Object,Set,Map});
 return win;
}
test('240 crisp SVG badges exist with differentiated frames, motifs and materials',()=>{
 const api=harness().HealthGoBadgeVector;
 assert.equal(api.frames,24);assert.ok(api.emblems>=28);
 const signatures=new Set(),artworks=new Set(),shapes=new Set(),emblems=new Set();
 for(let i=1;i<=240;i++){
  const item={id:'hg-model-'+String(i).padStart(3,'0'),name:'Projekt '+i,prototype:true,earned:false};
  const art=api.thumbnail(item);
  assert.match(art,/viewBox="0 0 240 240"/);
  assert.match(art,/preserveAspectRatio="xMidYMid meet"/);
  assert.match(art,/<linearGradient/);
  assert.match(art,/<radialGradient/);
  assert.match(art,/data-vector-badge/);
  assert.match(art,/<svg[\s\S]*<path[\s\S]*<\/svg>/);
  const v=api.variant(item);
  signatures.add(v.frame+':'+v.icon+':'+v.index);
  shapes.add(v.frame);emblems.add(v.icon);artworks.add(art);
 }
 assert.equal(signatures.size,240);assert.equal(artworks.size,240);
 assert.equal(shapes.size,24);assert.ok(emblems.size>=28);
});
test('real accomplishments use distinct thematic artwork, with lock state unchanged',()=>{
 const api=harness().HealthGoBadgeVector;
 const defs=[
  {id:'first_chat',name:'Pierwsza rozmowa',earned:true},
  {id:'level_2',name:'Poziom 2',earned:true},
  {id:'xp_250',name:'250 XP',earned:true},
  {id:'challenge_2',name:'Wyzwania II',earned:true},
  {id:'explorer',name:'Odkrywca',earned:true}
 ];
 const drawn=defs.map(x=>api.thumbnail(x));
 assert.equal(new Set(drawn).size,5);
 assert.equal(api.variant(defs[0]).icon,'chat');
 assert.equal(api.variant(defs[1]).icon,'level');
 assert.equal(api.variant(defs[2]).icon,'xp');
 assert.equal(api.variant(defs[3]).icon,'challenge');
 assert.equal(api.variant(defs[4]).icon,'compass');
 assert.match(api.thumbnail({id:'locked1',name:'Tajemnica',earned:false}),/hgv-locked/);
 assert.doesNotMatch(drawn[0],/hgv-locked/);
 const host=harness();assert.equal(typeof host.HealthGoBadge3D.openChest,'function');
});
test('one close button, touch orbit and pinch, no bottom toolbar',()=>{
 assert.match(source,/pointerdown/);
 assert.match(source,/pointermove/);
 assert.match(source,/pointercancel/);
 assert.match(source,/rotateX\(/);
 assert.match(source,/rotateY\(/);
 assert.match(source,/Math\.hypot/);
 assert.match(source,/data-hgv-close/);
 assert.match(source,/aria-modal="true"/);
 assert.doesNotMatch(source,/data-hgv="auto"|data-hgv="details"|data-hgv="reset"/);
 const css=read('www/healthgo-badge-vector.css');
 assert.match(css,/touch-action:none/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/\.hgv-object/);
 assert.doesNotMatch(css,/background-size:1400%/);
});
test('PWA loads vector graphics before backpack and profile, never requesting legacy atlas',()=>{
 const html=read('www/index.html'),sw=read('www/service-worker.js');
 const find=x=>html.indexOf(x);
 assert.ok(find('healthgo-badge-3d.js?v=3')<find('healthgo-badge-board.js?v=2'));
 assert.ok(find('healthgo-badge-board.js?v=2')<find('healthgo-pack-pro.js?v=7'));
 assert.ok(find('healthgo-badge-board.js?v=2')<find('healthgo-profile-pro.js?v=4'));
 assert.doesNotMatch(html,/healthgo-badge-gallery/);
 assert.match(sw,/healthgo-pwa-v52-iphone-canvas-badges-20261011/);
 const pack=read('www/healthgo-pack-pro.js');
 const profile=read('www/healthgo-profile-pro.js');
 const room=read('www/healthgo-collector-room.js');
 assert.match(pack,/HealthGoBadge3D\.thumbnail/);
 assert.match(profile,/HealthGoBadge3D\?\.thumbnail/);
 assert.match(room,/HealthGoBadge3D\?\.thumbnail/);
});
