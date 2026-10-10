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
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json'};
   res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
   res.end(fs.readFileSync(file));
  }catch(_){res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
const routeFixture={
 geometry:{coordinates:[[19.24,50.12],[19.25,50.12],[19.26,50.12]]},
 distance:1360,duration:220,
 legs:[{steps:[
  {name:'Początek',maneuver:{type:'depart',location:[19.24,50.12]}},
  {name:'Ulica Testowa',maneuver:{type:'turn',modifier:'right',location:[19.25,50.12]}},
  {name:'Park',maneuver:{type:'arrive',location:[19.26,50.12]}}
 ]}]
};
for(const width of [360,390,430]){
 test('Moving GPS arrow and route shortening work on '+width+'px iPhone',async()=>{
  const page=await browser.newPage({viewport:{width,height:860}});
  await page.route('https://**/*',route=>route.abort());
  await page.addInitScript(()=>{
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    watchPosition(success){window.__watchGPS=success;window.__watchCount=(window.__watchCount||0)+1;return 3;},
    clearWatch(){window.__clearedWatch=true;},
    getCurrentPosition(){}
   }});
  });
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(origin);
  await page.waitForFunction(()=>window.HealthGoNavigationFollow&&window.HealthGoMapPro&&window.HealthGoServices);
  await page.evaluate(async()=>{
   await HealthGoServices.start({uid:'gps-arrow-fixture',email:'test@example.invalid',providerData:[]});
   document.getElementById('authScreen')?.classList.remove('show');
   document.getElementById('splashScreen')?.classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(node=>node.classList.remove('auth-hidden'));
   document.body.dataset.dark='1';
   go('map');
   const container=document.getElementById('healthgoMap');
   window.__cameraFrames=[];window.__layers=[];
   healthGoMap={
    getZoom(){return 16},
    getSize(){return {x:width,y:800}},
    getCenter(){return {lat:50.12,lng:19.24}},
    project(coords){return {x:coords[1]*10000,y:-coords[0]*10000}},
    unproject(coords){return {lat:-coords[1]/10000,lng:coords[0]/10000}},
    setView(point,zoom){window.__cameraFrames.push({point,zoom});return this;},
    invalidateSize(){return this},
    removeLayer(layer){layer.__el?.remove();layer.removed=true}
   };
   window.L={
    divIcon(config){return {config}},
    marker(position,options){
     const node=document.createElement('div');
     node.className=options.icon.config.className;
     node.innerHTML=options.icon.config.html;
     node.dataset.lat=position[0];node.dataset.lon=position[1];
     return {
      kind:'marker',__el:node,
      addTo(){container.appendChild(node);window.__layers.push(this);return this},
      setLatLng(pos){node.dataset.lat=pos[0];node.dataset.lon=pos[1]},
      getElement(){return node}
     };
    },
    polyline(positions,options){
     const el=document.createElement('div');
     el.className=options.className;
     const layer={
      kind:options.className,__el:el,
      positions,
      addTo(){container.appendChild(el);window.__layers.push(this);return this},
      setLatLngs(coords){this.positions=coords}
     };return layer;
    }
   };
  });
  // Mock real-shaped GPS callbacks. No fake movement is used in production.
  await page.evaluate(route=>{HealthGoMapPro.setRoute(route,'Park');HealthGoMapPro.startNavigation({
   lat:50.12,lon:19.2404,accuracy:7
  })},routeFixture);
  await page.waitForFunction(()=>document.body.classList.contains('hg-guidance-follow-ready'));
  const initial=await page.evaluate(()=>({
   status:HealthGoNavigationFollow.status(),
   marker:document.querySelector('#healthgoMap .hg-follow-user-icon')?.dataset,
   route:window.__layers.find(x=>x.kind==='hg-follow-remaining-route')?.positions,
   camera:window.__cameraFrames.at(-1),
   visible:!document.getElementById('hgProNavigation').hidden,
   button:document.getElementById('hgFollowRecenter').hidden,
   width:document.documentElement.scrollWidth,
   viewport:document.documentElement.clientWidth
  }));
  assert.equal(initial.visible,true);
  assert.equal(initial.button,true,'recenter must stay hidden in following mode');
  assert.equal(initial.status.hasGPS,true);
  assert.equal(initial.status.headingSource,'route');
  assert.ok(initial.camera.point[0]>50.12,'GPS pointer must sit below center, leaving road visible ahead');
  assert.equal(initial.marker.lon,'19.2404');
  assert.ok(initial.width<=initial.viewport+1,'horizontal page overflow in navigation');
  await page.evaluate(()=>{
   window.__watchGPS({coords:{
    latitude:50.12,longitude:19.2507,accuracy:6,speed:9,heading:92
   }});
  });
  const moved=await page.evaluate(()=>({
   status:HealthGoNavigationFollow.status(),
   marker:document.querySelector('#healthgoMap .hg-follow-user-icon')?.dataset,
   route:window.__layers.find(x=>x.kind==='hg-follow-remaining-route')?.positions,
   passed:window.__layers.find(x=>x.kind==='hg-follow-passed-route')?.positions,
   rotation:document.querySelector('#healthgoMap .hg-follow-arrow-shape')?.style.transform,
   turn:document.getElementById('hgProNavDirection').textContent,
   distance:document.getElementById('hgProNavDistance').textContent
  }));
  assert.equal(moved.marker.lon,'19.2507','GPS arrow did not advance');
  assert.equal(moved.status.headingSource,'device','phone heading was ignored');
  assert.match(moved.rotation,/rotate\(92deg\)/);
  assert.ok(moved.status.progressMeters>initial.status.progressMeters+300,'route progress is static');
  assert.ok(moved.route[0][1]>19.25,'remaining route did not shorten');
  assert.ok(moved.passed.length>=3,'traveled route must appear faded');
  assert.match(moved.distance,/m|km/);

  await page.evaluate(()=>HealthGoMapPro.toggleFollow());
  assert.equal(await page.locator('#hgFollowRecenter').isVisible(),true);
  await page.locator('#hgFollowRecenter').click();
  assert.equal(await page.locator('#hgFollowRecenter').isVisible(),false);
  await page.evaluate(()=>HealthGoMapPro.stopNavigation());
  assert.equal(await page.locator('#hgProNavigation').isVisible(),false);
  assert.equal(await page.locator('#healthgoMap .hg-follow-user-icon').count(),0);
  assert.equal(await page.evaluate(()=>window.__clearedWatch),true);
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
