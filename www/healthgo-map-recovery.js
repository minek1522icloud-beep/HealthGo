/* HealthGo map availability recovery: Leaflet secondary CDN and OSM tile fallback.
 * Never requests GPS. No automatic location tracking, tile prefetching or data upload. */
(function(host){
'use strict';
if(typeof document==='undefined')return;
let leafletPromise=null,failedTiles=0,loadedTiles=0,streetBackup=false,switched=false,lastError='';
const STREET='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
function hosted(){
 const name=String(host.location?.hostname||'');
 const protocol=String(host.location?.protocol||'');
 return (protocol==='https:'||protocol==='http:')&&!/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(name);
}
function status(message,show){
 const panel=document.getElementById('hgMapRecoveryPanel'),copy=document.getElementById('hgMapRecoveryText');
 if(copy&&message)copy.textContent=message;
 if(panel)panel.hidden=show===false;
 if(message&&typeof host.mapStatus==='function')host.mapStatus(message);
 lastError=message||'';
}
function addCss(){
 if(document.querySelector('link[data-hg-map-rescue]'))return;
 const css=document.createElement('link');
 css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
 css.dataset.hgMapRescue='1';document.head.appendChild(css);
}
function loadLeaflet(){
 if(typeof host.L!=='undefined')return Promise.resolve(true);
 if(leafletPromise)return leafletPromise;
 status('Ładuję zapasowy silnik mapy. Sprawdź połączenie internetowe.',true);
 addCss();
 leafletPromise=new Promise(resolve=>{
  const tag=document.createElement('script');
  let finished=false;
  const timer=host.setTimeout?.(()=>complete(false),12000);
  function complete(ok){
   if(finished)return;finished=true;
   if(timer)host.clearTimeout?.(timer);
   if(!ok)status('Mapa nie wczytała się. Spróbuj ponownie lub otwórz mapę zewnętrzną.',true);
   else status('',false);
   resolve(ok);
  }
  tag.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  tag.async=true;tag.onload=()=>complete(typeof host.L!=='undefined');
  tag.onerror=()=>complete(false);
  document.head.appendChild(tag);
 }).finally(()=>{leafletPromise=null;});
 return leafletPromise;
}
function tileUrl(){
 if(!hosted())return '/map-tiles/{z}/{x}/{y}.png';
 return streetBackup?ESRI:STREET;
}
function tileAttribution(){
 return hosted()&&streetBackup?'Tiles © Esri, HERE, Garmin, OpenStreetMap contributors':'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
}
function attach(layer,map){
 if(!layer||!layer.on)return;
 layer.on('tileload',()=>{loadedTiles++;failedTiles=0;if(loadedTiles>0)status('',false);});
 layer.on('tileerror',()=>{
  failedTiles++;
  if(failedTiles<3)return;
  if(hosted()&&!streetBackup&&!switched&&typeof host.L!=='undefined'&&map){
   switched=true;streetBackup=true;failedTiles=0;loadedTiles=0;
   status('Serwer mapy nie odpowiada. Przełączam na mapę zastępczą Esri.',true);
   try{
    const alternative=host.L.tileLayer(ESRI,{maxZoom:18,attribution:tileAttribution()});
    attach(alternative,map);alternative.addTo(map);
    if(typeof map.removeLayer==='function')map.removeLayer(layer);
    host.setTimeout?.(()=>{map.invalidateSize?.({pan:false});},100);
   }catch(_){status('Nie można wczytać mapy. Możesz otworzyć OpenStreetMap.',true);}
  }else if(failedTiles>=6){
   status('Nie można pobrać kafelków mapy. Sprawdź sieć i spróbuj ponownie.',true);
  }
 });
}
function retry(){
 failedTiles=0;loadedTiles=0;streetBackup=false;switched=false;
 if(typeof host.L==='undefined'){
  loadLeaflet().then(ok=>{if(ok&&typeof host.initHealthGoMap==='function')host.initHealthGoMap();});
 }else if(typeof host.initHealthGoMap==='function'){
  // The original map object may exist with an unavailable base layer.
  const map=typeof host.healthGoMapInstance==='function'?host.healthGoMapInstance():null;
  if(map&&host.L.tileLayer){
   try{
    const original=host.L.tileLayer(tileUrl(),{maxZoom:19,attribution:tileAttribution()});
    map.eachLayer?.(l=>{if(l instanceof host.L.TileLayer)map.removeLayer(l);});
    attach(original,map);original.addTo(map);map.invalidateSize?.({pan:false});
    status('Ponownie pobieram mapę…',true);
   }catch(_){status('Próba ponownego wczytania mapy nie powiodła się.',true);}
  }else host.initHealthGoMap();
 }
}
host.HealthGoMapRecovery=Object.freeze({loadLeaflet,tileUrl,tileAttribution,attach,retry,hosted,status});
})(window);
