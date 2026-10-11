'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function load(win,doc){
 win=win||{HealthGoBadge3D:{catalog:[],openChest(){return true;}}};
 vm.runInNewContext(read('www/healthgo-badge-board.js'),{window:win,document:doc,Math,Number,String,Set,Map,Array,Object});
 return win.HealthGoBadgeBoard;
}
test('local original artwork is present and PWA uses isolated canvas badge renderer',()=>{
 const html=read('www/index.html'),jpg=fs.readFileSync('www/assets/healthgo-badge-board.jpg');
 assert.ok(jpg.length>40000);
 assert.equal(jpg.subarray(0,2).toString('hex'),'ffd8');
 assert.equal(jpg.subarray(-2).toString('hex'),'ffd9');
 assert.match(html,/healthgo-badge-board\\.js\\?v=6/);
 assert.match(html,/healthgo-badge-board\\.css\\?v=6/);
 assert.doesNotMatch(html,/src="\\.\\/healthgo-badge-vector\\.js/);
});
test('231 badges are distinct and use only one bounded 192px Canvas with no scaled poster',()=>{
 const api=load(),seen=new Set(),rects=[];
 assert.equal(api.count,231);
 for(let n=1;n<=api.count;n++){
  const item={id:'hg-model-'+String(n).padStart(3,'0'),name:'Model '+n,prototype:true};
  const i=api.artIndex(item),crop=api.cropRect(i),html=api.thumbnail(item);
  seen.add(i);rects.push(crop);
  assert.match(html,/<canvas class="hgab-crop" width="192" height="192"/);
  assert.match(html,/data-hgab-index="\\d+"/);
  assert.doesNotMatch(html,/<svg|<image |<img |background-position|background-size:/);
  assert.ok(crop.x>=0&&crop.y>=100&&crop.x+crop.w<=1055&&crop.y+crop.h<=1491);
  assert.ok(crop.w>=60&&crop.w<=80);
  assert.equal(crop.w,crop.h);
 }
 assert.equal(seen.size,231);
 assert.notDeepEqual(rects[0],rects[1]);assert.notDeepEqual(rects[0],rects[14]);
});
test('earned state and labels use actual account achievements, no fake XP',()=>{
 const api=load(),real={id:'level_2',name:'Poziom 2',earned:true};
 assert.match(api.thumbnail(real),/aria-label="Poziom 2"/);
 assert.doesNotMatch(api.thumbnail(real),/hgab-locked/);
 assert.match(api.thumbnail({...real,earned:false}),/hgab-locked/);
 assert.doesNotMatch(read('www/healthgo-badge-board.js'),/grantXP|addXP|setXP|awardXP/);
 assert.equal(typeof api.open,'function');
});
test('Safari canvas visibly paints one isolated source region and redraws after image load',()=>{
 const drawn=[],tile={width:192,height:192,dataset:{},getAttribute(k){return k==='data-hgab-index'?'109':null;},getContext(){return ctx;}};
 const badge={
  nodeType:1,matches(sel){return sel==='.hgab-photo[data-hgab-index]';},
  querySelectorAll(){return[];},querySelector(sel){return sel==='canvas.hgab-crop'?tile:null;}
 };
 const ctx={
  clearRect(){},fillRect(){},strokeRect(){},fillText(){},
  drawImage(...args){drawn.push(args);},imageSmoothingEnabled:false,imageSmoothingQuality:'',
  fillStyle:'',font:'',textAlign:'',textBaseline:'',lineWidth:0,strokeStyle:''
 };
 const doc={
  readyState:'loading',body:{},addEventListener(){},
  querySelectorAll(sel){return sel==='.hgab-photo[data-hgab-index]'?[badge]:[];}
 };
 class MockImage{naturalWidth=1055;naturalHeight=1491;set src(v){this.loaded=v;this.onload?.();}}
 const win={HealthGoBadge3D:{catalog:[]},Image:MockImage,console};
 const api=load(win,doc);api.hydrate(doc);
 assert.ok(drawn.length>=1);
 const [img,x,y,w,h,dx,dy,tw,th]=drawn[drawn.length-1];
 assert.ok(img instanceof MockImage);
 assert.deepEqual([x,y,w,h,dx,dy,tw,th],Object.values(api.cropRect(109)).concat([0,0,192,192]));
 assert.equal(tile.dataset.hgabStatus,'art');
});
test('no hidden/black badge placeholders are left behind while JPEG is loading',()=>{
 const css=read('www/healthgo-badge-board.css'),js=read('www/healthgo-badge-board.js');
 assert.match(css,/canvas\\.hgab-crop[\\s\\S]*visibility:visible!important/);
 assert.match(js,/paint\\(canvas,true\\)/);
 assert.match(js,/hydrate\\(root\\)/);
 assert.doesNotMatch(js,/class="hgp-medal-svg hgab-single"/);
});
