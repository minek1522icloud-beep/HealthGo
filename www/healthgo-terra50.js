/* HealthGo 5.0 Terra Unified API integration (opt-in; disabled unless configured).
 * The API key, dev ID and webhook signing secret exist ONLY in Supabase Edge Function secrets.
 * Nothing is connected merely by selecting a brand. No frontend health uploads or XP.
 */
(function(w){
'use strict';
const d=w.document,S=w.HealthGoServices,api=w.HealthGoSupabase;
if(!d||!S||!api)return;
const $=id=>d.getElementById(id);
const n=(tag,cls,text)=>{const e=d.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const button=(label,action,quiet=false)=>{const e=n('button','hg50-terra-btn'+(quiet?' quiet':''),label);e.type='button';e.addEventListener('click',action);return e;};
const validUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='tryterra.co'||u.hostname.endsWith('.tryterra.co'));}catch(_){return false;}};
const date=v=>{const d=new Date(v||'');return Number.isFinite(d.getTime())?d.toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}):'Brak danych';};
const fmt=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x.toLocaleString('pl-PL',{maximumFractionDigits:1}):'—';
let uid=null,configured=false,connections=[],metrics=[],loading=false,busy=false,message='',lastFetched=0,generation=0;
const route='/functions/v1/healthgo-terra-link';
async function apiRequest(method,body){
 return api.request(route,{method,...(body?{body}:{})});
}
function setMsg(txt){
 message=String(txt||'').slice(0,300);const e=$('hg50TerraMessage');if(e)e.textContent=message;
}
async function refresh(force=false){
 const account=String(S.state?.uid||'');
 if(!account||loading||busy)return;
 if(!force&&Date.now()-lastFetched<60000)return;
 loading=true;const nonce=++generation;
 try{
  const result=await apiRequest('GET');
  if(nonce!==generation||account!==String(S.state?.uid||''))return;
  configured=result?.configured===true;
  connections=Array.isArray(result?.connections)?result.connections.filter(x=>x&&typeof x==='object'):[];
  let rows=[];
  if(configured&&connections.length){
   try{rows=await api.db.select('hg_terra_daily_metrics',{user_id:'eq.'+account,order:'activity_date.desc',limit:21});}
   catch(_){rows=[];}
  }
  if(nonce!==generation||account!==String(S.state?.uid||''))return;
  metrics=Array.isArray(rows)?rows:[];
  lastFetched=Date.now();
 }catch(e){
  configured=false;connections=[];metrics=[];
  if(account===String(S.state?.uid||'')){lastFetched=Date.now();setMsg('Nie udało się sprawdzić integracji Terra. Dane innych urządzeń pozostają dostępne.');}
 }finally{loading=false;if(account===String(S.state?.uid||''))draw();}
}
async function connect(){
 if(busy||!configured||!S.state?.uid)return;
 busy=true;setMsg('Przygotowuję bezpieczne okno logowania producenta…');
 try{
  const response=await apiRequest('POST',{action:'connect'});
  const url=response?.url;
  if(!validUrl(url))throw Error('invalid_terra_url');
  // User initiates the external provider widget. A successful return does not
  // prove the connection: only signed Terra auth webhooks can confirm it.
  w.location?.assign?.(url);
 }catch(_){setMsg('Nie udało się otworzyć połączenia Terra. Sprawdź konfigurację administratora i spróbuj później.');}
 finally{busy=false;}
}
async function disconnect(id){
 if(busy||!S.state?.uid||!connections.some(c=>c.id===id&&c.status==='connected'))return;
 if(w.confirm?.('Odłączyć źródło Terra i usunąć jego pomiary zapisane przez tę integrację?')!==true)return;
 busy=true;setMsg('Wycofuję uprawnienia i usuwam dane połączonego źródła…');
 try{
  await apiRequest('POST',{action:'disconnect',connection_id:id});
  setMsg('Źródło odłączone. Jego dane Terra zostały usunięte z HealthGo.');
  lastFetched=0;busy=false;await refresh(true);
 }catch(_){setMsg('Nie udało się potwierdzić odłączenia. Spróbuj ponownie.');}
 finally{busy=false;draw();}
}
function render(parent){
 if(!parent)return;
 const account=String(S.state?.uid||'');
 if(account!==uid){uid=account;configured=false;connections=[];metrics=[];lastFetched=0;message='';generation++;loading=false;busy=false;}
 let root=$('hg50Terra');
 if(!root){root=n('section','hg45-card hg50-terra');root.id='hg50Terra';parent.appendChild(root);}
 draw();
 if(account&&!lastFetched&&!loading&&!busy)void refresh();
}
function draw(){
 const root=$('hg50Terra');if(!root)return;
 root.replaceChildren();
 const title=n('div','hg50-terra-top');
 title.append(n('span','hg45-kicker','INTEGRACJE KONT · OPCJONALNIE'),
  n('h3','','Terra — wielu producentów, jedno API'));
 root.appendChild(title);
 root.appendChild(n('p','hg50-terra-note',
  'Może pomóc połączyć konta obsługiwanych producentów zegarków. Dostępność zależy od integracji Terra i uprawnień. To nie jest uniwersalne parowanie Bluetooth.'));
 const notice=n('div','hg50-terra-state');
 notice.append(n('strong','',!uid?'Zaloguj się do HealthGo':
  loading?'Sprawdzam stan usługi…':configured?'Połączenia Terra mogą być dostępne':'Terra nie jest jeszcze skonfigurowana'),
  n('p','',configured?'Zaloguj się do konta producenta wyłącznie przez oficjalne okno Terra. Połączenie zostanie potwierdzone po zweryfikowanym webhooku.':
   'Terra jest osobną płatną usługą dla administratora HealthGo. Nie uruchomiono abonamentu ani nie pobieramy opłat za kliknięcie tego ekranu.'));
 root.appendChild(notice);
 const actions=n('div','hg50-terra-actions');
 const start=button('Połącz konto producenta przez Terra',connect);
 start.disabled=!uid||!configured||busy;
 actions.appendChild(start);
 const sync=button('Sprawdź połączenia i dane',()=>void refresh(true),true);
 sync.disabled=!uid||busy||loading;actions.appendChild(sync);root.appendChild(actions);
 if(connections.length){
  const list=n('div','hg50-terra-list');list.appendChild(n('h4','','Połączone źródła'));
  for(const row of connections){
   const status=row.status==='connected'?'Potwierdzone połączenie konta':'Odłączone';
   const item=n('div','hg50-terra-row'),info=n('div');
   info.append(n('strong','',String(row.provider||'Źródło Terra').slice(0,80)),
    n('span','',status+' · synchronizacja: '+date(row.last_sync_at)));
   item.appendChild(info);
   const match=metrics.find(m=>m.connection_id===row.id);
   if(match){
    const metric=n('p','hg50-terra-measure',
     'Dane '+match.activity_date+': kroki '+fmt(match.steps)+
     ' · dystans '+(typeof match.distance_meters==='number'?fmt(match.distance_meters/1000)+' km':'—')+
     ' · aktywność '+(typeof match.active_minutes==='number'?fmt(match.active_minutes)+' min':'—'));
    info.appendChild(metric);
   }
   if(row.status==='connected')item.appendChild(button('Odłącz i usuń odczyty',()=>void disconnect(row.id),true));
   list.appendChild(item);
  }
  root.appendChild(list);
 }
 root.appendChild(n('p','hg50-terra-small',
  'Zapisujemy tylko minimalne dzienne podsumowania kroków, dystansu i czasu aktywności. Pomiary Terra są oddzielone od innych danych HealthGo i nie przyznają automatycznie XP.'));
 const state=n('p','hg50-terra-message',message);state.id='hg50TerraMessage';state.setAttribute('role','status');root.appendChild(state);
}
w.HealthGoTerra50=Object.freeze({render,refresh,getState:()=>({configured,connections:connections.length,metrics:metrics.length,loading,busy})});
})(window);
