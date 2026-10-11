/* HealthGo Treasure Hunt: curated public site photo quests with opt-in GPS.
 * No arbitrary community-created sites earn points; photo image matching is not yet available.
 */
(function(w){
'use strict';
const root=document.getElementById('hgTreasureCenter'),points=w.HealthGoPoints,api=w.HealthGoSupabase?.db,S=w.HealthGoServices;
if(!root||!points||!api||!S)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let coords=null,selected=null,notice='',busy=false,preview='';
const deg=Math.PI/180;
function distance(a,b){
 const t=(b.lat-a.lat)*deg,u=(b.lon-a.lon)*deg;
 const v=Math.sin(t/2)**2+Math.cos(a.lat*deg)*Math.cos(b.lat*deg)*Math.sin(u/2)**2;
 return Math.round(12742000*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v))));
}
function findSites(){
 const sites=points.getState()?.sites||[];
 return sites.filter(p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&
  (!coords||distance(coords,p)<=30000))
 .map(p=>({...p,meters:coords?distance(coords,p):null}))
 .sort((a,b)=>Number(a.claimed)-Number(b.claimed)||(a.meters??0)-(b.meters??0));
}
function render(){
 const sites=findSites(),found=(points.getState()?.sites||[]).filter(s=>s.claimed).length;
 root.innerHTML='<div class="hpt-explore-hero"><div><small>HEALTHGO ADVENTURE</small><h2>Poszukiwacz Skarbów</h2>'+
 '<p>Prawdziwe miejsca. Zdjęcie obiektu. Potwierdzenie lokalizacji. Twój własny szlak odkrywcy.</p></div><span aria-hidden="true">🧭</span></div>'+
 '<div class="hpt-explore-actions"><button type="button" data-ht-locate>◎ Znajdź miejsca w pobliżu</button>'+
 '<button type="button" data-ht-wallet>✦ Mój portfel HG</button></div>'+
 '<div class="hpt-mini"><span>🗺️ '+sites.length+' lokalizacji'+(coords?' w promieniu 30 km':'')+'</span><span>🏅 '+found+' odkryć</span>'+
 '<span>+0,5 HG za zatwierdzony skarb</span></div>'+
 (notice?'<p class="hpt-notice" role="status">'+esc(notice)+'</p>':'')+
 (sites.length?'<div class="hpt-sites">'+sites.map(p=>{
  const url=typeof p.photoUrl==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(p.photoUrl)?p.photoUrl:'';
  return '<article class="hpt-site"><div class="hpt-site-photo">'+(url?'<img loading="lazy" referrerpolicy="no-referrer" src="'+esc(url)+'" alt="Zdjęcie miejsca">':'<span>📍</span>')+'</div><div><strong>'+esc(p.name)+'</strong><p>'+esc(p.description||'Bezpieczne publiczne miejsce wybrane przez administratora.')+'</p>'+
  '<small>'+(p.meters===null?'Dotknij „Znajdź miejsca”, by sprawdzić odległość':p.meters<1000?p.meters+' m od Ciebie':(p.meters/1000).toFixed(1).replace('.',',')+' km od Ciebie')+'</small>'+
  '<button type="button" data-ht-site="'+esc(p.id)+'" '+(p.claimed?'disabled':'')+'>'+(p.claimed?'✓ Już odkryto':'Odkryj skarb →')+'</button></div></article>';
 }).join('')+'</div>':'<div class="hpt-treasure-empty"><span aria-hidden="true">🧭</span><h3>W tej okolicy nie ma jeszcze zatwierdzonych skarbów</h3>'+
 '<p>Wskazówki, fotografie i miejsca muszą zostać sprawdzone przed udostępnieniem. Nie będziemy wysyłać Cię do przypadkowych lokalizacji.</p></div>')+
 '<div class="hpt-disclaimer">Lokalizacja jest używana tylko po Twojej zgodzie. Poszukiwania odbywają się wyłącznie w bezpiecznych, publicznie dostępnych miejscach. Nie wchodź na teren prywatny ani nie korzystaj z telefonu podczas przechodzenia przez ulicę. Możesz też zdobywać odznaki i XP bez spaceru.</div>'+
 (selected?dialog(selected):'');
}
function dialog(site){
 const meters=coords?distance(coords,site):null;
 return '<div class="hpt-treasure-modal"><div class="hpt-treasure-dim" data-ht-close></div>'+
 '<section class="hpt-treasure-dialog" role="dialog" aria-modal="true" aria-label="Zadanie skarbu">'+
 '<button type="button" class="hpt-treasure-close" data-ht-close aria-label="Zamknij">×</button>'+
 '<small>ODKRYJ MIEJSCE</small><h2>'+esc(site.name)+'</h2><p>'+esc(site.description||'Przyjrzyj się obiektowi i wykonaj zdjęcie.')+'</p>'+
 '<ol><li>Odwiedź miejsce, do którego można bezpiecznie dojść.</li><li>Wykonaj nowe zdjęcie obiektu.</li><li>Pozwól aplikacji sprawdzić dwukrotnie GPS.</li></ol>'+
 '<p>Odległość: '+(meters===null?'GPS nie został włączony':meters+' m')+'. Wymagana dokładność do 35 m, maksymalna odległość 60 m.</p>'+
 '<label class="hpt-photo-label">📷 Zrób zdjęcie obiektu<input id="htPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label>'+
 '<div id="htPhotoInfo" class="hpt-photo-info">Zdjęcie nie zostało jeszcze wybrane.</div>'+
 '<button type="button" data-ht-check class="hpt-treasure-submit" '+(busy?'disabled':'')+'>Sprawdź skarb (+0,5 HG)</button>'+
 '<p class="hpt-disclaimer">HealthGo sprawdza miejsce GPS i obecność pliku zdjęcia, ale nie rozpoznaje jeszcze jego zawartości. GPS również można sfałszować. Zdjęcie pozostaje na Twoim urządzeniu; serwer otrzymuje jedynie jego skrót SHA-256.</p></section></div>';
}
function gps(){
 if(!navigator.geolocation)return Promise.reject(new Error('Brak usługi lokalizacji.'));
 return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>{
  const c=p.coords,item={lat:Number(c.latitude),lon:Number(c.longitude),accuracy:Number(c.accuracy)};
  if(!Number.isFinite(item.lat)||!Number.isFinite(item.lon)||!Number.isFinite(item.accuracy)||item.accuracy<0)return reject(new Error('Nieprawidłowy odczyt GPS.'));
  resolve(item);
 },e=>reject(new Error(e.code===1?'Nie udzielono zgody na GPS. Włącz lokalizację w ustawieniach telefonu.':'Brak aktualnego sygnału GPS. Spróbuj ponownie na zewnątrz.')),
 {enableHighAccuracy:true,timeout:17000,maximumAge:0}));
}
async function check(){
 if(!selected||busy||!S.state.uid)return;
 const photo=document.getElementById('htPhoto')?.files?.[0];
 if(!photo||!/^image\/(png|jpeg|webp)$/.test(photo.type)||photo.size>7*1024*1024||photo.size<1000){
  notice='Wybierz aktualne zdjęcie JPG, PNG lub WebP o rozmiarze do 7 MB.';render();return;
 }
 if(!w.crypto?.subtle){notice='Weryfikacja zdjęcia wymaga bezpiecznego połączenia HTTPS.';render();return}
 busy=true;const task=selected,uid=String(S.state.uid);
 try{
  notice='Sprawdzam Twoją pozycję GPS…';render();
  const first=await gps();
  if(first.accuracy>35||distance(first,task)>60)throw Error('Zbyt słaby sygnał GPS lub za duża odległość. Spróbuj w bezpiecznym miejscu bliżej punktu.');
  const second=await gps();
  if(second.accuracy>35||distance(second,task)>60||distance(first,second)>45)throw Error('Nie udało się uzyskać dwóch dokładnych odczytów GPS.');
  const digest=await w.crypto.subtle.digest('SHA-256',await photo.arrayBuffer());
  const hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
  if(uid!==String(S.state.uid))throw Error('Sesja została zmieniona. Zaloguj się ponownie.');
  const result=await api.rpc('hg_point_claim',{p_site:task.id,p_lat:second.lat,p_lon:second.lon,p_accuracy:Math.round(second.accuracy),p_photo_sha256:hash});
  selected=null;coords=second;await points.refresh();
  notice=result?.already?'Ten skarb został już wcześniej zaliczony.':'Odkrycie zapisane! +0,5 wirtualnego HealthGo Point.';
 }catch(e){notice='Nie udało się zaliczyć skarbu: '+String(e.message||e);}
 finally{busy=false;render();}
}
root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-ht-close')){selected=null;render();return}
 if(b.hasAttribute('data-ht-wallet')){w.mobileGo?.('points');return}
 if(b.hasAttribute('data-ht-locate')){
  try{notice='Pobieram pozycję GPS…';render();coords=await gps();notice='Pozycja została odczytana. Nie udostępniamy jej publicznie.';}
  catch(err){notice=String(err.message||err)}
  render();return;
 }
 if(b.dataset.htSite){selected=findSites().find(s=>s.id===b.dataset.htSite&&!s.claimed)||null;render();return}
 if(b.hasAttribute('data-ht-check'))check();
});
root.addEventListener('change',e=>{if(e.target.id==='htPhoto'){const info=document.getElementById('htPhotoInfo');if(info)info.textContent=e.target.files?.[0]?'Wybrano zdjęcie. Możesz sprawdzić GPS.':'Nie wybrano zdjęcia.'}});
w.HealthGoTreasure=Object.freeze({refresh:render});
S.subscribe(s=>{if(!s.uid){coords=null;selected=null;}render()});
render();
})(window);