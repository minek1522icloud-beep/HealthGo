/* HealthGo 2.1 — free profile cosmetics linked to earned achievements.
 * Visual gifts are saved per account on this device. No payments, paid boxes,
 * trading, real-world value or client-awarded XP. */
(function(){
'use strict';
var Services=window.HealthGoServices, Engine=window.HealthGoEngine, Supabase=window.HealthGoSupabase;
if(!Services||!Engine)return;
var STICKERS=[
 {id:'mint-star',name:'Miętowa gwiazda',symbol:'✦',tone:'mint'},
 {id:'orbit',name:'Kosmiczna orbita',symbol:'◎',tone:'blue'},
 {id:'fire',name:'Płomień energii',symbol:'✹',tone:'orange'},
 {id:'clover',name:'Czterolistna koniczyna',symbol:'❖',tone:'green'},
 {id:'crown',name:'Złota korona',symbol:'♛',tone:'gold'},
 {id:'spark',name:'Błysk odkrywcy',symbol:'✧',tone:'purple'},
 {id:'sun',name:'Słoneczny znak',symbol:'☼',tone:'coral'},
 {id:'bolt',name:'Błyskawica',symbol:'ϟ',tone:'blue'}
];
var STICKER_THEMES=[
 ['Arktyczna','blue',['❄','✦','✧','☄','◈','✩']],
 ['Kosmiczna','purple',['✧','☾','✶','☄','✦','✺']],
 ['Szmaragdowa','green',['❖','✳','✾','✴','❃','✽']],
 ['Ognista','orange',['✹','✸','ϟ','✷','★','✧']],
 ['Królewska','gold',['♛','♜','♞','♟','✦','♔']],
 ['Morska','blue',['≈','◈','❉','✿','✧','✺']],
 ['Neonowa','mint',['✦','✧','✷','✸','✹','✺']],
 ['Słoneczna','coral',['☼','✺','✹','❂','✸','✴']],
 ['Leśna','green',['❁','❀','✿','✾','❖','✳']],
 ['Cyber','purple',['ϟ','◇','◉','✦','✴','◎']],
 ['Pustynna','gold',['☀','◆','❖','✴','✧','❂']],
 ['Galaktyczna','mint',['☄','✵','✷','✧','☾','✦']]
];
STICKER_THEMES.forEach(function(theme,group){
 theme[2].forEach(function(symbol,i){
  STICKERS.push({id:'s'+String(group*6+i+1).padStart(2,'0'),name:theme[0]+' #'+(i+1),symbol:symbol,tone:theme[1]});
 });
});
function randomInt(size){
 if(typeof crypto!=='undefined'&&crypto.getRandomValues){
  var values=new Uint32Array(1);crypto.getRandomValues(values);return values[0]%size;
 }
 return Math.floor(Math.random()*size);
}
var WALLPAPERS=[
 {id:'aurora',name:'Miętowa zorza'},
 {id:'nebula',name:'Kosmiczna mgławica'},
 {id:'sunset',name:'Złoty zachód'},
 {id:'forest',name:'Szmaragdowy las'},
 {id:'violet',name:'Fioletowy puls'},
 {id:'arctic',name:'Arktyczny blask'}
];
var owner='',data=empty(),lastReveal=null;
var starter=null,starterOwner='',starterLoading=false,starterBusy=false;
var animating=null,skipRequested=false,revealTimer=null;
function rerender(){if(window.HealthGoPackPro&&window.HealthGoPackPro.render)window.HealthGoPackPro.render();}
function cancelTimer(){if(revealTimer&&typeof clearTimeout==='function')clearTimeout(revealTimer);revealTimer=null;}
function reveal(){
 if(!animating||starterBusy)return false;
 cancelTimer();lastReveal=animating;animating=null;skipRequested=false;rerender();return true;
}
function startAnimation(prize){
 cancelTimer();animating=prize;
 if(skipRequested)reveal();
 else revealTimer=setTimeout(reveal,1800);
}
function saveStarterResult(response){
 if(!response||!response.opened)return false;
 if(!['sticker','wallpaper'].includes(response.reward_kind))return false;
 if(response.reward_kind==='sticker'&&!sticker(response.reward_item))return false;
 if(response.reward_kind==='wallpaper'&&!wallpaper(response.reward_item))return false;
 var next=normalize(data);
 next.claimed.starter={kind:response.reward_kind,item:response.reward_item,chest:true};
 return save(next);
}
function loadStarter(){
 sync();
 if(!owner||!Supabase?.db||starterOwner===owner||starterLoading)return;
 starterOwner=owner;starterLoading=true;
 var uid=owner;
 Supabase.db.rpc('healthgo_starter_status',{}).then(function(status){
  if(uid!==owner)return;
  starter=status||null;
  if(status&&status.opened)saveStarterResult(status);
 }).catch(function(err){
  if(uid===owner){starter={error:'Nie udało się pobrać skrzyni powitalnej.'};console.warn('HealthGo starter:',err);}
 }).finally(function(){if(uid===owner){starterLoading=false;rerender();}});
}
async function openStarter(){
 sync();if(!owner||!Supabase?.db||starterBusy)return false;
 starterBusy=true;skipRequested=false;animating={kind:'sticker',item:'mint-star'};rerender();
 var uid=owner;
 try{
  var prize=await Supabase.db.rpc('healthgo_starter_open',{});
  if(uid!==owner)return false;
  starter=prize;
  if(!saveStarterResult(prize))throw Error('Nie udało się zapisać skrzyni.');
  starterBusy=false;
  startAnimation({kind:prize.reward_kind,item:prize.reward_item,chest:true});
  rerender();return true;
 }catch(err){
  if(uid===owner){animating=null;starter={error:err.message||'Błąd otwierania skrzyni'};rerender();}
  return false;
 }finally{starterBusy=false;}
}
function starterBanner(){
 sync();
 if(!owner||!starter||!starter.available)return '';
 return '<section class="hgr-starter-banner"><div class="hgr-starter-star" aria-hidden="true">✦</div><div><strong>Twoja pierwsza darmowa skrzynia!</strong><span>Prezent powitalny możesz odebrać tylko raz na konto.</span></div><button type="button" data-action="gift-starter-open">Otwórz skrzynię</button></section>';
}

function empty(){return {version:1,claimed:{},sticker:'',wallpaper:''};}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function hash(v){var h=2166136261,s=String(v||'');for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function sticker(id){return STICKERS.find(function(x){return x.id===id;})||null;}
function wallpaper(id){return WALLPAPERS.find(function(x){return x.id===id;})||null;}
function normalize(raw){
 var out=empty();if(!raw||typeof raw!=='object')return out;
 if(raw.claimed&&typeof raw.claimed==='object'&&!Array.isArray(raw.claimed)){
  Object.keys(raw.claimed).slice(0,300).forEach(function(id){
   var value=raw.claimed[id];
   if(id.length>120||!value||!['sticker','wallpaper'].includes(value.kind))return;
   if(value.kind==='sticker'&&!sticker(value.item))return;
   if(value.kind==='wallpaper'&&!wallpaper(value.item))return;
   out.claimed[id]={kind:value.kind,item:value.item,chest:value.chest===true};
  });
 }
 out.sticker=sticker(raw.sticker)?raw.sticker:'';
 out.wallpaper=wallpaper(raw.wallpaper)?raw.wallpaper:'';
 return out;
}
function storageKey(){return owner?'healthgo.rewards.v1.'+encodeURIComponent(owner):null;}
function sync(){
 var uid=String(Services.state.uid||'').trim();
 if(uid===owner)return;
 owner=uid;data=empty();lastReveal=null;starter=null;starterOwner='';starterLoading=false;animating=null;skipRequested=false;cancelTimer();
 if(owner){try{data=normalize(JSON.parse(localStorage.getItem(storageKey())||'null'));}catch(_){}}
}
function save(next){
 if(!owner)return false;
 try{localStorage.setItem(storageKey(),JSON.stringify(next));data=next;return true;}catch(e){console.warn('HealthGo rewards: zapis lokalny nieudany',e);return false;}
}
function earned(){
 try{return Services.state.engine?Engine.viewAchievements(Services.state.engine).filter(function(x){return x.earned===true&&typeof x.id==='string';}):[];}
 catch(_){return [];}
}
function freeGiftKind(id){return hash('healthgo-free-gift:'+id)%3===0?'sticker':'chest';}
function rewardOf(id){
 var gift=freeGiftKind(id),kind=gift==='sticker'?'sticker':(randomInt(4)===0?'wallpaper':'sticker');
 var choices=kind==='sticker'?STICKERS:WALLPAPERS;
 return {kind:kind,item:choices[randomInt(choices.length)].id,chest:gift==='chest'};
}
function owned(kind,id){
 return Object.keys(data.claimed).some(function(key){var r=data.claimed[key];return r.kind===kind&&r.item===id;});
}
function stickerHtml(id){
 var info=sticker(id);
 return info?'<span class="hgr-sticker hgr-tone-'+info.tone+'" aria-label="'+escapeHtml(info.name)+'"><span>'+info.symbol+'</span></span>':'';
}
function wallpaperHtml(id){
 var info=wallpaper(id);
 return info?'<span class="hgr-wallpaper hgr-wallpaper-'+info.id+'" aria-label="'+escapeHtml(info.name)+'"></span>':'';
}
function infoFor(reward){return reward.kind==='sticker'?sticker(reward.item):wallpaper(reward.item);}
function countAvailable(){sync();return earned().filter(function(x){return !data.claimed[x.id];}).length+(starter&&starter.available?1:0);}
function cardFor(gift){
 var claimed=data.claimed[gift.id],kind=freeGiftKind(gift.id);
 return '<div class="hgr-gift-card">'+
  '<div class="hgr-gift-figure '+(claimed?'hgr-gift-claimed':'')+'">'+(kind==='chest'?'<span class="hgr-chest-art">✦<span>HG</span></span>':stickerHtml('mint-star'))+'</div>'+
  '<div class="hgr-gift-copy"><strong>'+escapeHtml(kind==='chest'?'Skrzynia osiągnięcia':'Naklejka za osiągnięcie')+'</strong><small>Za: '+escapeHtml(gift.name||'osiągnięcie')+'</small>'+
  '<small>'+(claimed?'Odebrano · '+escapeHtml((infoFor(claimed)||{}).name||'Nagroda'):kind==='chest'?'W środku: tapeta albo naklejka':'Darmowa naklejka profilowa')+'</small></div>'+
  (claimed?'<span class="hgr-gift-state">Odebrane</span>':'<button type="button" class="hgr-open" data-action="gift-open" data-id="'+escapeHtml(gift.id)+'">'+(kind==='chest'?'Otwórz':'Odbierz')+'</button>')+'</div>';
}
function rewardCard(item,kind){
 var isEquipped=kind==='sticker'?data.sticker===item.id:data.wallpaper===item.id;
 return '<div class="hgr-cosmetic-card"><div class="hgr-cosmetic-art">'+(kind==='sticker'?stickerHtml(item.id):wallpaperHtml(item.id))+'</div>'+
 '<strong>'+escapeHtml(item.name)+'</strong><small>'+(kind==='sticker'?'Naklejka':'Tapeta profilowa')+'</small>'+
 '<button type="button" class="hgr-equip" data-action="gift-equip-'+kind+'" data-id="'+escapeHtml(item.id)+'" '+(isEquipped?'disabled':'')+'>'+(isEquipped?'Wyposażono':'Wyposaż')+'</button></div>';
}
function renderGifts(){
 sync();
 var items=earned(),ready=items.filter(function(x){return !data.claimed[x.id];});
 if(owner&&!starter&&!starterLoading)loadStarter();
 var unlockedStickers=STICKERS.filter(function(x){return owned('sticker',x.id);});
 var unlockedWallpapers=WALLPAPERS.filter(function(x){return owned('wallpaper',x.id);});
 var output='<div class="hgr-section-head"><div><span class="hgr-kicker">DARMOWE NAGRODY</span><h3>Prezenty i skrzynie</h3></div><span class="hgr-counter">'+ready.length+' do odebrania</span></div>'+
 '<div class="hgr-note">Wszystkie skrzynie są bezpłatne. Zawierają wyłącznie ozdoby profilu (75% naklejka, 25% tapeta). Nagrodę można odsłonić od razu przyciskiem „Pomiń animację”. Bez zakupów, wymiany na pieniądze ani wpływu na XP.</div>';
 if(starter&&starter.error)output+='<p class="hgr-note" role="status">'+escapeHtml(starter.error)+'</p>';
 if(animating)output+='<div class="hgr-animation" role="status"><div class="hgr-chest-spin" aria-hidden="true">✦ HG ✦</div><strong>Otwieranie skrzyni…</strong><button type="button" class="hgr-equip" data-action="gift-skip">Pomiń animację i pokaż nagrodę</button></div>';
 if(lastReveal){
  var info=infoFor(lastReveal);
  output+='<div class="hgr-reveal" role="status"><span class="hgr-kicker">PREZENT OTWARTY</span><div class="hgr-reveal-art">'+(lastReveal.kind==='sticker'?stickerHtml(lastReveal.item):wallpaperHtml(lastReveal.item))+'</div><strong>'+escapeHtml((info||{}).name||'Nowa nagroda')+'</strong><span>'+(lastReveal.kind==='sticker'?'Nowa naklejka profilowa!':'Nowa tapeta na profil!')+'</span><button type="button" class="hgr-equip" data-action="gift-equip-'+lastReveal.kind+'" data-id="'+escapeHtml(lastReveal.item)+'">Wyposaż teraz</button></div>';
 }
 output+='<div class="hgr-section-head"><h3>Do odebrania</h3></div>'+
 (ready.length?'<div class="hgr-gift-list">'+ready.slice(0,60).map(cardFor).join('')+'</div>':'<div class="hgr-empty">Wszystkie dostępne prezenty zostały odebrane. Zdobywaj nowe odznaki, aby odblokować kolejne upominki.</div>')+
 '<div class="hgr-section-head"><h3>Moja kolekcja ('+(unlockedStickers.length+unlockedWallpapers.length)+')</h3></div>';
 output+='<div class="hgr-collection-head">Naklejki profilowe</div>'+
 (unlockedStickers.length?'<div class="hgr-cosmetics">'+unlockedStickers.map(function(x){return rewardCard(x,'sticker');}).join('')+'</div>':'<div class="hgr-empty">Nie masz jeszcze naklejek profilowych.</div>');
 output+='<div class="hgr-collection-head">Tapety profilowe</div>'+
 (unlockedWallpapers.length?'<div class="hgr-cosmetics">'+unlockedWallpapers.map(function(x){return rewardCard(x,'wallpaper');}).join('')+'</div>':'<div class="hgr-empty">Nie masz jeszcze tapet profilowych.</div>');
 output+='<div class="hgr-actions">'+(data.sticker?'<button type="button" class="hgr-equip" data-action="gift-clear-sticker">Zdejmij naklejkę</button>':'')+
 (data.wallpaper?'<button type="button" class="hgr-equip" data-action="gift-clear-wallpaper">Przywróć zwykłe tło</button>':'')+'</div>'+
 '<div class="hgr-note">Naklejki, tapety i odebrane prezenty zapisują się lokalnie na tym urządzeniu, osobno dla każdego konta. Nie są jeszcze synchronizowane między telefonami i nie zwiększają XP.</div>';
 return output;
}
function handle(action,id){
 sync();if(!owner)return false;
 if(action==='gift-skip'){
  if(!animating)return false;
  if(starterBusy){skipRequested=true;return true;}
  return reveal();
 }
 if(action==='gift-open'){
  if(data.claimed[id]||!earned().some(function(x){return x.id===id;}))return false;
  var result=rewardOf(id),next=normalize(data);
  next.claimed[id]=result;
  if(!save(next))return false;
  if(result.chest){skipRequested=false;startAnimation(result);}else lastReveal=result;
  return true;
 }
 if(action==='gift-equip-sticker'&&sticker(id)&&owned('sticker',id)){
  var s=normalize(data);s.sticker=id;return save(s);
 }
 if(action==='gift-equip-wallpaper'&&wallpaper(id)&&owned('wallpaper',id)){
  var w=normalize(data);w.wallpaper=id;return save(w);
 }
 if(action==='gift-clear-sticker'||action==='gift-clear-wallpaper'){
  var c=normalize(data);if(action==='gift-clear-sticker')c.sticker='';else c.wallpaper='';
  return save(c);
 }
 return false;
}
function decorateProfile(){
 sync();
 var st=sticker(data.sticker),wp=wallpaper(data.wallpaper);
 ['topAvatar','sidebarAvatar'].forEach(function(id){
  var avatar=document.getElementById(id);if(!avatar)return;
  avatar.classList.toggle('hgr-avatar-equipped',!!st);
  var symbol=avatar.querySelector('.hgr-avatar-sticker');
  if(st){
   if(!symbol){symbol=document.createElement('span');symbol.className='hgr-avatar-sticker';symbol.setAttribute('aria-hidden','true');avatar.appendChild(symbol);}
   symbol.textContent=st.symbol;
  }else if(symbol)symbol.remove();
 });
 var target=document.getElementById('settingsAccount');
 if(!target)return;
 var panel=document.getElementById('hgGiftProfilePanel');
 if(!panel){
  panel=document.createElement('section');panel.id='hgGiftProfilePanel';panel.className='hgr-profile-panel';
  target.appendChild(panel);
  panel.addEventListener('click',function(e){
   var button=e.target.closest('[data-hgr-open]');
   if(!button)return;
   if(window.HealthGoPackPro&&typeof window.HealthGoPackPro.open==='function')window.HealthGoPackPro.open('gifts');
   else if(typeof window.mobileGo==='function')window.mobileGo('backpack');
  });
 }
 var nickname=String(Services.state.profile&&Services.state.profile.nickname||'HealthGo');
 panel.innerHTML='<div class="hgr-profile-head"><span class="hgr-kicker">MÓJ PROFIL</span><strong>Moje ozdoby profilowe</strong></div>'+
 '<div class="hgr-profile-preview '+(wp?'hgr-wallpaper-'+wp.id:'hgr-wallpaper-default')+'"><div class="hgr-profile-avatar">'+escapeHtml((nickname.trim().charAt(0)||'H').toUpperCase())+(st?'<span class="hgr-profile-decal">'+st.symbol+'</span>':'')+'</div><div><strong>'+escapeHtml(nickname)+'</strong><span>'+escapeHtml(wp?wp.name:'Domyślne tło')+' · '+escapeHtml(st?st.name:'Bez naklejki')+'</span></div></div>'+
 '<button type="button" class="hgr-open" data-hgr-open="1">Otwórz prezenty i zmień wygląd profilu</button>'+
 '<p>Wyposażone dodatki są widoczne na Twoim podglądzie profilu i avatarze w HealthGo.</p>';
}
function refresh(){sync();decorateProfile();loadStarter();}
Services.subscribe(function(){refresh();});
window.HealthGoRewards={renderGifts:renderGifts,handle:handle,decorateProfile:decorateProfile,countAvailable:countAvailable,getState:function(){sync();return normalize(data);},starterBanner:starterBanner,openStarter:openStarter,getStarter:function(){sync();return starter;},stickerCount:function(){return STICKERS.length;}};
})();
