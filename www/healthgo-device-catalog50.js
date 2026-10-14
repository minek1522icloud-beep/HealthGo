/* HealthGo 5.0 — device families and conservative compatibility decisions.
 * This is a method catalog, not an unverified list of officially supported watches.
 * Never present a model as connected until a real transport or data record confirms it.
 */
(function(w){
'use strict';
const catalog=[
 {id:'apple',label:'Apple Watch',emoji:'⌚',models:['Series','SE','Ultra','Inny Apple Watch'],companion:'Watch i Zdrowie (Apple Health)',health:'ios'},
 {id:'samsung',label:'Samsung Galaxy Watch',emoji:'⌚',models:['Galaxy Watch','Galaxy Watch Classic','Galaxy Watch Ultra','Galaxy Fit','Inny Samsung'],companion:'Galaxy Wearable / Samsung Health',health:'android'},
 {id:'garmin',label:'Garmin',emoji:'🧭',models:['Forerunner','Fēnix','Venu','Vivoactive','Instinct','Inny Garmin'],companion:'Garmin Connect',health:'conditional'},
 {id:'xiaomi',label:'Xiaomi',emoji:'⌚',models:['Smart Band','Redmi Watch','Xiaomi Watch','Inny Xiaomi'],companion:'Mi Fitness / aplikacja zalecana dla modelu',health:'conditional'},
 {id:'huawei',label:'Huawei',emoji:'⌚',models:['Watch GT','Watch Fit','Watch','Band','Inny Huawei'],companion:'Huawei Health',health:'conditional'},
 {id:'amazfit',label:'Amazfit',emoji:'⌚',models:['Balance','Active','Bip','T-Rex','Inny Amazfit'],companion:'Zepp',health:'conditional'},
 {id:'fitbit',label:'Fitbit',emoji:'⌚',models:['Charge','Sense','Versa','Inny Fitbit'],companion:'Fitbit / aplikacja producenta',health:'conditional'},
 {id:'polar',label:'Polar',emoji:'⌚',models:['Pacer','Vantage','Ignite','Grit X','Inny Polar'],companion:'Polar Flow',health:'conditional'},
 {id:'other',label:'Inna marka / BLE',emoji:'ᛒ',models:['Inny zegarek','Opaska sportowa','Czujnik Bluetooth LE'],companion:'Oficjalna aplikacja producenta',health:'conditional'}
].map(x=>Object.freeze({...x,models:Object.freeze(x.models)}));
const brands=Object.freeze(catalog);
const byId=Object.freeze(Object.fromEntries(brands.map(x=>[x.id,x])));
function platforms(raw){
 const input=String(raw||'').toLowerCase();
 return input==='ios'||input==='android'||input==='desktop'?input:'desktop';
}
function getBrand(id){return byId[id]||byId.other;}
function getModel(brand,model){
 const name=String(model||'').trim();
 const safe=getBrand(brand);
 return safe.models.includes(name)?name:safe.models[0];
}
/* No model-specific unsupported certification claims:
 * Brand selection determines the recommended source and pathway only.
 */
function resolve(opts={}){
 const brand=getBrand(opts.brand),model=getModel(brand.id,opts.model);
 const platform=platforms(opts.platform);
 const webBluetooth=!!opts.webBluetooth&&platform!=='ios';
 const nativeHealth=!!opts.nativeHealth&&platform==='ios';
 const healthMethod=platform==='ios'?'Apple Health':platform==='android'?'Health Connect':'brak';
 const systemHealth=platform!=='desktop';
 const isApple=brand.id==='apple';
 const recommendSource=isApple?'Apple Health':brand.id==='samsung'&&platform==='android'?'Health Connect':brand.companion;
 const paths=[];
 if(isApple&&platform==='ios'){
  paths.push({id:'health',label:'Apple Health (aplikacja natywna)',kind:'native',enabled:nativeHealth,
   note:nativeHealth?'W natywnej aplikacji możesz poprosić o zgodę Apple Health i odczytać dostępne dane. Nie jest to ponowne parowanie zegarka.':'Wymaga osobno zainstalowanej, podpisanej aplikacji HealthGo na iPhone i zgody HealthKit. Skrót Safari nie wystarcza.'});
 }else if(isApple){
  paths.push({id:'manual',label:'Wymagany iPhone i Apple Health',kind:'manual',enabled:false,
   note:'Apple Watch nie może być bezpośrednio odczytywany przez standardowy Web Bluetooth.'});
 }else if(platform==='android'){
  paths.push({id:'health',label:'Health Connect (aplikacja natywna)',kind:'native',enabled:false,
   note:'Jeżeli producent synchronizuje dane do Health Connect, natywna aplikacja HealthGo może je odczytać po uzyskaniu uprawnień.'});
 }else if(platform==='ios'){
  paths.push({id:'health',label:'Apple Health (aplikacja natywna)',kind:'native',enabled:false,
   note:'Jeżeli aplikacja producenta udostępnia dane w Zdrowiu, natywna aplikacja HealthGo może je odczytać za zgodą użytkownika.'});
 }
 if(!isApple){
  paths.push({id:'ble',label:'Bluetooth LE (usługi standardowe)',kind:'ble',enabled:webBluetooth,
   note:webBluetooth?'Wyszukiwanie może wykryć urządzenie. Dostępne będą tylko faktycznie udostępniane standardowe usługi, np. bateria lub aktualne tętno.':
    platform==='ios'?'Safari na iPhonie nie udostępnia Web Bluetooth. Użyj zgodnej natywnej aplikacji i urządzenia obsługującego CoreBluetooth.':
    'Brak dostępnego Web Bluetooth w tej przeglądarce. Spróbuj zgodnej przeglądarki na Androidzie/komputerze.'});
 }
 paths.push({id:'manual',label:'Synchronizacja przez aplikację producenta',kind:'manual',enabled:false,
  note:'Połącz zegarek w aplikacji producenta i sprawdź, czy Twoja marka, model i wersja aplikacji udostępniają dane do '+(systemHealth?healthMethod:'systemowego źródła zdrowia')+'. Nie zakładamy obsługi z góry.'});
 return Object.freeze({brand:brand.id,brandName:brand.label,model,platform,companion:brand.companion,
  recommended:recommendSource,webBluetooth,healthMethod,methods:Object.freeze(paths.map(x=>Object.freeze(x)))});
}
w.HealthGoDeviceCatalog50=Object.freeze({brands,getBrand,getModel,resolve});
})(window);
