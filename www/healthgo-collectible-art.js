/* HealthGo 2.4 collectible artwork — original individually seeded SVG engravings, not emoji recolors. */
(function(host){
'use strict';
function hash(input){var h=2166136261,s=String(input||'item');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function prng(seed){var value=seed>>>0;return function(){value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var finishes=[
 {name:'Holo Prism',colors:['#fc92ff','#68ffe4','#779bff'],accent:'#fbffdf'},
 {name:'Gold Foil',colors:['#f4d379','#80501e','#ffe9b0'],accent:'#fff8df'},
 {name:'Iridescent',colors:['#b7f8ff','#817afb','#ff83b8'],accent:'#e9faff'},
 {name:'Emerald Steel',colors:['#56efb1','#063d35','#aafbcf'],accent:'#dcffcf'},
 {name:'Glacier',colors:['#b5ffff','#406aaa','#edf9ff'],accent:'#efffff'},
 {name:'Obsidian',colors:['#b2bacd','#1a2436','#7185ac'],accent:'#dce3ff'},
 {name:'Copper Leaf',colors:['#f9a688','#743b35','#ffdcaa'],accent:'#fff1da'},
 {name:'Ultraviolet',colors:['#d5b0ff','#463080','#f88ded'],accent:'#ffeaff'}
];
var emblems=[
 'M50 13 62 38 89 43 68 60 74 88 50 75 26 88 32 60 11 43 38 38Z',
 'M16 67 39 22 53 51 69 30 89 73 68 81 49 63 33 84Z',
 'M25 80 25 36 50 15 75 36 75 80 50 91Z',
 'M50 12 79 26 88 53 69 82 50 91 25 80 12 50 24 26Z',
 'M50 17 70 31 81 55 64 80 50 91 29 76 18 48 35 31Z',
 'M17 51 50 12 83 51 50 89Z',
 'M19 70Q36 13 72 20Q90 58 50 88Q30 80 19 70Z',
 'M13 40Q55 12 84 34L61 46 83 69Q56 93 18 67L39 53Z',
 'M28 86V44L50 14 72 44V86L50 72Z',
 'M17 79 20 25 44 42 50 15 68 42 83 25 82 79Z',
 'M50 12Q70 30 66 53Q89 66 50 90Q11 67 34 53Q29 29 50 12Z',
 'M15 54Q20 21 51 19Q81 21 85 52Q68 82 50 91Q32 79 15 54Z'
];
var motifLabels=['AURA','PRISM','NOVA','ECHO','VOLT','ATLAS','LUMEN','ONYX','TERRA','ZEN','SOL','WAVE'];
function glyph(seed){
 var r=prng(seed),parts='';
 var shape=emblems[seed%emblems.length];
 parts+='<path d="'+shape+'" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round" opacity=".78"/>';
 parts+='<path d="'+shape+'" fill="none" stroke="#061c22" stroke-width="2.5" stroke-linejoin="round" opacity=".83" transform="translate(0 3)"/>';
 for(var i=0;i<5;i++){
  var angle=i*1.2566+r()*.38,cx=50+Math.cos(angle)*(21+r()*13),cy=52+Math.sin(angle)*(21+r()*13);
  parts+='<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+(1.6+r()*3.2).toFixed(1)+'" fill="#fff" opacity=".62"/>';
 }
 var band=seed%5;
 if(band===0)parts+='<path d="M19 51H81 M50 18V84" stroke="#fff" stroke-width="2" opacity=".43"/>';
 if(band===1)parts+='<path d="M25 75 75 25 M25 25 75 75" stroke="#fff" stroke-width="2" opacity=".42"/>';
 if(band===2)parts+='<circle cx="50" cy="51" r="17" fill="none" stroke="#fff" stroke-width="2.4" opacity=".48"/>';
 if(band===3)parts+='<path d="M20 61Q49 21 81 60 M24 44Q51 86 76 43" stroke="#fff" stroke-width="2.3" fill="none" opacity=".46"/>';
 if(band===4)parts+='<path d="M32 22 68 77 M68 22 32 77" stroke="#fff" stroke-width="2.3" opacity=".37"/>';
 return parts;
}
function foil(id,x,y,w,h,seed){
 var r=prng(seed),out='';
 for(var i=0;i<13;i++){
  var px=x+r()*w,py=y+r()*h,length=8+r()*30,angle=(r()-.5)*35;
  out+='<path d="M'+px.toFixed(1)+' '+py.toFixed(1)+'l'+length.toFixed(1)+' '+angle.toFixed(1)+'" stroke="#fff" stroke-width="'+(r()*1.5+.35).toFixed(2)+'" opacity="'+(.09+r()*.32).toFixed(2)+'"/>';
 }
 return out;
}
function stickerArt(id,opts){
 opts=opts||{};
 var seed=hash(id),r=prng(seed),f=finishes[seed%finishes.length],uid='hgfoil-'+seed.toString(36)+(opts.large?'-large':'');
 var n=Number((/^s(\d\d)$/.exec(id)||[])[1])||0;
 var family=n?n%6:seed%6;
 var path=[
 'M50 4 84 18 96 49 80 87 50 97 17 86 4 49 17 17Z',
 'M49 4 87 25 97 50 86 84 50 96 14 84 4 50 14 24Z',
 'M50 4 90 13 95 52 78 91 50 96 18 90 5 52 11 12Z',
 'M50 4 82 15 97 46 81 87 50 97 19 87 3 46 18 15Z',
 'M50 4 72 17 96 27 86 52 96 77 68 85 50 97 28 85 4 77 14 52 4 27 28 17Z',
 'M50 4 95 25 91 75 50 97 9 75 5 25Z'
 ][family];
 var radii=Array.from({length:6},(_,i)=>Math.floor(r()*24));
 var subject=glyph(seed);
 var engraving='<circle cx="50" cy="50" r="'+(38+radii[0]/4)+'" fill="none" stroke="#fff" stroke-width="1.7" opacity=".42"/>';
 for(var k=0;k<8;k++){
  var t=k*Math.PI/4+r()*.1;
  engraving+='<circle cx="'+(50+39*Math.cos(t)).toFixed(1)+'" cy="'+(50+39*Math.sin(t)).toFixed(1)+'" r="1.3" fill="'+f.accent+'"/>';
 }
 var texture=foil(id,9,9,82,82,seed^0xabcc33)+engraving;
 return '<svg class="hgr-collectible-art hgr-sticker-svg" viewBox="0 0 100 110" data-art-id="'+esc(id)+'" data-finish="'+f.name.replace(/ /g,'-')+'" role="img" aria-label="'+esc(opts.label||'Naklejka')+'">'+
 '<defs><linearGradient id="'+uid+'-foil" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+f.colors[0]+'"/><stop offset=".38" stop-color="'+f.colors[1]+'"/><stop offset=".59" stop-color="'+f.colors[2]+'"/><stop offset=".82" stop-color="'+f.colors[0]+'"/><stop offset="1" stop-color="'+f.colors[2]+'"/></linearGradient>'+
 '<radialGradient id="'+uid+'-enamel"><stop stop-color="'+f.colors[1]+'"/><stop offset=".64" stop-color="'+f.colors[2]+'"/><stop offset="1" stop-color="#061c20"/></radialGradient>'+
 '<clipPath id="'+uid+'-clip"><path d="'+path+'"/></clipPath></defs>'+
 '<path d="'+path+'" transform="translate(0 6)" fill="#07120f" opacity=".54"/>'+
 '<path d="'+path+'" fill="#f6fff9" stroke="#f6ffeb" stroke-width="2.5"/>'+
 '<path d="'+path+'" transform="translate(50 50) scale(.89) translate(-50 -50)" fill="url(#'+uid+'-foil)" stroke="#032821" stroke-width="1.9"/>'+
 '<path d="'+path+'" transform="translate(50 50) scale(.77) translate(-50 -50)" fill="url(#'+uid+'-enamel)" opacity=".96"/>'+
 '<g clip-path="url(#'+uid+'-clip)">'+texture+'<g transform="translate(14 15) scale(.71)">'+subject+'</g></g>'+
 '<path d="M23 15Q48 4 79 21" stroke="#fff" stroke-width="4" opacity=".45" fill="none"/>'+
 '<rect x="31" y="90" width="38" height="10" rx="4" fill="#09221e" stroke="'+f.colors[0]+'" stroke-width="1.2"/>'+
 '<text x="50" y="98" text-anchor="middle" font-size="6.8" letter-spacing=".7" font-family="Arial,sans-serif" font-weight="bold" fill="'+f.accent+'">'+esc(n?'HG '+String(n).padStart(2,'0'):motifLabels[seed%12])+'</text></svg>';
}
function chestArt(type){
 var key=String(type||'basic'),seed=hash(key),p=finishes[seed%finishes.length],id='hgch-'+seed.toString(36),accent=p.colors[0];
 return '<svg class="hgr-collectible-art hgr-chest-svg" viewBox="0 0 170 160" role="img" aria-label="Skrzynia HealthGo '+esc(key)+'">'+
 '<defs><linearGradient id="'+id+'-metal" x1="0" x2="1" y1="0" y2="1"><stop stop-color="'+p.colors[2]+'"/><stop offset=".4" stop-color="'+p.colors[0]+'"/><stop offset=".75" stop-color="'+p.colors[1]+'"/><stop offset="1" stop-color="'+p.colors[2]+'"/></linearGradient></defs>'+
 '<path d="M19 48 84 18 152 48 87 79Z" fill="url(#'+id+'-metal)" stroke="'+accent+'" stroke-width="4"/>'+
 '<path d="M19 48 87 79V145L19 116Z" fill="#132d29" stroke="'+accent+'" stroke-width="3"/>'+
 '<path d="M87 79 152 48V117L87 145Z" fill="'+p.colors[1]+'" stroke="'+accent+'" stroke-width="3"/>'+
 '<path d="M58 30 123 65V133L99 144V79L35 43Z" fill="url(#'+id+'-metal)" opacity=".86"/>'+
 '<path d="M19 91 87 119 152 91" fill="none" stroke="'+accent+'" stroke-width="4" opacity=".83"/>'+
 '<rect x="103" y="89" width="32" height="28" rx="5" fill="#081d18" stroke="'+p.colors[0]+'" stroke-width="2"/>'+
 '<text x="119" y="107" text-anchor="middle" font-family="Arial" font-size="13" font-weight="900" fill="#fff9d4">HG</text>'+
 '<path d="M35 52 73 70 M109 70 140 56" stroke="#fff" opacity=".45" stroke-width="2"/>'+
 foil(key,22,24,115,95,seed)+'</svg>';
}
host.HealthGoCollectibleArt=Object.freeze({sticker:stickerArt,chest:chestArt,finish:function(id){return finishes[hash(id)%finishes.length].name;},hash:hash});
})(window);