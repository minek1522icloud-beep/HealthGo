(function(){
'use strict';
const host=()=>document.getElementById('settingsPrivacy');
const services=()=>window.HealthGoServices;
let root=null,busy=false,inviteCode='',notice='',unsubscribe=null;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
function button(label,action,kind){const b=el('button','hg-family-btn '+(kind||''),label);b.type='button';b.addEventListener('click',action);return b;}
function message(text,error){const n=el('p','hg-family-message'+(error?' is-error':''),text);n.setAttribute('role','status');return n;}
function run(action){return async function(){if(busy)return;busy=true;notice='';render();try{await action();}catch(e){notice=services()?.errorMessage?.(e)||'Nie udało się wykonać operacji. Spróbuj ponownie.';}finally{busy=false;render();}};}
function render(){
 const section=host(),api=services();if(!section||!api)return;
 if(!root){root=el('section','hg-family-home');root.id='hgFamilyHome';root.setAttribute('aria-labelledby','hgFamilyHeading');section.appendChild(root);}
 root.replaceChildren();
 const state=api.state||{},family=state.family||{},members=Array.isArray(family.members)?family.members:[];
 const head=el('div','hg-family-head');head.append(el('span','hg-family-kicker','HEALTHGO FAMILY 2.0'),el('h3','', 'Twoja rodzina'));root.append(head);
 root.append(el('p','hg-family-intro','Połącz konta bliskich i zarządzaj udostępnianiem. Dane zdrowotne i lokalizacja nie są udostępniane automatycznie.'));
 if(notice)root.append(message(notice,true));
 if(busy)root.append(message('Zapisywanie…',false));
 if(!family.id){
  const card=el('div','hg-family-card');card.append(el('h4','','Utwórz rodzinę lub dołącz'));
  const profile=state.profile||{},guardian=profile.accountType==='guardian'||profile.accountType==='guardian';
  if(guardian){
   const name=el('input','hg-family-input');name.id='hgFamilyName';name.maxLength=60;name.placeholder='Nazwa rodziny (opcjonalnie)';name.setAttribute('aria-label','Nazwa rodziny');
   card.append(name,button('Utwórz rodzinę',run(async()=>{await api.call('createFamily',{name:name.value.trim()});notice='Rodzina została utworzona.';}),'primary'));
  }else{
   card.append(message('Rodzinę tworzy konto rodzica lub opiekuna. Możesz dołączyć za pomocą kodu zaproszenia.',false));
  }
  const code=el('input','hg-family-input');code.id='hgFamilyInviteCode';code.maxLength=64;code.autocomplete='one-time-code';code.placeholder='Wpisz kod zaproszenia';code.setAttribute('aria-label','Kod zaproszenia');
  card.append(code,button('Dołącz do rodziny',run(async()=>{const value=code.value.trim();if(!value)throw new Error('Wpisz kod zaproszenia.');await api.call('acceptFamilyInvite',{code:value});notice='Dołączono do rodziny.';}),'secondary'));
  root.append(card);return;
 }
 const summary=el('div','hg-family-card');summary.append(el('h4','',family.name||'Rodzina HealthGo'),el('p','hg-family-muted',members.length+' członków · rola: '+(family.callerRole||'członek')));
 const list=el('ul','hg-family-members');
 members.forEach(member=>{const item=el('li','');item.append(el('span','',member.nickname||'Członek rodziny'),el('small','',member.role==='guardian'?'Rodzic / opiekun':member.role==='child'?'Dziecko':'Członek'));list.append(item);});
 if(!members.length)list.append(el('li','','Brak danych o członkach.'));
 summary.append(list);root.append(summary);
 if(family.callerRole==='guardian'){
  const invite=el('div','hg-family-card');invite.append(el('h4','','Zaproszenie do rodziny'),el('p','hg-family-muted','Kod jest przeznaczony dla jednej osoby i ma ograniczony czas ważności.'));
  invite.append(button('Wygeneruj kod zaproszenia',run(async()=>{const result=await api.call('createFamilyInvite',{});inviteCode=String(result?.code||result?.inviteCode||'');notice=inviteCode?'Kod zaproszenia został wygenerowany.': 'Backend nie zwrócił kodu zaproszenia.';}),'primary'));
  if(inviteCode){const code=el('code','hg-family-code',inviteCode);invite.append(code,button('Kopiuj kod',async()=>{try{await navigator.clipboard.writeText(inviteCode);notice='Kod skopiowany.';}catch(_){notice='Nie udało się skopiować kodu.';}render();},'secondary'));}
  root.append(invite);
 }
 root.append(button('Odśwież dane rodziny',run(async()=>{await api.initialize();notice='Dane rodziny zostały odświeżone.';}),'secondary'));
}
function start(){const api=services();if(!api)return;if(!unsubscribe&&typeof api.subscribe==='function')unsubscribe=api.subscribe(()=>render());render();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.HealthGoFamilyHome={refresh:render,stop(){if(unsubscribe)unsubscribe();unsubscribe=null;root=null;}};
})();