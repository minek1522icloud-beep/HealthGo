'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('original user badge image is now the artwork loaded in HealthGo',()=>{
 const html=read('www/index.html');
 const jpg=fs.readFileSync('www/assets/healthgo-badge-board.jpg');
 assert.ok(jpg.length>40000);
 assert.match(html,/healthgo-badge-board\.js\?v=2/);
 assert.match(html,/healthgo-badge-board\.css\?v=2/);
 assert.doesNotMatch(html,/src="\.\/healthgo-badge-vector\.js/);
 assert.doesNotMatch(html,/href="\.\/healthgo-badge-vector\.css/);
});
test('all 240 catalog tiles display the supplied board instead of generated emblems',()=>{
 const window={HealthGoBadge3D:{catalog:[],openChest(){return true;}}};
 vm.runInNewContext(read('www/healthgo-badge-board.js'),{window,Math,Number,String,Set,Map,Array,Object});
 const art=window.HealthGoBadgeBoard;
 assert.equal(art.count,249);
 const indexes=new Set();
 for(let n=1;n<=240;n++){
  const item={id:'hg-model-'+String(n).padStart(3,'0'),name:'Model',prototype:true};
  indexes.add(art.artIndex(item));
  assert.match(art.thumbnail(item),/healthgo-badge-board\.jpg/);
 }
 assert.equal(indexes.size,240);
 assert.match(art.thumbnail({id:'locked',earned:false}),/hgab-locked/);
});

test('iOS-friendly canvas crops the original 68px badges instead of creating oversized CSS textures',()=>{
 const js=read('www/healthgo-badge-board.js');
 const css=read('www/healthgo-badge-board.css');
 assert.match(js,/<canvas class="hgab-crop"/);
 assert.match(js,/ctx\.drawImage\(atlas,crop\.x,crop\.y,crop\.w,crop\.h,0,0,w,h\)/);
 assert.match(js,/MutationObserver/);
 assert.match(js,/canvas\.dataset\.hgabStatus='art'/);
 assert.doesNotMatch(js,/background-size:[^;]+%/);
 assert.match(css,/#hgPackProRoot canvas\.hgab-crop/);
 assert.match(css,/#hgBadgeArtInspect canvas\.hgab-crop/);
 const jpg=fs.readFileSync('www/assets/healthgo-badge-board.jpg');
 assert.equal(jpg.subarray(0,2).toString('hex'),'ffd8','asset must be JPEG');
 assert.equal(jpg.subarray(-2).toString('hex'),'ffd9','asset must not be truncated');
});
test('the crop renderer actually paints badge pixels at bounded size',()=>{
 const draws=[],calls=[],ctx={
  clearRect(){},fillRect(){},strokeRect(){},fillText(){},
  drawImage(_image,x,y,width,height,dx,dy,w,h){draws.push({x,y,width,height,dx,dy,w,h});}
 };
 const badge={nodeType:1,width:160,height:160,dataset:{},
  matches(sel){return sel==='canvas.hgab-crop';},
  getAttribute(key){return key==='data-hgab-index'?'98':null;},
  getContext(t){calls.push(t);return ctx;},
  querySelectorAll(){return[];}
 };
 const doc={readyState:'loading',body:{},querySelectorAll(){return[badge];},addEventListener(){}};
 class MockImage{
  set src(url){
   this.naturalWidth=1055;this.naturalHeight=1491;
   if(this.onload)this.onload();
  }
 }
 const win={HealthGoBadge3D:{catalog:[],openChest(){}},Image:MockImage,console};
 vm.runInNewContext(read('www/healthgo-badge-board.js'),{
  window:win,document:doc,Math,Number,String,Set,Map,Array,Object
 });
 win.HealthGoBadgeBoard.hydrate(doc);
 assert.equal(badge.dataset.hgabStatus,'art');
 assert.ok(draws.length>=1);
 const last=draws[draws.length-1];
 assert.equal(last.width,68);assert.equal(last.height,68);
 assert.equal(last.w,160);assert.equal(last.h,160);
 assert.ok(last.x>=0&&last.x<1055&&last.y>=0&&last.y<1491);
 assert.ok(calls.every(x=>x==='2d'));
});
