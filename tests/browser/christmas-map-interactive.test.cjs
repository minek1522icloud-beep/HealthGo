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
 test('Christmas map fills available space with only a mini tree at '+width+'px',async()=>{
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
  assert.equal(await page.locator('#map .map-toolbar').count(),1);
  assert.equal(await page.locator('#hgXmasMapIntro').count(),0,'Large Christmas banner must be removed');
  assert.equal(await page.locator('#map .hgxm-action').count(),0,'No extra shortcuts above the map');
  assert.equal(await page.locator('#map > .hgx-holiday-page').isVisible(),false,'Duplicated generic banner');
  const tree=page.locator('#hgXmasMapTree');
  assert.ok(await tree.isVisible(),'Mini tree missing');
  const sizes=await page.evaluate(()=>{
   const tree=document.getElementById('hgXmasMapTree').getBoundingClientRect();
   const canvas=document.getElementById('healthgoMap').getBoundingClientRect();
   const host=document.getElementById('mapWorkspace').getBoundingClientRect();
   return {treeW:tree.width,treeH:tree.height,canvasH:canvas.height,hostH:host.height,
    scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth};
  });
  assert.ok(sizes.treeW<=70&&sizes.treeH<=77,'Tree must stay small '+JSON.stringify(sizes));
  assert.ok(sizes.scroll<=sizes.client+1,'Horizontal page overflow '+JSON.stringify(sizes));
  assert.ok(sizes.canvasH>=250,'Map too small '+JSON.stringify(sizes));
  if(width<=900)assert.ok(sizes.hostH>=height*.69,'Map should fill the former viewport '+JSON.stringify(sizes));
  assert.equal(await tree.getAttribute('aria-pressed'),'false');
  await tree.click();
  assert.equal(await tree.getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#hgxmTreeStatus').innerText(),/Lampki choinki włączone/);
  await tree.click();
  assert.equal(await tree.getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>window.HealthGoMapV2.toggle('route'));
  assert.ok(await page.locator('.map-v2-panel[data-map-panel="route"]').isVisible(),'Route planner did not open');
  assert.equal(await tree.isVisible(),false,'Tree must not cover route planning');
  await page.evaluate(()=>window.HealthGoMapV2.close());
  assert.ok(await tree.isVisible(),'Tree should reappear when map returns');
  await page.evaluate(()=>window.HealthGoChristmas.apply(false));
  assert.equal(await tree.isVisible(),false,'Seasonal option must hide tree');
  assert.equal(await page.locator('#healthgoMap').count(),1,'Map must remain when holiday mode is off');
  if(width<=900){
   await page.evaluate(()=>window.HealthGoChristmas.apply(true));
   await page.locator('[data-mobile-page="more"]').click();
   const sheet=page.locator('#mobileMoreSheet');
   assert.ok(await sheet.isVisible());
   const position=await page.evaluate(()=>{
    const s=document.getElementById('mobileMoreSheet').getBoundingClientRect();
    return {bottom:s.bottom,navTop:document.getElementById('mobileNav').getBoundingClientRect().top};
   });
   assert.ok(position.bottom<=position.navTop+3,'More must not overlap navigation');
   await sheet.locator('[data-more-close]').click();
   assert.equal(await sheet.isVisible(),false);
  }
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
