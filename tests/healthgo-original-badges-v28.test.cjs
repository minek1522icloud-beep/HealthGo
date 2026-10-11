'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('original user badge image is now the artwork loaded in HealthGo',()=>{
 const html=read('www/index.html');
 const jpg=fs.readFileSync('www/assets/healthgo-badge-board.jpg');
 assert.ok(jpg.length>40000);
 assert.match(html,/healthgo-badge-board\.js\?v=1/);
 assert.match(html,/healthgo-badge-board\.css\?v=1/);
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
