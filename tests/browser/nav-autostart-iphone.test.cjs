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
  }catch(_){res.writeHead(404);res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});

const destination={lat:50.13,lon:19.25};
const routeFixture={routes:[{
 distance:1950,duration:340,
 geometry:{coordinates:[[19.24,50.12],[19.245,50.125],[19.25,50.13]]},
 legs:[{steps:[
  {name:'Start',maneuver:{type:'depart',location:[19.24,50.12]}},
  {name:'Aleja Testowa',maneuver:{type:'turn',modifier:'right',location:[19.245,50.125]}},
  {name:'Park',maneuver:{type:'arrive',location:[19.25,50.13]}}
 ]}]
}]};
for(const width of [360,390,430]){
 test('Address leads from real phone GPS to live guidance at '+width+'px',async()=>{
  const page=await browser.newPage({viewport:{width,height:860}});
  await page.route('https://**/*',route=>{
   if(route.request().url().includes('nominatim.openstreetmap.org/search')){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
     {display_name:'Park, Częstochowa',lat:destination.lat,lon:destination.lon}
    ])});
   }
   if(route.request().url().includes('router.project-osrm.org/route/v1/driving/')){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(routeFixture)});
   }
   return route.abort();
  });
  await page.addInitScript(()=>{
   window.__gpsCalls=0;window.__watchCalls=0;
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition(success){window.__gpsCalls++;success({coords:{
     latitude:50.12,longitude:19.24,accuracy:8
    }})},
    watchPosition(){window.__watchCalls++;return 7;},
    clearWatch(){}
   }});
  });
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(origin);
  await page.waitForFunction(()=>window.HealthGoServices&&window.HealthGoMapV2&&window.HealthGoMapPro);
  await page.evaluate(async()=>{
   await HealthGoServices.start({uid:'nav-fixture',email:'navigation@example.invalid',providerData:[]});
   document.getElementById('authScreen')?.classList.remove('show');
   document.getElementById('splashScreen')?.classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(el=>el.classList.remove('auth-hidden'));
   document.body.dataset.dark='1';
   healthGoMap={getCenter(){return {lat:50.12,lng:19.24}},getZoom(){return 16},
    setView(){return this},invalidateSize(){return this}};
   go('map');
  });
  await page.locator('#mapAddressInput').fill('Park, Częstochowa');
  // Search must initiate geolocation before async address geocoding.
  await page.evaluate(()=>searchMapAddress());
  await page.waitForFunction(()=>document.body.classList.contains('hg-navigation-active'),{timeout:7000});
  const state=await page.evaluate(()=>({
   gps:window.__gpsCalls,
   tracking:window.__watchCalls,
   planner:document.body.classList.contains('hg-route-planner-open'),
   navVisible:!document.getElementById('hgProNavigation').hidden,
   address:document.getElementById('mapV2RouteTo').value,
   manual:document.getElementById('mapV2RouteFrom').value,
   directions:document.getElementById('hgProNavDirection').textContent,
   street:document.getElementById('hgProNavStreet').textContent,
   distance:document.getElementById('hgProNavDistance').textContent,
   time:document.getElementById('hgProNavTime').textContent,
   speed:document.getElementById('hgProNavSpeed').textContent,
   overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }));
  assert.equal(state.gps,1,'Destination navigation must request GPS on click');
  assert.equal(state.tracking,1,'Live position tracking must begin');
  assert.equal(state.planner,false,'Route panel must close automatically');
  assert.equal(state.navVisible,true);
  assert.match(state.address,/Park/);
  assert.equal(state.manual,'');
  assert.notEqual(state.directions,'Ustalam pozycję','First GPS fix should immediately update turn card');
  assert.match(state.distance,/m|km/);
  assert.match(state.time,/^\d+$/);
  assert.equal(state.speed,'—','No invented speed without sensor data');
  assert.equal(state.overflow,false);
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>HealthGoMapPro.stopNavigation());
  assert.equal(await page.locator('#hgProNavigation').isVisible(),false);
  await page.close();
 });
}
test('Denied GPS remains visible as an error and never invents a route',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 let requests=0;
 await page.route('https://**/*',route=>{
  if(route.request().url().includes('router.project-osrm.org/route/v1/driving/'))requests++;
  return route.abort();
 });
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
   getCurrentPosition(ok,error){error({code:1})},
   watchPosition(){throw Error('WATCH_SHOULD_NOT_RUN')},clearWatch(){}
  }});
 });
 await page.goto(origin);
 await page.waitForFunction(()=>window.HealthGoServices&&window.HealthGoMapV2);
 await page.evaluate(async()=>{
  await HealthGoServices.start({uid:'denied-fixture',email:'navigation@example.invalid',providerData:[]});
  document.getElementById('authScreen')?.classList.remove('show');
  document.getElementById('splashScreen')?.classList.add('hide');
  document.querySelectorAll('.auth-hidden').forEach(el=>el.classList.remove('auth-hidden'));
  document.body.dataset.dark='1';
  healthGoMap={getCenter(){return {lat:50.12,lng:19.24}},getZoom(){return 16},
   setView(){return this},invalidateSize(){return this}};
  go('map');
  HealthGoMapV2.selectDestination('Park',50.13,19.25);
 });
 await page.waitForFunction(()=>document.getElementById('mapV2RouteOutput').textContent.includes('zablokował GPS'));
 assert.equal(await page.evaluate(()=>document.body.classList.contains('hg-navigation-active')),false);
 assert.equal(requests,0);
 await page.close();
});
