'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const source=read('www/healthgo-badge-simple.js');
function load(){
 const win={HealthGoBadge3D:{catalog:[{id:'hg-model-001',prototype:true}],openChest(){return true;}},HealthGoServices:{state:{}},HealthGoEngine:{}};
 vm.runInNewContext(source,{window:win,Math,Number,String,Set,Map,Array,Object});
 return win;
}
test('one neat consistent medal shape for all real achievements',()=>{
 const api=load().HealthGoSimpleBadges;
 const names=['Pierwsza rozmowa','Poziom 2','250 XP','Wyzwania II','Odkrywca','Pierwsze XP'];
 const cards=names.map((name,i)=>api.svg({id:'achievement_'+i,name,earned:true,rarity:i%2?'legendary':'common'}));
 const shape=s=>s.match(/<path d="M120 12 168 24 209 63 [^"]+"/)?.[0];
 assert.ok(cards.every(card=>card.includes('hgsb-svg')));
 assert.equal(new Set(cards.map(shape)).size,1);
 assert.ok(cards.every(card=>card.includes('preserveAspectRatio="xMidYMid meet"')));
 assert.ok(cards.every(card=>card.includes('viewBox="0 0 240 240"')));
 assert.ok(cards.every(card=>card.includes('<linearGradient')));
 assert.ok(cards.every(card=>card.includes('<radialGradient')));
 assert.equal(new Set(cards.map(c=>(c.match(/data-color-hue="(\d+)"/)||[])[1])).size,names.length);
});
test('different colors are attached deterministically to model identity not rarity',()=>{
 const api=load().HealthGoSimpleBadges;
 const item={id:'xp_250',name:'250 XP',earned:true,rarity:'rare'};
 assert.equal(api.svg(item),api.svg(item));
 assert.equal(api.hue(item),api.hue({...item,rarity:'legendary'}));
 assert.notEqual(api.hue({id:'hg-model-001'}),api.hue({id:'hg-model-002'}));
 assert.notEqual(api.svg({id:'xp_250',name:'250 XP'}),api.svg({id:'first_chat',name:'Pierwsza rozmowa'}));
 assert.match(api.thumbnail({...item,earned:false}),/hgsb-locked/);
 assert.doesNotMatch(api.thumbnail(item),/hgsb-locked/);
});
test('simple touch viewer supports 360 degree rotation and pinch, without poster downloads',()=>{
 assert.match(source,/pointerdown/);assert.match(source,/pointermove/);assert.match(source,/pointercancel/);
 assert.match(source,/rotateX\(/);assert.match(source,/rotateY\(/);assert.match(source,/Math\.hypot/);
 assert.match(source,/aria-modal="true"/);assert.match(source,/role="dialog"/);
 assert.match(source,/hgsb-close/);
 assert.doesNotMatch(source,/drawImage|canvas|healthgo-badge-board\.jpg|fetch\(/);
 const css=read('www/healthgo-badge-simple.css');
 assert.match(css,/touch-action:none/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/\.hgsb-object/);
 assert.match(css,/\.hgsb-front/);
});
test('PWA uses only the new clean SVG renderer and invalidates the old iPhone cache',()=>{
 const html=read('www/index.html'),sw=read('www/service-worker.js');
 assert.match(html,/healthgo-badge-simple\.js\?v=1/);
 assert.match(html,/healthgo-badge-simple\.css\?v=1/);
 assert.doesNotMatch(html,/src="\.\/healthgo-badge-board\.js/);
 assert.doesNotMatch(html,/href="\.\/healthgo-badge-board\.css/);
 assert.match(sw,/healthgo-pwa-v59-navigation-2d3d-20261011/);
 const before=html.indexOf('healthgo-badge-3d.js?v=3');
 const simple=html.indexOf('healthgo-badge-simple.js?v=1');
 const pack=html.indexOf('healthgo-pack-pro.js?v=9');
 const profile=html.indexOf('healthgo-profile-pro.js?v=5');
 assert.ok(before>=0&&simple>before&&pack>simple&&profile>simple);
});
test('all account trophies and XP remain sourced from the existing achievement engine',()=>{
 const script=read('www/healthgo-pack-pro.js');
 assert.match(script,/function achievements\(\)/);
 assert.match(script,/HealthGoBadge3D\.thumbnail/);
 assert.doesNotMatch(source,/grantXP|addXP|setXP|awardXP|updateEngine|updateAchievement/);
 const w=load();assert.equal(typeof w.HealthGoBadge3D.openChest,'function');
 assert.equal(w.HealthGoBadge3D.catalog.length,1);
});
