'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function api(){
 const window={HealthGoBadge3D:{catalog:[],openChest(){return true;}}};
 vm.runInNewContext(read('www/healthgo-badge-board.js'),{window,Math,Number,String,Set,Map,Array,Object});
 return window.HealthGoBadgeBoard;
}
test('user-provided original photo is shipped locally and single-image SVG is enabled',()=>{
 const html=read('www/index.html'),jpg=fs.readFileSync('www/assets/healthgo-badge-board.jpg');
 assert.ok(jpg.length>40000);
 assert.equal(jpg.subarray(0,2).toString('hex'),'ffd8');
 assert.equal(jpg.subarray(-2).toString('hex'),'ffd9');
 assert.match(html,/healthgo-badge-board\.js\?v=4/);
 assert.match(html,/healthgo-badge-board\.css\?v=4/);
 assert.doesNotMatch(html,/src="\.\/healthgo-badge-vector\.js/);
});
test('231 original badges have independent bounded viewBoxes, never a huge translated source img',()=>{
 const b=api(),seen=new Set(),rects=[];
 assert.equal(b.count,231);
 for(let n=1;n<=b.count;n++){
  const it={id:'hg-model-'+String(n).padStart(3,'0'),name:'Model '+n,prototype:true};
  const i=b.artIndex(it),crop=b.cropRect(i),html=b.thumbnail(it);
  seen.add(i);rects.push(crop);
  assert.match(html,/class="hgp-medal-svg hgab-single"/);
  assert.match(html,/viewBox="\d+ \d+ \d+ \d+"/);
  assert.match(html,/preserveAspectRatio="xMidYMid meet"/);
  assert.match(html,/<image href="\.\/assets\/healthgo-badge-board\.jpg\?v=4"/);
  assert.doesNotMatch(html,/<img class="hgab-board-image"|<canvas class="hgab-crop"/);
  assert.ok(crop.x>=0&&crop.y>=100&&crop.x+crop.w<=1055&&crop.y+crop.h<=1491);
  assert.ok(crop.w>=60&&crop.w<=80);
  assert.ok(crop.h===crop.w);
 }
 assert.equal(seen.size,231);
 assert.notDeepEqual(rects[0],rects[1]);
 assert.notDeepEqual(rects[0],rects[14]);
});
test('real earned/locked status and name match artwork, no phantom achievement or XP',()=>{
 const b=api(),real={id:'level_2',name:'Poziom 2',earned:true};
 const thumb=b.thumbnail(real),locked=b.thumbnail({...real,earned:false});
 assert.match(thumb,/aria-label="Poziom 2"/);
 assert.doesNotMatch(thumb,/hgab-locked/);
 assert.match(locked,/hgab-locked/);
 assert.doesNotMatch(read('www/healthgo-badge-board.js'),/grantXP|addXP|setXP|awardXP/);
 assert.equal(typeof b.open,'function');
});
test('single SVG region visible on iOS, old oversized CSS fallback disabled',()=>{
 const js=read('www/healthgo-badge-board.js'),css=read('www/healthgo-badge-board.css');
 assert.match(js,/A fixed SVG viewport clips a SINGLE badge/);
 assert.match(css,/\.hgab-photo svg\.hgab-single/);
 assert.match(css,/svg\.hgab-single image/);
 assert.match(css,/overflow:hidden!important/);
 assert.match(css,/max-width:215px!important/);
 const thumb=api().thumbnail({id:'first_chat',name:'Pierwsza rozmowa',earned:true});
 assert.doesNotMatch(thumb,/style="left:/);
 assert.doesNotMatch(thumb,/1551\.470588%/);
});
