/* HealthGo Collector Room 2.6 — six verified showcase medals, customizable museum themes.
 * Opens from own/visible friend profiles. No health, position or email data is exported. */
(function(host){
 'use strict';
 var current=null;
 var THEMES={
  emerald:{title:'Szmaragdowy skarbiec',hint:'Podświetlane szkło i zielone światło'},
  aurora:{title:'Polarna zorza',hint:'Błękitne kryształy i chłodne światło'},
  royal:{title:'Królewska sala',hint:'Złote kolumny i ciepłe reflektory'}
 };
 function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
 function account(){return String(host.HealthGoServices?.state?.uid||'');}
 function themeKey(){return 'healthgo.collector.room.theme.'+encodeURIComponent(account());}
 function savedTheme(){
  try{var t=localStorage.getItem(themeKey());return Object.prototype.hasOwnProperty.call(THEMES,t)?t:'emerald';}catch(_){return 'emerald';}
 }
 function uniqueEarned(items){
  var ids=new Set();
  return (Array.isArray(items)?items:[]).filter(function(x){
   var id=x&&String(x.id||x.code||'');if(!id||ids.has(id)||x.earned!==true)return false;
   ids.add(id);return true;
  }).slice(0,6).map(function(x){
   return {id:String(x.id||x.code),name:String(x.name||'Odznaka').slice(0,100),rarity:String(x.rarity||'common'),earned:true,category:x.category||'badges'};
  });
 }
 function figure(item){
  var badge=host.HealthGoBadge3D?.thumbnail(item)||host.HealthGoMedalArt?.render(item,false);
  return badge||'<span class="hgcr-placeholder">✦</span>';
 }
 function roomHTML(){
  if(!current)return '';
  var state=current,sets=Object.keys(THEMES).map(function(id){
   return '<button type="button" data-hgcr-theme="'+id+'" class="'+(state.theme===id?'active':'')+'" aria-pressed="'+(state.theme===id)+'">'+safe(THEMES[id].title)+'</button>';
  }).join('');
  var tiles=Array.from({length:6},function(_,i){
   var item=state.items[i];
   return item?
    '<button class="hgcr-podium" type="button" data-hgcr-medal="'+safe(item.id)+'" aria-label="Obejrzyj odznakę 3D: '+safe(item.name)+'">'+
    '<span class="hgcr-spotlight" aria-hidden="true"></span><span class="hgcr-podium-art">'+figure(item)+'</span>'+
    '<span class="hgcr-podium-dais" aria-hidden="true"></span>'+
    '<span class="hgcr-medal-label">'+safe(item.name)+'</span><small>INSPECT 360°</small></button>':
    '<div class="hgcr-podium hgcr-empty"><span class="hgcr-spotlight" aria-hidden="true"></span>'+
    '<span class="hgcr-empty-medal">✧</span><span class="hgcr-podium-dais" aria-hidden="true"></span>'+
    '<span class="hgcr-medal-label">Wolna gablota</span><small>Wybierz zdobyte odznaki</small></div>';
  }).join('');
  return '<div class="hgcr-dialog" role="dialog" aria-modal="true" aria-labelledby="hgcrTitle">'+
   '<header class="hgcr-toolbar"><div><small>HEALTHGO COLLECTOR EDITION</small><h2 id="hgcrTitle">Pokój Kolekcjonera</h2></div>'+
   '<button type="button" data-hgcr-close="1" aria-label="Zamknij pokój kolekcjonera">×</button></header>'+
   '<div class="hgcr-scroll"><div class="hgcr-lead"><span>EKSKLUZYWNA GABLOTA 3D</span><h3>'+safe(state.owner)+'</h3>'+
   '<p>'+state.items.length+' z 6 miejsc · wyłącznie zdobyte i wybrane odznaki</p></div>'+
   '<div class="hgcr-theme-picker" role="group" aria-label="Wygląd pokoju">'+sets+'</div>'+
   '<div class="hgcr-room hgcr-theme-'+state.theme+'"><div class="hgcr-roof"></div>'+
   '<div class="hgcr-room-horizon" aria-hidden="true"></div>'+
   '<div class="hgcr-room-tiles">'+tiles+'</div><div class="hgcr-floor"></div></div>'+
   '<p class="hgcr-hint">Dotknij medalu w gablocie, aby obejrzeć jego obracany model 3D. '+safe(THEMES[state.theme].hint)+'.</p>'+
   (state.self?'<button type="button" class="hgcr-edit" data-hgcr-edit="1">Edytuj gablotę w profilu</button>':'<p class="hgcr-hint">Oglądasz udostępnioną przez użytkownika kolekcję.</p>')+
   '<button type="button" class="hgcr-snapshot" data-hgcr-photo="1">Zapisz kartę kolekcji (SVG)</button>'+
   '<p class="hgcr-privacy">Zapisana karta zawiera jedynie nazwy wybranych odznak i ich grafiki. Nie zawiera danych zdrowotnych ani lokalizacji.</p>'+
   '</div></div>';
 }
 function close(){
  if(!current)return;
  var prior=current.previous,el=current.el;
  current=null;
  if(el)el.remove();
  document.body.classList.remove('hgcr-open');
  if(prior&&typeof prior.focus==='function')try{prior.focus({preventScroll:true});}catch(_){}
 }
 function savePicture(){
  if(!current)return;
  var theme=current.theme,items=current.items,ink=theme==='royal'?'#ffdc91':theme==='aurora'?'#a4dbff':'#9af4c9';
  var sx=820,sy=570;
  // All badge artwork is original app SVG and only locally selected collectibles.
  var ornaments=items.map(function(item,i){
   var x=70+(i%3)*250,y=115+Math.floor(i/3)*205;
   var art=figure(item).replace(/^<svg\b/,'<svg x="'+(x+40)+'" y="'+(y+16)+'" width="135" height="135"');
   return '<rect x="'+x+'" y="'+y+'" width="220" height="182" rx="18" fill="#193d31" stroke="'+ink+'" stroke-opacity=".62"/>'+
    '<ellipse cx="'+(x+110)+'" cy="'+(y+150)+'" rx="82" ry="13" fill="#070f0c" stroke="'+ink+'" stroke-opacity=".5"/>'+art+
    '<text x="'+(x+110)+'" y="'+(y+172)+'" fill="#eafff2" font-family="Arial" font-size="12" text-anchor="middle">'+safe(item.name).slice(0,32)+'</text>';
  }).join('');
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+sx+'" height="'+sy+'" viewBox="0 0 '+sx+' '+sy+'">'+
   '<defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#07130f"/><stop offset=".55" stop-color="#143b2e"/><stop offset="1" stop-color="#040d0b"/></linearGradient></defs>'+
   '<rect width="'+sx+'" height="'+sy+'" fill="url(#bg)"/><rect x="12" y="12" width="796" height="546" rx="20" fill="none" stroke="'+ink+'" stroke-width="2"/>'+
   '<text x="38" y="58" fill="'+ink+'" font-family="Arial" font-size="25" font-weight="bold">HealthGo · Moja Gablota</text>'+
   '<text x="38" y="82" fill="#cbead9" font-family="Arial" font-size="14">'+safe(current.owner).slice(0,60)+'</text>'+
   ornaments+'<text x="410" y="545" font-family="Arial" font-size="12" text-anchor="middle" fill="#8bc5a4">HealthGo Collector Edition · wybrane odznaki</text></svg>';
  try{
   var blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
   var a=document.createElement('a');a.href=url;a.download='healthgo-gablota.svg';a.style.display='none';
   document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},3000);
  }catch(e){host.console?.warn?.('Cannot export collector card',e);}
 }
 function click(event){
  if(!current)return;
  var b=event.target.closest('button');
  if(event.target===current.el){close();return;}
  if(!b)return;
  if(b.dataset.hgcrClose){close();return;}
  var selected=b.dataset.hgcrTheme;
  if(selected&&Object.prototype.hasOwnProperty.call(THEMES,selected)){
   current.theme=selected;if(current.self)try{localStorage.setItem(themeKey(),selected);}catch(_){}
   current.el.innerHTML=roomHTML();return;
  }
  var id=b.dataset.hgcrMedal;
  if(id){
   var medal=current.items.find(function(x){return x.id===id;});
   if(medal)host.HealthGoBadge3D?.open(medal);
   return;
  }
  if(b.dataset.hgcrEdit){close();host.HealthGoProfile?.open('edit');return;}
  if(b.dataset.hgcrPhoto)savePicture();
 }
 function open(opts){
  opts=opts||{};
  if(typeof document==='undefined'||!document.body)return false;
  close();
  var data=uniqueEarned(opts.items);
  var el=document.createElement('section');
  el.id='hgCollectorRoom';el.className='hgcr-overlay';
  var previous=document.activeElement;
  current={el:el,owner:String(opts.owner||'Kolekcja HealthGo'),items:data,self:!!opts.self,theme:opts.self?savedTheme():'emerald',previous:previous};
  el.addEventListener('click',click);
  el.addEventListener('keydown',function(ev){
   if(ev.key==='Escape'){ev.preventDefault();close();return;}
   if(ev.key!=='Tab')return;
   var choices=Array.from(el.querySelectorAll('button:not([disabled])'));
   if(!choices.length)return;
   if(ev.shiftKey&&document.activeElement===choices[0]){ev.preventDefault();choices[choices.length-1].focus();}
   else if(!ev.shiftKey&&document.activeElement===choices[choices.length-1]){ev.preventDefault();choices[0].focus();}
  });
  el.innerHTML=roomHTML();
  document.body.appendChild(el);document.body.classList.add('hgcr-open');
  el.querySelector('[data-hgcr-close]')?.focus({preventScroll:true});
  return true;
 }
 host.HealthGoCollectorRoom=Object.freeze({open:open,close:close,uniqueEarned:uniqueEarned,themes:Object.keys(THEMES)});
})(window);