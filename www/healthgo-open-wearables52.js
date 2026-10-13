/* HealthGo 5.2: optional self-hosted Open Wearables provider account connections.
 * Data and API keys are not stored in this page; Supabase validates users.
 * Cloud-provider support depends on the admin running OW + provider approval.
 */
(function(w){
'use strict';
const d=w.document,S=w.HealthGoServices,api=w.HealthGoSupabase;
if(!d||!S||!api)return;
const $=id=>d.getElementById(id);
const node=(tag,cls,value)=>{
 const e=d.createElement(tag);if(cls)e.className=cls;
 if(value!==undefined)e.textContent=String(value);
 return e;
};
const control=(label,fn,quiet=false)=>{
 const b=node('button','hg52-button'+(quiet?' quiet':''),label);
 b.type='button';b.addEventListener('click',fn);return b;
};
const providers=[
 {id:'garmin',name:'Garmin'}, {id:'polar',name:'Polar'},
 {id:'suunto',name:'Suunto'}, {id:'whoop',name:'WHOOP'},
 {id:'oura',name:'Oura'}, {id:'strava',name:'Strava'},
 {id:'ultrahuman',name:'Ultrahuman'}, {id:'google_health',name:'Google Health'}
];
const allowed=new Set(providers.map(p=>p.id));
let status='checking',connections=[],selection='garmin',loading=false,busy=false,message='',lastFetch=0,nonce=0;
const endpoint='/functions/v1/healthgo-open-wearables';
const validAuthorizationUrl=raw=>{
 if(typeof raw!=='string')return null;
 try{const url=new URL(raw);
  return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname?url.toString():null;
 }catch(_){return null;}
};
const date=value=>{
 const dt=new Date(value||'');
 return Number.isFinite(dt.getTime())?dt.toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}):'Brak danych';
};
async function call(method,body){return api.request(endpoint,{method,...(body?{body}:{})});}
function info(text){
 message=String(text||'').slice(0,360);
 const box=$('hg52Message');if(box)box.textContent=message;
}
function reset(nextUid){
 status='checking';connections=[];selection='garmin';
 busy=false;loading=false;message='';lastFetch=0;nonce++;
}
async function refresh(force=false){
 const uid=String(S.state?.uid||'');
 if(!uid||busy||loading)return;
 if(!force&&Date.now()-lastFetch<60000)return;
 loading=true;const seq=++nonce;
 try{
  const data=await call('GET');
  if(seq!==nonce||uid!==String(S.state?.uid||''))return;
  status=data?.configured===true?'ready':'not-configured';
  connections=Array.isArray(data?.connections)?
   data.connections.filter(x=>x&&typeof x.provider==='string').slice(0,30):[];
  lastFetch=Date.now();
 }catch(_){
  if(uid===String(S.state?.uid||'')&&seq===nonce){
   status='unavailable';lastFetch=Date.now();
   info('Nie udało się uzyskać stanu Open Wearables. Twoje inne urządzenia pozostają bez zmian.');
  }
 }finally{
  if(seq===nonce){loading=false;draw();}
 }
}
async function connect(){
 if(busy||status!=='ready'||!owner()||!allowed.has(selection))return;
 const uid=owner();const seq=++nonce;busy=true;
 info('Przygotowuję oficjalny ekran zgody producenta…');
 try{
  const data=await call('POST',{action:'connect',provider:selection});
  if(seq!==nonce||uid!==owner())return;
  const target=validAuthorizationUrl(data?.authorization_url);
  if(!target){info('Ten producent nie udostępnił prawidłowego adresu logowania. Sprawdź jego konfigurację.');return;}
  // This is OAuth consent, NOT a completed connection.
  w.location?.assign?.(target);
 }catch(_){
  if(seq===nonce&&uid===owner())info('Nie udało się rozpocząć autoryzacji. Sprawdź konfigurację serwera i konta producenta.');
 }finally{if(seq===nonce){busy=false;draw();}}
}
function owner(){return String(S.state?.uid||'');}
async function disconnect(provider){
 if(busy||!allowed.has(provider)||!owner())return;
 if(w.confirm?.('Odłączyć '+provider+'? Spowoduje to odebranie dostępu do jego konta w Open Wearables.')!==true)return;
 const uid=owner(),seq=++nonce;busy=true;
 info('Odłączam konto producenta…');
 try{
  await call('POST',{action:'disconnect',provider});
  if(seq!==nonce||uid!==owner())return;
  info('Potwierdzono odłączenie źródła.');busy=false;lastFetch=0;await refresh(true);
 }catch(_){if(seq===nonce&&uid===owner())info('Nie udało się potwierdzić odłączenia.');}
 finally{if(seq===nonce){busy=false;draw();}}
}
function render(parent){
 if(!parent)return;
 const uid=owner();
 if(uid!==currentOwner){currentOwner=uid;reset(uid);}
 let root=$('hg52Wearables');
 if(!root){root=node('section','hg45-card hg52-wearables');root.id='hg52Wearables';parent.appendChild(root);}
 draw();
 if(uid&&!lastFetch&&!loading&&!busy)void refresh();
}
let currentOwner='';
function syncOwner(){const uid=owner();if(uid!==currentOwner){currentOwner=uid;reset(uid);}}
function draw(){
 const root=$('hg52Wearables');if(!root)return;
 syncOwner();
 root.replaceChildren();
 const heading=node('div','hg52-heading');
 heading.append(node('span','hg45-kicker','HEALTHGO 5.2 · OPEN WEARABLES'),
  node('h3','','Połącz konto zegarka'),
  node('p','hg52-muted','Garmin, Polar, Suunto i inne obsługiwane źródła. Nie potrzebujesz abonamentu Terra.'));
 root.appendChild(heading);
 const state=node('div','hg52-state');
 state.append(node('strong','',!owner()?'Najpierw zaloguj się':
  loading||status==='checking'?'Sprawdzam serwer…':
  status==='ready'?'Serwer Open Wearables dostępny':
  status==='not-configured'?'Serwer Open Wearables nie jest jeszcze uruchomiony':
  'Nie udało się sprawdzić serwera'),
  node('p','',status==='ready'?'Dostęp do poszczególnych marek wymaga jeszcze aktywnych uprawnień producenta.':
  'Kod integracji jest przygotowany. Aby łączyć konta producentów, administrator musi uruchomić Open Wearables na własnym serwerze HTTPS.'));
 root.appendChild(state);
 if(owner()&&status==='ready'){
  const grid=node('div','hg52-providers');
  for(const p of providers){
   const b=control(p.name,()=>{selection=p.id;draw();},p.id!==selection);
   b.setAttribute('aria-pressed',String(p.id===selection));
   grid.appendChild(b);
  }
  root.appendChild(grid);
  const actions=node('div','hg52-actions');
  const start=control('Połącz '+(providers.find(p=>p.id===selection)?.name||'konto'),()=>connect());
  start.disabled=busy;
  actions.append(start,control('Sprawdź połączenia',()=>refresh(true),true));
  root.appendChild(actions);
 }
 const stateList=node('div','hg52-connections');
 if(connections.length){
  stateList.append(node('h4','','Potwierdzone źródła'));
  for(const c of connections){
   const label=providers.find(p=>p.id===c.provider)?.name||String(c.provider).slice(0,40);
   const active=c.status==='active';
   const line=node('div','hg52-connection'),text=node('div','');
   text.append(node('strong','',label),
    node('span','',(active?'Połączone':'Stan: '+String(c.status).slice(0,40))+' · ostatnia synchronizacja: '+date(c.last_synced_at)));
   line.appendChild(text);
   if(active&&allowed.has(c.provider)){
    line.appendChild(control('Odłącz',()=>disconnect(c.provider),true));
   }
   stateList.appendChild(line);
  }
 }else stateList.append(node('p','hg52-muted','Nie ma jeszcze potwierdzonych połączeń kont producentów.'));
 root.appendChild(stateList);
 const bottom=node('p','hg52-muted','Apple Health i Health Connect nadal wymagają wersji natywnej. Xiaomi i Huawei nie mają gwarantowanej integracji w Open Wearables. Wybór marki nie oznacza połączenia ani pobierania danych.');
 root.appendChild(bottom);
 const notice=node('p','hg52-message',message);notice.id='hg52Message';notice.setAttribute('role','status');root.appendChild(notice);
}
w.HealthGoOpenWearables52=Object.freeze({render,refresh,getState:()=>({owner:currentOwner,status,connections:connections.length,loading,busy})});
w.HealthGoDevicesPro45?.render?.();
})(window);
