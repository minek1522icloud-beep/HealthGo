'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('www/healthgo-badge-photo.js','utf8');
function setup(){
 const win={HealthGoBadge3D:{catalog:[{id:'hg-model-001',prototype:true}],openChest(){return true;}},HealthGoSimpleBadges:{svg(){return '<svg viewBox="0 0 24 24"><path d="M2 2"/></svg>';}}};
 vm.runInNewContext(source,{window:win,Math,Array,Set,Map,Number,console});
 return win;
}
test('single original badge per sprite crop, never the full poster in a square',()=>{
 const api=setup().HealthGoBadgePhoto;
 assert.equal(api.count,231);
 for(let i=1;i<=231;i++){
  const item={id:'hg-model-'+String(i).padStart(3,'0'),name:'Odznaka '+i,prototype:true};
  const html=api.thumbnail(item);
  assert.match(html,/hgab-photo hgab-native/);
  assert.match(html,/background-size:[\d.]+% [\d.]+%/);
  assert.match(html,/background-position:[\d.]+% [\d.]+%/);
  assert.doesNotMatch(html,/<canvas|<img[^>]+healthgo-badge-board/);
  const index=api.artIndex(item),rect=api.cropRect(index);
  assert.ok(rect.w>=60&&rect.w<=76);
  assert.ok(rect.x>=0&&rect.y>=0);
  assert.ok(rect.x+rect.w<=1055&&rect.y+rect.h<=1491);
  const sizes=html.match(/background-size:([\d.]+)% ([\d.]+)%/);
  const offsets=html.match(/background-position:([\d.]+)% ([\d.]+)%/);
  assert.ok(Math.abs(Number(sizes[1])-1055/rect.w*100)<.001);
  assert.ok(Math.abs(Number(sizes[2])-1491/rect.h*100)<.001);
  assert.ok(Math.abs(Number(offsets[1])-rect.x/(1055-rect.w)*100)<.001);
  assert.ok(Math.abs(Number(offsets[2])-rect.y/(1491-rect.h)*100)<.001);
 }
});
test('real achievement name mapping stays deterministic and shows distinct illustrations',()=>{
 const api=setup().HealthGoBadgePhoto;
 const badges=['Pierwsza rozmowa','Poziom 2','250 XP','Wyzwania II','Odkrywca','Pierwsze XP'];
 const ids=badges.map((name,i)=>api.artIndex({id:'badge-'+i,name,earned:true}));
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(ids.every(x=>Number.isInteger(x)&&x>=0&&x<231));
 const one=api.thumbnail({id:'badge-level',name:'Poziom 2',earned:true});
 assert.match(one,/hgab-native-fallback/);
 assert.match(one,/role="img"/);
});
test('photo asset exists and guaranteed visible fallback when Safari cannot load it',()=>{
 const html=fs.readFileSync('www/index.html','utf8'),css=fs.readFileSync('www/healthgo-badge-photo.css','utf8');
 const jpeg=fs.readFileSync('www/assets/healthgo-badge-board.jpg');
 assert.equal(jpeg[0],255);assert.equal(jpeg[1],216);
 assert.match(css,/background-image:url\('\.\/assets\/healthgo-badge-board\.jpg\?v=4'\)!important/);
 assert.match(source,/hgab-image-ready/);
 assert.match(source,/hgab-image-error/);
 assert.match(css,/hgab-native-fallback/);
 assert.match(html,/healthgo-badge-photo\.js\?v=1/);
 assert.match(html,/healthgo-badge-photo\.css\?v=1/);
 assert.ok(html.indexOf('healthgo-badge-simple.js?v=1')<html.indexOf('healthgo-badge-photo.js?v=1'));
 assert.ok(html.indexOf('healthgo-badge-photo.js?v=1')<html.indexOf('healthgo-pack-pro.js?v=9'));
 assert.doesNotMatch(html,/src="\.\/healthgo-badge-board\.js/);
});
test('phone inspect remains operable with touch orbit and pinch zoom without oversized artwork',()=>{
 const css=fs.readFileSync('www/healthgo-badge-photo.css','utf8');
 assert.match(source,/pointerdown/);assert.match(source,/pointermove/);
 assert.match(source,/pointercancel/);assert.match(source,/Math\.hypot/);
 assert.match(source,/hgab-face-back/);assert.match(source,/role="dialog"/);
 assert.match(css,/max-width:190px!important/);
 assert.match(css,/safe-area-inset-bottom/);
});
