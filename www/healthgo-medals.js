/* HealthGo original 3D enamel achievement badges. No CS2 or third-party artwork. */
(function(host){
'use strict';
var metals={
 common:['#e6c2a3','#99674f','#39251c','#ffdfb2'],
 rare:['#d0f4ff','#548cbb','#152d49','#abe7ff'],
 epic:['#eecfff','#9555c4','#331a52','#f5d7ff'],
 legendary:['#fff0b5','#d2992a','#482d10','#ffe486'],
 mythic:['#caffea','#20b695','#103e36','#aaffdb']
};
var shapes={
 badges:'M110 16 177 39 194 98 175 159 110 208 45 159 26 98 43 39Z',
 cups:'M75 19H145L194 66V145L145 199H75L26 145V66Z',
 sports:'M110 18a91 91 0 1 1 0 182a91 91 0 1 1 0-182Z',
 special:'M110 11 137 28 165 20 177 48 204 59 195 90 209 113 191 137 197 166 167 175 153 198 124 186 110 211 96 186 67 198 53 175 23 166 29 137 11 113 25 90 16 59 43 48 55 20 83 28Z',
 limited:'M110 15 183 56 188 145 110 207 32 145 37 56Z',
 family:'M110 16 181 42 199 100 181 163 110 209 39 163 21 100 39 42Z',
 secret:'M110 15 183 56 188 145 110 207 32 145 37 56Z'
};
function hash(s){var h=2166136261;s=String(s||'healthgo');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function emblem(item,h){
 var type=item.category==='secret'&&!item.earned?'lock':item.category==='cups'?'trophy':item.category==='sports'?'speed':item.category==='family'?'unity':item.category==='limited'?'compass':item.category==='special'?'star':['summit','compass','flame','crown','leaf','star'][h%6];
 var art={
 trophy:'<path d="M30 20H70V48Q70 72 50 72T30 48Z" fill="currentColor" stroke="#fff5ca" stroke-width="3"/><path d="M30 27H15V39Q15 54 32 55M70 27H85V39Q85 54 68 55M50 72V84M32 87H68" fill="none" stroke="currentColor" stroke-width="6"/><path d="m50 31 6 12 12 2-9 9 2 12-11-6-11 6 2-12-9-9 12-2Z" fill="#fff7d8"/>',
 speed:'<path d="M15 70Q29 23 75 17L61 42Q80 34 90 24Q88 68 50 69L38 87 28 77 38 61Q25 73 15 70Z" fill="currentColor" stroke="#fff4cb" stroke-width="3"/><path d="M23 49 9 54M24 35 9 38M35 24 21 22" stroke="#fff5d8" stroke-width="4" stroke-linecap="round"/>',
 unity:'<circle cx="50" cy="29" r="12" fill="currentColor"/><circle cx="24" cy="44" r="9" fill="currentColor"/><circle cx="76" cy="44" r="9" fill="currentColor"/><path d="M25 80Q25 47 50 47T75 80ZM7 81Q8 61 23 61L32 66V81ZM68 81V66L77 61Q92 61 93 81Z" fill="currentColor" stroke="#fff4ca" stroke-width="2"/>',
 compass:'<circle cx="50" cy="51" r="34" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50 11 61 40 91 51 61 62 50 91 39 62 9 51 39 40Z" fill="currentColor" stroke="#fff7d8" stroke-width="3"/><path d="m50 23 9 28-9 28-9-28Z" fill="#fff7dd" opacity=".7"/>',
 star:'<path d="m50 9 11 26 28 2-22 18 7 27-24-15-24 15 7-27-22-18 28-2Z" fill="currentColor" stroke="#fff3cc" stroke-width="3"/><circle cx="50" cy="50" r="10" fill="#fff8d9"/>',
 summit:'<path d="m8 81 31-57 17 29 12-18 24 46Z" fill="currentColor" stroke="#fff4d2" stroke-width="3"/><path d="m24 51 15-27 16 25-13-5-8 13Zm35 2 9-18 12 24-13-6Z" fill="#fff8dd"/><path d="M11 88H89" stroke="currentColor" stroke-width="5"/>',
 flame:'<path d="M50 9Q68 30 59 46Q77 33 78 49Q90 78 64 89Q41 100 25 78Q12 57 37 35Q34 57 45 57Q54 47 50 9Z" fill="currentColor" stroke="#fff4d4" stroke-width="3"/><path d="M50 48Q64 66 54 84Q39 87 39 74Q38 62 50 48Z" fill="#fff8db"/>',
 crown:'<path d="m14 33 18 15 18-29 18 29 18-15-8 43H22Z" fill="currentColor" stroke="#fff3cd" stroke-width="3"/><path d="M22 80H78V89H22Z" fill="currentColor"/><circle cx="50" cy="57" r="7" fill="#fff5d0"/>',
 leaf:'<path d="M19 83Q14 20 83 17Q89 79 31 86Z" fill="currentColor" stroke="#fff4d1" stroke-width="3"/><path d="M18 94Q45 47 82 18M40 65 29 45M57 45 75 47" fill="none" stroke="#fff9e3" stroke-width="4"/>',
 lock:'<rect x="27" y="43" width="46" height="39" rx="7" fill="currentColor" stroke="#fff5cf" stroke-width="3"/><path d="M35 43V31a15 15 0 0 1 30 0V43" stroke="currentColor" fill="none" stroke-width="8"/><circle cx="50" cy="62" r="5" fill="#fff5d3"/>'
 };
 return art[type]||art.star;
}

/* Every badge receives its OWN seed, geometry, enamel engraving, foil graining and serial. */
function seeded(seed){var n=seed>>>0;return function(){n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function uniqueRelief(item,seed,uid,ink,shine){
 var rng=seeded(seed),styles=[
  'M110 77 134 114 110 148 86 114Z','M77 143 94 89 127 89 145 143Z','M82 90H139L153 120 139 147H82L67 120Z',
  'M91 154 110 78 129 154 110 141Z','M77 118 110 86 143 118 110 151Z','M110 80 143 110 132 147 88 147 77 110Z',
  'M75 119Q109 69 145 119Q129 158 110 150Q91 158 75 119Z',
  'M73 103Q102 82 135 105L149 134 110 154 71 134Z',
  'M110 77 123 98 147 98 130 121 137 148 110 134 83 148 90 121 73 98 97 98Z',
  'M84 151Q72 96 110 80Q148 96 136 151L110 139Z',
  'M69 118 89 90 110 107 131 90 152 118 135 150 110 133 85 150Z',
  'M88 152 76 104 110 77 144 104 132 152Z'
 ];
 var style=styles[seed%styles.length],art='',scratches='',mesh='',chips='';
 var serial='HG-'+('0000'+(seed%99999)).slice(-5);
 var baseHue=(seed>>>7)%360,aspect=seed%6;
 for(var i=0;i<27;i++){
  var x=44+rng()*132,y=40+rng()*147,ang=rng()*6.28,length=4+rng()*19;
  scratches+='<path d="M'+x.toFixed(1)+' '+y.toFixed(1)+'l'+(Math.cos(ang)*length).toFixed(1)+' '+(Math.sin(ang)*length).toFixed(1)+'" stroke="'+(i%3?'#fff':ink)+'" stroke-width="'+(.32+rng()*.74).toFixed(2)+'" opacity="'+(.08+rng()*.28).toFixed(2)+'"/>';
 }
 for(var j=0;j<14;j++){
  var y2=68+j*6,x2=61+Math.sin(j+(seed%9))*(11+rng()*7);
  mesh+='<path d="M'+x2.toFixed(1)+' '+y2+'q'+(16+rng()*12).toFixed(1)+' '+(rng()*11-5).toFixed(1)+' '+(50+rng()*25).toFixed(1)+' '+(rng()*11-5).toFixed(1)+'" fill="none" stroke="'+(j%2?shine:'#071d25')+'" stroke-opacity="'+(.12+rng()*.26).toFixed(2)+'" stroke-width=".9"/>';
 }
 for(var k=0;k<9;k++){
  var ang=k*.698+(seed%53)*.017,rad=48+rng()*10;
  var xx=110+rad*Math.cos(ang),yy=115+rad*Math.sin(ang);
  chips+='<path d="M'+xx.toFixed(1)+' '+yy.toFixed(1)+'l'+(2+rng()*7).toFixed(1)+' '+(-3-rng()*9).toFixed(1)+' '+(-3-rng()*5).toFixed(1)+' '+(5+rng()*9).toFixed(1)+'Z" fill="'+shine+'" opacity="'+(.2+rng()*.37).toFixed(2)+'"/>';
 }
 var scene='';
 if(aspect===0)scene='<path d="M72 145 89 108 100 126 111 93 147 145Z" fill="'+shine+'" opacity=".61"/><path d="M99 112 111 93 127 116 113 110Z" fill="#fff" opacity=".74"/>';
 if(aspect===1)scene='<circle cx="110" cy="113" r="41" fill="none" stroke="'+shine+'" stroke-width="5" opacity=".75"/><path d="M110 71V155 M68 113H152 M80 82 140 144 M140 82 80 144" stroke="#fff" stroke-width="1.5" opacity=".38"/>';
 if(aspect===2)scene='<path d="M82 153Q84 102 110 81Q139 103 137 153M95 153V111M124 153V111" stroke="'+shine+'" fill="none" stroke-width="8" opacity=".68"/>';
 if(aspect===3)scene='<path d="M75 125Q89 78 110 106Q134 76 146 125Q117 156 110 156Q84 146 75 125Z" stroke="'+shine+'" stroke-width="6" fill="none" opacity=".72"/>';
 if(aspect===4)scene='<path d="M110 72 126 102 158 114 127 126 110 158 95 128 64 114 95 102Z" fill="'+shine+'" opacity=".5"/>';
 if(aspect===5)scene='<path d="M79 144Q95 96 128 79Q145 117 113 146Q94 155 79 144Z" fill="'+shine+'" opacity=".68"/><path d="M83 155Q110 128 126 87" stroke="#fff" stroke-width="4" opacity=".7"/>';
 var mark='<path d="'+style+'" fill="'+ink+'" opacity=".48" stroke="'+shine+'" stroke-width="4" stroke-linejoin="round"/>'+
 '<path d="'+style+'" transform="translate(0 3)" fill="none" stroke="#000" stroke-opacity=".48" stroke-width="2"/>';
 var group='<defs><clipPath id="'+uid+'-relief"><circle cx="110" cy="113" r="66"/></clipPath>'+
 '<linearGradient id="'+uid+'-engrave" x1="0" x2="1" y1="0" y2="1"><stop stop-color="'+shine+'" stop-opacity=".82"/><stop offset=".48" stop-color="'+ink+'" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity=".36"/></linearGradient></defs>'+
 '<g clip-path="url(#'+uid+'-relief)" data-texture-serial="'+serial+'">'+
 '<circle cx="110" cy="112" r="65" fill="url(#'+uid+'-engrave)" opacity=".17"/>'+
 scratches+mesh+chips+scene+mark+
 '<circle cx="110" cy="114" r="'+(24+seed%12)+'" fill="none" stroke="'+shine+'" stroke-width="2" opacity=".47"/>'+
 '<text x="110" y="120" font-family="Arial,sans-serif" fill="'+shine+'" stroke="'+ink+'" stroke-width=".4" font-size="17" font-weight="900" text-anchor="middle" letter-spacing="1">'+('0'+((seed>>>3)%99)).slice(-2)+'</text>'+
 '<path d="M60 161Q110 '+(143+(seed%17))+' 160 161" stroke="'+shine+'" opacity=".57" stroke-width="1.6" fill="none"/>'+
 '</g>';
 return group;
}

function render(item,big){
 item=item||{};
 var h=hash(item.id||item.name),category=Object.prototype.hasOwnProperty.call(shapes,item.category)?item.category:'badges';
 var p=metals[item.rarity]||metals.common,metal=p[0],shadow=p[1],enamel=p[2],shine=p[3],d=shapes[category];
 var id='hg-medal-'+h.toString(36)+'-'+(big?'large':'small'),locked=!item.earned,studs='',leaves='';
 for(var i=0;i<8;i++){var a=i*Math.PI/4-Math.PI/2;studs+='<circle cx="'+(110+73*Math.cos(a)).toFixed(1)+'" cy="'+(110+73*Math.sin(a)).toFixed(1)+'" r="2.3" fill="'+shine+'" opacity=".88"/>';}
 for(var j=0;j<5;j++){var y=95+j*13,x=63-j*1.5;leaves+='<ellipse cx="'+x+'" cy="'+y+'" rx="5" ry="10" transform="rotate(-32 '+x+' '+y+')"/><ellipse cx="'+(220-x)+'" cy="'+y+'" rx="5" ry="10" transform="rotate(32 '+(220-x)+' '+y+')"/>';}
 return '<svg class="hgp-medal-svg '+(locked?'is-locked':'is-earned')+'" data-medal-category="'+category+'" data-individual-texture="'+h.toString(36)+'" viewBox="0 0 220 238" focusable="false" aria-hidden="true">'+
 '<defs>'+
 '<linearGradient id="'+id+'-metal" x1="0" x2="1" y1="0" y2="1"><stop stop-color="'+metal+'"/><stop offset=".18" stop-color="'+shine+'"/><stop offset=".4" stop-color="'+shadow+'"/><stop offset=".62" stop-color="'+metal+'"/><stop offset=".81" stop-color="'+shadow+'"/><stop offset="1" stop-color="'+shine+'"/></linearGradient>'+
 '<radialGradient id="'+id+'-core" cx=".3" cy=".15" r="1"><stop stop-color="'+shadow+'"/><stop offset=".53" stop-color="'+enamel+'"/><stop offset="1" stop-color="#080e11"/></radialGradient>'+
 '<linearGradient id="'+id+'-glass"><stop stop-color="#fff" stop-opacity=".4"/><stop offset=".3" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>'+
 '<filter id="'+id+'-depth" x="-.3" y="-.3" width="1.6" height="1.6"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".55"/></filter>'+
 '</defs>'+
 '<g filter="url(#'+id+'-depth)">'+
 '<path d="M52 138 37 226 66 210 87 232 98 151Z M168 138 183 226 154 210 133 232 122 151Z" fill="url(#'+id+'-metal)" stroke="'+shadow+'" stroke-width="3"/>'+
 '<path d="'+d+'" transform="translate(0 5)" fill="#090f0e" opacity=".8"/>'+
 '<path d="'+d+'" fill="url(#'+id+'-metal)" stroke="'+shine+'" stroke-width="2.4" stroke-linejoin="round"/>'+
 '<path d="'+d+'" transform="translate(110 110) scale(.87) translate(-110 -110)" fill="url(#'+id+'-core)" stroke="'+shadow+'" stroke-width="7" stroke-linejoin="round"/>'+
 '<path d="'+d+'" transform="translate(110 110) scale(.77) translate(-110 -110)" fill="none" stroke="'+metal+'" stroke-width="2.1" opacity=".8"/>'+
 '<path d="'+d+'" fill="url(#'+id+'-glass)" opacity=".34"/>'+
 '<g fill="'+metal+'" stroke="'+enamel+'" stroke-width=".6" opacity=".8">'+leaves+'</g>'+
 '<g>'+studs+'</g>'+
 '<rect x="62" y="49" width="96" height="18" rx="5" fill="'+enamel+'" stroke="'+shine+'" stroke-width="2"/>'+
 '<text x="110" y="61.7" text-anchor="middle" fill="'+shine+'" font-family="Arial,sans-serif" font-size="9" font-weight="800" letter-spacing="1.5">HEALTHGO</text>'+
 uniqueRelief(item,h,id,enamel,shine)+
 '<path d="M76 173H144L154 184 144 196H76L66 184Z" fill="'+enamel+'" stroke="'+shine+'" stroke-width="2"/>'+
 '<text x="110" y="189" text-anchor="middle" fill="'+shine+'" font-family="Arial,sans-serif" font-size="14" font-weight="900" letter-spacing="2">HG</text>'+
 '</g>'+
 (locked?'<g><rect x="151" y="166" width="39" height="32" rx="10" fill="#18221c" stroke="#9ba7a0" stroke-width="2"/><path d="M161 167v-7a9 9 0 0 1 18 0v7" fill="none" stroke="#d3dad4" stroke-width="3"/><circle cx="170" cy="183" r="3" fill="#d3dad4"/></g>':'')+'</svg>';
}
host.HealthGoMedalArt=Object.freeze({render:render});
})(window);
