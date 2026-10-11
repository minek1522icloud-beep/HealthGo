/* HealthGo 3.1 — simple, clean and reliable collectible badges.
 * One premium medal design. The achievement ID only chooses its enamel hue.
 * Never crops the poster, never awards XP or modifies achievements.
 */
(function(host){
'use strict';
var earlier=host.HealthGoBadge3D||{},opened=null,cache=new Map();
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
function hash(v){var h=2166136261;for(var c of String(v||'badge')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function indexFor(item){
 var id=String(item.id||item.code||item.name||'badge');
 var prot=/^hg-model-(\d{3})$/.exec(id);
 if(prot)return Math.max(0,Number(prot[1])-1);
 try{
  var e=host.HealthGoServices?.state?.engine,all=host.HealthGoEngine?.viewAchievements(e);
  if(Array.isArray(all)){
    var sorted=all.map(x=>String(x.id||x.code||'')).filter(Boolean).sort();
    var idx=sorted.indexOf(id);if(idx>=0)return idx;
  }
 }catch(_){}
 return hash(id)%360;
}
function hue(item){
 var index=indexFor(item);
 return Math.round((index*137.507764+185)%360);
}
function svg(item){
 item=item||{};var id=String(item.id||item.code||item.name||'badge');
 var locked=item.earned===false&&!item.prototype,degree=hue(item);
 var key=id+'-'+degree+'-'+(locked?'L':'E');
 if(cache.has(key))return cache.get(key);
 var uid='hg-simple-'+hash(id).toString(36);
 var core='hsl('+degree+',66%,34%)',bright='hsl('+degree+',90%,64%)',pale='hsl('+degree+',96%,84%)',deep='hsl('+degree+',60%,17%)';
 var medal='<svg class="hgp-medal-svg hgsb-svg'+(locked?' hgsb-locked':'')+'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+esc(item.name||'Odznaka HealthGo')+'" data-simple-badge="'+esc(id)+'" data-color-hue="'+degree+'">'+
 '<defs>'+
 '<linearGradient id="'+uid+'-steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8ffff"/><stop offset=".22" stop-color="#9baeb7"/><stop offset=".46" stop-color="#eef7ff"/><stop offset=".7" stop-color="#526b7b"/><stop offset="1" stop-color="#c8dfec"/></linearGradient>'+
 '<radialGradient id="'+uid+'-enamel" cx=".32" cy=".25" r=".87"><stop stop-color="'+bright+'"/><stop offset=".43" stop-color="'+core+'"/><stop offset="1" stop-color="'+deep+'"/></radialGradient>'+
 '<linearGradient id="'+uid+'-rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+pale+'"/><stop offset=".54" stop-color="'+bright+'"/><stop offset="1" stop-color="'+deep+'"/></linearGradient>'+
 '</defs>'+
 '<path d="M120 12 168 24 209 63 225 113 213 169 174 207 120 224 65 207 26 169 15 113 31 63 72 24Z" fill="#020d11" opacity=".45" transform="translate(0 7)"/>'+
 '<path d="M120 12 168 24 209 63 225 113 213 169 174 207 120 224 65 207 26 169 15 113 31 63 72 24Z" fill="url(#'+uid+'-steel)" stroke="#f4fffe" stroke-width="2"/>'+
 '<path d="M120 23 162 35 198 69 213 114 202 163 169 196 120 212 71 196 38 163 27 114 42 69 78 35Z" fill="'+deep+'" stroke="url(#'+uid+'-rim)" stroke-width="6"/>'+
 '<circle cx="120" cy="118" r="80" fill="url(#'+uid+'-enamel)" stroke="'+pale+'" stroke-width="3.5"/>'+
 '<circle cx="120" cy="118" r="71" fill="none" stroke="'+bright+'" stroke-opacity=".85" stroke-width="2.5"/>'+
 '<circle cx="120" cy="118" r="60" fill="none" stroke="#e9fff7" stroke-opacity=".24" stroke-width="1.5"/>'+
 '<path d="M120 63 136 97 173 102 146 128 152 165 120 146 88 165 94 128 67 102 104 97Z" fill="url(#'+uid+'-steel)" stroke="'+pale+'" stroke-width="3.5" stroke-linejoin="round"/>'+
 '<path d="M120 83 130 108 157 111 137 130 141 154 120 141 99 154 103 130 83 111 110 108Z" fill="'+pale+'" opacity=".87"/>'+
 '<circle cx="120" cy="120" r="11" fill="'+deep+'" stroke="'+bright+'" stroke-width="3"/>'+
 '<path d="M69 68Q120 39 171 68" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="5" stroke-linecap="round"/>'+
 '<circle cx="120" cy="28" r="4" fill="'+pale+'"/><circle cx="120" cy="207" r="4" fill="'+pale+'"/>'+
 '</svg>';
 if(cache.size>500)cache.clear();cache.set(key,medal);return medal;
}
function thumbnail(item){return '<span class="hgsb-medal">'+svg(item)+'</span>';}
function close(){
 if(!opened)return;
 var old=opened;opened=null;old.el.remove();document.body.classList.remove('hgsb-open');
 if(old.focus?.focus)try{old.focus.focus({preventScroll:true});}catch(_){}
}
function open(item){
 if(typeof document==='undefined'||!document.body)return false;
 close();item=item||{id:'preview',name:'Odznaka',earned:false};
 var prior=document.activeElement,el=document.createElement('section'),rotX=-8,rotY=0,zoom=1,pointers=new Map();
 el.id='hgSimpleBadgeInspect';el.className='hgsb-overlay';
 el.innerHTML='<div class="hgsb-dialog" role="dialog" aria-modal="true" aria-labelledby="hgsbTitle">'+
 '<header><div><small>HEALTHGO · KOLEKCJA</small><h2 id="hgsbTitle">'+esc(item.name||'Odznaka')+'</h2></div>'+
 '<button class="hgsb-close" type="button" aria-label="Zamknij podgląd">×</button></header>'+
 '<div class="hgsb-scene"><div class="hgsb-object" tabindex="0" role="img" aria-label="Odznaka obracana palcem">'+
 '<div class="hgsb-face hgsb-front">'+svg(item)+'</div>'+
 '<div class="hgsb-face hgsb-back"><strong>HG</strong><span>HEALTHGO</span></div></div></div>'+
 '<footer><strong>'+(item.prototype?'Model pokazowy':item.earned?'Zdobyta odznaka':'Niezdobyta odznaka')+'</strong>'+
 '<p>Przesuń palcem, aby obrócić odznakę. Rozsuń dwa palce, aby ją przybliżyć.</p></footer></div>';
 document.body.appendChild(el);document.body.classList.add('hgsb-open');
 var obj=el.querySelector('.hgsb-object'),scene=el.querySelector('.hgsb-scene');
 function paint(){obj.style.transform='translate(-50%,-50%) rotateX('+rotX+'deg) rotateY('+rotY+'deg) scale('+zoom+')';}
 function down(event){pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});try{scene.setPointerCapture(event.pointerId);}catch(_){}}
 function move(event){
  var before=pointers.get(event.pointerId);if(!before)return;
  if(pointers.size===1){rotY+=(event.clientX-before.x)*.65;rotX=Math.max(-75,Math.min(75,rotX-(event.clientY-before.y)*.55));}
  if(pointers.size===2){
   var other=Array.from(pointers.entries()).find(x=>x[0]!==event.pointerId);
   if(other){var a=Math.hypot(before.x-other[1].x,before.y-other[1].y),
      b=Math.hypot(event.clientX-other[1].x,event.clientY-other[1].y);
     zoom=Math.max(.65,Math.min(2,zoom+(b-a)*.008));}
  }
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});paint();
 }
 function end(event){pointers.delete(event.pointerId);}
 scene.addEventListener('pointerdown',down);scene.addEventListener('pointermove',move);
 scene.addEventListener('pointerup',end);scene.addEventListener('pointercancel',end);
 scene.addEventListener('wheel',function(event){event.preventDefault();zoom=Math.max(.65,Math.min(2,zoom-event.deltaY*.002));paint();},{passive:false});
 el.querySelector('.hgsb-close').addEventListener('click',close);
 el.addEventListener('click',function(event){if(event.target===el)close();});
 el.addEventListener('keydown',function(event){
  if(event.key==='Escape'){event.preventDefault();close();}
  else if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();rotY+=event.key==='ArrowRight'?22:-22;paint();}
  else if(event.key==='Tab'){
    var btn=el.querySelector('.hgsb-close');
    if(document.activeElement!==btn){event.preventDefault();btn.focus();}
    else{event.preventDefault();obj.focus();}
  }
 });
 opened={el:el,focus:prior};paint();el.querySelector('.hgsb-close').focus({preventScroll:true});
 return true;
}
host.HealthGoBadge3D=Object.freeze(Object.assign({},earlier,{thumbnail:thumbnail,open:open,close:close}));
host.HealthGoSimpleBadges=Object.freeze({svg:svg,thumbnail:thumbnail,open:open,close:close,hue:hue});
})(window);