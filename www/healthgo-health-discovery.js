/* HealthGo — first-run health integration invitation.
 * This is an in-app invitation, not a system notification and not an app scanner.
 * iOS does not expose a general installed-app inventory. Android package discovery
 * must be implemented natively with narrowly declared package visibility.
 */
(function(w){
'use strict';
const d=w.document, S=w.HealthGoServices;
if(!d||!S)return;
const STORAGE='healthgo.health-discovery.prompt.v1';
let activeUid='',shown=false;
const platform=()=>/iPhone|iPad|iPod/i.test(w.navigator?.userAgent||'')?'ios':
 /Android/i.test(w.navigator?.userAgent||'')?'android':'other';
function node(tag,cls,text){
 const x=d.createElement(tag);if(cls)x.className=cls;
 if(text!==undefined)x.textContent=String(text);return x;
}
function remove(){d.getElementById('hgHealthDiscoveryPrompt')?.remove();}
function openDevices(){
 remove();
 const wizard=d.getElementById('hg50Wizard');
 if(wizard){wizard.scrollIntoView({behavior:'smooth',block:'center'});return;}
 const buttons=Array.from(d.querySelectorAll('button,[role="button"]'));
 const target=buttons.find(x=>/urz[aą]dzenia|zegarki|aktywnoś[cć]/i.test(x.textContent||''));
 if(target){target.click();return;}
 const note=node('p','hg-health-discovery-note','Otwórz zakładkę Urządzenia, aby zobaczyć dostępne metody synchronizacji.');
 note.id='hgHealthDiscoveryNote';
 (d.querySelector('main')||d.querySelector('.main')||d.body).prepend(note);
}
function connectApple(){
 remove();
 const api=w.HealthGoAppleHealth53;
 if(typeof api?.connect==='function'){void api.connect();return;}
 openDevices();
}
function render(){
 remove();
 if(!activeUid||shown||platform()==='other')return;
 let seen=false;
 try{seen=w.localStorage?.getItem(STORAGE+':'+encodeURIComponent(activeUid))==='1';}catch(_){}
 if(seen)return;
 const ios=platform()==='ios';
 const box=node('section','hg-health-discovery','');
 box.id='hgHealthDiscoveryPrompt';
 box.setAttribute('role','region');
 box.setAttribute('aria-labelledby','hgHealthDiscoveryTitle');
 const head=node('div','hg-health-discovery-head');
 head.append(node('span','hg-health-discovery-icon','♥'));
 const title=node('h3','','Połącz HealthGo z danymi zdrowotnymi');
 title.id='hgHealthDiscoveryTitle';
 head.append(title);
 box.append(head);
 box.append(node('p','',ios?
  'Możesz sprawdzić połączenie z Apple Zdrowie. HealthGo poprosi o dostęp dopiero po Twoim wyborze.':
  'Możesz sprawdzić dostępność synchronizacji przez Health Connect. HealthGo nie skanuje wszystkich aplikacji ani nie łączy ich bez Twojej zgody.'));
 const actions=node('div','hg-health-discovery-actions');
 const yes=node('button','hg-health-discovery-primary',ios?'Połącz Apple Zdrowie':'Sprawdź integracje');
 yes.type='button';yes.addEventListener('click',ios?connectApple:openDevices);
 const later=node('button','hg-health-discovery-secondary','Nie teraz');
 later.type='button';later.addEventListener('click',()=>{remove();shown=true;try{w.localStorage?.setItem(STORAGE+':'+encodeURIComponent(activeUid),'1');}catch(_){}});
 actions.append(yes,later);box.append(actions);
 const host=d.querySelector('main')||d.querySelector('.main')||d.body;
 host.prepend(box);shown=true;
}
function sessionChanged(event){
 const next=String(event?.detail?.uid||S.state?.uid||'');
 if(next===activeUid)return;
 activeUid=next;shown=false;remove();
 if(activeUid)render();
}
S.events?.addEventListener('SESSION_CHANGED',sessionChanged);
S.subscribe?.(()=>{const next=String(S.state?.uid||'');if(next!==activeUid)sessionChanged({detail:{uid:next}});});
if(S.state?.uid){activeUid=String(S.state.uid);render();}
})(window);
