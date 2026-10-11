/* HealthGo shields: light, illustrated badges, with a touch-friendly 2.5D view.
 * This is a visual renderer only. XP, ownership and achievements stay in the engine. */
(function(host){
'use strict';
var previous=host.HealthGoBadge3D||{},active=null;
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function hash(s){var h=2166136261;for(var ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
var COLORS=[
 ['#5db99e','#204b40','#c6eee1'],['#6c9ed9','#243e66','#c8e0fa'],
 ['#c79c68','#674425','#f3dcb5'],['#b985c9','#513264','#e9c9f2'],
 ['#db8f83','#673a3c','#ffe1d3'],['#83b67a','#395838','#daf3cd'],
 ['#b3a1d8','#4b416d','#eee3ff'],['#d5b76f','#67552c','#fff0c6']
];
var OUTER='M120 13 201 42 197 137 Q195 193 120 241 Q45 193 43 137 L39 42Z';
var INNER='M120 31 184 53 181 135 Q180 180 120 221 Q60 180 59 135 L56 53Z';
function info(item){
 item=item||{};var id=String(item.id||item.code||item.name||'healthgo');
 var n=/^hg-model-(\d+)$/.exec(id),seed=n?Number(n[1])-1:hash(id);
 return {id:id,seed:seed,color:COLORS[seed%COLORS.length],shape:seed%5,detail:Math.floor(seed/40)%6,locked:item.earned===false&&!item.prototype};
}
function badgeSvg(item,back){
 var v=info(item),c=v.color,label=escapeHtml(item&&item.name||'Odznaka HealthGo');
 var id='hgs-'+v.seed+'-'+(back?'b':'f');
 var panels=[
  '<path d="M60 127H180" stroke="'+c[2]+'" stroke-width="8" opacity=".7"/>',
  '<path d="M72 83L120 130 168 83" fill="none" stroke="'+c[2]+'" stroke-width="11" stroke-linejoin="round" opacity=".65"/>',
  '<path d="M120 37V220" stroke="'+c[2]+'" stroke-width="7" opacity=".62"/>',
  '<path d="M70 88L172 180 M172 88L70 180" stroke="'+c[2]+'" stroke-width="7" opacity=".53"/>',
  '<path d="M73 95H167 M76 120H164 M80 145H160" stroke="'+c[2]+'" stroke-width="6" stroke-linecap="round" opacity=".57"/>'
 ];
 var details=[
  '<circle cx="82" cy="66" r="4" fill="'+c[2]+'"/><circle cx="158" cy="66" r="4" fill="'+c[2]+'"/>',
  '<path d="M76 62L86 72 M164 62L154 72" stroke="'+c[2]+'" stroke-width="4" opacity=".7"/>',
  '<path d="M83 63H105 M135 63H157" stroke="'+c[2]+'" stroke-width="4" opacity=".7"/>',
  '<path d="M75 70L82 60 89 70 M151 70L158 60 165 70" fill="none" stroke="'+c[2]+'" stroke-width="3" opacity=".7"/>',
  '<path d="M83 58L92 75 M157 58L148 75" stroke="'+c[2]+'" stroke-width="5" opacity=".75"/>',
  '<circle cx="82" cy="66" r="6" fill="none" stroke="'+c[2]+'" stroke-width="2"/><circle cx="158" cy="66" r="6" fill="none" stroke="'+c[2]+'" stroke-width="2"/>'
 ];
 return '<svg class="hgp-medal-svg hgsh-svg'+(v.locked?' hgsh-locked':'')+'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 260" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+label+'" data-shield-id="'+escapeHtml(v.id)+'" data-shield-variant="'+v.shape+'">'+
 '<defs><linearGradient id="'+id+'" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="'+c[0]+'"/><stop offset="1" stop-color="'+c[1]+'"/></linearGradient></defs>'+
 '<path d="'+OUTER+'" fill="#071e17" opacity=".6" transform="translate(0 6)"/>'+
 '<path d="'+OUTER+'" fill="url(#'+id+')" stroke="'+c[2]+'" stroke-width="5" stroke-linejoin="round"/>'+
 '<path d="'+INNER+'" fill="none" stroke="'+c[2]+'" stroke-width="3" opacity=".75" stroke-linejoin="round"/>'+
 (back?'<text x="120" y="137" text-anchor="middle" font-size="42" font-weight="800" font-family="sans-serif" fill="'+c[2]+'">HG</text>':panels[v.shape]+details[v.detail])+
 '<path d="M64 53L120 35 176 53" stroke="#fff" stroke-opacity=".22" stroke-width="4" fill="none"/>'+
 '</svg>';
}
function thumbnail(item){var p=info(item);return '<span class="hgsh-badge'+(p.locked?' hgsh-muted':'')+'" data-hgsh="'+escapeHtml(p.id)+'">'+badgeSvg(item,false)+'</span>';}
function close(){
 if(!active)return;
 var d=active;active=null;
 d.node.remove();
 if(typeof document!=='undefined')document.body.classList.remove('hgsh-open');
 if(d.focus&&d.focus.focus)try{d.focus.focus({preventScroll:true});}catch(_){}
}
function open(item){
 if(typeof document==='undefined'||!document.body)return false;
 close();item=item||{id:'preview',name:'Odznaka'};
 var focus=document.activeElement,root=document.createElement('section');
 var x=-8,y=-15,zoom=1,pointers=new Map();
 root.className='hgsh-overlay';root.id='hgShieldInspect';
 root.innerHTML='<div class="hgsh-dialog" role="dialog" aria-modal="true" aria-labelledby="hgsh-title">'+
 '<header><h2 id="hgsh-title">'+escapeHtml(item.name||'Odznaka')+'</h2><button type="button" class="hgsh-close" aria-label="Zamknij">×</button></header>'+
 '<div class="hgsh-scene"><div class="hgsh-object" role="img" tabindex="0" aria-label="Obracana tarcza">'+
 '<div class="hgsh-face hgsh-front">'+badgeSvg(item,false)+'</div>'+
 '<div class="hgsh-face hgsh-back">'+badgeSvg(item,true)+'</div></div></div>'+
 '<footer><strong>'+(item.prototype?'Wzór kolekcjonerski':item.earned?'Zdobyta odznaka':'Niezdobyta odznaka')+'</strong>'+
 '<p>Przeciągnij palcem, aby obrócić tarczę. Dwoma palcami możesz ją przybliżyć.</p></footer></div>';
 document.body.appendChild(root);document.body.classList.add('hgsh-open');
 var scene=root.querySelector('.hgsh-scene'),object=root.querySelector('.hgsh-object'),exit=root.querySelector('.hgsh-close');
 function paint(){object.style.transform='translate(-50%,-50%) rotateX('+x+'deg) rotateY('+y+'deg) scale('+zoom+')';}
 function down(e){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{scene.setPointerCapture(e.pointerId);}catch(_){}}
 function move(e){
  var old=pointers.get(e.pointerId);if(!old)return;
  if(pointers.size===1){y+=(e.clientX-old.x)*.65;x=Math.max(-70,Math.min(70,x-(e.clientY-old.y)*.48));}
  else if(pointers.size===2){
   var other=Array.from(pointers.entries()).find(function(pair){return pair[0]!==e.pointerId;});
   if(other){var a=Math.hypot(old.x-other[1].x,old.y-other[1].y);
    var b=Math.hypot(e.clientX-other[1].x,e.clientY-other[1].y);
    zoom=Math.max(.65,Math.min(1.85,zoom+(b-a)*.008));}
  }
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});paint();
 }
 function up(e){pointers.delete(e.pointerId);}
 scene.addEventListener('pointerdown',down);
 scene.addEventListener('pointermove',move);
 scene.addEventListener('pointerup',up);
 scene.addEventListener('pointercancel',up);
 scene.addEventListener('lostpointercapture',up);
 scene.addEventListener('wheel',function(e){e.preventDefault();zoom=Math.max(.65,Math.min(1.85,zoom-e.deltaY*.002));paint();},{passive:false});
 exit.addEventListener('click',close);
 root.addEventListener('click',function(e){if(e.target===root)close();});
 root.addEventListener('keydown',function(e){
  if(e.key==='Escape'){e.preventDefault();close();}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();y+=(e.key==='ArrowRight'?18:-18);paint();}
  else if(e.key==='+'||e.key==='='){e.preventDefault();zoom=Math.min(1.85,zoom+.1);paint();}
  else if(e.key==='-'){e.preventDefault();zoom=Math.max(.65,zoom-.1);paint();}
  else if(e.key==='Tab'){e.preventDefault();(document.activeElement===exit?object:exit).focus();}
 });
 active={node:root,focus:focus};paint();exit.focus({preventScroll:true});return true;
}
host.HealthGoBadge3D=Object.freeze(Object.assign({},previous,{thumbnail:thumbnail,open:open,close:close}));
host.HealthGoShieldBadges=Object.freeze({thumbnail:thumbnail,svg:badgeSvg,open:open,close:close,info:info});
})(window);
