/* HealthGo Profile PRO — profile cards, appearance presets and friend viewing.
   Backend only shares chosen public-facing cosmetics. Private photo stays on this device. */
(function(){
'use strict';
var Services=window.HealthGoServices,Engine=window.HealthGoEngine,Db=window.HealthGoSupabase&&window.HealthGoSupabase.db;
if(!Services||!Db)return;
var AVATARS={
 leaf:{label:'Emerald',icon:'M39 77Q19 30 77 22Q80 74 39 77ZM25 88Q48 44 71 31',color:'#7ff6c6'},
 rocket:{label:'Kosmos',icon:'M50 12Q79 31 64 69L50 85 36 69Q21 31 50 12ZM50 34v1M36 69 19 83 23 56M64 69 81 83 77 56',color:'#b5c5ff'},
 shield:{label:'Strażnik',icon:'M50 13 80 25V52Q77 75 50 88Q23 75 20 52V25ZM37 51l10 11 19-23',color:'#a2eeff'},
 star:{label:'Gwiazda',icon:'M50 13 61 36 86 40 68 58 72 84 50 72 28 84 32 58 14 40 39 36Z',color:'#ffe4a0'},
 fox:{label:'Lis',icon:'M21 16 38 30Q50 24 62 30L79 16 75 65Q70 82 50 85Q30 82 25 65ZM33 52h1M66 52h1M44 64l6 5 6-5',color:'#ffc79e'},
 wave:{label:'Fala',icon:'M13 52Q31 25 50 52T87 52M13 69Q31 42 50 69T87 69M35 30Q49 12 64 30',color:'#89e4ff'},
 crown:{label:'Korona',icon:'M12 33 29 48 50 19 71 48 88 33 79 75H21ZM22 81H78',color:'#ffe9ab'},
 moon:{label:'Księżyc',icon:'M65 18Q30 20 30 52Q31 80 64 82Q40 96 22 71Q9 54 20 34Q35 10 65 18Z',color:'#e5d0ff'}
};
var FRAMES=['mint','silver','gold','violet','cyber','emerald'],FRAME_NAMES=['Miętowa','Srebrna','Złota','Fioletowa','Cyber','Szmaragdowa'];
var WALLS={default:'Domyślna',aurora:'Miętowa zorza',nebula:'Kosmos',sunset:'Zachód słońca',forest:'Las',violet:'Fiolet',arctic:'Arktyka'};
var state={uid:'',card:null,local:null,open:false,tab:'menu',visitor:null,loading:false,saving:false,message:'',photo:'',previousFocus:null};
var defaults=()=>({visibility:'friends',about:'',avatar:'leaf',wallpaper:'default',frame:'mint',sticker:'',featured:[],looks:[]});
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uid(){return String(Services.state.uid||'');}
function key(){return 'healthgo.profile.pro.1.'+encodeURIComponent(uid());}
function photoKey(){return key()+'.privatePhoto';}
function legalAvatar(x){return Object.prototype.hasOwnProperty.call(AVATARS,x);}
function wallpaperOk(x){return Object.prototype.hasOwnProperty.call(WALLS,x);}
function normal(v){
 var d=defaults(),o=v&&typeof v==='object'?v:{};
 d.visibility=['private','friends','public'].includes(o.visibility)?o.visibility:'friends';
 d.about=String(o.about||'').slice(0,160);
 d.avatar=legalAvatar(o.avatar)?o.avatar:'leaf';
 d.wallpaper=wallpaperOk(o.wallpaper)?o.wallpaper:'default';
 d.frame=FRAMES.includes(o.frame)?o.frame:'mint';
 d.sticker=/^[a-z0-9-]{0,24}$/.test(o.sticker||'')?String(o.sticker||''):'';
 d.featured=Array.isArray(o.featured)?o.featured.filter(x=>typeof x==='string').slice(0,3):[];
 d.looks=Array.isArray(o.looks)?o.looks.slice(0,3).map(x=>({
  name:String(x.name||'Mój zestaw').slice(0,28),avatar:legalAvatar(x.avatar)?x.avatar:'leaf',
  wallpaper:wallpaperOk(x.wallpaper)?x.wallpaper:'default',
  frame:FRAMES.includes(x.frame)?x.frame:'mint',sticker:String(x.sticker||'').slice(0,24)
 })):[];
 return d;
}
function refreshAccount(){
 var current=uid();
 if(current===state.uid)return;
 close(true);state.uid=current;state.card=null;state.local=defaults();state.message='';
 state.photo='';
 if(current){try{state.local=normal(JSON.parse(localStorage.getItem(key())||'{}'));}catch(_){}try{var file=localStorage.getItem(photoKey())||'';if(/^data:image\/(?:png|jpeg|webp);base64,/.test(file)&&file.length<340000)state.photo=file;}catch(_){}}
 applyAvatar();
}
function store(){
 if(!uid())return false;
 try{localStorage.setItem(key(),JSON.stringify(state.local));return true;}
 catch(e){state.message='Nie udało się zapisać ustawień na urządzeniu.';return false;}
}
function avatarSvg(type){
 var a=AVATARS[type]||AVATARS.leaf;
 return '<svg viewBox="0 0 100 100" fill="none" aria-hidden="true" stroke="'+a.color+'" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+a.icon+'"/></svg>';
}
function avatarMarkup(type,remote){
 if(!remote&&state.photo&&type==='leaf')return '<img src="'+state.photo+'" alt="" class="hgp-avatar-photo">';
 return avatarSvg(type);
}
function rewardState(){return window.HealthGoRewards&&window.HealthGoRewards.getState?window.HealthGoRewards.getState():{claimed:{},sticker:'',wallpaper:''};}
function unlocked(kind){
 var data=rewardState(),result={},claims=data.claimed||{};
 Object.keys(claims).forEach(function(id){var r=claims[id];if(r&&r.kind===kind)result[r.item]=true;});
 return Object.keys(result);
}
function stickerLabel(id){
 var map={'mint-star':'✦',orbit:'◎',fire:'✹',clover:'❖',crown:'♛',spark:'✧',sun:'☼',bolt:'ϟ'};
 if(map[id])return map[id];
 if(/^s[0-7]\d$/.test(id)){
  var symbols=['✦','❖','★','☄','✧','✿','✹','◈','✳','ϟ','❀','♛','✺','✷','☼','◇'];
  return symbols[(parseInt(id.slice(1),10)-1)%symbols.length];
 }
 return '✦';
}
function nickname(){return String(Services.state.profile?.nickname||Services.state.profile?.displayName||'Użytkownik HealthGo');}
function level(){try{return Engine&&Services.state.engine?Engine.getLevel(Services.state.engine.totalXp||0).level:1;}catch(_){return 1;}}
function badges(){try{return Engine&&Services.state.engine?Engine.viewAchievements(Services.state.engine).filter(x=>x.earned):[];}catch(_){return [];}}
function avatarTopMarkup(){
 var p=state.local||defaults();
 var inner=avatarMarkup(p.avatar,false);
 var sticker=rewardState().sticker;
 return inner+(sticker?'<span class="hgp-avatar-sticker" aria-hidden="true">'+(window.HealthGoCollectibleArt?window.HealthGoCollectibleArt.sticker(sticker):esc(stickerLabel(sticker)))+'</span>':'');
}
function applyAvatar(){
 if(!state.uid)return;
 ['topAvatar','sidebarAvatar'].forEach(function(name){
  var node=document.getElementById(name);
  if(!node)return;node.classList.add('hgp-avatar-current');node.innerHTML=avatarTopMarkup();
 });
}
function headerCard(p,isSelf){
 var frame=FRAMES.includes(p.frame)?p.frame:'mint',wall=wallpaperOk(p.wallpaper)?p.wallpaper:'default';
 var nick=isSelf?nickname():String(p.nickname||'Użytkownik HealthGo'),lv=isSelf?level():Math.max(1,Number(p.level)||1);
 var about=isSelf?state.local.about:String(p.about||'');
 var art=avatarMarkup(legalAvatar(p.avatar)?p.avatar:'leaf',!isSelf);
 var tag=p.sticker||(!isSelf?'':rewardState().sticker);
 var list=isSelf?badges().filter(x=>(state.local.featured||[]).includes(x.id)).slice(0,3):(Array.isArray(p.featured)?p.featured.slice(0,3):[]);
 return '<div class="hgp-profile-cover hgr-wallpaper-'+wall+'"><span class="hgp-cover-label">HEALTHGO COLLECTOR PROFILE</span><span class="hgp-cover-glow" aria-hidden="true"></span></div>'+
 '<div class="hgp-profile-identity"><div class="hgp-profile-avatar hgp-frame-'+frame+'">'+art+(tag?'<span class="hgp-profile-sticker">'+(window.HealthGoCollectibleArt?window.HealthGoCollectibleArt.sticker(tag):esc(stickerLabel(tag)))+'</span>':'')+'</div>'+
 '<div class="hgp-identity-label"><h2>'+esc(nick)+'</h2><p>Poziom '+lv+' · '+(isSelf?'Twój profil':'Profil użytkownika HealthGo')+'</p></div></div>'+
 '<div class="hgp-profile-statrow">'+
 '<span><strong>'+lv+'</strong><small>Poziom</small></span>'+
 '<span><strong>'+list.length+'</strong><small>Wyróżnienia</small></span>'+
 '<span><strong>'+(isSelf?unlocked('sticker').length:'—')+'</strong><small>Naklejki</small></span></div>'+
 '<div class="hgp-profile-about"><strong>O mnie</strong><p>'+esc(about||'Witaj na moim profilu HealthGo!')+'</p></div>'+
 '<div class="hgp-profile-badges"><strong>Wyróżnione odznaki</strong><div class="hgp-featured-grid">'+
 (list.length?list.map(function(x){var medal=window.HealthGoMedalArt?.render({id:x.id||x.code,name:x.name,earned:true,category:x.category||'badges',rarity:x.rarity||'common'},false)||'★';return '<div class="hgp-feature"><div>'+medal+'</div><span>'+esc(x.name)+'</span></div>';}).join(''):
 '<p class="hgp-muted">Brak wyróżnionych odznak.</p>')+'</div></div>';
}
function menu(){
 var p=state.local||defaults();
 return headerCard(p,true)+
 '<div class="hgp-menu">'+
 menuButton('edit','Edytuj profil','Awatar, tapeta, ramka i opis','settings')+
 menuButton('friends','Znajomi','Znajomi i zaproszenia','users')+
 menuButton('cosmetics','Moja kolekcja','Naklejki, skrzynie, tekstury i tapety','gift')+
 menuButton('looks','Zapisane zestawy','Szybka zmiana wyglądu','layers')+
 menuButton('privacy','Prywatność profilu','Kto może oglądać mój profil','lock')+
 menuButton('updates','Co nowego?','Dziennik zmian HealthGo','sparkles')+
 '</div>';
}
function menuButton(action,name,sub,icon){
 var paths={settings:'M9 3h6l1 3 3 1 3 5-3 4 0 4-5 2-3-3-3 3-5-2v-4l-3-4 3-5 3-1Z',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-4m-3-12a4 4 0 0 1 0 8',gift:'M3 8h18v13H3ZM2 8v-4h20v4M12 4v17m0-17c-5-9-11-1 0 0Zm0 0c5-9 11-1 0 0Z',layers:'M12 2 2 8l10 6 10-6-10-6ZM2 12l10 6 10-6M2 16l10 6 10-6',lock:'M4 10h16v12H4Zm4 0V7a4 4 0 0 1 8 0v3',sparkles:'m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z'};
 return '<button type="button" class="hgp-menu-action" data-profile-action="'+action+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[icon]||paths.settings)+'"/></svg><span><strong>'+name+'</strong><small>'+sub+'</small></span><b aria-hidden="true">›</b></button>';
}
function editor(kind){
 var p=state.local||defaults();
 var authUser=Services.state.profile||{};
 var child=authUser.accountType==='child';
 var avatarBtns=Object.keys(AVATARS).map(function(id){return '<button type="button" class="hgp-avatar-choice '+(p.avatar===id?'active':'')+'" data-profile-avatar="'+id+'" aria-pressed="'+(p.avatar===id)+'">'+avatarSvg(id)+'<span>'+esc(AVATARS[id].label)+'</span></button>';}).join('');
 var ownedWalls=unlocked('wallpaper'),walls=['default'].concat(ownedWalls.filter(x=>wallpaperOk(x)&&x!=='default'));
 var wallBtns=walls.map(function(id){return '<button type="button" class="hgp-wall-choice hgr-wallpaper-'+id+' '+(p.wallpaper===id?'active':'')+'" data-profile-wall="'+id+'" aria-pressed="'+(p.wallpaper===id)+'"><span>'+esc(WALLS[id])+'</span></button>';}).join('');
 var frames=FRAMES.map(function(id,i){return '<button type="button" class="hgp-frame-choice hgp-frame-'+id+' '+(p.frame===id?'active':'')+'" data-profile-frame="'+id+'" aria-pressed="'+(p.frame===id)+'">'+FRAME_NAMES[i]+'</button>';}).join('');
 var unlockedStickers=unlocked('sticker');
 var stickerBtns=[''].concat(unlockedStickers).map(function(id){return '<button type="button" class="hgp-decal-choice '+(p.sticker===id?'active':'')+'" data-profile-sticker="'+esc(id)+'" aria-pressed="'+(p.sticker===id)+'">'+(id?esc(stickerLabel(id)):'Ø')+'</button>';}).join('');
 var available=badges();
 var featured=available.map(function(b){var active=p.featured.includes(b.id);return '<button type="button" class="hgp-badge-choice '+(active?'active':'')+'" data-profile-badge="'+esc(b.id)+'" aria-pressed="'+active+'">'+esc(b.name)+'</button>';}).join('');
 var base=headerCard(p,true);
 var section='';
 if(kind==='edit'){
  section='<div class="hgp-editor"><h3>Edytuj wygląd profilu</h3>'+
   '<label class="hgp-field-label">O mnie (maksymalnie 160 znaków)<textarea data-profile-bio maxlength="160" rows="3" placeholder="Napisz kilka słów o sobie">'+esc(p.about)+'</textarea></label>'+
   '<h4>Awatar</h4><div class="hgp-avatars">'+avatarBtns+'</div>'+
   '<label class="hgp-upload">Wybierz własne zdjęcie (widoczne tylko na tym urządzeniu)<input type="file" data-profile-photo accept="image/png,image/jpeg,image/webp"></label>'+
   (state.photo?'<button type="button" data-profile-action="remove-photo" class="hgp-lite-button">Usuń moje zdjęcie</button>':'')+
   '<h4>Tapeta profilu</h4><p class="hgp-muted">Tapety zdobyte w Plecaku będą widoczne tutaj.</p><div class="hgp-wall-grid">'+wallBtns+'</div>'+
   '<h4>Ramka avatara</h4><div class="hgp-frame-grid">'+frames+'</div>'+
   '<h4>Naklejka na avatar</h4><div class="hgp-decals">'+stickerBtns+'</div>'+
   '<h4>Gablota: wybierz maksymalnie 3 zdobyte odznaki</h4><div class="hgp-badge-choices">'+(featured||'<p class="hgp-muted">Zdobyte odznaki pojawią się tutaj.</p>')+'</div>'+
   '<button type="button" class="hgp-primary" data-profile-action="save">Zapisz profil</button></div>';
 }else if(kind==='privacy'){
  section='<div class="hgp-editor"><h3>Prywatność profilu</h3><p class="hgp-muted">To Ty decydujesz, kto widzi Twój profil. Dane zdrowotne, e-mail i lokalizacja pozostają prywatne.</p>'+
   '<label class="hgp-field-label">Kto może oglądać moją kartę?<select data-profile-visibility>'+
   '<option value="private" '+(p.visibility==='private'?'selected':'')+'>Tylko ja</option>'+
   '<option value="friends" '+(p.visibility==='friends'?'selected':'')+'>Zaakceptowani znajomi</option>'+
   (!child?'<option value="public" '+(p.visibility==='public'?'selected':'')+'>Publiczna karta (po podaniu mojego kodu)</option>':'')+
   '</select></label><button type="button" class="hgp-primary" data-profile-action="save">Zapisz prywatność</button></div>';
 }else if(kind==='looks'){
  var cards=p.looks.map(function(look,i){return '<div class="hgp-look"><div class="hgp-look-art hgr-wallpaper-'+look.wallpaper+'"></div><strong>'+esc(look.name)+'</strong><button type="button" data-profile-load="'+i+'">Wybierz zestaw</button></div>';}).join('');
  section='<div class="hgp-editor"><h3>Moje zestawy wyglądu</h3><p class="hgp-muted">Zapisz maksymalnie 3 własne kombinacje awatara, tapety, ramki i naklejki na tym urządzeniu.</p>'+
  '<div class="hgp-looks">'+(cards||'<p class="hgp-muted">Nie zapisano jeszcze żadnego zestawu.</p>')+'</div>'+
  (p.looks.length<3?'<button type="button" class="hgp-primary" data-profile-action="save-look">Zapisz aktualny wygląd</button>':'<button type="button" class="hgp-lite-button" data-profile-action="clear-looks">Usuń zapisane zestawy</button>')+'</div>';
 }else if(kind==='friends'){
  var f=window.HealthGoFriends&&window.HealthGoFriends.getState?window.HealthGoFriends.getState():null;
  var list=Array.isArray(f?.friends)?f.friends:[];
  section='<div class="hgp-editor"><h3>Moi znajomi</h3><p class="hgp-muted">Kliknij znajomego, aby obejrzeć jego kartę. Dodawanie i akceptowanie zaproszeń odbywa się w panelu Znajomi.</p>'+
  '<div class="hgp-friend-grid">'+(list.length?list.map(function(friend){return '<button type="button" data-profile-visitor="'+esc(friend.user_id)+'">'+
  '<span class="hgp-friend-icon">★</span><span>'+esc(friend.nickname)+'</span><b>›</b></button>';}).join(''):'<p class="hgp-muted">Lista znajomych jest pusta lub jeszcze się ładuje.</p>')+'</div>'+
  '<button type="button" class="hgp-primary" data-profile-action="friend-settings">Zarządzaj zaproszeniami</button></div>';
 }
 return base+section;
}
function render(){
 if(!state.open)return;
 var shell=document.getElementById('hgProfileProOverlay');if(!shell)return;
 var child=state.visitor!==null;
 var content=child?(state.loading?'<p class="hgp-loading">Wczytuję profil…</p>':state.card?.available?headerCard(state.card,false)+
 '<div class="hgp-editor"><p class="hgp-muted">Zobacz udostępnione ozdoby i odznaki tego użytkownika. Dane zdrowotne nie są publiczne.</p>'+
 (state.card.is_friend?'<span class="hgp-friend-approved">✓ Jesteście znajomymi</span>':'<span class="hgp-muted">Aby dodać tę osobę, użyj jej kodu zaproszeń.</span>')+'</div>':'<p class="hgp-loading">Ten profil jest prywatny lub niedostępny.</p>'):
 (state.tab==='menu'?menu():editor(state.tab));
 shell.innerHTML='<div class="hgp-profile-panel" role="dialog" aria-modal="true" aria-label="Profil HealthGo">'+
 '<header class="hgp-toolbar"><button type="button" class="hgp-arrow" data-profile-action="back" aria-label="Wstecz">←</button>'+
 '<div><strong>'+(child?'Profil znajomego':state.tab==='menu'?'Mój profil':state.tab==='friends'?'Znajomi':state.tab==='edit'?'Edytuj profil':state.tab==='looks'?'Zestawy wyglądu':'Prywatność')+'</strong><small>HEALTHGO PRO</small></div>'+
 '<button type="button" class="hgp-x" data-profile-action="close" aria-label="Zamknij">×</button></header>'+
 '<div class="hgp-profile-scroll">'+(state.message?'<p class="hgp-notice" role="status">'+esc(state.message)+'</p>':'')+content+'</div>'+
 '</div>';
}
function open(mode,userId){
 refreshAccount();if(!uid())return;
 if(!state.open)state.previousFocus=document.activeElement;
 state.open=true;state.message='';state.tab=mode==='edit'?'edit':mode==='friends'?'friends':'menu';
 state.visitor=mode==='visitor'?String(userId||''):null;
 if(!document.getElementById('hgProfileProOverlay')){
  var root=document.createElement('div');root.id='hgProfileProOverlay';root.className='hgp-profile-overlay';
  root.addEventListener('click',onClick);root.addEventListener('change',onChange);
  root.addEventListener('input',onInput);
  root.addEventListener('keydown',onKey);
  document.body.appendChild(root);
  document.body.classList.add('hgp-profile-open');
 }
 if(state.visitor){loadVisitor(state.visitor);}else{state.card=null;render();loadOwn();}
 var close=document.querySelector('#hgProfileProOverlay .hgp-x');if(close)close.focus({preventScroll:true});
}
function close(silent){
 var root=document.getElementById('hgProfileProOverlay');
 if(root)root.remove();document.body.classList.remove('hgp-profile-open');
 state.open=false;state.visitor=null;state.tab='menu';state.message='';
 if(!silent&&state.previousFocus&&state.previousFocus.focus)state.previousFocus.focus({preventScroll:true});
 state.previousFocus=null;
}
async function loadOwn(){
 var who=uid();
 try{
  var card=await Db.rpc('healthgo_profile_get',{p_user_id:who});
  if(who!==uid())return;
  state.card=card;
  if(card&&card.available){
   var previous=state.local||defaults();
   var d=normal(Object.assign({},previous,{visibility:card.visibility,about:card.about,avatar:card.avatar,
    wallpaper:card.wallpaper,frame:card.frame,sticker:card.sticker}));
   state.local=d;store();applyAvatar();
  }
  if(state.open&&state.visitor===null&&state.tab==='menu')render();
 }catch(error){console.warn('Profile card could not load',error);}
}
async function loadVisitor(userId){
 state.loading=true;state.card=null;render();
 try{var result=await Db.rpc('healthgo_profile_get',{p_user_id:userId});
  if(state.visitor!==userId)return;state.card=result;state.loading=false;render();
 }catch(e){if(state.visitor===userId){state.card={available:false};state.loading=false;state.message='Nie udało się pobrać profilu.';render();}}
}
function setLocal(key,value){
 var rewards=window.HealthGoRewards;
 if(rewards&&rewards.handle){
  if(key==='sticker')rewards.handle(value?'gift-equip-sticker':'gift-clear-sticker',value);
  if(key==='wallpaper')rewards.handle(value==='default'?'gift-clear-wallpaper':'gift-equip-wallpaper',value);
 }
 var p=state.local||defaults();p[key]=value;state.local=normal(p);store();applyAvatar();render();
}
async function save(){
 if(state.saving)return;
 state.saving=true;var current=uid(),d=state.local||defaults();
 try{
  await Db.rpc('healthgo_profile_save',{p_visibility:d.visibility,p_about:d.about,p_avatar:d.avatar,
    p_wallpaper:d.wallpaper,p_frame:d.frame,p_sticker:d.sticker,p_featured:d.featured});
  if(current!==uid())return;
  store();state.message='Profil został zapisany.';state.tab='menu';render();
 }catch(error){state.message='Nie udało się zsynchronizować profilu: '+String(error.message||'Spróbuj ponownie');render();}
 finally{state.saving=false;}
}
function currentAvatarPhoto(file){
 if(!file||!file.type||!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024){
  state.message='Wybierz plik JPG, PNG lub WebP mniejszy niż 5 MB.';render();return;
 }
 var reader=new FileReader();
 reader.onload=function(){
  var image=new Image();
  image.onload=function(){
   try{
    var canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    var context=canvas.getContext('2d');
    var side=Math.min(image.width,image.height);
    context.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,256,256);
    var value=canvas.toDataURL('image/jpeg',.7);
    if(value.length>330000)throw Error('too large');
    localStorage.setItem(photoKey(),value);state.photo=value;state.local.avatar='leaf';store();state.message='Zdjęcie zapisano lokalnie. Znajomi widzą domyślny awatar, nie Twoją fotografię.';applyAvatar();render();
   }catch(e){state.message='Zdjęcie nie mogło zostać zapisane na tym urządzeniu.';render();}
  };
  image.onerror=function(){state.message='Nie udało się odczytać zdjęcia.';render();};
  image.src=String(reader.result||'');
 };
 reader.readAsDataURL(file);
}
function onChange(e){
 if(e.target.matches('[data-profile-photo]')){currentAvatarPhoto(e.target.files?.[0]);return;}
 if(e.target.matches('[data-profile-visibility]')){setLocal('visibility',e.target.value);return;}
}
function onInput(e){
 if(e.target.matches('[data-profile-bio]')){
  state.local.about=String(e.target.value||'').slice(0,160);store();
  // Do not re-render while typing; preserve caret position.
 }
}
function onClick(e){
 if(e.target.id==='hgProfileProOverlay'){close();return;}
 var btn=e.target.closest('button');if(!btn)return;
 var act=btn.getAttribute('data-profile-action');
 if(act==='close'){close();return;}
 if(act==='back'){if(state.visitor){state.visitor=null;state.card=null;state.tab='friends';render();}else if(state.tab!=='menu'){state.tab='menu';state.message='';render();}else close();return;}
 if(act==='edit'||act==='privacy'||act==='friends'||act==='looks'){state.tab=act;state.message='';render();return;}
 if(act==='cosmetics'){close();window.HealthGoPackPro?.open('gifts');return;}
 if(act==='updates'){close();window.HealthGoWhatsNew?.show();return;}
 if(act==='friend-settings'){close();if(typeof window.mobileGo==='function')window.mobileGo('settings');var node=document.getElementById('hgFriendsPanel');if(node)node.scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(act==='save'){save();return;}
 if(act==='save-look'){
  var name='Zestaw '+((state.local.looks||[]).length+1),p=state.local;
  if(p.looks.length<3){p.looks.push({name:name,avatar:p.avatar,wallpaper:p.wallpaper,frame:p.frame,sticker:p.sticker});store();render();}return;
 }
 if(act==='clear-looks'){state.local.looks=[];store();render();return;}
 if(act==='remove-photo'){try{localStorage.removeItem(photoKey());}catch(_){}state.photo='';applyAvatar();render();return;}
 var visitor=btn.getAttribute('data-profile-visitor');if(visitor){open('visitor',visitor);return;}
 var frame=btn.getAttribute('data-profile-frame');if(frame){setLocal('frame',frame);return;}
 var avatar=btn.getAttribute('data-profile-avatar');if(avatar){setLocal('avatar',avatar);return;}
 var wall=btn.getAttribute('data-profile-wall');if(wall){
  if(wall!=='default'&&!unlocked('wallpaper').includes(wall))return;
  setLocal('wallpaper',wall);return;
 }
 var sticker=btn.getAttribute('data-profile-sticker');if(sticker!==null){
  if(sticker!==''&&!unlocked('sticker').includes(sticker))return;
  setLocal('sticker',sticker);return;
 }
 var badge=btn.getAttribute('data-profile-badge');if(badge){
  var b=badges();if(!b.some(x=>x.id===badge))return;
  var list=state.local.featured;
  if(list.includes(badge))state.local.featured=list.filter(x=>x!==badge);
  else if(list.length<3)state.local.featured=list.concat(badge);
  else{state.message='Możesz wyróżnić maksymalnie 3 odznaki.';render();return;}
  store();render();return;
 }
 var slot=btn.getAttribute('data-profile-load');if(slot!==null){
  var saved=state.local.looks[Number(slot)];if(!saved)return;
  state.local=normal(Object.assign({},state.local,saved));
  store();applyAvatar();state.message='Zestaw wybrany. Zapisz profil, aby udostępnić wygląd znajomym.';render();return;
 }
}
function onKey(e){
 if(e.key==='Escape'){e.preventDefault();close();return;}
 if(e.key!=='Tab')return;
 var items=Array.from(e.currentTarget.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])')).filter(x=>x.offsetParent!==null);
 if(!items.length)return;
 if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items[items.length-1].focus();}
 else if(!e.shiftKey&&document.activeElement===items[items.length-1]){e.preventDefault();items[0].focus();}
}
function syncCosmetics(){
 refreshAccount();if(!state.uid)return;
 var p=state.local||defaults(),rewards=rewardState();
 p.sticker=rewards.sticker||'';
 p.wallpaper=rewards.wallpaper||'default';
 store();if(state.open&&state.visitor===null)render();
 // Explicit save is required to publish changes to contacts; no surprise visibility change.
}
function attach(){
 refreshAccount();
 var top=document.querySelector('.top .account-pill');
 var side=document.querySelector('.sidebar-account');
 if(top){top.setAttribute('onclick',"window.HealthGoProfile?.open('me')");top.setAttribute('aria-label','Otwórz mój profil HealthGo');top.title='Mój profil';}
 if(side){side.setAttribute('onclick',"window.HealthGoProfile?.open('me')");side.setAttribute('aria-label','Otwórz mój profil HealthGo');}
 var old=window.renderHealthGoProfile;
 if(typeof old==='function'&&!old.__hgpProfilePro){
  var wrapped=function(){var result=old.apply(this,arguments);refreshAccount();applyAvatar();return result;};
  wrapped.__hgpProfilePro=true;window.renderHealthGoProfile=wrapped;
 }
 applyAvatar();
}
Services.subscribe(function(s){refreshAccount();if(s.uid)applyAvatar();});
window.HealthGoProfile={open:open,close:close,render:render,attach:attach,syncCosmetics:syncCosmetics};
attach();
})();
