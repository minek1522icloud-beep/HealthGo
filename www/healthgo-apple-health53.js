/* HealthGo 5.3 — Apple Health / Apple Watch in the signed Capacitor iOS app.
 * HealthKit is not available to Safari/PWA. The watch remains paired in Apple's Watch app.
 * Read only; samples stay on device, never uploaded by this integration.
 */
(function (w) {
'use strict';
const d=w.document, S=w.HealthGoServices;
if(!d||!S)return;
const name='HealthGoHealth';
const uid=()=>String(S.state?.uid||'');
const key=user=>'healthgo.applehealth.enabled.'+encodeURIComponent(user);
const native=()=>w.Capacitor?.isNativePlatform?.()===true &&
 w.Capacitor?.getPlatform?.()==='ios' &&
 typeof w.Capacitor?.registerPlugin==='function';
let owner='',enabled=false,busy=false,message='',lastUpdated='',revision=0,lastRefresh=0;
let plugin=null;
function bridge(){
 if(!native())return null;
 try{return plugin||(plugin=w.Capacitor.registerPlugin(name));}catch(_){return null;}
}
function checkOwner(){
 const next=uid();
 if(owner===next)return;
 owner=next;revision++;busy=false;lastUpdated='';message='';
 try{enabled=!!owner&&w.localStorage?.getItem(key(owner))==='true';}
 catch(_){enabled=false;}
}
function saveFlag(){
 if(!owner)return;
 try{if(enabled)w.localStorage?.setItem(key(owner),'true');
 else w.localStorage?.removeItem(key(owner));}catch(_){}
}
function elt(tag,cls,value){
 const n=d.createElement(tag);if(cls)n.className=cls;
 if(value!==undefined)n.textContent=String(value);return n;
}
function btn(label,fn,quiet=false){
 const n=elt('button','hg45-btn'+(quiet?' secondary':''));
 n.type='button';n.textContent=label;n.disabled=busy;n.addEventListener('click',fn);return n;
}
function setMessage(value){message=String(value||'').slice(0,380);renderCached();}
function renderCached(){const node=d.getElementById('hg53AppleHealth');if(node&&node.parentElement)render(node.parentElement);}
function render(parent){
 if(!parent)return;
 checkOwner();
 let root=d.getElementById('hg53AppleHealth');
 if(!root){root=elt('section','hg45-card hg53-applehealth');root.id='hg53AppleHealth';parent.appendChild(root);}
 root.replaceChildren();
 root.append(elt('span','hg45-kicker','APPLE WATCH · PIERWSZA INTEGRACJA'),
  elt('h3','','Apple Watch i Apple Health'),
  elt('p','hg45-caption','Połącz dane z aplikacji Zdrowie. Sam zegarek musi być wcześniej sparowany w aplikacji Watch.'));
 const state=elt('div','hg53-state');
 state.append(elt('strong','',enabled?'Synchronizacja włączona':'Niepołączono'),
  elt('span','',!native()?'W tej wersji internetowej odczyt Apple Health jest niedostępny.':enabled?
   (lastUpdated?'Ostatni odczyt: '+lastUpdated:'Czekam na pierwszy odczyt Apple Health.'):
   'Dostęp do Apple Health wymaga Twojej zgody.'));
 root.appendChild(state);
 const controls=elt('div','hg53-actions');
 if(native()&&owner){
  if(enabled){
   controls.append(btn('Synchronizuj teraz',()=>void sync()),btn('Rozłącz',()=>void disconnect(),true));
  }else controls.append(btn('Połącz Apple Health',()=>void connect()));
 }else if(!owner)root.appendChild(elt('p','hg45-caption','Zaloguj się do HealthGo, aby przypisać synchronizację do swojego konta.'));
 else root.appendChild(elt('p','hg45-caption','Na iPhonie potrzebna jest natywna aplikacja HealthGo z HealthKit. Skrót WWW nie ma tych uprawnień.'));
 root.appendChild(controls);
 root.appendChild(elt('p','hg45-caption','Wyniki kroków, tętna, dystansu i kalorii pojawią się w Start i Aktywność, nie tutaj. HealthGo nie odczytuje baterii Apple Watch przez HealthKit.'));
 const detail=elt('p','hg53-message',message);detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');root.appendChild(detail);
}
async function read(user,token){
 const api=bridge();
 if(!api)throw new Error('Moduł Apple Health nie został załadowany w aplikacji iOS.');
 const sample=await api.readToday();
 if(user!==uid()||token!==revision||!enabled)return false;
 const valid=['steps','distanceKm','activeCalories','heartRate','sleepMinutes'].some(k=>
  typeof sample?.[k]==='number'&&Number.isFinite(sample[k])&&sample[k]>=0);
 if(valid){
  if(typeof S.applyNativeHealthSnapshot!=='function')throw new Error('Moduł statystyk HealthGo jest niedostępny.');
  if(!S.applyNativeHealthSnapshot(sample,user))throw new Error('Nie udało się zaktualizować statystyk konta.');
  lastUpdated=new Date(sample.updatedAt||Date.now()).toLocaleString('pl-PL',{dateStyle:'short',timeStyle:'short'});
  setMessage('Odczytano rzeczywiste dane z Apple Health. Wyniki są na ekranie Start i w Aktywności.');
 }else{
  lastUpdated='';
  setMessage('Nie otrzymano jeszcze pomiarów. Sprawdź uprawnienia HealthGo w aplikacji Zdrowie oraz synchronizację zegarka.');
 }
 return valid;
}
async function connect(){
 checkOwner();if(busy)return;
 const user=uid(),api=bridge();
 if(!user){setMessage('Najpierw zaloguj się do HealthGo.');return;}
 if(!api){setMessage('Apple Health wymaga podpisanej natywnej aplikacji na iPhonie.');return;}
 const token=++revision;busy=true;setMessage('Sprawdzam Apple Health…');
 try{
  const availability=await api.availability();
  if(user!==uid()||token!==revision)return;
  if(!availability?.available)throw new Error('Apple Health jest niedostępne na tym urządzeniu.');
  setMessage('Otwieram prośbę o dostęp do Apple Health…');
  const permission=await api.requestAccess();
  if(user!==uid()||token!==revision)return;
  if(permission?.requested!==true)throw new Error('Nie udało się zakończyć prośby o dostęp.');
  // HealthKit does not reveal whether read permission was declined.
  enabled=true;saveFlag();
  await read(user,token);
 }catch(e){if(user===uid()&&token===revision)setMessage('Nie udało się włączyć synchronizacji: '+String(e?.message||e).slice(0,200));}
 finally{if(user===uid()&&token===revision){busy=false;renderCached();}}
}
async function sync(){
 checkOwner();if(busy||!enabled||!native()||!uid())return;
 const user=uid(),token=++revision;busy=true;setMessage('Pobieram najnowsze dostępne odczyty z Apple Health…');
 try{await read(user,token);}
 catch(e){if(user===uid()&&token===revision)setMessage('Nie udało się odczytać Apple Health: '+String(e?.message||e).slice(0,200));}
 finally{if(user===uid()&&token===revision){busy=false;lastRefresh=Date.now();renderCached();}}
}
async function disconnect(){
 checkOwner();if(busy||!enabled)return;
 if(typeof w.confirm==='function'&&!w.confirm('Wyłączyć synchronizację Apple Health w HealthGo? Zegarek pozostanie sparowany z iPhonem.'))return;
 revision++;enabled=false;saveFlag();lastUpdated='';
 S.clearNativeHealthSnapshot?.(uid());
 setMessage('Rozłączono w HealthGo. Aby cofnąć zgodę HealthKit w iOS, otwórz uprawnienia HealthGo w aplikacji Zdrowie.');
}
function resume(){
 checkOwner();
 if(native()&&enabled&&uid()&&!busy&&Date.now()-lastRefresh>60000)void sync();
}
S.subscribe?.(()=>{const before=owner;checkOwner();if(before!==owner)renderCached();});
w.addEventListener?.('pageshow',resume);
d.addEventListener?.('visibilitychange',()=>{if(d.visibilityState==='visible')resume();});
w.HealthGoAppleHealth53=Object.freeze({
 render,connect,sync,disconnect,
 getState:()=>({owner,enabled,busy,lastUpdated,message,native:native()})
});
})(window);
