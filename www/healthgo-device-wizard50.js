/* HealthGo Devices PRO 5.0 — brand / model / transport / real verification.
 * Does not simulate successful pairing, claim branded API partnerships, or mint health data.
 */
(function(w){
'use strict';
const S=w.HealthGoServices,cat=w.HealthGoDeviceCatalog50,d=w.document;
if(!S||!cat||!d)return;
const el=(tag,cls,text)=>{
 const x=d.createElement(tag);
 if(cls)x.className=cls;
 if(text!==undefined)x.textContent=String(text);
 return x;
};
const button=(text,handler,muted=false)=>{
 const b=el('button','hg50-button'+(muted?' subtle':''),text);b.type='button';
 b.addEventListener('click',handler);return b;
};
const detectedPlatform=()=>/iPhone|iPad|iPod/i.test(w.navigator?.userAgent||'')?'ios':
 /Android/i.test(w.navigator?.userAgent||'')?'android':'desktop';
const bleAvailable=()=>typeof w.navigator?.bluetooth?.requestDevice==='function';
const owner=()=>String(S.state?.uid||'');
const prefKey=()=>owner()?'healthgo.devices50.selection.'+encodeURIComponent(owner()):null;
let currentOwner=null,brand='apple',model='Series',method='health',step=1,status='';
let busy=false,gen=0;
function persist(){
 const key=prefKey();if(!key)return;
 try{w.localStorage?.setItem(key,JSON.stringify({brand,model}));}catch(_){}
}
function restore(){
 const key=prefKey();
 let value={};
 try{if(key)value=JSON.parse(w.localStorage?.getItem(key)||'{}')||{};}catch(_){}
 brand=cat.getBrand(value.brand|| (detectedPlatform()==='ios'?'apple':'samsung')).id;
 model=cat.getModel(brand,value.model);
 method='';
 step=1;status='';busy=false;gen++;
}
function resolve(){
 return cat.resolve({brand,model,platform:detectedPlatform(),webBluetooth:bleAvailable()});
}
function setBrand(id){
 const next=cat.getBrand(id);
 brand=next.id;model=next.models[0];method='';step=1;status='';
 persist();redraw();
}
function setModel(name){
 model=cat.getModel(brand,name);method='';status='';
 persist();redraw();
}
function setMethod(id){const match=resolve().methods.find(x=>x.id===id);if(!match)return;
 method=id;step=3;status='';redraw();
}
function setStatus(s){status=String(s||'').slice(0,390);
 const x=d.getElementById('hg50Status');if(x)x.textContent=status;}
function root(){return d.getElementById('hg50Wizard');}
function redraw(){
 const node=root();if(node)render(node.parentElement||null);
}
function section(tag,cls,label){return el(tag,cls,label);}
function caption(text){return el('p','hg50-caption',text);}
function renderBrands(container){
 const head=section('div','hg50-section-heading');
 head.append(section('h4','','1. Wybierz producenta'),caption('Wybierasz markę zegarka. Nie oznacza to jeszcze połączenia.'));
 container.appendChild(head);
 const grid=el('div','hg50-brands');
 for(const b of cat.brands){
  const tile=button(b.emoji+' '+b.label,()=>setBrand(b.id),b.id!==brand);
  tile.setAttribute('aria-pressed',String(brand===b.id));
  grid.appendChild(tile);
 }
 container.appendChild(grid);
 const pick=el('label','hg50-model');
 pick.append(el('span','','Rodzina modelu / typ urządzenia'));
 const select=el('select','hg50-select');
 select.id='hg50Model';select.setAttribute('aria-label','Rodzina modelu zegarka');
 for(const name of cat.getBrand(brand).models){
  const opt=el('option','',name);opt.value=name;select.appendChild(opt);
 }
 select.value=model;select.addEventListener('change',()=>setModel(select.value));
 pick.appendChild(select);container.appendChild(pick);
}
function renderPaths(container,plan){
 const heading=el('div','hg50-section-heading');
 heading.append(el('h4','','2. Wybierz rzeczywistą metodę'),caption('Możliwości zależą od telefonu i modelu. Wykorzystamy wyłącznie zgodne integracje.'));
 container.appendChild(heading);
 const notice=el('div','hg50-status-card');
 notice.append(el('strong','','Wybrano: '+plan.brandName+' · '+plan.model),
  el('span','','Aplikacja producenta: '+plan.companion),
  el('span','','Telefon: '+(plan.platform==='ios'?'iPhone':plan.platform==='android'?'Android':'Komputer')));
 container.appendChild(notice);
 const list=el('div','hg50-method-list');
 for(const p of plan.methods){
  const wrap=el('div','hg50-method');
  const choose=button((p.kind==='ble'?'ᛒ ':p.kind==='native'?'♥ ':'↗ ')+p.label,
   ()=>setMethod(p.id),p.id!==method);
  choose.setAttribute('aria-pressed',String(p.id===method));
  const descr=caption(p.note);
  wrap.append(choose,descr);list.appendChild(wrap);
 }
 container.appendChild(list);
}
function renderAction(container,plan){
 const p=plan.methods.find(m=>m.id===method);
 if(!p)return;
 const pane=el('div','hg50-instructions');
 pane.append(el('h4','','3. Sprawdź i połącz'),
  el('p','',p.note));
 const actions=el('div','hg50-actions');
 if(p.kind==='ble'&&p.enabled){
  const b=button(busy?'Trwa łączenie…':'Wyszukaj i połącz Bluetooth LE',()=>startBle());
  b.disabled=busy;actions.appendChild(b);
 }else if(p.kind==='ble'){
  pane.appendChild(caption('Ta przeglądarka nie umożliwia bezpośredniego wyszukania urządzenia. Nie otwieramy nieobsługiwanych adresów systemowych.'));
 }else if(p.id==='health'){
  pane.appendChild(caption('Najpierw sparuj zegarek w aplikacji producenta. Sprawdź, czy dane są zapisane w Zdrowiu (iPhone) albo Health Connect (Android). Synchronizacja do HealthGo wymaga natywnej aplikacji z odpowiednimi uprawnieniami.'));
 }else{
  pane.appendChild(caption('Otwórz na telefonie oficjalną aplikację producenta. Jeśli udostępnia dane do systemowej aplikacji zdrowotnej, natywne HealthGo będzie mogło je odczytać po uzyskaniu zgody.'));
 }
 actions.append(button('Odśwież prawdziwe odczyty',()=>void refresh(),true));
 pane.appendChild(actions);
 const result=el('p','hg50-result',status);result.id='hg50Status';result.setAttribute('role','status');pane.appendChild(result);
 container.appendChild(pane);
}
async function startBle(){
 const plan=resolve(),p=plan.methods.find(m=>m.id==='ble');
 if(busy||!p?.enabled||method!=='ble')return;
 if(!owner()){setStatus('Najpierw zaloguj się do swojego konta HealthGo.');return;}
 const a=w.HealthGoDevices;
 if(typeof a?.connect!=='function'){setStatus('Moduł łączenia BLE nie jest dostępny.');return;}
 const uid=owner(),generation=++gen;busy=true;
 setStatus('Otwieram systemowy wybór urządzeń Bluetooth…');
 // Call BLE directly from the click callback before crossing an await boundary.
 try{
  await a.connect();
  if(generation!==gen||uid!==owner())return;
  if(a.connected&&a.activeDevice){
   setStatus('Połączono przez Bluetooth LE: '+String(a.activeDevice.name||'wybrane urządzenie').slice(0,90)+
    '. Sprawdzono rzeczywiste połączenie. Obsługiwane usługi: '+
    (a.capabilities?.length?a.capabilities.join(', '):'brak potwierdzonych standardowych odczytów')+
    '. Wybór marki nie weryfikuje modelu.');
  }else{
   const legacy=d.getElementById('hgRealDeviceStatus')?.textContent||'';
   setStatus(legacy||'Nie potwierdzono połączenia. Włącz tryb parowania i spróbuj ponownie.');
  }
 }catch(e){if(generation===gen)setStatus('Łączenie nie powiodło się: '+String(e?.message||'Błąd urządzenia').slice(0,180));}
 finally{if(generation===gen){busy=false;const r=root();if(r)render(r.parentElement);}}
}
async function refresh(){
 if(busy)return;
 const uid=owner(),generation=++gen;
 if(!uid){setStatus('Zaloguj się, aby odświeżyć pomiary.');return;}
 busy=true;setStatus('Sprawdzam dane zapisane na Twoim koncie…');
 try{
  const [devices,health]=await Promise.allSettled([S.refreshDevices?.(),S.refreshHealth?.()]);
  if(uid!==owner()||generation!==gen)return;
  setStatus(devices.status==='fulfilled'&&health.status==='fulfilled'?
   'Odświeżono dane konta. Jeżeli nadal nie ma pomiarów, źródło nie udostępniło ich jeszcze HealthGo.':
   'Część danych jest niedostępna. Sprawdź połączenie internetowe i uprawnienia.');
 }catch(_){if(uid===owner()&&generation===gen)setStatus('Odświeżenie się nie powiodło.');}
 finally{if(generation===gen){busy=false;const r=root();if(r)render(r.parentElement);}}
}
function render(parent){
 if(!parent)return;
 if(owner()!==currentOwner){currentOwner=owner();restore();}
 const plan=resolve();
 let panel=root();
 if(!panel){panel=el('section','hg45-card hg50-wizard');panel.id='hg50Wizard';parent.appendChild(panel);}
 panel.replaceChildren();
 const heading=el('div','hg50-heading');
 heading.append(el('span','hg45-kicker','URZĄDZENIA PRO 5.0'),
  el('h3','','Dodaj zegarek lub opaskę'),
  caption('Jeden kreator dla różnych marek. Pokazujemy tylko połączenia i odczyty faktycznie dostępne na urządzeniu.'));
 panel.appendChild(heading);
 renderBrands(panel);
 renderPaths(panel,plan);
 if(method)renderAction(panel,plan);
 else panel.appendChild(caption('Wybierz metodę z listy, aby przejść dalej. Brak potwierdzonego połączenia nie zostanie oznaczony jako sukces.'));
}
w.HealthGoDeviceWizard50=Object.freeze({render,resolve,getState:()=>({owner:currentOwner,brand,model,method,step,status,busy}),selectBrand:setBrand,selectModel:setModel,selectMethod:setMethod});
w.HealthGoDevicesPro45?.render?.();
})(window);
