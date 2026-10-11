/* HealthGo 3.0.4 — original user badge board, reliably converted to native individual PNG previews on iOS.
 * Each image is an actual region of the board, not a generated replacement emblem.
 * Portrait image ratio: 1055 x 1491; 14 columns x 18 rows of badges.
 * Viewer is honest 2.5D: front is the supplied picture, back is a decorative card. */
(function(host){
'use strict';
var old=host.HealthGoBadge3D||{},prevClose=old.close,dialog=null,cache=new Map();
var COLS=14, TOTAL=231;
var CENTERS=[[47,160,66],[117,160,66],[188,160,66],[260,160,66],[330,160,66],[403,160,66],[479,160,66],[551,160,66],[634,160,66],[706,160,66],[788,160,66],[861,160,66],[933,160,66],[1007,160,66],[41,235,66],[119,235,66],[203,235,66],[264,235,66],[327,235,66],[406,235,66],[477,235,66],[553,235,66],[623,235,66],[708,235,66],[786,235,66],[861,235,66],[933,235,66],[1003,235,66],[40,307,66],[120,307,66],[185,307,66],[249,307,66],[331,307,66],[401,307,66],[475,307,66],[548,307,66],[615,307,66],[690,307,66],[777,307,66],[858,307,66],[929,307,66],[987,307,66],[43,383,66],[121,383,66],[196,383,66],[270,383,66],[344,383,66],[420,383,66],[499,383,66],[564,383,66],[640,383,66],[712,383,66],[791,383,66],[862,383,66],[941,383,66],[1008,383,66],[41,460,66],[116,460,66],[189,460,66],[265,460,66],[342,460,66],[417,460,66],[495,460,66],[568,460,66],[645,460,66],[720,460,66],[793,460,66],[869,460,66],[942,460,66],[1011,460,66],[43,535,66],[117,535,66],[189,535,66],[270,535,66],[343,535,66],[417,535,66],[493,535,66],[570,535,66],[644,535,66],[723,535,66],[797,535,66],[871,535,66],[945,535,66],[1011,535,66],[44,610,66],[115,610,66],[189,610,66],[268,610,66],[340,610,66],[413,610,66],[485,610,66],[559,610,66],[636,610,66],[705,610,66],[788,610,66],[855,610,66],[936,610,66],[1006,610,66],[42,690,66],[108,690,66],[196,690,66],[253,690,66],[325,690,66],[405,690,66],[479,690,66],[546,690,66],[614,690,66],[694,690,66],[773,690,66],[845,690,66],[921,690,66],[996,690,66],[40,762,66],[114,762,66],[187,762,66],[253,762,66],[324,762,66],[402,762,66],[476,762,66],[552,762,66],[631,762,66],[707,762,66],[782,762,66],[848,762,66],[919,762,66],[1004,762,66],[46,836,66],[112,836,66],[179,836,66],[264,836,66],[329,836,66],[407,836,66],[485,836,66],[560,836,66],[632,836,66],[697,836,66],[783,836,66],[859,836,66],[929,836,66],[1002,836,66],[43,911,66],[115,911,66],[187,911,66],[258,911,66],[327,911,66],[400,911,66],[476,911,66],[555,911,66],[628,911,66],[708,911,66],[786,911,66],[856,911,66],[935,911,66],[1002,911,66],[33,988,66],[120,988,66],[202,988,66],[276,988,66],[353,988,66],[425,988,66],[496,988,66],[559,988,66],[631,988,66],[708,988,66],[780,988,66],[857,988,66],[923,988,66],[1002,988,66],[33,1063,68],[104,1063,68],[193,1063,68],[271,1063,68],[349,1063,68],[429,1063,68],[504,1063,68],[576,1063,68],[658,1063,68],[740,1063,68],[828,1063,68],[912,1063,68],[1002,1063,68],[42,1144,68],[120,1144,68],[200,1144,68],[269,1144,68],[352,1144,68],[438,1144,68],[521,1144,68],[593,1144,68],[676,1144,68],[757,1144,68],[838,1144,68],[917,1144,68],[1000,1144,68],[44,1224,68],[107,1224,68],[200,1224,68],[281,1224,68],[352,1224,68],[441,1224,68],[522,1224,68],[611,1224,68],[700,1224,68],[789,1224,68],[872,1224,68],[941,1224,68],[1006,1224,68],[45,1304,68],[121,1304,68],[201,1304,68],[282,1304,68],[354,1304,68],[441,1304,68],[524,1304,68],[602,1304,68],[696,1304,68],[773,1304,68],[854,1304,68],[932,1304,68],[1003,1304,68],[58,1390,76],[149,1390,76],[246,1390,76],[331,1390,76],[435,1390,76],[530,1390,76],[626,1390,76],[717,1390,76],[810,1390,76],[891,1390,76],[988,1390,76]];
var SOURCE='./assets/healthgo-badge-board.jpg?v=4';

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
 if(m){var n=Number(m[1]);return n>0?(n-1)%TOTAL:0;}
 return mappedIndex(item);
}

// Coordinates measured on the poster artwork. All regions preserve the exact original artwork.
/* Canvas draws a small crop from the original JPEG once. Unlike a huge CSS
 * background-size this is safe for iPhone/WebKit texture limits. */
var atlas=null,atlasPending=false,atlasError=false,watcher=null;
function cropRect(index){
 var idx=((Number(index)||0)%TOTAL+TOTAL)%TOTAL;
 var c=CENTERS[idx],size=c[2];
 return {x:Math.max(0,Math.min(1055-size,Math.round(c[0]-size/2))),y:Math.max(0,Math.min(1491-size,Math.round(c[1]-size/2))),w:size,h:size};
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
 image.src=SOURCE;
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
/* Native isolated bitmap for Safari: crop the atlas once into standalone local PNGs.
 * Only items currently mounted in the UI are converted. A bounded SVG crop stays
 * as the visual fallback if Canvas export is unsupported. */
var tileImages=new Map();
function isolatedImage(index){
 if(tileImages.has(index))return tileImages.get(index);
 if(!atlas||typeof document==='undefined')return null;
 var rect=cropRect(index),canvas=document.createElement('canvas');
 canvas.width=192;canvas.height=192;
 var ctx=canvas.getContext('2d');
 if(!ctx)return null;
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(atlas,rect.x,rect.y,rect.w,rect.h,0,0,192,192);
 var src=canvas.toDataURL('image/png');
 if(!src||src.length<80)return null;
 if(tileImages.size>250)tileImages.clear();
 tileImages.set(index,src);
 return src;
}
function hydrate(root){
 if(!root||typeof root.querySelectorAll!=='function')return;
 var nodes=[];
 if(root.matches?.('.hgab-photo[data-hgab-index]'))nodes.push(root);
 for(var node of root.querySelectorAll('.hgab-photo[data-hgab-index]'))nodes.push(node);
 if(!nodes.length)return;
 if(!atlas&&!atlasError)loadAtlas();
 if(!atlas)return;
 for(var badge of nodes){
  if(badge.dataset.hgabReady==='1')continue;
  var idx=Number(badge.getAttribute('data-hgab-index')||0);
  try{
   var url=isolatedImage(idx);if(!url)continue;
   var img=document.createElement('img');
   img.className='hgab-isolated-image';img.alt='';
   img.setAttribute('aria-hidden','true');img.decoding='async';img.src=url;
   badge.replaceChildren(img);
   badge.dataset.hgabReady='1';
  }catch(err){host.console?.warn?.('Could not create a single badge image',err);}
 }
}
function watch(){
 if(typeof document==='undefined')return;
 if(document.body&&typeof host.MutationObserver==='function'&&!watcher){
  watcher=new host.MutationObserver(function(records){
   for(var record of records)for(var node of record.addedNodes||[]){
    if(node.nodeType!==1)continue;
    if(node.matches?.('.hgab-photo[data-hgab-index]')||node.querySelector?.('.hgab-photo[data-hgab-index]'))hydrate(node);
   }
  });
  watcher.observe(document.body,{childList:true,subtree:true});
 }
 hydrate(document);
}

function front(item,extra){
 var idx=artIndex(item),name=esc(item?.name||'Odznaka'),r=cropRect(idx);
 // A fixed SVG viewport clips a SINGLE badge. No CSS translate, 1500%-wide <img>, Canvas or WebGL.
 // This avoids Safari's image offset/scale bug that previously showed adjacent medals.
 return '<span class="hgab-photo '+(extra||'')+'" data-hgab-index="'+idx+'">'+
 '<svg xmlns="http://www.w3.org/2000/svg" class="hgp-medal-svg hgab-single" viewBox="'+
 r.x+' '+r.y+' '+r.w+' '+r.h+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+name+'">'+
 '<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'" fill="#071b16"/>'+
 '<image href="'+SOURCE+'" x="0" y="0" width="1055" height="1491" preserveAspectRatio="none"/>'+
 '</svg></span>';
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