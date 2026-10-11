/* HealthGo 2.8 — badges use the actual picture collection supplied by the user.
 * A compact 14x18 AVIF atlas holds the original illustrated designs, not fabricated SVG medals.
 * Touch inspect is a 3D rotating collectible display with the artwork as its front texture.
 * XP and earned state remain owned exclusively by HealthGoEngine. */
(function(host){
'use strict';
var previous=host.HealthGoBadge3D||{};
var ATLAS='./assets/healthgo-badges-collection.avif?v=1';
var COLS=14,ROWS=18,TOTAL=COLS*ROWS;
var active=null;
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function hash(input){var h=2166136261,s=String(input||'badge');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
var groups={
 chat:[105,119,120,121,123,135,137,149,154,162,163,174],
 level:[53,54,56,57,70,71,72,73,74,75,91,105,118,140,156],
 xp:[43,44,45,46,61,62,63,74,75,79,80,91,92,94],
 challenge:[47,48,49,50,51,52,63,64,65,66,67,68,82,83,93],
 sport:[0,1,14,15,16,17,18,19,20,24,25,29,30],
 health:[2,3,14,28,84,85,86,100,101,111,124],
 explorer:[9,13,26,27,39,41,45,111,126,140,153,161,167],
 plan:[40,49,78,79,92,95,96,108,109,122,136],
 nature:[6,7,8,12,27,28,29,31,43,112,140,167],
 reward:[11,53,54,55,56,57,58,59,60,61,62,63,67,74,75],
 rest:[13,23,40,95,109,135,151,152,166],
 community:[97,98,110,113,119,121,122,123,136,137],
 mythical:[69,82,83,123,124,138,139,140,180,181,200,211,224,233,236]
};
function group(item){
 var phrase=String((item?.name||'')+' '+(item?.id||'')+' '+(item?.category||'')).toLowerCase();
 if(/rozmow|chat|ai\b|wiadomo|asystent/.test(phrase))return 'chat';
 if(/level|poziom|ranga/.test(phrase))return 'level';
 if(/\bxp\b|punkty|punkto/.test(phrase))return 'xp';
 if(/wyzwan|challenge|quest|zadani|misj/.test(phrase))return 'challenge';
 if(/sport|bieg|rower|krok|pływan|trening|ruch|fitness/.test(phrase))return 'sport';
 if(/zdrow|tętno|serc|puls|medyc/.test(phrase))return 'health';
 if(/odkryw|map|podróż|lokalizac|kompas/.test(phrase))return 'explorer';
 if(/plan|kalendarz|organizac|nauk|książk/.test(phrase))return 'plan';
 if(/liś|las|natura|drzew|ogrod|zielon/.test(phrase))return 'nature';
 if(/puchar|zwyci|nagrod|legend|mitycz|koron/.test(phrase))return 'reward';
 if(/odpoczy|sen|relaks|medyt/.test(phrase))return 'rest';
 if(/rodzin|znajom|przyjac|social|społecz/.test(phrase))return 'community';
 return 'mythical';
}
function indexOf(item){
 item=item||{};
 var specific=/^hg-model-(\d{1,3})$/.exec(String(item.id||''));
 if(specific)return clamp(Number(specific[1])-1,0,239);
 var pool=groups[group(item)],seed=hash(String(item.id||item.name||'badge'));
 return pool[seed%pool.length];
}
function thumb(item,large){
 var idx=indexOf(item),row=Math.floor(idx/COLS),col=idx%COLS,lock=!item?.earned&&!item?.prototype;
 var nx=(col/(COLS-1)*100).toFixed(5),ny=(row/(ROWS-1)*100).toFixed(5);
 return '<span class="hgp-medal-svg hgai-badge '+(large?'hgai-badge-large ':'')+(lock?'is-locked':'')+'" data-atlas-index="'+idx+
 '" data-badge-model="'+escapeHtml(item?.id||'')+'" role="img" aria-label="'+escapeHtml(item?.name||'Odznaka HealthGo')+
 '" style="--hgai-x:'+nx+'%;--hgai-y:'+ny+'%" ></span>';
}
function close(){
 if(!active)return;
 var old=active;active=null;
 if(old.frame)host.cancelAnimationFrame?.(old.frame);
 if(old.el)old.el.remove();
 document.body.classList.remove('hgai-open');
 if(old.previousFocus&&old.previousFocus.focus)try{old.previousFocus.focus({preventScroll:true});}catch(_){}
}
function open(item){
 if(typeof document==='undefined'||!document.body)return false;
 previous.close?.();close();
 item=item||{id:'hg-model-001',name:'Odznaka HealthGo',prototype:true};
 var unlocked=!!item.earned;
 var oldFocus=document.activeElement,root=document.createElement('div');
 root.id='hgBadgeImageInspect';root.className='hgai-overlay';
 var angleX=-10,angleY=-20,zoom=1,auto=false,frame=0,pointers=new Map(),reduced=!!host.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 var id=String(item.id||'unknown'),name=String(item.name||'Odznaka HealthGo');
 root.innerHTML='<div class="hgai-dialog" role="dialog" aria-modal="true" aria-labelledby="hgai-title">'+
 '<header class="hgai-head"><div><small>HEALTHGO · KOLEKCJA ODZNAK</small><h2 id="hgai-title">'+escapeHtml(name)+'</h2></div>'+
 '<button type="button" data-hgai="close" aria-label="Zamknij oglądanie odznaki">×</button></header>'+
 '<div class="hgai-display"><div class="hgai-light"></div><div class="hgai-showcase" aria-label="Obracana odznaka kolekcjonerska">'+
 '<div class="hgai-object">'+
 '<div class="hgai-face hgai-front">'+thumb(item,true)+'</div>'+
 '<div class="hgai-face hgai-back"><span class="hgai-rear-symbol">HG</span><span>HEALTHGO<br>COLLECTOR</span></div>'+
 '<div class="hgai-edge hgai-left"></div><div class="hgai-edge hgai-right"></div>'+
 '<div class="hgai-edge hgai-top"></div><div class="hgai-edge hgai-bottom"></div></div></div>'+
 '<div class="hgai-pedestal" aria-hidden="true"><span>KOLEKCJA HEALTHGO</span></div>'+
 '<span class="hgai-corner-info">WZÓR '+String(indexOf(item)+1).padStart(3,'0')+' / '+TOTAL+'</span></div>'+
 '<div class="hgai-footer"><p>'+escapeHtml(unlocked?'Zdobyta odznaka':'Podgląd odznaki · niezdobyta')+
 ' · Przesuwaj palcem, aby obejrzeć przód, bok i rewers. To obracana grafika 2D w przestrzennej oprawie.</p>'+
 '<div class="hgai-controls"><button type="button" data-hgai="left">↶ Obróć</button>'+
 '<button type="button" data-hgai="right">Obróć ↷</button>'+
 '<button type="button" data-hgai="zoomin">Przybliż +</button>'+
 '<button type="button" data-hgai="zoomout">Oddal −</button>'+
 '<button type="button" data-hgai="auto" aria-pressed="false">Autoobrót</button>'+
 '<button type="button" data-hgai="reset">Reset</button>'+ 
 (!item.prototype?'<button type="button" data-hgai="details">Szczegóły</button>':'')+'</div>'+
 '</div></div>';
 document.body.appendChild(root);document.body.classList.add('hgai-open');
 var scene=root.querySelector('.hgai-showcase'),object=root.querySelector('.hgai-object'),autoButton=root.querySelector('[data-hgai="auto"]');
 function render(){object.style.transform='translate(-50%,-50%) rotateX('+angleX+'deg) rotateY('+angleY+'deg) scale('+zoom+')';}
 function tick(){if(!active||active.el!==root||!auto)return;angleY+=.48;render();frame=host.requestAnimationFrame(tick);if(active)active.frame=frame;}
 function stopAuto(){auto=false;host.cancelAnimationFrame?.(frame);autoButton.setAttribute('aria-pressed','false');}
 function startAuto(){if(reduced)return;auto=true;autoButton.setAttribute('aria-pressed','true');frame=host.requestAnimationFrame(tick);if(active)active.frame=frame;}
 root.addEventListener('click',function(e){
  if(e.target===root){close();return;}
  var b=e.target.closest('[data-hgai]');if(!b)return;
  var action=b.dataset.hgai;
  if(action==='close'){close();return;}
  if(action==='details'){close();host.HealthGoPackPro?.openBadgeDetails?.(id);return;}
  if(action==='left')angleY-=34;
  if(action==='right')angleY+=34;
  if(action==='zoomin')zoom=clamp(zoom+.16,.65,2.3);
  if(action==='zoomout')zoom=clamp(zoom-.16,.65,2.3);
  if(action==='reset'){stopAuto();angleX=-10;angleY=-20;zoom=1;}
  if(action==='auto'){auto?stopAuto():startAuto();return;}
  render();
 });
 scene.addEventListener('pointerdown',function(e){stopAuto();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{scene.setPointerCapture(e.pointerId);}catch(_){}});
 scene.addEventListener('pointermove',function(e){
  var cur=pointers.get(e.pointerId);if(!cur)return;
  if(pointers.size===1){angleY+=(e.clientX-cur.x)*.6;angleX=clamp(angleX-(e.clientY-cur.y)*.52,-83,83);}
  else if(pointers.size===2){
   var other=Array.from(pointers.entries()).find(x=>x[0]!==e.pointerId)?.[1];
   if(other){zoom=clamp(zoom+(Math.hypot(e.clientX-other.x,e.clientY-other.y)-Math.hypot(cur.x-other.x,cur.y-other.y))*.006,.65,2.3);}
  }
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});render();
 });
 function up(e){pointers.delete(e.pointerId);}
 scene.addEventListener('pointerup',up);scene.addEventListener('pointercancel',up);
 scene.addEventListener('wheel',function(e){e.preventDefault();zoom=clamp(zoom-e.deltaY*.0015,.65,2.3);render();},{passive:false});
 root.addEventListener('keydown',function(e){
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();angleY+=(e.key==='ArrowRight'?24:-24);render();}
  if(e.key!=='Tab')return;
  var list=Array.from(root.querySelectorAll('button:not([disabled])'));
  if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list[list.length-1].focus();}
  else if(!e.shiftKey&&document.activeElement===list[list.length-1]){e.preventDefault();list[0].focus();}
 });
 active={el:root,frame:0,previousFocus:oldFocus};render();
 root.querySelector('[data-hgai="close"]')?.focus({preventScroll:true});
 return true;
}
host.HealthGoBadge3D=Object.freeze(Object.assign({},previous,{thumbnail:thumb,open:open,close:close,artIndex:indexOf,artSource:ATLAS}));
host.HealthGoBadgeGallery=Object.freeze({thumbnail:thumb,indexOf:indexOf,open:open,close:close,count:TOTAL,atlas:ATLAS});
})(window);