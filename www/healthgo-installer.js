/* HealthGo native installation hub.
 * A button is active only after a real release/testflight URL is confirmed.
 * Never advertise an APK artifact from CI as a publicly installable release.
 */
(function(w,d){
'use strict';
if(!w||!d)return;
const repo='minek1522icloud-beep/HealthGo';
const assetName='HealthGo-Android.apk';
const iosAppStoreUrl=null; // Configure ONLY after App Store release.
const iosTestFlightUrl=null; // Configure ONLY after TestFlight invitation is valid.
const android=d.getElementById('androidDownload');
const ios=d.getElementById('iosDownload');
if(!android||!ios)return;
const status=(id,msg)=>{const e=d.getElementById(id);if(e)e.textContent=msg;};
function setLink(el,url,label){
 if(!el)return;
 el.textContent=label;
 if(url){el.setAttribute('href',url);el.setAttribute('rel','noopener noreferrer');el.removeAttribute('aria-disabled');el.removeAttribute('tabindex');}
 else{el.removeAttribute('href');el.setAttribute('aria-disabled','true');el.setAttribute('tabindex','-1');}
}
function activePlatform(){
 const ua=w.navigator?.userAgent||'';
 const id=/iPhone|iPad|iPod/.test(ua)?'ios':/Android/.test(ua)?'android':null;
 if(id)d.getElementById(id+'Card')?.setAttribute('data-primary','true');
 return id;
}
function checkedUrl(value,provider){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password)return null;
  if(provider==='apple'&&['apps.apple.com','testflight.apple.com'].includes(url.hostname))return url.toString();
  if(provider==='github'&&url.hostname==='github.com'&&url.pathname.startsWith('/'+repo+'/releases/download/')&&url.pathname.endsWith('/'+assetName))return url.toString();
 }catch(_){}
 return null;
}
function iosChannel(){
 const store=checkedUrl(iosAppStoreUrl,'apple'),test=checkedUrl(iosTestFlightUrl,'apple');
 if(store){setLink(ios,store,'Zainstaluj z App Store');status('iosStatus','Oficjalna aplikacja iOS.');}
 else if(test){setLink(ios,test,'Zainstaluj przez TestFlight');status('iosStatus','Wersja testowa: Apple może wymagać aplikacji TestFlight.');}
 else{setLink(ios,null,'Wersja iOS w przygotowaniu');status('iosStatus','Nie ma jeszcze podpisanej aplikacji iOS ani aktywnego zaproszenia TestFlight.');}
}
async function androidChannel(){
 setLink(android,null,'Sprawdzam instalator…');
 try{
  const response=await w.fetch('https://api.github.com/repos/'+repo+'/releases?per_page=10',{
   headers:{Accept:'application/vnd.github+json'},cache:'no-store'
  });
  if(!response.ok)throw Error('unavailable');
  const releases=await response.json();
  if(!Array.isArray(releases))throw Error('unexpected');
  for(const release of releases){
   if(release.draft||!Array.isArray(release.assets))continue;
   const asset=release.assets.find(a=>a&&a.name===assetName&&a.state==='uploaded'&&a.size>0);
   const url=asset&&checkedUrl(asset.browser_download_url,'github');
   if(!url)continue;
   setLink(android,url,'Pobierz HealthGo na Androida');
   status('androidStatus','Oficjalny instalator APK · '+String(release.tag_name||'wydanie HealthGo').slice(0,60)+'.');
   return;
  }
  setLink(android,null,'APK w przygotowaniu');
  status('androidStatus','Nie opublikowano jeszcze podpisanego instalatora APK.');
 }catch(_){
  setLink(android,null,'Sprawdź później');
  status('androidStatus','Nie udało się sprawdzić wydań. Spróbuj później; nie przekierowujemy do nieznanego pliku.');
 }
}
activePlatform();iosChannel();void androidChannel();
})(window,document);
