/* HealthGo 2.9 — authentic, original badge illustrations made from vector paths.
 * Design inspiration: premium collectibles; NO clipping/cropping of any supplied picture.
 * The SVGs scale sharply on retina iPhones, and rotate as two-sided 3D art.
 * Real achievements/XP still come exclusively from HealthGoEngine. */
(function(host){
'use strict';
var previous=host.HealthGoBadge3D||{},active=null,cache=new Map();
var FRAMES=[
'M120 16Q169 35 202 58L197 140Q172 187 120 221Q67 187 43 140L38 58Q72 35 120 16Z',
'M72 22H168L219 118L168 215H72L21 118Z',
'M120 13L141 62L195 38L178 98L223 118L178 141L195 197L141 179L120 226L99 179L45 197L62 141L17 118L62 98L45 38L99 62Z',
'M120 14L147 37L183 23L189 66L220 85L198 116L216 151L185 173L175 210L120 197L65 210L55 173L24 151L42 116L20 85L51 66L57 23L93 37Z',
'M120 12L149 57L205 51L187 101L223 119L182 148L191 204L143 188L120 223L97 188L49 204L58 148L17 119L53 101L35 51L91 57Z',
'M36 86L59 33L83 63L120 18L157 63L181 33L204 86L191 191L120 220L49 191Z',
'M120 19L161 30L174 63L216 81L191 120L204 163L166 182L120 221L74 182L36 163L49 120L24 81L66 63L79 30Z',
'M120 12L207 118L120 224L33 118Z',
'M120 13L139 49L180 27L174 73L217 69L193 109L224 130L181 150L189 201L143 182L120 224L97 182L51 201L59 150L16 130L47 109L23 69L66 73L60 27L101 49Z',
'M120 19C162 19 207 59 207 110C207 165 168 213 120 216C72 213 33 165 33 110C33 59 78 19 120 19Z',
'M28 76L66 42L96 53L120 15L144 53L174 42L212 76L186 112L213 149L179 191L137 184L120 225L103 184L61 191L27 149L54 112Z',
'M120 17L184 44L218 107L195 176L120 218L45 176L22 107L56 44Z',
'M120 16C143 40 163 51 189 52C174 81 202 104 216 117C191 137 185 167 195 194C162 185 142 198 120 224C98 198 78 185 45 194C55 167 49 137 24 117C38 104 66 81 51 52C77 51 97 40 120 16Z',
'M120 18L150 41L186 43L185 80L217 117L186 156L188 192L151 191L120 220L89 191L52 192L54 156L23 117L55 80L54 43L90 41Z',
'M31 60L77 72L120 15L163 72L209 60L184 115L207 163L151 166L120 219L89 166L33 163L56 115Z',
'M120 15L161 56L204 53L186 96L222 120L186 144L204 187L161 184L120 225L79 184L36 187L54 144L18 120L54 96L36 53L79 56Z',
'M120 18C158 15 175 43 182 73L216 105L191 143L172 189L120 222L68 189L49 143L24 105L58 73C65 43 82 15 120 18Z',
'M26 66L65 29L120 45L175 29L214 66L197 120L214 172L174 210L120 190L66 210L26 172L43 120Z',
'M120 14L156 65L215 64L187 119L215 172L157 173L120 225L83 173L25 172L53 119L25 64L84 65Z',
'M120 18Q164 23 188 58L204 123L183 180L120 219L57 180L36 123L52 58Q76 23 120 18Z',
'M120 18L175 43L215 102L198 159L155 202L120 226L85 202L42 159L25 102L65 43Z',
'M120 14L135 43L171 28L180 66L211 70L197 107L222 128L192 154L193 194L150 181L120 224L90 181L47 194L48 154L18 128L43 107L29 70L60 66L69 28L105 43Z',
'M120 17L173 30L197 75L217 119L197 163L173 208L120 222L67 208L43 163L23 119L43 75L67 30Z',
'M120 17L144 54L192 40L185 91L222 119L185 147L192 198L144 184L120 221L96 184L48 198L55 147L18 119L55 91L48 40L96 54Z'
];
var PALETTES=[
['#d5fff1','#4de6c3','#093d36','#167d6f','#adfff2'],
['#fff1aa','#ffc650','#59300d','#a45b24','#fff5ca'],
['#e2f5ff','#79c8ff','#132d69','#3560bc','#ffffff'],
['#ffe4f5','#ff7cdc','#641568','#a83797','#ffdbfc'],
['#ddffb5','#83e36e','#20491d','#449d4b','#f5ffb5'],
['#ffe0bd','#ff8a61','#66221a','#ae4933','#fff5d4'],
['#dbdaff','#9081ff','#2a1d6c','#555ac7','#ffffff'],
['#f7f7f7','#c2d7dc','#263c4a','#597d84','#ffffff'],
['#cfffff','#43dfee','#074a64','#1383a9','#ffffff'],
['#fff3e8','#e5aa77','#513223','#ad7050','#fff7d8']
];
var ICONS={
chat:'<path d="M-38-31Q-48-31-48-18V17Q-48 30-35 30H-16L-3 47V30H35Q48 30 48 17V-18Q48-31 35-31Z"/><path d="M-25 0H26M-25 13H10"/>',
level:'<path d="M-42-17L-23 6L-10-26L9 4L32-25L42 24H-40Z"/><path d="M-37 31H38M-29 40H29"/><circle cx="7" cy="16" r="6"/>',
xp:'<path d="M4-46L-33 6H-7L-22 46L36-15H10L26-46Z"/>',
challenge:'<path d="M-26-36H26V-1Q26 22 5 29V41H26M5 29H-5V41H-26M-26-24H-43V-10Q-41 5-26 7M26-24H43V-10Q41 5 26 7"/>',
compass:'<circle r="44"/><circle r="29"/><path d="M-15 15L-5-24L25-29L15 7Z"/><circle r="6"/>',
heart:'<path d="M0 37C-50 6-49-26-23-32Q-7-36 0-20Q12-38 30-31C56-16 38 12 0 37Z"/><path d="M-34 2H-17L-7-12L4 15L14-2H34"/>',
run:'<path d="M-12-34L2-44L15-31L-1-16Z"/><path d="M-3-12L18 1L36 9L25 19L2 13L-19 35L-40 31L-30 17L-12 1Z"/><path d="M-25-31L-7-19"/>',
water:'<path d="M0-46C14-20 39-2 39 21Q39 44 0 44Q-39 44-39 21C-39-2-14-20 0-46Z"/><path d="M-23 17Q-21 32-4 33"/>',
leaf:'<path d="M-42 27Q-47-29 44-40Q43 27-11 42Z"/><path d="M-29 34L29-23M-3 8L-7-22M-3 8L28 14"/>',
sun:'<circle r="21"/><path d="M0-47V-34M0 34V47M47 0H34M-34 0H-47M34-34L25-25M-25 25L-34 34M34 34L25 25M-25-25L-34-34"/>',
snow:'<path d="M0-47V47M-41-24L41 24M-41 24L41-24M-13-34L0-22L13-34M-13 34L0 22L13 34M-38-10L-22-13L-26-30M38 10L22 13L26 30M-38 10L-22 13L-26 30M38-10L22-13L26-30"/>',
star:'<path d="M0-47L13-15L47-12L20 9L29 43L0 24L-29 43L-20 9L-47-12L-13-15Z"/>',
calendar:'<rect x="-41" y="-33" width="82" height="73" rx="8"/><path d="M-41-12H41M-22-44V-22M22-44V-22M-22 7H-9M9 7H22M-22 24H-9M9 24H22"/>',
book:'<path d="M-42-32Q-15-44 0-29Q15-44 42-32V34Q13 28 0 40Q-13 28-42 34Z"/><path d="M0-29V40M-30-19Q-14-24-8-17M8-17Q14-24 30-19"/>',
map:'<path d="M-45-32L-13-42L17-30L45-42V32L16 42L-14 30L-45 42Z"/><path d="M-13-42V30M17-30V42M-33-21L-9-10L12-16"/>',
fire:'<path d="M-3-47Q24-26 13-8Q35-18 31-35Q63 16 23 39Q0 55-26 36Q-55 11-23-21Q-21 1-4 6Q-11-23-3-47Z"/><path d="M0 8Q23 23 5 42Q-17 34 0 8Z"/>',
crystal:'<path d="M-44-17L-21-42H24L44-16L0 45Z"/><path d="M-44-17H44M-21-42L-9-17L0 45M24-42L10-17L0 45"/>',
mountain:'<path d="M-48 36L-16-21L0 1L21-39L49 36Z"/><path d="M-28-2L-16-21L-4-4M11-17L21-39L32-16"/>',
moon:'<path d="M16-45Q-20-27-16 8Q-14 39 22 40Q-2 58-28 33Q-59 2-31-31Q-11-50 16-45Z"/><path d="M22-13L28-2L39 0L29 9L30 22L20 15L10 23L13 10L3 2L15-1Z"/>',
people:'<circle cx="-22" cy="-19" r="14"/><circle cx="21" cy="-18" r="14"/><path d="M-45 34Q-44 2-22 2Q0 2 0 34M0 35Q1 4 21 4Q45 4 45 35"/>',
tree:'<path d="M0 46V8M-35 17L-22-7L-30-7L-12-38L0-16L12-38L30-7L22-7L35 17Z"/><path d="M-20 45H20"/>',
shield:'<path d="M0-46L40-29V3Q34 30 0 47Q-34 30-40 3V-29Z"/><path d="M-21 1L-4 17L24-15"/>',
planet:'<circle r="29"/><ellipse cx="0" cy="3" rx="47" ry="17" transform="rotate(-23)"/><circle cx="16" cy="-11" r="6"/>',
flower:'<circle r="12"/><path d="M0-43Q18-46 16-21L0-12Q-17-25 0-43ZM43 0Q46 18 21 16L12 0Q25-17 43 0ZM0 43Q-18 46-16 21L0 12Q17 25 0 43ZM-43 0Q-46-18-21-16L-12 0Q-25 17-43 0Z"/>',
dumbbell:'<path d="M-45-20V20M-33-30V30M-33 0H33M33-30V30M45-20V20"/>',
target:'<circle r="43"/><circle r="25"/><circle r="8"/><path d="M16-16L46-46M26-42L46-46L42-26"/>',
gift:'<rect x="-40" y="-11" width="80" height="50" rx="3"/><rect x="-46" y="-25" width="92" height="15" rx="4"/><path d="M0-25V39M0-25Q-50-25-33-46Q-19-55 0-25Q19-55 33-46Q50-25 0-25Z"/>',
butterfly:'<path d="M0-30Q-28-59-43-30Q-54 0-8 3Q-45 10-29 37Q-13 52 0 13Q13 52 29 37Q45 10 8 3Q54 0 43-30Q28-59 0-30Z"/><path d="M0-30V28"/>'
};
var iconKeys=Object.keys(ICONS);
function hash(value){var h=2166136261,s=String(value||'hgv');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function safe(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function clamp(n,low,high){return Math.min(high,Math.max(low,n));}
function classify(item){
 var s=(String(item.name||'')+' '+String(item.id||'')+' '+String(item.category||'')).toLowerCase();
 if(/rozmow|chat|ai\b|wiadomo|asystent/.test(s))return 'chat';
 if(/poziom|level|ranga/.test(s))return 'level';
 if(/\bxp\b|punkt|energy/.test(s))return 'xp';
 if(/wyzwan|challenge|quest/.test(s))return 'challenge';
 if(/odkryw|kompas|podró|map/.test(s))return 'compass';
 if(/sport|bieg|rower|krok|trening/.test(s))return 'run';
 if(/zdrow|tęt|puls|serc/.test(s))return 'heart';
 if(/wod|kropl|nawod/.test(s))return 'water';
 if(/natur|liś|las|roślin/.test(s))return 'leaf';
 if(/słoń|pogod|dzień/.test(s))return 'sun';
 if(/zima|śnieg|mróz/.test(s))return 'snow';
 if(/gwiazd|star/.test(s))return 'star';
 if(/kalendarz|plan|organiz/.test(s))return 'calendar';
 if(/książ|nauk|wiedz/.test(s))return 'book';
 if(/ogn|seria|streak|płom/.test(s))return 'fire';
 if(/kryszt|diament|gem/.test(s))return 'crystal';
 if(/gór|wspin/.test(s))return 'mountain';
 if(/księż|sen|odpoczy/.test(s))return 'moon';
 if(/przyjac|znajom|rodzin/.test(s))return 'people';
 if(/drzew|sad/.test(s))return 'tree';
 if(/bezpie|ochron/.test(s))return 'shield';
 if(/kosmo|planet/.test(s))return 'planet';
 if(/kwiat|garden/.test(s))return 'flower';
 if(/sił|hantel/.test(s))return 'dumbbell';
 if(/cel|target/.test(s))return 'target';
 if(/prezent|nagrod|pacz/.test(s))return 'gift';
 if(/motyl|butterfly/.test(s))return 'butterfly';
 return null;
}
function variant(item){
 item=item||{};var id=String(item.id||item.name||'badge'),seed=hash(id),number=/^hg-model-(\d{1,3})$/.exec(id);
 var index=number?clamp(Number(number[1])-1,0,239):seed%240;
 var frame=number?(index%FRAMES.length):((seed>>>2)%FRAMES.length);
 var key=classify(item)||(number?iconKeys[Math.floor(index/8)%iconKeys.length]:iconKeys[(seed>>>8)%iconKeys.length]);
 var mode=String(item.rarity||'common');
 var paletteIndex={common:7,rare:2,epic:3,legendary:1,mythic:6}[mode];
 if(number)paletteIndex=(Math.floor(index/20)+Math.floor(index/48))%PALETTES.length;
 else if(paletteIndex==null)paletteIndex=seed%PALETTES.length;
 var p=PALETTES[paletteIndex],isLocked=item.earned===false&&!item.prototype;
 return {id:id,index:index,frame:frame,icon:key,seed:seed,p:p,locked:isLocked,rarity:mode,prototype:!!item.prototype};
}
function decor(v){
 var spin=(v.seed%19)*3,parts='';
 for(var i=0;i<8;i++){
  var angle=i*Math.PI/4+spin*Math.PI/180,x=120+80*Math.cos(angle),y=116+80*Math.sin(angle);
  parts+='<circle cx="'+x.toFixed(2)+'" cy="'+y.toFixed(2)+'" r="'+(i%2?2.0:2.9)+'" fill="url(#'+v.idGrad+'gem)" stroke="'+v.p[4]+'" stroke-width="1"/>';
 }
 return parts;
}
function draw(item){
 var v=variant(item),p=v.p,id='hgv-'+hash(v.id).toString(36),cacheKey=v.id+'-'+v.rarity+'-'+v.icon+'-'+v.frame+'-'+(v.locked?'L':'E');
 if(cache.has(cacheKey))return cache.get(cacheKey);
 v.idGrad=id;
 var frame=FRAMES[v.frame],mini='<path d="'+frame+'" transform="translate(120 117) scale(.855) translate(-120 -117)"';
 var centre='<g transform="translate(120 117)" fill="none" stroke="'+p[4]+'" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">'+ICONS[v.icon]+'</g>';
 var tint=v.seed%3,upper=(v.seed>>>9)%7,ornaments='';
 if(v.frame%4===0||v.frame%4===3){
   ornaments='<path d="M38 65Q16 91 35 147M202 65Q224 91 205 147" stroke="'+p[1]+'" stroke-width="5" fill="none" opacity=".88"/>'+
   '<path d="M43 78Q23 94 39 127M197 78Q217 94 201 127" stroke="'+p[4]+'" stroke-width="2.5" fill="none" opacity=".7"/>';
 }else if(v.frame%4===1){
   ornaments='<path d="M45 66L77 42M195 66L163 42M46 165L74 194M194 165L166 194" stroke="'+p[4]+'" stroke-width="4" opacity=".8"/>';
 }else if(v.frame%4===2){
   ornaments='<path d="M75 38L120 19L165 38M75 197L120 218L165 197" stroke="'+p[4]+'" stroke-width="3.5" fill="none" opacity=".65"/>';
 }
 var innerShape=v.frame%3===0?
 '<circle cx="120" cy="116" r="60" stroke="'+p[0]+'" stroke-width="3" fill="url(#'+id+'enamel)"/>'+
 '<circle cx="120" cy="116" r="53" stroke="'+p[4]+'" stroke-opacity=".3" fill="none" stroke-width="1.5"/>':
 v.frame%3===1?
 '<path d="M120 50L171 82L171 150L120 184L69 150L69 82Z" fill="url(#'+id+'enamel)" stroke="'+p[0]+'" stroke-width="3.8"/>':
 '<path d="M120 50L178 116L120 182L62 116Z" fill="url(#'+id+'enamel)" stroke="'+p[0]+'" stroke-width="3.5"/>';
 var art='<svg xmlns="http://www.w3.org/2000/svg" class="hgp-medal-svg hgv-vector-badge'+(v.locked?' hgv-locked':'')+'" viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+safe(item.name||'Odznaka HealthGo')+'" data-vector-badge="'+safe(v.id)+'" data-frame="'+v.frame+'" data-emblem="'+v.icon+'">'+
 '<defs>'+
 '<linearGradient id="'+id+'metal" x1=".06" y1="0" x2=".92" y2="1"><stop stop-color="'+p[4]+'"/><stop offset=".20" stop-color="'+p[1]+'"/><stop offset=".46" stop-color="'+p[2]+'"/><stop offset=".70" stop-color="'+p[0]+'"/><stop offset="1" stop-color="'+p[3]+'"/></linearGradient>'+
 '<radialGradient id="'+id+'enamel" cx=".39" cy=".26" r=".9"><stop stop-color="'+p[3]+'"/><stop offset=".48" stop-color="'+p[2]+'"/><stop offset="1" stop-color="#060f1b"/></radialGradient>'+
 '<linearGradient id="'+id+'edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+p[4]+'"/><stop offset=".48" stop-color="'+p[1]+'"/><stop offset="1" stop-color="'+p[2]+'"/></linearGradient>'+
 '<radialGradient id="'+id+'gem"><stop stop-color="#fff"/><stop offset=".58" stop-color="'+p[1]+'"/><stop offset="1" stop-color="'+p[2]+'"/></radialGradient>'+
 '</defs>'+
 '<path d="'+frame+'" transform="translate(0 4)" fill="#000" opacity=".49"/>'+
 '<path d="'+frame+'" fill="url(#'+id+'metal)" stroke="'+p[4]+'" stroke-width="2.5" stroke-linejoin="round"/>'+
 mini+' fill="'+p[2]+'" stroke="'+p[4]+'" stroke-opacity=".78" stroke-width="3"/>'+
 '<path d="'+frame+'" fill="none" stroke="'+p[4]+'" stroke-opacity=".64" stroke-width="2" transform="translate(120 117) scale(.93) translate(-120 -117)"/>'+
 ornaments+
 '<circle cx="120" cy="116" r="70" fill="none" stroke="'+p[1]+'" stroke-opacity=".25" stroke-width="5"/>'+
 innerShape+
 '<circle cx="120" cy="116" r="47" fill="none" stroke="'+p[4]+'" stroke-opacity=".23" stroke-width="1.5"/>'+
 '<path d="M85 86Q120 59 155 84" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>'+
 centre+
 decor(v)+
 '<path d="M87 176Q120 194 152 175" fill="none" stroke="'+p[1]+'" stroke-opacity=".75" stroke-width="2"/>'+
 '<path d="M103 40L120 29L137 40" fill="none" stroke="'+p[4]+'" stroke-width="2.5" opacity=".8"/>'+
 '<circle cx="120" cy="32" r="3.5" fill="'+p[4]+'"/>'+
 '<path d="M83 198Q120 213 157 198" fill="none" stroke="'+p[4]+'" stroke-opacity=".58" stroke-width="2"/>'+
 '</svg>';
 if(cache.size>410)cache.clear();cache.set(cacheKey,art);return art;
}
function close(){
 if(!active)return;
 var current=active;active=null;
 if(current.frame)host.cancelAnimationFrame?.(current.frame);
 current.el?.remove();
 document.body.classList.remove('hgv-open');
 if(current.focus?.focus)try{current.focus.focus({preventScroll:true});}catch(_){}
}
function inspect(item){
 if(typeof document==='undefined'||!document.body)return false;
 previous.close?.();close();
 item=item||{id:'hg-model-001',name:'Odznaka HealthGo',prototype:true};
 var el=document.createElement('div'),focus=document.activeElement,angleX=-8,angleY=-12,zoom=1,pointers=new Map();
 var front=draw(item),back='<svg viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+
 '<defs><radialGradient id="hgvback"><stop stop-color="#2f7561"/><stop offset="1" stop-color="#0a2721"/></radialGradient></defs>'+
 '<circle cx="120" cy="120" r="103" fill="url(#hgvback)" stroke="#b9e0b5" stroke-width="7"/>'+
 '<circle cx="120" cy="120" r="87" fill="none" stroke="#6fad99" stroke-width="3"/>'+
 '<path d="M120 58L155 87V138L120 168L85 138V87Z" fill="none" stroke="#e6ffcf" stroke-width="4"/>'+
 '<text x="120" y="123" font-family="Arial,sans-serif" font-size="30" font-weight="900" text-anchor="middle" fill="#e8ffdf">HG</text>'+
 '<text x="120" y="201" font-family="Arial,sans-serif" font-size="11" text-anchor="middle" fill="#c8eccd" letter-spacing="2">HEALTHGO</text></svg>';
 el.id='hgBadgeVectorInspect';el.className='hgv-overlay';
 el.innerHTML='<section class="hgv-dialog" role="dialog" aria-modal="true" aria-labelledby="hgv-inspect-title">'+
 '<div class="hgv-head"><div><small>HEALTHGO · ODZNAKA</small><h2 id="hgv-inspect-title">'+safe(item.name||'Odznaka')+'</h2></div>'+
 '<button type="button" data-hgv-close aria-label="Zamknij podgląd odznaki">×</button></div>'+
 '<div class="hgv-stage"><div class="hgv-aura" aria-hidden="true"></div>'+
 '<div class="hgv-touch" aria-label="Obracany model odznaki. Przesuń palcem lub użyj strzałek klawiatury.">'+
 '<div class="hgv-object"><div class="hgv-face hgv-front">'+front+'</div><div class="hgv-face hgv-back">'+back+'</div>'+
 '<div class="hgv-rim" aria-hidden="true"></div></div></div>'+
 '<div class="hgv-pedestal" aria-hidden="true"></div></div>'+
 '<div class="hgv-hint">Przesuń palcem, aby obrócić · Rozsuń dwa palce, aby przybliżyć</div>'+
 '</section>';
 document.body.appendChild(el);document.body.classList.add('hgv-open');
 var obj=el.querySelector('.hgv-object'),touch=el.querySelector('.hgv-touch');
 function show(){obj.style.transform='translate(-50%,-50%) rotateX('+angleX+'deg) rotateY('+angleY+'deg) scale('+zoom+')';}
 function down(e){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{touch.setPointerCapture(e.pointerId);}catch(_){}}
 function move(e){
  var old=pointers.get(e.pointerId);if(!old)return;
  if(pointers.size===1){angleY+=(e.clientX-old.x)*.65;angleX=clamp(angleX-(e.clientY-old.y)*.45,-76,76);}
  else{var other=Array.from(pointers.entries()).find(q=>q[0]!==e.pointerId)?.[1];if(other){var a=Math.hypot(old.x-other.x,old.y-other.y),b=Math.hypot(e.clientX-other.x,e.clientY-other.y);zoom=clamp(zoom+(b-a)*.009,.65,2);}}
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});show();
 }
 function up(e){pointers.delete(e.pointerId);}
 touch.addEventListener('pointerdown',down);touch.addEventListener('pointermove',move);touch.addEventListener('pointerup',up);touch.addEventListener('pointercancel',up);
 touch.addEventListener('wheel',function(e){e.preventDefault();zoom=clamp(zoom-e.deltaY*.002,.65,2);show();},{passive:false});
 el.querySelector('[data-hgv-close]').addEventListener('click',close);
 el.addEventListener('click',function(e){if(e.target===el)close();});
 el.addEventListener('keydown',function(e){
  if(e.key==='Escape'){e.preventDefault();close();}
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();angleY+=(e.key==='ArrowRight'?22:-22);show();}
  if(e.key==='+'||e.key==='='){e.preventDefault();zoom=clamp(zoom+.13,.65,2);show();}
  if(e.key==='-'){e.preventDefault();zoom=clamp(zoom-.13,.65,2);show();}
  if(e.key==='Tab'){var buttons=Array.from(el.querySelectorAll('button'));if(buttons.length&&document.activeElement===buttons[0]){e.preventDefault();buttons[0].focus();}}
 });
 active={el:el,focus:focus};show();el.querySelector('[data-hgv-close]').focus({preventScroll:true});
 return true;
}
var merged=Object.assign({},previous,{thumbnail:draw,open:inspect,close:close});
host.HealthGoBadge3D=Object.freeze(merged);
host.HealthGoBadgeVector=Object.freeze({thumbnail:draw,open:inspect,variant:variant,frames:FRAMES.length,emblems:iconKeys.length,close:close});
})(window);