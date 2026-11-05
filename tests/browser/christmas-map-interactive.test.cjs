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
   const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
   res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
   res.end(fs.readFileSync(file));
  }catch(_){res.writeHead(404);res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve))});
for(const [width,height] of [[390,844],[768,900],[1440,900]]){
 test('Christmas map retains real OSM controls and interactive hero at '+width+'px',async()=>{
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('https://**/*',route=>route.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.waitForFunction(()=>!!window.HealthGoServices&&!!window.HealthGoMapV2&&!!window.HealthGoChristmasMap);
  await page.evaluate(async()=>{
   await HealthGoServices.start({uid:'map-christmas-test',email:'test@example.invalid',providerData:[]});
   document.getElementById('authScreen')?.classList.remove('show');
   document.getElementById('splashScreen')?.classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(el=>el.classList.remove('auth-hidden'));
   window.HealthGoChristmas.apply(true);
   window.go('map');
   window.HealthGoMapV2?.chooseWelcomeLocation(false);
  });
  assert.equal(await page.locator('#healthgoMap').count(),1,'Original Leaflet map must remain');
  assert.equal(await page.locator('#map .map-workspace').count(),1);
  assert.ok(await page.locator('#hgXmasMapIntro .hgxm-hero').isVisible(),'Holiday hero missing');
  assert.equal(await page.locator('#hgXmasMapIntro .hgxm-action').count(),3);
  assert.equal(await page.locator('#map > .hgx-holiday-page').isVisible(),false,'Duplicated generic banner');

  const tree=page.locator('#hgXmasMapIntro .hgxm-tree');
  assert.equal(await tree.getAttribute('aria-pressed'),'false');
  await tree.click();
  assert.equal(await tree.getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#hgxmStatus').innerText(),/Choinka świeci/);
  await tree.click();
  assert.equal(await tree.getAttribute('aria-pressed'),'false');

  await page.locator('[data-hgxm-action="search"]').click();
  assert.ok(await page.locator('#mapAddressInput').evaluate(el=>document.activeElement===el),'Search does not focus real input');
  await page.evaluate(()=>{
   window.__locationTriggered=0;
   document.querySelector('#map .map-bar-btn[onclick="useMyLocation()"]').addEventListener('click',()=>window.__locationTriggered++);
  });
  await page.locator('[data-hgxm-action="locate"]').click();
  assert.equal(await page.evaluate(()=>window.__locationTriggered),1,'Location button should delegate to existing consent-aware handler');

  await page.locator('[data-hgxm-action="route"]').click();
  assert.equal(await page.locator('.map-v2-panel[data-map-panel="route"]').isVisible(),true,'Route planner did not open');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('hg-route-planner-open')),true);
  assert.equal(await page.locator('#hgXmasMapIntro').isVisible(),false,'Decorations must not cover navigation');
  await page.evaluate(()=>window.HealthGoMapV2.close());
  assert.equal(await page.locator('#hgXmasMapIntro').isVisible(),true);

  const viewport=await page.evaluate(()=>({
   scroll:document.documentElement.scrollWidth,
   client:document.documentElement.clientWidth,
   canvas:document.getElementById('healthgoMap').getBoundingClientRect().height
  }));
  assert.ok(viewport.scroll<=viewport.client+1,'Horizontal overflow '+JSON.stringify(viewport));
  assert.ok(viewport.canvas>=250,'Real map too small '+JSON.stringify(viewport));

  await page.evaluate(()=>window.HealthGoChristmas.apply(false));
  assert.equal(await tree.isVisible(),false,'Seasonal visuals should be reversible');
  assert.equal(await page.locator('#healthgoMap').count(),1,'Disabling decor must not delete map');
  await page.evaluate(()=>window.HealthGoChristmas.apply(true));
  assert.ok(await tree.isVisible());
  if(width<=900){
   await page.locator('[data-mobile-page="more"]').click();
   const sheet=page.locator('#mobileMoreSheet');
   assert.ok(await sheet.isVisible());
   assert.match(await sheet.locator('#hgMoreHeading').innerText(),/Więcej/);
   const m=await page.evaluate(()=>{
    const s=document.getElementById('mobileMoreSheet').getBoundingClientRect();
    const n=document.getElementById('mobileNav').getBoundingClientRect();
    return {bottom:s.bottom,nav:n.top,scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
   });
   assert.ok(m.bottom<=m.nav+3,'More overlaps bottom nav '+JSON.stringify(m));
   await sheet.locator('[data-more-close]').click();
   assert.equal(await sheet.isVisible(),false);
  }
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
