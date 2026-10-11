/* HealthGo Badge Forge 2.5 — original procedural extruded 3D medal models.
 * 240 deterministic distinct geometries, WebGL inspection and 2D fallback.
 * Model prototypes are NOT unlocked achievements, XP or saleable items. */
(function(host){
'use strict';
var THEMES=['Odkrywca','Aurora','Wędrowiec','Kompas','Kryształ','Strażnik','Szmaragd','Kosmos','Energia','Korona','Legenda','Feniks'];
var FORMS=['tarcza','puchar','gwiazda','korona','kryształ','kompas','skrzydła','kwiat','słońce','runy','płomień','orbita'];
var PALETTES=[
 [[.52,.92,.77],[.10,.43,.35],[.85,1,.96]],
 [[.86,.78,1],[.32,.16,.65],[1,.92,1]],
 [[1,.83,.39],[.50,.27,.10],[1,.95,.70]],
 [[.65,.89,1],[.13,.30,.63],[.95,.97,1]],
 [[1,.57,.52],[.50,.13,.30],[1,.91,.70]],
 [[.86,.94,1],[.25,.36,.48],[1,1,.92]]
];
function hash(input){var h=2166136261,s=String(input||'medal');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function random(seed){var n=seed>>>0;return function(){n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;};}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function definition(index){
 var i=Number(index);if(!Number.isInteger(i)||i<1||i>240)return null;
 var family=Math.floor((i-1)/20),edition=(i-1)%20;
 return {id:'hg-model-'+String(i).padStart(3,'0'),index:i,name:THEMES[family]+' · '+(edition+1),
   family:THEMES[family],form:FORMS[(family+edition*7)%FORMS.length],
   familyIndex:family,edition:edition,earned:false,prototype:true,rarity:['common','rare','epic','legendary','mythic'][Math.floor(edition/4)]};
}
var CATALOG=Object.freeze(Array.from({length:240},function(_,i){return Object.freeze(definition(i+1));}));
function material(item){
 var rarity=item.rarity||'rare',lookup={common:5,rare:3,epic:1,legendary:2,mythic:0};
 return PALETTES[lookup[rarity]===undefined?0:lookup[rarity]];
}
/* Collector 2.7: authored silhouette families rather than nearly identical noisy discs.
 * Each outline is star-shaped (safe triangle-fan extrusion), with controlled 2% material variation. */
var OUTLINES=[
 // shield, faceted crystal, winged crest, sun, star, crown, leaf, flame
 [.93,.93,.94,.94,.88,.78,.69,.76,.85,.9,.94,.93,.95,.95,.95,.95],
 [.77,.86,.95,.82,.66,.82,.95,.87,.78,.86,.95,.82,.66,.82,.95,.87],
 [1,.91,.75,.69,.88,.96,1,.83,.96,.84,1,.96,.88,.69,.75,.91],
 [.83,1,.8,1,.82,1,.8,1,.83,1,.8,1,.82,1,.8,1],
 [.9,.65,1,.65,.9,.65,1,.65,.9,.65,1,.65,.9,.65,1,.65],
 [.76,.69,.91,1,.77,.88,.8,.95,.95,.8,.88,.77,1,.91,.69,.76],
 [.76,.84,1,.95,.86,.78,.64,.59,.64,.78,.86,.95,1,.84,.76,.7],
 [.79,.82,.9,.98,.8,.63,.71,.9,.99,.81,.68,.77,.91,1,.92,.8],
 // hexagon, gear, flower, lightning, target, book, mountain, trophy
 [.83,.94,1,.94,.83,.94,1,.94,.83,.94,1,.94,.83,.94,1,.94],
 [.91,.98,.91,.72,.91,.98,.91,.72,.91,.98,.91,.72,.91,.98,.91,.72],
 [.9,1,.86,.73,.9,1,.86,.73,.9,1,.86,.73,.9,1,.86,.73],
 [.75,.82,.72,.99,.86,.76,1,.87,.82,.96,.7,.84,.99,.7,.78,.97],
 [.83,.84,.89,.95,1,.95,.89,.84,.83,.84,.89,.95,1,.95,.89,.84],
 [.9,.9,.98,.92,.78,.9,.96,.72,.9,.9,.98,.92,.78,.9,.96,.72],
 [.73,.85,.9,1,.9,.79,.7,.93,.73,.85,.9,1,.9,.79,.7,.93],
 [.9,.93,.98,.98,.86,.75,.63,.81,.88,.81,.63,.75,.86,.98,.98,.93],
 // compass, moon, heart, butterfly, ivy, snowflake, runes, orbital
 [.67,.94,.73,.98,.67,.94,.73,.98,.67,.94,.73,.98,.67,.94,.73,.98],
 [.81,.72,.74,.83,.92,.96,1,.97,.81,.73,.65,.68,.77,.9,.98,.93],
 [.72,.84,.97,.95,.8,.67,.65,.78,.88,.78,.65,.67,.8,.95,.97,.84],
 [.72,.82,.92,.9,.73,.65,.97,1,.72,.82,.92,.9,.73,.65,.97,1],
 [.91,.8,.69,.87,.97,1,.81,.7,.91,.8,.69,.87,.97,1,.81,.7],
 [.73,.91,.98,.7,.73,.91,.98,.7,.73,.91,.98,.7,.73,.91,.98,.7],
 [.86,.76,.94,.75,.86,.76,.94,.75,.86,.76,.94,.75,.86,.76,.94,.75],
 [.9,.91,1,.91,.77,.91,1,.91,.9,.91,1,.91,.77,.91,1,.91]
];
function silhouetteIndex(item,seed){
 if(item.prototype&&FORMS.includes(item.form)){
   var map=[0,15,4,5,1,16,2,10,3,22,7,23];
   return map[FORMS.indexOf(item.form)];
 }
 var cue=crestIndex(item,seed);
 return [18,2,1,5,6,0,6,4,15,8,13,7,17,14,3,10,16,1,0,19,20,11,12,8][cue%24];
}
function contourAt(item,seed,angle){
 var family=silhouetteIndex(item,seed),outline=OUTLINES[family];
 var normalized=((angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
 var phase=normalized/(Math.PI*2)*outline.length;
 var a=Math.floor(phase),b=(a+1)%outline.length,blend=phase-a;
 // cubic easing smooths hard shoulders but preserves each characteristic silhouette.
 blend=blend*blend*(3-2*blend);
 var radius=outline[a]*(1-blend)+outline[b]*blend;
 var minor=(Math.sin(normalized*(5+(seed%4))+(seed%21)))*.012;
 var width=1+((seed>>>12)%7-3)*.011,height=1+((seed>>>18)%7-3)*.011;
 return [Math.cos(normalized)*radius*(.91+minor)*width,Math.sin(normalized)*radius*(.91+minor)*height];
}

function model(item,evolution){
 item=item||{};
 var id=String(item.id||'medal'),seed=hash(id),rng=random(seed),variant=evolution||1;
 var n=72,form=silhouetteIndex(item,seed),profile=[];
 var thickness=.09+(seed%7)*.017+variant*.021,front=.06+thickness/2,back=-thickness/2;
 var mat=material(item),colors=mat;
 var positions=[],normals=[],rgba=[],triangles=0;
 function pushTriangle(a,b,c,color){
  var ax=b[0]-a[0],ay=b[1]-a[1],az=b[2]-a[2],bx=c[0]-a[0],by=c[1]-a[1],bz=c[2]-a[2];
  var nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
  var mag=Math.hypot(nx,ny,nz)||1;nx/=mag;ny/=mag;nz/=mag;
  for(var k of [a,b,c]){positions.push(k[0],k[1],k[2]);normals.push(nx,ny,nz);rgba.push(color[0],color[1],color[2]);}
  triangles++;
 }
 function quad(a,b,c,d,col){pushTriangle(a,b,c,col);pushTriangle(a,c,d,col);}
 function contour(t){return contourAt(item,seed,t);}
 for(var k=0;k<n;k++)profile.push(contour(k*Math.PI*2/n));
 function point(index,s,z){
  var p=profile[(index+n)%n];return [p[0]*s,p[1]*s,z];
 }
 function ring(inner,outer,z0,z1,col){
  for(var j=0;j<n;j++){
   var q=(j+1)%n,a=point(j,inner,z0),b=point(q,inner,z0),c=point(q,outer,z1),d=point(j,outer,z1);
   quad(a,b,c,d,col);
  }
 }
 // The front consists of raised, physically separate enamel and metal relief rings.
 ring(.0,.33,front+.055,front+.055,colors[1]);
 ring(.33,.58,front+.055,front+.075,colors[1]);
 ring(.58,.68,front+.075,front+.09,colors[2]);
 ring(.68,.77,front+.09,front+.04,colors[0]);
 ring(.77,.9,front+.04,front+.052,colors[1]);
 ring(.9,1,front+.052,front+.10,colors[0]);
 for(var e=0;e<n;e++){
  var next=(e+1)%n;
  quad(point(e,1,front+.10),point(next,1,front+.10),point(next,1,back),point(e,1,back),colors[1]);
  pushTriangle([0,0,back],point(next,1,back),point(e,1,back),colors[1]);
 }
 function embossed(shape,s,z,depth,color){
  // Distinct actual extruded mesh relief, including beveled raised edges.
  var m=shape.length;
  if(m<3)return;
  for(var j=0;j<m;j++){
   var k=(j+1)%m,a=[shape[j][0]*s,shape[j][1]*s,z+depth],b=[shape[k][0]*s,shape[k][1]*s,z+depth];
   pushTriangle([0,0,z+depth],a,b,color);
   quad([shape[j][0]*s,shape[j][1]*s,z],[shape[k][0]*s,shape[k][1]*s,z],b,a,colors[1]);
  }
 }
 var motif=[],spikes=3+(seed%10),fold=2+((seed>>>9)%5);
 for(var i=0;i<spikes*2;i++){
  var a=(i/(spikes*2))*Math.PI*2+seed%37*.014,
    radius=(i%2===0?.46:.20)*(1+(seed%13)*.014)+((i%3)===0?.03:0);
  motif.push([Math.cos(a)*radius,Math.sin(a)*radius]);
 }
 embossed(motif,1,front+.075,.03+variant*.013,colors[2]);
 var central=[];
 for(var j=0;j<fold*2;j++){
  var a=j*Math.PI/fold,rad=(j%2?.13:.24)*(1+rng()*.26);
  central.push([Math.cos(a)*rad,Math.sin(a)*rad]);
 }
 embossed(central,1,front+.11,.07+variant*.018,colors[0]);
 // Independent geometric side motifs, crests, flanges, wings, studs.
 var finCount=3+(seed>>>8)%8;
 for(var g=0;g<finCount;g++){
  var ang=g*Math.PI*2/finCount,rad=.70+(g%2)*.13,ext=.1+rng()*.16+variant*.017;
  var X=Math.cos(ang),Y=Math.sin(ang),T=[-Y,X];
  var middle=[X*rad,Y*rad,front+.12],up=[X*(rad+ext)+T[0]*.045,Y*(rad+ext)+T[1]*.045,front+.15],
    left=[middle[0]-T[0]*.045,middle[1]-T[1]*.045,front+.12],
    right=[middle[0]+T[0]*.045,middle[1]+T[1]*.045,front+.12];
  pushTriangle(left,up,right,g%2?colors[2]:colors[0]);
  pushTriangle([left[0],left[1],front],[right[0],right[1],front],up,colors[1]);
 }
 var orbit=6+((seed>>>16)%14);
 for(var f=0;f<orbit;f++){
  var theta=2*Math.PI*f/orbit+seed%13*.07,d=.51+rng()*.035,
   x=Math.cos(theta)*d,y=Math.sin(theta)*d,z=front+.086;
  embossed([[x-.012,y-.012],[x+.012,y-.012],[x+.012,y+.012],[x-.012,y+.012]],1,z,.011,colors[2]);
 }
 // Backside engraving (different from front), visible on full rotation.
 embossed([[.22,.12],[.05,.25],[-.20,.07],[-.05,-.26],[.16,-.19]],1,back-.018,-.01,colors[0]);
 return {id:id,signature:seed.toString(36)+'-'+form+'-'+spikes+'-'+fold+'-'+finCount+'-'+variant,outline:profile,vertices:new Float32Array(positions),
  normals:new Float32Array(normals),colors:new Float32Array(rgba),triangles:triangles,form:form,depth:thickness,
  evolution:variant,prototype:!!item.prototype,modelName:FORMS[form]};
}

function chestModel(type){
 var seed=hash('chest-3d-'+type),rng=random(seed),colors=PALETTES[seed%PALETTES.length],positions=[],normals=[],rgba=[],triangles=0;
 function triangle(a,b,c,color){
  var u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  var nn=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  var length=Math.hypot.apply(null,nn)||1;nn=nn.map(q=>q/length);
  [a,b,c].forEach(function(p){positions.push.apply(positions,p);normals.push.apply(normals,nn);rgba.push.apply(rgba,color);});triangles++;
 }
 function quad(a,b,c,d,col){triangle(a,b,c,col);triangle(a,c,d,col);}
 function cube(x1,x2,y1,y2,z1,z2,color){
  var a=[x1,y1,z1],b=[x2,y1,z1],c=[x2,y2,z1],d=[x1,y2,z1],
   e=[x1,y1,z2],f=[x2,y1,z2],g=[x2,y2,z2],h=[x1,y2,z2];
  quad(e,f,g,h,color);quad(d,c,b,a,color);quad(a,b,f,e,color);
  quad(h,g,c,d,color);quad(b,c,g,f,color);quad(a,e,h,d,color);
 }
 cube(-.66,.66,-.47,.31,-.42,.42,colors[1]); // real chest volume
 cube(-.73,.73,.30,.56,-.49,.49,colors[0]); // lid, extruded volume
 cube(-.55,.55,.50,.60,-.38,.38,colors[2]); // ornate raised lid plate
 for(var edge of [-1,1]){
  cube(edge*.60-.043,edge*.60+.043,-.47,.56,-.47,.47,colors[0]);
  cube(-.67,.67,-.47,-.40,edge*.43-.035,edge*.43+.035,colors[0]);
 }
 cube(-.13,.13,-.21,.32,.44,.53,colors[0]); // clasp with raised jewel
 cube(-.09,.09,-.11,.15,.53,.61,colors[2]);
 cube(-.035,.035,-.07,.11,.61,.65,colors[0]);
 for(var i=0;i<8;i++){
  var x=-.53+i*.15;
  cube(x-.021,x+.021,-.39,-.33,.424,.455,i%2?colors[0]:colors[2]);
  cube(x-.021,x+.021,.42,.50,-.51,-.48,colors[1]);
 }
 for(var k=0;k<4;k++){
  var x=(k-1.5)*.28;
  cube(x-.05,x+.05,.57,.66,-.25,.25,k%2?colors[0]:colors[2]);
 }
 return {id:'chest-'+type,signature:seed.toString(36)+'-chest',vertices:new Float32Array(positions),normals:new Float32Array(normals),colors:new Float32Array(rgba),triangles:triangles,form:'skrzynia',
  modelName:'Skrzynia 3D',depth:.84,evolution:1,prototype:true};
}



/* Iconographic centrepieces: silhouettes follow the subject of each badge, not just its rarity. */
var CRESTS=[
 'M0-47 C-50-77 -75-19 0 43 C75-19 50-77 0-47Z',
 'M-9-51 L10-51 3-17 28-5 49 36 27 45 1 10 -19 32 -44 13 -28-1Z',
 'M-20 45 L-37 14 -10-11 8-56 28-16 44 13 20 45Z',
 'M-43 10 L-20-42 0-12 23-42 44 10 36 41 -36 41Z',
 'M-47 28 L-19-40 0-19 21-49 47 28 24 45 0 14 -23 45Z',
 'M0-53 L33-30 40 13 0 50 -40 13 -33-30Z',
 'M-3 48 C-42 22 -40-14 -12-43 C10-61 43-15 24 18 L6 38Z',
 'M0-53 L13-13 47-10 20 9 28 47 0 23 -28 47 -20 9 -47-10 -13-13Z',
 'M-43 7 L-18-6 -11-40 0-23 11-40 18-6 43 7 29 40 -29 40Z',
 'M-14-50 L14-50 14-5 43-5 43 18 14 18 14 49 -14 49 -14 18 -43 18 -43-5 -14-5Z',
 'M-41 39 L-41-39 2-29 2 40Z M5-29 L41-39 41 39 5 40Z',
 'M0-52 C31-27 36-6 5 15 L0 48 -9 8 C-40-16 -21-27 0-52Z',
 'M-32 39 C-44 6 -5-49 6-46 C30-35 43-12 32 39 L0 51Z',
 'M-46 30 L-14-34 12-5 26-41 47 30Z',
 'M0-54 L14-16 51 0 14 15 0 54 -15 15 -51 0 -15-16Z',
 'M-42 25 C-36-33 -2-39 9-18 C40-37 47 6 32 30Z',
 'M-45 0 L0-46 45 0 0 46Z',
 'M-24-46 L24-46 38-26 30 9 0 48 -30 9 -38-26Z',
 'M-45-28 L45-28 34 22 0 50 -34 22Z',
 'M0-51 C42-48 50-5 18 10 C11 34-3 49-15 49 C-42 40-49-6-25-32Z',
 'M-42-30 L-12-42 12-30 42-42 30-12 42 12 30 42 0 30 -30 42 -42 12 -30-12Z',
 'M-46 10 C-26-32 20-48 46 5 L21 42 -20 42Z',
 'M-37 37 L-37-24 0-43 37-24 37 37Z',
 'M-36 31 L-36-22 0-44 36-22 36 31 L0 49Z'
];
function crestIndex(item,seed){
 var phrase=String((item?.name||'')+' '+(item?.category||'')+' '+(item?.id||'')).toLowerCase();
 var keywords=[
 /serc|heart|zdrow|health|tęt|pulse/,/bieg|run|krok|step|sport/,
 /kryszt|crystal|gem|diament/,/koron|król|crown|elite/,
 /gór|mountain|explor|odkryw|map/,/tarc|shield|straż/,
 /liś|leaf|natur|las|forest/,/gwiazd|star|kosmo/,
 /zwyci|trophy|puchar|wyzwan|challenge/,/medy|doctor|szpital/,
 /książ|book|learn|plan|nauka/,/ogień|flame|streak|seria/,
 /wod|water|kropl|drink|hydr/,/wędrow|trail|hike/,
 /słoń|sun|dzień|pogod/,/spok|relax|odpoczy|meditat/,
 /kompas|cel|target|aim/,/diament|obsyd|metal/,
 /dom|home|family|rodzin/,/mózg|brain|myśl/,
 /przyj|friend|social|community/,/burz|lightning|energy|xp/,
 /kalendarz|calendar|daily/,/level|poziom|ranga/
 ];
 for(var i=0;i<keywords.length;i++){if(keywords[i].test(phrase))return i;}
 return seed%CRESTS.length;
}
function crestGlyph(item,seed,fill,stroke){
 var id=crestIndex(item,seed),outline=CRESTS[id];
 var symbol='<path d="'+outline+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
 if(id===0)symbol+='<path d="M-30 0H-13L-2 -20 9 20 21 0H34" stroke="'+stroke+'" stroke-width="5" fill="none"/>';
 if(id===2||id===17)symbol+='<path d="M-15 9 0-18 17 9 0 33Z" fill="'+stroke+'" opacity=".6"/>';
 if(id===14||id===7)symbol+='<circle cx="0" cy="0" r="15" fill="'+stroke+'"/>';
 return '<g>'+symbol+'</g>';
}

var thumbCache=new Map();
function thumbnail(item){
 item=item||{};var id=String(item.id||'preview'),isLocked=!item.earned&&!item.prototype,rarity=item.rarity||'common';
 var key=id+'|'+rarity+'|'+(isLocked?'locked':'earned');
 if(thumbCache.has(key))return thumbCache.get(key);
 var seed=hash(id),rng=random(seed^0xf16a),mat=material(item),outline=Array.from({length:72},function(_,i){return contourAt(item,seed,i*Math.PI*2/72);}),signature=seed.toString(36)+'-'+silhouetteIndex(item,seed)+'-'+(3+seed%10)+'-1';
 function hex(c){return '#'+c.map(function(v){return Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0');}).join('');}
 var border=hex(mat[0]),inner=hex(mat[1]),shine=hex(mat[2]),uid='thumb-'+seed.toString(36),
     path=outline.map(function(p){return (p[0]*91).toFixed(1)+','+(p[1]*91).toFixed(1);}).join(' ');
 var band=outline.map(function(p){return (p[0]*76).toFixed(1)+','+(p[1]*76).toFixed(1);}).join(' ');
 // Material engraving differs by model, while the main centerpiece comes from its subject.
 var spokes=3+(seed%8),motif=[];
 for(var i=0;i<spokes*2;i++){
  var theta=i*Math.PI/spokes,rad=i%2===0?52:43;
  motif.push((Math.cos(theta)*rad).toFixed(1)+','+(Math.sin(theta)*rad).toFixed(1));
 }
 var texture='';
 for(var i=0;i<13;i++){
  var angle=i*Math.PI*2/13,cx=64*Math.cos(angle),cy=64*Math.sin(angle);
  texture+='<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+(1.4+rng()*2.5).toFixed(1)+'" fill="'+shine+'" opacity=".75"/>';
 }
 var out='<svg class="hgp-medal-svg hgb3d-thumbnail '+(isLocked?'is-locked':'is-earned')+'" viewBox="-110 -110 220 220" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+escapeHtml(item.name||'Odznaka')+'" data-medal-category="'+escapeHtml(item.category||'badges')+'" data-model-geometry="'+escapeHtml(signature)+'">'+
 '<defs><linearGradient id="'+uid+'-m" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+shine+'"/><stop offset=".35" stop-color="'+border+'"/><stop offset=".65" stop-color="'+inner+'"/><stop offset="1" stop-color="'+border+'"/></linearGradient></defs>'+
 '<polygon points="'+path+'" transform="translate(0 5)" fill="#000" opacity=".6"/>'+
 '<polygon points="'+path+'" fill="url(#'+uid+'-m)" stroke="'+shine+'" stroke-width="2"/>'+
 '<polygon points="'+band+'" fill="'+inner+'" stroke="'+shine+'" stroke-width="3.5"/>'+
 '<circle r="57" fill="none" stroke="'+border+'" stroke-width="2.5" opacity=".82"/>'+
 texture+
 '<polygon points="'+motif.join(' ')+'" fill="'+border+'" fill-opacity=".4" stroke="'+shine+'" stroke-width="1.6" opacity=".72"/>'+
 '<circle r="40" fill="'+inner+'" stroke="'+shine+'" stroke-width="3.5"/>'+
 '<g transform="scale(.67)">'+crestGlyph(item,seed,shine,inner)+'</g>'+
 '<text x="0" y="-72" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" letter-spacing="2" fill="'+shine+'">HEALTHGO</text>'+
 '<text x="0" y="91" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="'+shine+'">'+escapeHtml(('000'+(seed%1000)).slice(-3))+'</text></svg>';
 if(thumbCache.size>380)thumbCache.clear();
 thumbCache.set(key,out);return out;
}

var VSHADER='attribute vec3 p;attribute vec3 n;attribute vec3 col;uniform vec3 rot;uniform float zoom;uniform float aspect;varying vec3 shade;varying vec3 norm;varying vec3 pos;void main(){float cx=cos(rot.x),sx=sin(rot.x),cy=cos(rot.y),sy=sin(rot.y);vec3 u=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);vec3 v=vec3(u.x*cy+u.z*sy,u.y,-u.x*sy+u.z*cy);vec3 un=vec3(n.x,n.y*cx-n.z*sx,n.y*sx+n.z*cx);norm=vec3(un.x*cy+un.z*sy,un.y,-un.x*sy+un.z*cy);shade=col;pos=v;float z=3.3-v.z;gl_Position=vec4(v.x*zoom/z*1.8/aspect,v.y*zoom/z*1.8,v.z/4.,1.); }';
var FSHADER='precision mediump float;varying vec3 shade;varying vec3 norm;varying vec3 pos;uniform float lit;uniform vec3 lightSource;void main(){vec3 N=normalize(norm);vec3 L=normalize(lightSource);float diff=.29+.72*abs(dot(N,L));vec3 V=normalize(vec3(-pos.x*.1,-pos.y*.1,1.));float spec=pow(max(dot(reflect(-L,N),V),0.),26.)*.64;vec3 col=shade*diff+vec3(spec, spec*.96, spec*.82)+shade*.09*lit;gl_FragColor=vec4(clamp(pow(col,vec3(.88)),0.,1.),1.);}';
function shader(gl,type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(gl){var p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VSHADER));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FSHADER));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function context(canvas,mesh){
 var gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});
 if(!gl)return null;
 var prog=program(gl);gl.useProgram(prog);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
 var buffers=[];
 for(var data of [['p',mesh.vertices],['n',mesh.normals],['col',mesh.colors]]){
  var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data[1],gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(prog,data[0]);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);buffers.push(buf);
 }
 var rot=gl.getUniformLocation(prog,'rot'),zoomLoc=gl.getUniformLocation(prog,'zoom'),aspectLoc=gl.getUniformLocation(prog,'aspect'),litLoc=gl.getUniformLocation(prog,'lit'),lightLoc=gl.getUniformLocation(prog,'lightSource');
 function draw(rx,ry,zoom,light){
  var w=canvas.clientWidth||300,h=canvas.clientHeight||300,dpr=Math.min(host.devicePixelRatio||1,2);
  var pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
  gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.uniform3f(rot,rx,ry,0);gl.uniform1f(zoomLoc,zoom);gl.uniform1f(aspectLoc,pw/Math.max(1,ph));gl.uniform1f(litLoc,Math.sin(ry)*.3+.8);
  var lights=[[.5,.8,1.1],[-.9,.4,1.3],[.3,-.9,1.5]],direction=lights[(light||0)%lights.length];gl.uniform3f(lightLoc,direction[0],direction[1],direction[2]);
  gl.drawArrays(gl.TRIANGLES,0,mesh.vertices.length/3);
 }
 return {draw:draw,release:function(){buffers.forEach(b=>gl.deleteBuffer(b));gl.deleteProgram(prog);}};
}
var active=null;
function close(){
 if(!active)return;
 var old=active;active=null;old.stop();
 if(old.root&&old.root.parentNode)old.root.remove();
 document.body.classList.remove('hgb3d-open');
 if(old.focus&&old.focus.focus)try{old.focus.focus({preventScroll:true});}catch(_){}
}
function stageLabel(stage){return ['Nieodkryta','Brąz','Srebro','Złoto'][stage]||'Brąz';}
function achievedStage(item){
 if(!item.earned)return 0;
 var count=Number(item.categoryEarnedCount)||1;
 return count>=10?3:count>=3?2:1;
}
function open(item){
 if(typeof document==='undefined'||!document.body)return false;
 close();item=item||{id:'preview',name:'Odznaka',earned:false};
 var stage=achievedStage(item),visualStage=Math.max(1,stage),mesh=item.previewChest?chestModel(item.chestType||'daily'):model(item,visualStage);
 var root=document.createElement('div');root.id='hgBadge3DInspect';root.className='hgb3d-overlay';root.setAttribute('role','presentation');
 var previous=document.activeElement,auto=false,raf=0,zoom=1.6,rx=-.24,ry=.35,drag=null,touches=new Map(),renderer=null,disposed=false,light=0;
 root.innerHTML='<div class="hgb3d-dialog" role="dialog" aria-modal="true" aria-labelledby="hgb3dTitle">'+
 '<div class="hgb3d-toolbar"><div><small>HEALTHGO · BADGE INSPECT 3D</small><h2 id="hgb3dTitle">'+escapeHtml(item.name||'Model odznaki')+'</h2></div>'+
 '<button type="button" data-hgb3d="close" aria-label="Zamknij podgląd 3D">×</button></div>'+
 '<div class="hgb3d-stage" data-hgb3d-light="0"><div class="hgb3d-light"></div>'+ 
 '<div class="hgb3d-glass-case" aria-hidden="true"><span class="hgb3d-glass-top"></span><span class="hgb3d-glass-column"></span><span class="hgb3d-glass-base"></span></div>'+ 
 '<canvas class="hgb3d-canvas" aria-label="Interaktywny model 3D, przeciągnij palcem, aby go obrócić"></canvas>'+ 
 '<div class="hgb3d-pedestal" aria-hidden="true"><span>HEALTHGO · COLLECTOR</span></div>'+
 '<div class="hgb3d-fallback" hidden></div><div class="hgb3d-stage-label">MODEL '+escapeHtml(mesh.signature.toUpperCase())+'</div></div>'+
 '<div class="hgb3d-details"><span>'+escapeHtml(item.prototype?'Katalog modeli · projekt':item.earned?'Zdobyta odznaka':'Nieodkryta odznaka')+'</span>'+
 '<span>Ewolucja: '+stageLabel(stage)+'</span><span>Forma: '+escapeHtml(mesh.modelName)+'</span></div>'+
 '<p class="hgb3d-note">'+(item.previewChest?'Dotknij, aby obrócić prawdziwy model przestrzenny skrzyni, obejrzeć wieko, boki i zapięcie. Nie trzeba otwierać ani odbierać nagrody.':'Przesuń palcem, aby obracać o 360°. Rozsuń dwa palce, aby powiększyć. Każdy model ma własną bryłę, relief i grubość. Etapy ewolucji zależą wyłącznie od zdobytych odznak w tej kategorii.')+'</p>'+
 '<div class="hgb3d-controls"><button type="button" data-hgb3d="left">↶ Obróć</button><button type="button" data-hgb3d="right">Obróć ↷</button>'+
 '<button type="button" data-hgb3d="zoomout" aria-label="Oddal model">−</button><button type="button" data-hgb3d="zoomin" aria-label="Przybliż model">+</button>'+
 '<button type="button" data-hgb3d="auto" aria-pressed="false">Autoobrót</button>'+ 
 '<button type="button" data-hgb3d="light" aria-label="Zmień oświetlenie gabloty">Światło ✦</button>'+ 
 '<button type="button" data-hgb3d="photo" aria-label="Zapisz zdjęcie modelu 3D">Zapisz PNG</button>'+ 
 '<button type="button" data-hgb3d="reset">Reset</button>'+ 
 ((!item.prototype&&!item.previewChest&&item.earned)?'<button type="button" data-hgb3d="showcase">Do gabloty</button>':'')+ 
 '</div><p class="hgb3d-feedback" role="status" aria-live="polite"></p>'+
 (item.prototype?'<p class="hgb3d-note">To prototyp modelu do obejrzenia. Nie jest zdobytą odznaką i nie przyznaje XP.</p>':'')+'</div>';
 document.body.appendChild(root);document.body.classList.add('hgb3d-open');
 var canvas=root.querySelector('canvas'),fallback=root.querySelector('.hgb3d-fallback');
 function render(){if(disposed)return;if(renderer){renderer.draw(rx,ry,zoom,light);}else if(fallback){fallback.style.transform='perspective(700px) rotateX('+(-rx*180/Math.PI)+'deg) rotateY('+(ry*180/Math.PI)+'deg) scale('+clamp(zoom/1.6,.75,1.55)+')';}}
 try{renderer=context(canvas,mesh);}catch(err){renderer=null;host.console?.warn?.('HealthGo 3D fallback',err);}
 if(!renderer){
  canvas.hidden=true;fallback.hidden=false;
  fallback.innerHTML=host.HealthGoMedalArt?.render(item,true)||'Podgląd modelu';
  root.querySelector('.hgb3d-note').textContent='Przeglądarka nie obsługuje WebGL. Dostępny jest zastępczy podgląd 2D obracany gestem.';
 }
 var reduced=!!(host.matchMedia&&host.matchMedia('(prefers-reduced-motion: reduce)').matches);
 function tick(){if(disposed||!auto)return;ry+=.012;render();raf=host.requestAnimationFrame(tick);}
 function turnOn(){if(reduced)return;auto=true;root.querySelector('[data-hgb3d="auto"]').setAttribute('aria-pressed','true');raf=host.requestAnimationFrame(tick);}
 function turnOff(){auto=false;host.cancelAnimationFrame?.(raf);root.querySelector('[data-hgb3d="auto"]').setAttribute('aria-pressed','false');}
 function press(ev){
  if(!ev.target.closest('[data-hgb3d]'))return;
  var btn=ev.target.closest('[data-hgb3d]'),action=btn.dataset.hgb3d;
  if(action==='close'){close();return;}if(action==='left')ry-=.35;
  if(action==='right')ry+=.35;if(action==='zoomin')zoom=clamp(zoom+.24,.85,3.4);
  if(action==='zoomout')zoom=clamp(zoom-.24,.85,3.4);
  if(action==='reset'){rx=-.24;ry=.35;zoom=1.6;light=0;root.querySelector('.hgb3d-stage').dataset.hgb3dLight='0';turnOff();}
  if(action==='light'){light=(light+1)%3;root.querySelector('.hgb3d-stage').dataset.hgb3dLight=String(light);}
  if(action==='showcase'){
   var ok=host.HealthGoProfile?.pinMedal?.(item.id);
   root.querySelector('.hgb3d-feedback').textContent=ok?'Dodano odznakę do Twojej gabloty.':'Możesz przypiąć tylko własne zdobyte odznaki; maksymalnie sześć.';
  }
  if(action==='photo'){
   if(!renderer){root.querySelector('.hgb3d-feedback').textContent='Zapis PNG wymaga WebGL na tym urządzeniu.';return;}
   try{render();var file=canvas.toDataURL('image/png');var link=document.createElement('a');link.href=file;link.download='healthgo-odznaka.png';document.body.appendChild(link);link.click();link.remove();root.querySelector('.hgb3d-feedback').textContent='Zapisano obraz odznaki.';}catch(e){root.querySelector('.hgb3d-feedback').textContent='Nie udało się zapisać obrazu na tym urządzeniu.';}return;
  }
  if(action==='auto'){auto?turnOff():turnOn();return;}render();
 }
 function pointerDown(ev){turnOff();try{canvas.setPointerCapture(ev.pointerId);}catch(_){}touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});}
 function pointerMove(ev){
  if(!touches.has(ev.pointerId))return;
  var p=touches.get(ev.pointerId),dx=ev.clientX-p.x,dy=ev.clientY-p.y;
  touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(touches.size===1){ry+=dx*.011;rx=clamp(rx+dy*.011,-1.45,1.45);}
  else if(touches.size===2){
   var other=Array.from(touches.values()).find(x=>x!==touches.get(ev.pointerId));
   if(other){var oldDist=Math.hypot(p.x-other.x,p.y-other.y),newDist=Math.hypot(ev.clientX-other.x,ev.clientY-other.y);zoom=clamp(zoom+(newDist-oldDist)*.01,.85,3.4);}
  }
  render();
 }
 function pointerUp(ev){touches.delete(ev.pointerId);}
 function wheel(ev){ev.preventDefault();zoom=clamp(zoom-ev.deltaY*.002,.85,3.4);render();}
 function keys(ev){
  if(ev.key==='Escape'){ev.preventDefault();close();return;}
  if(ev.key==='ArrowLeft'||ev.key==='ArrowRight'){ev.preventDefault();ry+=(ev.key==='ArrowLeft'?-.2:.2);render();}
  if(ev.key!=='Tab')return;
  var focus=root.querySelectorAll('button:not([disabled])');
  if(focus.length&&ev.shiftKey&&document.activeElement===focus[0]){ev.preventDefault();focus[focus.length-1].focus();}
  else if(focus.length&&!ev.shiftKey&&document.activeElement===focus[focus.length-1]){ev.preventDefault();focus[0].focus();}
 }
 root.addEventListener('click',press);root.addEventListener('keydown',keys);
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);
 canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('wheel',wheel,{passive:false});
 root.addEventListener('click',function(ev){if(ev.target===root)close();});
 function stop(){
  disposed=true;turnOff();if(renderer)renderer.release();
 }
 active={root:root,stop:stop,focus:previous,mesh:mesh};render();
 var x=root.querySelector('[data-hgb3d="close"]');if(x)x.focus({preventScroll:true});
 return true;
}
host.HealthGoBadge3D=Object.freeze({catalog:CATALOG,definition:definition,model:model,thumbnail:thumbnail,chestModel:chestModel,open:open,openChest:function(type){return open({id:'chest-'+String(type||'daily'),name:'Skrzynia HealthGo · '+String(type||'daily'),previewChest:true,chestType:String(type||'daily'),prototype:true,rarity:'epic'});},close:close,achievedStage:achievedStage});
})(window);