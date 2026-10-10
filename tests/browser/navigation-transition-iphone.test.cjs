'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
let browser,server,origin;
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
const directionSteps=[
 {name:'Start',maneuver:{type:'depart',location:[19.24,50.12]}},
 {name:'Ulica Testowa',maneuver:{type:'turn',modifier:'right',location:[19.245,50.125]}},
 {name:'Park',maneuver:{type:'arrive',location:[19.25,50.13]}}
];
const validRoute={geometry:{coordinates:[[19.24,50.12],[19.245,50.125],[19.25,50.13]]},distance:2000,duration:420,legs:[{steps:directionSteps}]};
const geometryOnly={geometry:{coordinates:[[19.24,50.12],[19.245,50.125],[19.25,50.13]]},distance:1800,duration:400,legs:[{steps:[]}]};
async function init(width,routes){
 const page=await browser.newPage({viewport:{width,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>{
  const url=r.request().url();
  if(url.includes('nominatim.openstreetmap.org/search'))
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{display_name:'Park, Częstochowa',lat:50.13,lon:19.25}])});
  if(url.includes('router.project-osrm.org/route/v1/driving/'))
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({routes})});
  return r.abort();
 });
 await page.addInitScript(()=>{
  window.__gpsRequested=0;window.__tracking=0;
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
   getCurrentPosition(success){window.__gpsRequested++;success({coords:{latitude:50.12,longitude:19.24,accuracy:8}})},
   watchPosition(){window.__tracking++;return 15;},clearWatch(){}
  }});
 });
 await page.goto(origin);
 await page.waitForFunction(()=>!!window.HealthGoServices&&!!window.HealthGoMapV2&&!!window.HealthGoMapPro);
 await page.evaluate(async()=>{
  await HealthGoServices.start({uid:'navigation-transition-fixture',email:'nav@example.invalid',providerData:[]});
  document.getElementById('authScreen')?.classList.remove('show');
  document.getElementById('splashScreen')?.classList.add('hide');
  document.querySelectorAll('.auth-hidden').forEach(e=>e.classList.remove('auth-hidden'));
  document.body.dataset.dark='1';go('map');
  healthGoMap={getCenter(){return {lat:50.12,lng:19.24}},getZoom(){return 16},
   setView(){return this},invalidateSize(){return this}};
 });
 return {page,errors};
}
for(const width of [360,390,430]){
 test('Actual iPhone planner button opens visible navigation without second tap at '+width,async()=>{
  const {page,errors}=await init(width,[validRoute]);
  // On iPhone the main discovery toolbar is intentionally hidden; use the
  // actual visible navigation planner, the same interface as the user.
  await page.evaluate(()=>HealthGoMapV2.toggle('route'));
  await page.locator('#mapV2RouteTo').fill('Park, Częstochowa');
  await page.getByRole('button',{name:/Wyznacz trasę i prowadź/}).click();
  await page.waitForFunction(()=>document.querySelector('#map')?.dataset.hgNavigationPhase==='active',null,{timeout:7000});
  const state=await page.evaluate(()=>{
   const hud=document.getElementById('hgProNavigation'),css=getComputedStyle(hud);
   return {
    phase:HealthGoMapV2.navigationState(),
    open:document.body.classList.contains('hg-navigation-active'),
    hudVisible:!hud.hidden&&css.display!=='none'&&css.visibility!=='hidden',
    planner:document.body.classList.contains('hg-route-planner-open'),
    panels:[...document.querySelectorAll('#map .map-v2-panel:not([hidden])')].length,
    gps:window.__gpsRequested,tracking:window.__tracking,
    text:document.getElementById('hgProNavDirection').textContent,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
   };
  });
  assert.equal(state.phase.phase,'active');
  assert.equal(state.phase.problem,'');
  assert.equal(state.open,true);
  assert.equal(state.hudVisible,true,'JS state was active but CSS hid the directions panel');
  assert.equal(state.planner,false);
  assert.equal(state.panels,0);
  assert.equal(state.gps,1);
  assert.equal(state.tracking,1);
  assert.notEqual(state.text,'Ustalam pozycję');
  assert.equal(state.overflow,false);
  await page.evaluate(()=>HealthGoMapPro.stopNavigation());
  assert.equal(await page.evaluate(()=>HealthGoMapV2.navigationState().phase),'idle');
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
test('One OSRM geometry-only variant is skipped when another has real maneuvers',async()=>{
 const {page,errors}=await init(390,[geometryOnly,validRoute]);
 await page.evaluate(()=>HealthGoMapV2.toggle('route'));
 await page.locator('#mapV2RouteTo').fill('Park');
 await page.getByRole('button',{name:/Wyznacz trasę i prowadź/}).click();
 await page.waitForFunction(()=>document.querySelector('#map')?.dataset.hgNavigationPhase==='active',null,{timeout:7000});
 assert.equal(await page.locator('#hgProNavigation').isVisible(),true);
 assert.equal(await page.locator('#hg4RouteAlternatives button').count(),1);
 assert.deepEqual(errors,[]);await page.close();
});
test('All routes missing OSRM maneuvers produce visible error, not a fake live drive',async()=>{
 const {page,errors}=await init(390,[geometryOnly]);
 await page.evaluate(()=>HealthGoMapV2.toggle('route'));
 await page.locator('#mapV2RouteTo').fill('Park');
 await page.getByRole('button',{name:/Wyznacz trasę i prowadź/}).click();
 await page.waitForFunction(()=>document.querySelector('#map')?.dataset.hgNavigationPhase==='error',null,{timeout:7000});
 const result=await page.evaluate(()=>({
  status:document.getElementById('mapSearchStatus').textContent,
  panel:document.getElementById('mapV2RouteOutput').textContent,
  nav:document.body.classList.contains('hg-navigation-active'),
  problem:HealthGoMapV2.navigationState().problem
 }));
 assert.match(result.status,/bez instrukcji skrętów/);
 assert.match(result.panel,/bez instrukcji skrętów/);
 assert.equal(result.nav,false);
 assert.ok(result.problem);
 assert.deepEqual(errors,[]);await page.close();
});
