/* HealthGo Point: free, non-cash, non-purchasable virtual points.
 * Supabase RPC performs all balance changes. No client-side minting.
 */
(function(w){
'use strict';
const node=document.getElementById('hgPointCenter'),api=w.HealthGoSupabase?.db,services=w.HealthGoServices;
if(!node||!api||!services)return;
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=n=>(Number(n||0)/2).toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1});
let owner='',state=null,tab='catalog',pending=false,notice='',friends=[];
function data(){return state||{units:0,catalog:[],inventory:[],events:[],sites:[]}}
function has(id){return data().inventory.some(x=>x.id===id&&x.quantity>0)}
function navigate(page){if(typeof w.mobileGo==='function')w.mobileGo(page);else if(typeof w.go==='function')w.go(page);}
async function refresh(){
 const uid=String(services.state.uid||'');
 if(uid!==owner){owner=uid;state=null;friends=[]}
 if(!uid){notice='Zaloguj się, aby używać HealthGo Point.';render();return}
 try{const value=await api.rpc('hg_point_snapshot',{});if(uid!==owner)return;state=value;notice='';}
 catch(e){if(uid===owner)notice='Nie udało się pobrać portfela: '+String(e.message||e);}
 render();
}
function status(t){notice=t;render()}
function render(){
 const v=data(),reward=v.catalog||[],inventory=v.inventory||[],events=v.events||[];
 const owned=inventory.length;
 node.innerHTML='<div class="hpt-hero"><div><small>NOWY SYSTEM HEALTHGO</small><h2>HealthGo Point</h2><p>Odkrywaj miejsca, rozwijaj kolekcję i zdobywaj wirtualne nagrody.</p></div>'+
 '<div class="hpt-balance"><b>'+format(v.units)+' HG</b><span>Twoje punkty</span></div></div>'+
 '<div class="hpt-mini"><span>🧭 '+(v.sites||[]).filter(x=>x.claimed).length+' odkryć</span><span>🎁 '+owned+' przedmiotów</span><span>⭐ 0,5 HG za skarb</span></div>'+
 (notice?'<p class="hpt-notice" role="status">'+html(notice)+'</p>':'')+
 '<div class="hpt-tabs">'+[['catalog','Nagrody'],['inventory','Kolekcja'],['friends','Wymiana'],['history','Historia']].map(a=>'<button data-hpt-tab="'+a[0]+'" aria-pressed="'+(tab===a[0])+'" class="'+(tab===a[0]?'active':'')+'">'+a[1]+'</button>').join('')+'</div>'+
 (tab==='catalog'?'<h3>Nagrody cyfrowe</h3><div class="hpt-grid">'+reward.map(i=>'<article class="hpt-item"><span class="hpt-emoji">'+html(i.emoji)+'</span><b>'+html(i.title)+'</b><p>'+html(i.description)+'</p><div><strong>'+format(i.priceUnits)+' HG</strong><button data-hpt-buy="'+html(i.id)+'" '+(pending||has(i.id)||!owner?'disabled':'')+'>'+(has(i.id)?'Posiadasz':'Odbierz')+'</button></div></article>').join('')+'</div>'+
 '<div class="hpt-wait"><b>🍦 Lód Kaktus · 🥗 Sałatka · inne produkty</b><p>To propozycje przyszłych nagród. Obecnie nie można ich odbierać: wymaga to prawdziwych partnerów i zasad wydawania.</p></div>':
 tab==='inventory'?'<h3>Twój Plecak</h3>'+(inventory.length?'<div class="hpt-grid">'+inventory.map(x=>{const item=reward.find(y=>y.id===x.id);return '<article class="hpt-item"><span class="hpt-emoji">'+html(item?.emoji||'✦')+'</span><b>'+html(item?.title||x.id)+'</b><p>Przedmiot cyfrowy · w kolekcji</p></article>'}).join('')+'</div>':'<p class="hpt-empty">Nie masz jeszcze przedmiotów. Zbieraj punkty w Poszukiwaczu Skarbów.</p>'):
 tab==='friends'?'<h3>Wymiana ze znajomymi</h3><div class="hpt-gift"><p>Punkty można przekazać tylko zaakceptowanemu znajomemu. Nie są to pieniądze ani nagrody rzeczowe. Limity chronią przed przypadkowymi transferami.</p>'+
 '<label>Wybierz znajomego<select id="hptFriend"><option value="">Wybierz…</option>'+friends.map(f=>'<option value="'+html(f.id)+'">'+html(f.name)+'</option>').join('')+'</select></label>'+
 '<label>Ilość<select id="hptAmount">'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+format(n)+' HG</option>').join('')+'</select></label>'+
 '<button data-hpt-refresh-friends>Odśwież znajomych</button> <button class="hpt-primary" data-hpt-send '+(pending||!owner?'disabled':'')+'>Potwierdź przekazanie</button></div>':
 '<h3>Historia punktów</h3>'+(events.length?events.map(e=>'<div class="hpt-event"><span>'+html(({treasure:'Odkrycie',virtual_item:'Nagroda cyfrowa',gift_sent:'Przekazano',gift_received:'Otrzymano'})[e.kind]||'Punkty')+'</span><b>'+(e.units>0?'+':'')+format(e.units)+' HG</b></div>').join(''):'<p class="hpt-empty">Nie ma jeszcze zapisanych operacji.</p>'))+
 '<div class="hpt-disclaimer">HealthGo Point to wyłącznie wirtualne punkty bez wartości pieniężnej. XP pozostaje osobną statystyką. Nie są dostępne zakupy, wypłaty ani wymiana na rzeczywiste produkty.</div>';
 const small=document.getElementById('hgPointHomeMini');
 if(small)small.textContent=format(v.units)+' HG';
}
async function buy(id){
 const item=data().catalog?.find(x=>x.id===id);
 if(!item||has(id)||pending||!owner)return;
 if(!w.confirm('Odbierasz '+item.title+' za '+format(item.priceUnits)+' HG. Kontynuować?'))return;
 pending=true;
 try{await api.rpc('hg_point_redeem',{p_item:id});await refresh();status('Przedmiot zapisany w kolekcji.')}
 catch(e){status('Nie udało się odebrać przedmiotu: '+String(e.message||e))}
 finally{pending=false;render()}
}
async function loadFriends(){
 const uid=owner;if(!uid)return;
 try{
 const rows=await api.select('healthgo_friend_links',{or:'(requester_id.eq.'+uid+',recipient_id.eq.'+uid+')',status:'eq.accepted',limit:100});
 const ids=[...new Set((rows||[]).map(x=>x.requester_id===uid?x.recipient_id:x.requester_id))].filter(x=>/^[0-9a-f-]{36}$/i.test(x)).slice(0,30);
 const list=await Promise.all(ids.map(async id=>{try{const p=await api.rpc('healthgo_profile_get',{p_user_id:id});return{id,name:p?.available?p.nickname:'Znajomy HealthGo'}}catch(_){return{id,name:'Znajomy HealthGo'}}}));
 if(uid!==owner)return;friends=list;render();
 }catch(e){status('Nie można pobrać listy znajomych.')}
}
async function send(){
 const friend=document.getElementById('hptFriend')?.value,units=Number(document.getElementById('hptAmount')?.value);
 if(pending||!friends.some(x=>x.id===friend)||!Number.isInteger(units)||units<1||units>10)return status('Wybierz znajomego i ilość punktów.');
 if(!w.confirm('Przekazać '+format(units)+' HG? Tego działania nie można cofnąć.'))return;
 const nonce=w.crypto?.randomUUID?.();if(!nonce)return status('Wymagane bezpieczne połączenie HTTPS.');
 pending=true;
 try{await api.rpc('hg_point_gift',{p_friend:friend,p_units:units,p_nonce:nonce});await refresh();status('Przekazano punkty znajomemu.')}
 catch(e){status('Nie udało się przekazać punktów: '+String(e.message||e))}
 finally{pending=false;render()}
}
node.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.hptTab){tab=b.dataset.hptTab;render();if(tab==='friends'&&owner)loadFriends();}
 if(b.dataset.hptBuy)buy(b.dataset.hptBuy);
 if(b.hasAttribute('data-hpt-refresh-friends'))loadFriends();
 if(b.hasAttribute('data-hpt-send'))send();
});
services.subscribe(s=>{const id=String(s.uid||'');if(id!==owner){owner=id;state=null;friends=[];refresh();}});
w.HealthGoPoints=Object.freeze({refresh,getState:()=>data(),format});
refresh();
})(window);