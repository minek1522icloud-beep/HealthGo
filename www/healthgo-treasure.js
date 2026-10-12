/* HealthGo Treasure Hunt 2.0.
 * Real OSM world map and ONLY admin-approved, public-safe reward locations.
 * Browsing never starts GPS; claim is verified by server RPC.
 */
(function(w){
'use strict';
const root=document.getElementById('hgTreasureCenter');
const points=w.HealthGoPoints,api=w.HealthGoSupabase?.db,S=w.HealthGoServices;
if(!root||!points||!api||!S)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const deg=Math.PI/180;
let coords=null,selected=null,notice='',busy=false,worldOpen=false,nearbyOnly=false,worldMap=null;
let requestGeneration=0;
function distance(a,b){
 const t=(Number(b.lat)-Number(a.lat))*deg,u=(Number(b.lon)-Number(a.lon))*deg;
 const v=Math.sin(t/2)**2+Math.cos(Number(a.lat)*deg)*Math.cos(Number(b.lat)*deg)*Math.sin(u/2)**2;
 return Math.round(12742000*Math.atan2(Math.sqrt(Math.max(0,v)),Math.sqrt(Math.max(0,1-v))));
}
function approvedSites(){
 if(!S.state.uid)return [];
 const sites=points.getState()?.sites;
 return (Array.isArray(sites)?sites:[]).filter(p=>
  p&&typeof p.id==='string'&&Number.isFinite(Number(p.lat))&&Math.abs(Number(p.lat))<=90&&
  Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lon))<=180).slice(0,250);
}
function listedSites(){
 return approvedSites().filter(p=>!nearbyOnly||!coords||distance(coords,p)<=30000)
  .map(p=>({...p,meters:coords?distance(coords,p):null}))
  .sort((a,b)=>Number(a.claimed)-Number(b.claimed)||(a.meters??0)-(b.meters??0));
}
function removeMap(){
 if(worldMap){try{worldMap.remove()}catch(_){}worldMap=null;}
}
function startMap(){
 const container=document.getElementById('hptWorldMap');
 if(!worldOpen||!container)return false;
 const status=document.getElementById('hptWorldMapStatus');
 if(!w.L?.map||!w.L?.tileLayer){
  if(status)status.textContent='Mapa jest chwilowo niedostępna. Lista zatwierdzonych skarbów nadal działa.';
  return false;
 }
 removeMap();
 try{
  worldMap=w.L.map(container,{zoomControl:true,scrollWheelZoom:false,worldCopyJump:true,attributionControl:true});
  w.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
   attribution:'© OpenStreetMap contributors',maxZoom:18
  }).addTo(worldMap);
  const sites=approvedSites(),group=w.L.featureGroup();
  for(const site of sites){
   const marker=w.L.marker([Number(site.lat),Number(site.lon)]).addTo(group);
   const card=document.createElement('div');
   const heading=document.createElement('strong');heading.textContent=String(site.name||'Skarb');
   const para=document.createElement('p');para.textContent=site.claimed?'Zatwierdzone odkrycie':'Zatwierdzone miejsce publiczne';
   const btn=document.createElement('button');btn.type='button';
   btn.textContent=site.claimed?'✓ Odkryto':'Sprawdź skarb';
   btn.disabled=!!site.claimed;
   btn.addEventListener('click',()=>{selected=site;render();});
   card.append(heading,para,btn);
   marker.bindPopup(card);
  }
  if(sites.length){
   group.addTo(worldMap);
   worldMap.fitBounds(group.getBounds(),{padding:[30,30],maxZoom:12});
  }else worldMap.setView([22,0],2);
  if(coords&&w.L.circleMarker){
   w.L.circleMarker([coords.lat,coords.lon],{radius:7,color:'#eafff4',weight:2,fillColor:'#3ce6aa',fillOpacity:1})
    .addTo(worldMap).bindPopup('Twoja pozycja GPS (nieudostępniana publicznie)');
  }
  if(status)status.textContent=sites.length?'Na mapie wyświetlam tylko zatwierdzone lokalizacje.':
   'Mapa świata działa. Administrator nie dodał jeszcze zatwierdzonych miejsc ze skarbami.';
  w.setTimeout?.(()=>worldMap?.invalidateSize?.(),100);
  return true;
 }catch(_){
  removeMap();if(status)status.textContent='Mapa nie mogła się załadować. Możesz nadal przeglądać listę.';
  return false;
 }
}
function statusMessage(value){
 notice=String(value||'').slice(0,340);
 const status=document.getElementById('hptTreasureNotice');
 if(status){status.hidden=!notice;status.textContent=notice;}
 const check=document.getElementById('htCheckStatus');
 if(check)check.textContent=notice;
}
function render(){
 removeMap();
 const all=approvedSites(),sites=listedSites(),found=all.filter(s=>s.claimed).length;
 root.innerHTML='<div class="hpt-explore-hero"><div><small>HEALTHGO ADVENTURE</small><h2>Poszukiwacz Skarbów</h2>'+
  '<p>Odkrywaj świat na prawdziwej mapie. Nagrody czekają tylko w zatwierdzonych, bezpiecznych miejscach.</p></div><span aria-hidden="true">🧭</span></div>'+
  '<div class="hpt-explore-actions">'+
  '<button type="button" data-ht-map aria-pressed="'+worldOpen+'">'+(worldOpen?'Ukryj mapę świata':'🗺️ Pokaż mapę świata')+'</button>'+
  '<button type="button" data-ht-locate>◎ Moja lokalizacja</button>'+
  '<button type="button" data-ht-nearby '+(!coords?'disabled':'')+' aria-pressed="'+nearbyOnly+'">'+(nearbyOnly?'Pokaż cały świat':'Miejsca do 30 km')+'</button>'+
  '<button type="button" data-ht-wallet>✦ Portfel HG</button></div>'+
  (worldOpen?'<section class="hpt-world-wrap" aria-label="Mapa odkrywania świata">'+
   '<div id="hptWorldMap" class="hpt-world-map" aria-label="Mapa OpenStreetMap z zatwierdzonymi miejscami"></div>'+
   '<p id="hptWorldMapStatus" class="hpt-map-caption" role="status">Ładowanie mapy świata…</p></section>':'')+
  '<div class="hpt-mini"><span>🗺️ '+all.length+' zatwierdzonych lokalizacji</span><span>🏅 '+found+' odkryć</span>'+
  '<span>+0,5 HG za zatwierdzony skarb</span></div>'+
  '<p id="hptTreasureNotice" class="hpt-notice" role="status" '+(!notice?'hidden':'')+'>'+esc(notice)+'</p>'+
  (sites.length?'<div class="hpt-sites">'+sites.map(p=>{
   const url=typeof p.photoUrl==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(p.photoUrl)?p.photoUrl:'';
   return '<article class="hpt-site"><div class="hpt-site-photo">'+(url?'<img loading="lazy" referrerpolicy="no-referrer" src="'+esc(url)+'" alt="Zdjęcie miejsca">':'<span>📍</span>')+'</div><div><strong>'+esc(p.name||'Skarb')+'</strong>'+
    '<p>'+esc(p.description||'Bezpieczne miejsce publiczne zatwierdzone przez administratora.')+'</p>'+
    '<small>'+(p.meters===null?'Odległość po dobrowolnym włączeniu GPS':p.meters<1000?p.meters+' m od Ciebie':(p.meters/1000).toFixed(1).replace('.',',')+' km od Ciebie')+'</small>'+
    '<button type="button" data-ht-site="'+esc(p.id)+'" '+(p.claimed?'disabled':'')+'>'+(p.claimed?'✓ Już odkryto':'Zobacz skarb →')+'</button></div></article>';
  }).join('')+'</div>':'<div class="hpt-treasure-empty"><span aria-hidden="true">🧭</span>'+
   '<h3>'+(nearbyOnly&&coords?'W promieniu 30 km nie ma zatwierdzonych skarbów':'Brak zatwierdzonych skarbów')+'</h3>'+
   '<p>Możesz przeglądać mapę świata bez GPS. Nagrody pojawią się dopiero po zatwierdzeniu bezpiecznych lokalizacji przez administratora.</p></div>')+
  '<div class="hpt-disclaimer">GPS uruchamia się wyłącznie po Twoim kliknięciu. Odwiedzaj jedynie legalnie dostępne, bezpieczne miejsca z opiekunem, gdy jest to potrzebne. Nie korzystaj z ekranu podczas przechodzenia przez jezdnię. Możesz korzystać z HealthGo bez szukania skarbów.</div>'+
  (selected?dialog(selected):'');
 if(worldOpen)w.setTimeout?.(startMap,0);
}
function dialog(site){
 const meters=coords?distance(coords,site):null;
 return '<div class="hpt-treasure-modal"><div class="hpt-treasure-dim" data-ht-close></div>'+
 '<section class="hpt-treasure-dialog" role="dialog" aria-modal="true" aria-label="Odkryj skarb">'+
 '<button type="button" class="hpt-treasure-close" data-ht-close aria-label="Zamknij">×</button>'+
 '<small>ODKRYJ MIEJSCE</small><h2>'+esc(site.name||'Skarb')+'</h2><p>'+esc(site.description||'Zatwierdzone miejsce publiczne.')+'</p>'+
 '<ol><li>Sprawdź, czy miejsce jest bezpiecznie dostępne.</li><li>Wybierz nowe zdjęcie obiektu.</li><li>Za Twoją zgodą dwukrotnie sprawdzimy GPS.</li></ol>'+
 '<p>Odległość: '+(meters===null?'GPS nie został włączony':meters+' m')+'. Wymagana dokładność do 35 m i odległość najwyżej 60 m.</p>'+
 '<label class="hpt-photo-label">📷 Zdjęcie obiektu<input id="htPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label>'+
 '<div id="htPhotoInfo" class="hpt-photo-info">Zdjęcie nie zostało wybrane.</div>'+
 '<button type="button" data-ht-check class="hpt-treasure-submit" '+(busy?'disabled':'')+'>Sprawdź skarb (+0,5 HG)</button>'+
 '<p id="htCheckStatus" class="hpt-photo-info" role="status"></p>'+
 '<p class="hpt-disclaimer">HealthGo weryfikuje lokalizację i obecność zdjęcia, nie jego zawartość. Zdjęcie nie jest przesyłane, tylko jego skrót SHA-256. Zaliczenie potwierdza serwer.</p></section></div>';
}
function gps(){
 if(!navigator.geolocation?.getCurrentPosition)return Promise.reject(new Error('Usługa lokalizacji jest niedostępna.'));
 return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>{
  const c=p.coords,item={lat:Number(c.latitude),lon:Number(c.longitude),accuracy:Number(c.accuracy)};
  if(!Number.isFinite(item.lat)||Math.abs(item.lat)>90||!Number.isFinite(item.lon)||Math.abs(item.lon)>180||
     !Number.isFinite(item.accuracy)||item.accuracy<0)reject(new Error('Nieprawidłowy odczyt GPS.'));
  else resolve(item);
 },e=>reject(new Error(e?.code===1?'Brak zgody na GPS. Zmień uprawnienia lokalizacji telefonu.':
  'Nie ma aktualnego odczytu GPS. Spróbuj ponownie w miejscu z dobrym sygnałem.')),
 {enableHighAccuracy:true,timeout:17000,maximumAge:0}));
}
async function check(){
 if(!selected||busy||!S.state.uid)return;
 const photo=document.getElementById('htPhoto')?.files?.[0];
 if(!photo||!/^image\/(png|jpeg|webp)$/.test(photo.type)||photo.size>7*1024*1024||photo.size<1000){
  statusMessage('Wybierz zdjęcie JPG, PNG lub WebP o rozmiarze 1 KB–7 MB.');return;
 }
 if(!w.crypto?.subtle){statusMessage('Do sprawdzania zdjęcia wymagany jest protokół HTTPS.');return;}
 busy=true;const task=selected,uid=String(S.state.uid),generation=requestGeneration;
 const submit=root.querySelector('[data-ht-check]');if(submit)submit.disabled=true;
 try{
  statusMessage('Sprawdzam pozycję GPS…');
  const first=await gps();
  if(first.accuracy>35||distance(first,task)>60)throw Error('GPS jest zbyt niedokładny lub jesteś za daleko. Nie przemieszczaj się do niedostępnych miejsc.');
  const second=await gps();
  if(second.accuracy>35||distance(second,task)>60||distance(first,second)>45)throw Error('Nie udało się potwierdzić dwóch dokładnych odczytów GPS.');
  const digest=await w.crypto.subtle.digest('SHA-256',await photo.arrayBuffer());
  const hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
  if(uid!==String(S.state.uid)||generation!==requestGeneration)throw Error('Sesja została zmieniona. Zaloguj się ponownie.');
  const result=await api.rpc('hg_point_claim',{p_site:task.id,p_lat:second.lat,p_lon:second.lon,p_accuracy:Math.round(second.accuracy),p_photo_sha256:hash});
  selected=null;coords=second;
  await points.refresh();
  statusMessage(result?.already?'Ten skarb już był zaliczony.':'Odkrycie zapisane! +0,5 wirtualnego HG.');
 }catch(err){statusMessage('Nie udało się zaliczyć skarbu: '+String(err.message||err));}
 finally{busy=false;render();}
}
root.addEventListener('click',async e=>{
 const btn=e.target.closest('button');if(!btn||busy)return;
 if(btn.hasAttribute('data-ht-close')){selected=null;render();return;}
 if(btn.hasAttribute('data-ht-map')){worldOpen=!worldOpen;render();return;}
 if(btn.hasAttribute('data-ht-wallet')){if(typeof w.mobileGo==='function')w.mobileGo('points');else w.go?.('points');return;}
 if(btn.hasAttribute('data-ht-nearby')){if(coords){nearbyOnly=!nearbyOnly;render();}return;}
 if(btn.hasAttribute('data-ht-locate')){
  const generation=requestGeneration;statusMessage('Odczytuję GPS po Twojej zgodzie…');
  try{const current=await gps();if(generation!==requestGeneration)return;coords=current;statusMessage('Lokalizacja odczytana. Pozostaje prywatna.');}
  catch(err){statusMessage(String(err.message||err));}
  render();return;
 }
 if(btn.dataset.htSite){selected=approvedSites().find(s=>s.id===btn.dataset.htSite&&!s.claimed)||null;render();return;}
 if(btn.hasAttribute('data-ht-check'))void check();
});
root.addEventListener('change',e=>{
 if(e.target.id==='htPhoto'){
  const info=document.getElementById('htPhotoInfo');
  if(info)info.textContent=e.target.files?.[0]?'Zdjęcie wybrane. Możesz sprawdzić lokalizację.':'Nie wybrano zdjęcia.';
 }
});
w.HealthGoTreasure=Object.freeze({refresh:()=>{if(!busy&&!selected)render();},openMap:()=>{worldOpen=true;render();}});
S.subscribe?.(state=>{
 if(!state.uid){coords=null;selected=null;nearbyOnly=false;worldOpen=false;requestGeneration++;}
 if(!busy&&!selected)render();
});
w.addEventListener?.('healthgo:points-updated',()=>{if(!busy&&!selected)render();});
render();
})(window);
