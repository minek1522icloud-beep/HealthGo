/* HealthGo 3.0 — original user-supplied badge board used directly as an image atlas.
 * Each image is an actual region of the board, not a generated replacement emblem.
 * Portrait image ratio: 1055 x 1491; 14 columns x 18 rows of badges.
 * Viewer is honest 2.5D: front is the supplied picture, back is a decorative card. */
(function(host){
'use strict';
var old=host.HealthGoBadge3D||{},prevClose=old.close,dialog=null,cache=new Map();
var COLS=14,ROWS=18,TOTAL=249,SIZE=68;
var SOURCE='./assets/healthgo-badge-board.jpg';
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function hash(s){var h=2166136261;for(var c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
var rules=[
[/pierwsz[aey].*rozmow|chat|wiadomo|message/i,7*COLS+11],
[/biega|bieg|run|maraton/i,0*COLS+0],
[/pierwsz.*krok|krok|step|spacer/i,0*COLS+1],
[/tętno|puls|heartbeat/i,1*COLS+0],
[/serce|heart|zdrow/i,0*COLS+2],
[/rower|cycle|bike/i,1*COLS+4],
[/pływ|swim|basen/i,1*COLS+5],
[/wod|nawod|water/i,0*COLS+5],
[/wyzwan|challenge|puchar|trophy/i,0*COLS+11],
[/odkryw|explor|kompas|mapa/i,8*COLS+2],
[/poziom|level|ranga/i,4*COLS+10],
[/pierwsz.*xp/i,2*COLS+2],
[/xp|energia|power/i,2*COLS+1],
[/spok|medyt|relaks/i,1*COLS+7],
[/drzew|natura|las|eko|leaf/i,0*COLS+6],
[/pogod|słońce|sun/i,2*COLS+4],
[/senn|śpi|sleep|sen\b/i,8*COLS+12],
[/plan|kalendarz|calendar/i,3*COLS+9],
[/znajom|friends|przyj/i,7*COLS+8],
[/rodzin|family|dom|home/i,7*COLS+13],
[/sekret|secret|ukryt/i,11*COLS+11]
];
function allItemIds(){
 try{
  var e=host.HealthGoServices?.state?.engine;
  var f=host.HealthGoEngine?.viewAchievements;
  if(typeof f!=='function'||!e)return [];
  var badges=f(e);return Array.isArray(badges)?badges.map(function(a){return String(a.id||a.code||'');}).filter(Boolean).sort():[];
 }catch(_){return [];}
}
function mappedIndex(item){
 var id=String(item?.id||item?.code||'unknown'),label=String(item?.name||'')+' '+id;
 var explicit=null;
 for(var pair of rules)if(pair[0].test(label)){explicit=pair[1];break;}
 var ids=allItemIds();
 if(!ids.includes(id))return explicit===null?hash(id)%TOTAL:explicit;
 // Deterministic collision-free assignment, stable for a particular achievement catalogue.
 var used=new Set(),assigned=new Map();
 for(var key of ids){
  var hint=key===id?label:key;
  var idx=null;
  for(var rule of rules){if(rule[0].test(hint)){idx=rule[1];break;}}
  if(idx===null)idx=hash(key)%TOTAL;
  while(used.has(idx))idx=(idx+1)%TOTAL;
  used.add(idx);assigned.set(key,idx);
 }
 return assigned.get(id);
}
function artIndex(item){
 var id=String(item?.id||item?.code||'');
 var m=/^hg-model-(\d{3})$/.exec(id);
 if(m){var n=Number(m[1]);return (n-1>=0&&n-1<TOTAL)?n-1:0;}
 return mappedIndex(item);
}
// Coordinates measured on the poster artwork. All regions preserve the exact original artwork.
/* Canvas draws a small crop from the original JPEG once. Unlike a huge CSS
 * background-size this is safe for iPhone/WebKit texture limits. */
var atlas=null,atlasPending=false,atlasError=false,watcher=null;
function cropRect(index){
 var idx=((Number(index)||0)%TOTAL+TOTAL)%TOTAL;
 var col=idx%COLS,row=Math.floor(idx/COLS);
 return {x:(44+col*72.25)-SIZE/2,y:(160+row*72.75)-SIZE/2,w:SIZE,h:SIZE};
}
function spriteStyle(index){
 // Public compatibility helper; no oversized CSS background rasterization.
 return '--hgab-index:'+(((Number(index)||0)%TOTAL+TOTAL)%TOTAL);
}
function loadAtlas(){
 if(atlas||atlasPending||atlasError||typeof host.Image!=='function')return;
 atlasPending=true;
 var image=new host.Image();
 image.onload=function(){
  atlasPending=false;
  if(image.naturalWidth<100||image.naturalHeight<100){atlasError=true;}
  else{atlas=image;atlasError=false;}
  if(typeof document!=='undefined')hydrate(document,true);
 };
 image.onerror=function(){
  atlasPending=false;atlasError=true;
  if(typeof document!=='undefined')hydrate(document,true);
  host.console?.warn?.('HealthGo: nie udało się pobrać planszy odznak:',SOURCE);
 };
 image.src=SOURCE+'?v=2';
}
function paint(canvas,force){
 if(!canvas||!canvas.getContext)return;
 if(!force&&canvas.dataset.hgabStatus==='art')return;
 var ctx=canvas.getContext('2d');
 if(!ctx)return;
 var w=canvas.width||160,h=canvas.height||160;
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#113225';ctx.fillRect(0,0,w,h);
 var index=Number(canvas.getAttribute('data-hgab-index')||0);
 if(atlas){
  try{
   var crop=cropRect(index);
   ctx.imageSmoothingEnabled=true;
   ctx.imageSmoothingQuality='high';
   ctx.drawImage(atlas,crop.x,crop.y,crop.w,crop.h,0,0,w,h);
   canvas.dataset.hgabStatus='art';return;
  }catch(err){host.console?.warn?.('HealthGo: cannot draw badge crop',err);}
 }
 // Never silently leave a black rectangle when the JPEG cannot load.
 ctx.strokeStyle='#4d9e7e';ctx.lineWidth=3;
 ctx.strokeRect(8,8,w-16,h-16);
 ctx.fillStyle='#c8f4dc';
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font='bold '+Math.max(13,Math.floor(w/12))+'px sans-serif';
 ctx.fillText(atlasError?'Grafika offline':'Ładowanie...',w/2,h/2);
 canvas.dataset.hgabStatus=atlasError?'offline':'loading';
}
function hydrate(root,force){
 if(!root||typeof root.querySelectorAll!=='function')return;
 var all=[];
 if(root.matches&&root.matches('canvas.hgab-crop'))all.push(root);
 for(var el of root.querySelectorAll('canvas.hgab-crop'))all.push(el);
 if(!all.length)return;
 if(!atlas&&!atlasError)loadAtlas();
 for(var node of all)paint(node,force);
}
function watch(){
 if(typeof document==='undefined')return;
 if(document.body&&typeof host.MutationObserver==='function'&&!watcher){
  watcher=new host.MutationObserver(function(records){
   for(var record of records){
    for(var node of record.addedNodes||[]){
     if(node.nodeType!==1)continue;
     if(node.matches?.('canvas.hgab-crop')||node.querySelector?.('canvas.hgab-crop'))hydrate(node,false);
    }
   }
  });
  watcher.observe(document.body,{childList:true,subtree:true});
 }
 hydrate(document,false);
}
function front(item,extra){
 var idx=artIndex(item),name=esc(item?.name||'Odznaka'),resolution=(extra&&extra.includes('inspect'))?384:160;
 return '<span class="hgab-photo '+(extra||'')+'" data-hgab-index="'+idx+'">'+
  '<canvas class="hgab-crop" data-hgab-index="'+idx+'" data-hgab-source="'+SOURCE+
  '" width="'+resolution+'" height="'+resolution+'" role="img" aria-label="'+name+'">'+name+'</canvas></span>';
}
function thumbnail(item){
 item=item||{};
 var locked=!item.earned&&!item.prototype;
 return '<span class="hgab-thumbnail'+(locked?' hgab-locked':'')+'" data-hgab-art="'+artIndex(item)+'">'+front(item,'')+'</span>';
}
function close(){
 if(!dialog)return;
 var d=dialog;dialog=null;
 d.root.remove();document.body.classList.remove('hgab-open');
 if(d.previous&&d.previous.focus)try{d.previous.focus({preventScroll:true});}catch(_){}
}
function open(item){
 if(typeof document==='undefined'||!document.body)return false;
 item=item||{id:'preview',name:'Odznaka',earned:false};close();
 var previous=document.activeElement,root=document.createElement('section'),rotX=-7,rotY=0,zoom=1,pointers=new Map();
 root.id='hgBadgeArtInspect';root.className='hgab-overlay';
 root.innerHTML='<div class="hgab-dialog" role="dialog" aria-modal="true" aria-labelledby="hgabTitle">'+
 '<header class="hgab-heading"><div><small>HEALTHGO · COLLECTION</small><h2 id="hgabTitle">'+esc(item.name||'Odznaka')+'</h2></div>'+
 '<button type="button" class="hgab-close" aria-label="Zamknij podgląd odznaki">×</button></header>'+
 '<div class="hgab-scene"><div class="hgab-sheen"></div><div class="hgab-object" tabindex="0" role="img" aria-label="Obracany podgląd odznaki: '+esc(item.name||'Odznaka')+'">'+
 '<div class="hgab-face hgab-face-front">'+front(item,'hgab-inspect-front')+'</div>'+
 '<div class="hgab-face hgab-face-back"><div class="hgab-back-disc"><strong>HG</strong><span>HEALTHGO</span><small>COLLECTOR SERIES</small></div></div>'+
 '</div><div class="hgab-plinth"></div></div>'+
 '<div class="hgab-footer"><span>'+esc(item.prototype?'Wzór kolekcjonerski · niezdobyty':item.earned?'Zdobyta odznaka':'Odznaka nieodkryta')+'</span>'+
 '<p>Przesuń palcem, aby obracać. Rozsuń dwa palce, aby przybliżyć. Podgląd wykorzystuje grafikę z przesłanej kolekcji z przestrzennym obrotem.</p></div>'+
 '</div>';
 document.body.appendChild(root);document.body.classList.add('hgab-open');
 var object=root.querySelector('.hgab-object'),scene=root.querySelector('.hgab-scene');
 function show(){object.style.transform='translate(-50%,-50%) rotateX('+rotX+'deg) rotateY('+rotY+'deg) scale('+zoom+')';}
 function down(ev){try{scene.setPointerCapture(ev.pointerId);}catch(_){}pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});}
 function move(ev){
  if(!pointers.has(ev.pointerId))return;
  var last=pointers.get(ev.pointerId),dx=ev.clientX-last.x,dy=ev.clientY-last.y;
  if(pointers.size===1){rotY+=dx*.57;rotX=Math.max(-72,Math.min(72,rotX-dy*.42));}
  else if(pointers.size===2){
   var other=Array.from(pointers.entries()).find(function(e){return e[0]!==ev.pointerId;});
   if(other){var a=Math.hypot(last.x-other[1].x,last.y-other[1].y),b=Math.hypot(ev.clientX-other[1].x,ev.clientY-other[1].y);zoom=Math.max(.65,Math.min(1.9,zoom+(b-a)*.008));}
  }
  pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});show();
 }
 function end(ev){pointers.delete(ev.pointerId);}
 scene.addEventListener('pointerdown',down);scene.addEventListener('pointermove',move);
 scene.addEventListener('pointerup',end);scene.addEventListener('pointercancel',end);
 scene.addEventListener('wheel',function(ev){ev.preventDefault();zoom=Math.max(.65,Math.min(1.9,zoom-ev.deltaY*.002));show();},{passive:false});
 root.querySelector('.hgab-close').addEventListener('click',close);
 root.addEventListener('click',function(ev){if(ev.target===root)close();});
 root.addEventListener('keydown',function(ev){
  if(ev.key==='Escape'){ev.preventDefault();close();}
  else if(ev.key==='ArrowLeft'||ev.key==='ArrowRight'){ev.preventDefault();rotY+=(ev.key==='ArrowRight'?18:-18);show();}
  else if(ev.key==='+'||ev.key==='='){zoom=Math.min(1.9,zoom+.12);show();}
  else if(ev.key==='-'){zoom=Math.max(.65,zoom-.12);show();}
  if(ev.key==='Tab'){
   var b=root.querySelector('.hgab-close');
   if(document.activeElement!==b){ev.preventDefault();b.focus();}
   else{ev.preventDefault();object.focus();}
  }
 });
 dialog={root:root,previous:previous};show();root.querySelector('.hgab-close').focus({preventScroll:true});return true;
}
host.HealthGoBadge3D=Object.freeze(Object.assign({},old,{thumbnail:thumbnail,open:open,close:close}));
host.HealthGoBadgeBoard=Object.freeze({thumbnail:thumbnail,open:open,close:close,artIndex:artIndex,spriteStyle:spriteStyle,cropRect:cropRect,hydrate:hydrate,getAssetStatus:function(){return atlas?'ready':atlasError?'offline':atlasPending?'loading':'idle';},count:TOTAL,source:SOURCE});
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();}
})(window);