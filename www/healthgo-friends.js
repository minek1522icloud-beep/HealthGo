/* HealthGo Friends: consent-only friend code invitations backed by Supabase RPC.
 * No directory search, exposed email, health readings or friend location. */
(function(){
'use strict';
const S=window.HealthGoSupabase,Services=window.HealthGoServices;
if(!S||!Services)return;
let uid='',snapshot=null,busy=false,message='',request=0;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function isUid(){return String(Services.state.uid||'');}
function el(){return document.getElementById('hgFriendsPanel');}
function ensure(){
 const parent=document.getElementById('settingsAccount');
 if(!parent)return null;
 let panel=el();
 if(panel)return panel;
 panel=document.createElement('section');panel.id='hgFriendsPanel';panel.className='hgf-panel';parent.appendChild(panel);
 panel.addEventListener('click',onClick);
 panel.addEventListener('submit',onSubmit);
 return panel;
}
function listRow(item,mode){
 const buttons=mode==='incoming'
 ?'<button type="button" data-friend-action="accept" data-id="'+esc(item.id)+'">Akceptuj</button><button type="button" class="hgf-subtle" data-friend-action="decline" data-id="'+esc(item.id)+'">Odrzuć</button>'
 :mode==='friends'
 ?'<button type="button" class="hgf-subtle" data-friend-action="remove" data-id="'+esc(item.id)+'">Usuń</button><button type="button" class="hgf-danger" data-friend-action="block" data-id="'+esc(item.id)+'">Zablokuj</button>'
 :mode==='blocked'
 ?'<button type="button" class="hgf-subtle" data-friend-action="unblock" data-id="'+esc(item.user_id)+'">Odblokuj</button>'
 :'<span class="hgf-pending">Oczekuje na odpowiedź</span><button type="button" class="hgf-subtle" data-friend-action="remove" data-id="'+esc(item.id)+'">Anuluj</button>';
 return '<div class="hgf-person"><span class="hgf-person-avatar" aria-hidden="true">'+esc((item.nickname||'H').charAt(0).toUpperCase())+'</span><span class="hgf-person-name">'+esc(item.nickname||'Użytkownik HealthGo')+'</span><span class="hgf-person-actions">'+buttons+'</span></div>';
}
function section(title,items,mode,empty){
 return '<div class="hgf-section"><h4>'+esc(title)+' <span>'+items.length+'</span></h4>'+
 (items.length?items.map(item=>listRow(item,mode)).join(''):'<p class="hgf-empty">'+esc(empty)+'</p>')+'</div>';
}
function paint(){
 const root=ensure();if(!root)return;
 let html='<div class="hgf-heading"><div><span class="hgf-eyebrow">HEALTHGO FRIENDS</span><h3>Znajomi</h3><p>Dodawaj znajomych kodem. Każda osoba musi zaakceptować zaproszenie.</p></div><button type="button" data-friend-action="refresh" '+(busy?'disabled':'')+'>Odśwież</button></div>';
 if(!uid){root.innerHTML=html+'<p class="hgf-empty">Zaloguj się, aby korzystać ze znajomych.</p>';return;}
 if(message)html+='<p class="hgf-status" role="status">'+esc(message)+'</p>';
 if(snapshot){
  html+='<div class="hgf-my-code"><div><span>Twój prywatny kod zaproszeń</span><strong>'+esc(snapshot.code||'—')+'</strong></div><button type="button" data-friend-action="copy-code">Kopiuj</button></div>'+
  '<form class="hgf-send" data-friend-form="1"><label for="hgfFriendCode">Dodaj znajomego kodem</label><div><input id="hgfFriendCode" name="friendCode" maxlength="18" autocomplete="off" autocapitalize="characters" inputmode="text" pattern="[a-fA-F0-9]{18}" placeholder="18 znaków kodu" required><button type="submit" '+(busy?'disabled':'')+'>Wyślij prośbę</button></div></form>'+
  section('Zaproszenia do Ciebie',Array.isArray(snapshot.incoming)?snapshot.incoming:[],'incoming','Brak nowych zaproszeń.')+
  section('Znajomi',Array.isArray(snapshot.friends)?snapshot.friends:[],'friends','Nie masz jeszcze znajomych.')+
  section('Wysłane zaproszenia',Array.isArray(snapshot.outgoing)?snapshot.outgoing:[],'outgoing','Nie wysyłano jeszcze zaproszeń.')+
  section('Zablokowani',Array.isArray(snapshot.blocked)?snapshot.blocked:[],'blocked','Brak zablokowanych kont.');
 }else html+='<p class="hgf-empty">'+(busy?'Pobieram listę znajomych…':'Naciśnij Odśwież, aby pobrać swoją listę znajomych.')+'</p>';
 html+='<p class="hgf-privacy">Prywatność: znajomi widzą tylko Twój nick. Nie udostępniamy im lokalizacji, e-maila ani danych zdrowotnych. Zaproszenia można odrzucać, a znajomych usuwać i blokować.</p>';
 root.innerHTML=html;
}
async function load(){
 const now=isUid();
 if(!now){uid='';snapshot=null;message='';paint();return;}
 if(busy)return;
 uid=now;const ticket=++request;busy=true;paint();
 try{
  const result=await S.db.rpc('healthgo_friends_snapshot',{});
  if(ticket!==request||now!==isUid())return;
  snapshot=result||null;message='';
 }catch(err){if(ticket!==request||now!==isUid())return;message='Nie udało się pobrać znajomych: '+(err.message||'Błąd połączenia');}
 finally{if(ticket===request){busy=false;paint();}}
}
async function change(action,id){
 if(busy)return;
 busy=true;message='Zapisuję…';paint();
 try{
  if(action==='send'){
   await S.db.rpc('healthgo_friend_send',{p_code:id});
   message='Zaproszenie wysłane. Druga osoba musi je zaakceptować.';
  }else{
   const types={accept:['respond',true],decline:['respond',false],remove:['remove',false],block:['block',false],unblock:['unblock',false]};
   if(!types[action])return;
   await S.db.rpc('healthgo_friend_action',{p_action:types[action][0],p_id:id,p_accept:types[action][1]});
   message=action==='accept'?'Dodano do znajomych.':action==='block'?'Użytkownik został zablokowany.':action==='unblock'?'Odblokowano konto.':'Zapisano zmianę.';
  }
  snapshot=await S.db.rpc('healthgo_friends_snapshot',{});
 }catch(err){message='Nie udało się wykonać akcji: '+(err.message||'Błąd połączenia');}
 finally{busy=false;paint();}
}
function onClick(ev){
 const button=ev.target.closest('[data-friend-action]');if(!button)return;
 const action=button.getAttribute('data-friend-action'),id=button.getAttribute('data-id');
 if(action==='refresh'){load();return;}
 if(action==='copy-code'&&snapshot?.code){
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(snapshot.code).then(()=>{message='Kod skopiowany.';paint();}).catch(()=>{message='Zaznacz kod i skopiuj ręcznie.';paint();});
  else{message='Zaznacz kod i skopiuj ręcznie.';paint();}
  return;
 }
 if(action==='block'&&typeof window.confirm==='function'&&!window.confirm('Zablokować użytkownika? Nie będziecie już znajomymi.'))return;
 if(!id)return;
 change(action,id);
}
function onSubmit(ev){
 if(!ev.target.matches('[data-friend-form]'))return;ev.preventDefault();
 const raw=String(ev.target.elements.friendCode.value||'').trim().toUpperCase();
 if(!/^[A-F0-9]{18}$/.test(raw)){message='Kod powinien mieć 18 znaków (litery A–F i cyfry).';paint();return;}
 change('send',raw);
}
Services.subscribe(function(st){
 const next=String(st.uid||'');
 if(next===uid)return;
 ++request;uid=next;snapshot=null;busy=false;message='';
 paint();if(uid)load();
});
window.HealthGoFriends={refresh:load,getState:()=>snapshot,render:paint};
})();