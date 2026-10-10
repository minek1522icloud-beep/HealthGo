'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
let server,browser,origin;
test.before(async()=>{
 const base=path.resolve('www');
 server=http.createServer((req,res)=>{
  const file=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  try{
   const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webmanifest':'application/manifest+json'};
   res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
   res.end(fs.readFileSync(file));
  }catch(_){res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
for(const [width,height] of [[360,740],[390,844],[430,932],[1024,768]]){
 test('Map is dark and live navigation remains minimal on '+width+'px',async()=>{
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('https://**/*',route=>route.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.waitForFunction(()=>!!window.HealthGoServices&&!!window.HealthGoMapV2&&!!window.HealthGoMapPro);
  await page.evaluate(async()=>{
   await HealthGoServices.start({uid:'map-fixture',email:'fixture@example.invalid',providerData:[]});
   document.getElementById('authScreen')?.classList.remove('show');
   document.getElementById('splashScreen')?.classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(e=>e.classList.remove('auth-hidden'));
   document.body.dataset.dark='1';
   window.go('map');
  });
  await page.waitForTimeout(100);
  const style=await page.locator('#map .map-toolbar').evaluate(node=>getComputedStyle(node).backgroundColor);
  assert.notEqual(style,'rgb(255, 255, 255)','White map toolbar');
  assert.ok(await page.locator('#map .map-v2-tab').count()>=3);

  await page.evaluate(()=>{
   window.healthGoMap={
    getCenter(){return {lat:50.12,lng:19.24}},
    setView(){return this},
    invalidateSize(){return this},
    getZoom(){return 15}
   };
   HealthGoMapV2.toggle('saved');
  });
  await page.locator('#hgMapRecentDestinations').waitFor();
  await page.locator('.hg-map-recent-home button').first().click();
  await page.locator('.hg-map-recent-home button').nth(1).click();
  assert.match(await page.locator('#mapV2RouteTo').inputValue(),/Dom/);
  assert.equal(await page.locator('#hgMapRecentDestinations .map-v2-item').count(),1);

  await page.evaluate(()=>{
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(){return 7},clearWatch(){},getCurrentPosition(success){success({coords:{latitude:50.12,longitude:19.24,accuracy:10}})}}});
   const item={
    geometry:{coordinates:[[19.24,50.12],[19.25,50.13]]},
    distance:1700,duration:290,
    legs:[{steps:[{name:'Początek',maneuver:{type:'depart',location:[19.24,50.12]}},{name:'Cel',maneuver:{type:'arrive',location:[19.25,50.13]}}]}]
   };
   HealthGoMapPro.setRoute(item,'Cel');
   HealthGoMapPro.startNavigation();
  });
  await page.waitForTimeout(100);
  const properties=await page.evaluate(()=>{
   const el=id=>document.getElementById(id);
   const voice=el('hgNavVoiceQuick'),speed=document.querySelector('#map .hg-drive-speed'),weather=el('hgLiveWeather');
   const hud=el('hgProNavigation'),turn=document.querySelector('#map .hg-drive-turn');
   const rect=turn.getBoundingClientRect();
   const vrect=voice.getBoundingClientRect();
   return {
    isActive:document.body.classList.contains('hg-navigation-active'),
    hudVisible:getComputedStyle(hud).display!=='none',
    speed:getComputedStyle(speed).display,
    weather:getComputedStyle(weather).display,
    voiceVisible:getComputedStyle(voice).display!=='none',
    voiceInside:vrect.left>=rect.left-2&&vrect.right<=rect.right+2,
    voiceAria:voice.getAttribute('aria-pressed'),
    pageOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
   };
  });
  assert.equal(properties.isActive,true);
  assert.equal(properties.hudVisible,true);
  assert.equal(properties.speed,'none');
  assert.equal(properties.weather,'none');
  assert.equal(properties.voiceVisible,true);
  assert.equal(properties.voiceInside,true,'Voice button is outside turn panel');
  assert.equal(properties.pageOverflow,false,'Map overflows viewport');
  await page.evaluate(()=>HealthGoMapPro.stopNavigation());
  assert.equal(await page.locator('#hgProNavigation').isVisible(),false);
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
