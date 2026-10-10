'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
let server,browser,origin;
test.before(async()=>{
 const root=path.resolve('www');
 server=http.createServer((req,res)=>{
  const filename=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{
   const ext=path.extname(filename);
   const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webmanifest':'application/manifest+json'};
   res.setHeader('Content-Type',types[ext]||'application/octet-stream');
   res.end(fs.readFileSync(filename));
  }catch(_){res.writeHead(404);res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve))});
async function ready(width,height){
 const page=await browser.newPage({viewport:{width,height}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**/*',r=>r.abort());
 await page.goto(origin);
 await page.waitForFunction(()=>window.HealthGoServices&&typeof window.toggleMobileMore==='function');
 await page.evaluate(async()=>{
  await HealthGoServices.start({uid:'more-test-account',email:'more@example.invalid',providerData:[]});
  document.getElementById('authScreen')?.classList.remove('show');
  document.getElementById('splashScreen')?.classList.add('hide');
  document.querySelectorAll('.auth-hidden').forEach(el=>el.classList.remove('auth-hidden'));
  document.body.dataset.dark='1';
  const overlay=document.getElementById('hgLocationWelcome');
  if(overlay){overlay.hidden=true;overlay.style.display='none'}
  go('start');
 });
 return {page,errors};
}
for(const [width,height] of [[360,740],[390,844],[430,932],[768,700]]){
 test('Premium More sheet behaves on mobile width '+width,async()=>{
  const {page,errors}=await ready(width,height);
  const trigger=page.locator('[data-mobile-page="more"]');
  const sheet=page.locator('#mobileMoreSheet');
  assert.equal(await sheet.isVisible(),false,'Initially closed');
  await trigger.click();
  await page.waitForFunction(()=>document.getElementById('mobileMoreSheet').classList.contains('show'));
  const layout=await page.evaluate(()=>{
   const sheet=document.getElementById('mobileMoreSheet');
   const nav=document.getElementById('mobileNav');
   const box=sheet.getBoundingClientRect(),bar=nav.getBoundingClientRect();
   return {
    cards:sheet.querySelectorAll('.hg-more-action').length,
    svg:sheet.querySelectorAll('.hg-more-action>.hg-more-icon>svg').length,
    families:sheet.querySelectorAll('[data-hg2-family]').length,
    content:sheet.innerText,
    box:{x:box.left,right:box.right,bottom:box.bottom,height:box.height},
    navTop:bar.top,
    viewport:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    open:document.querySelector('[data-mobile-page="more"]').getAttribute('aria-expanded'),
    locked:document.body.classList.contains('hg-more-open'),
    active:document.querySelector('.mobile-nav .active')?.dataset.mobilePage
   };
  });
  assert.equal(layout.cards,7);
  assert.equal(layout.svg,7,'Every item must have a vector icon');
  assert.equal(layout.families,1,'Family is not duplicated');
  assert.doesNotMatch(layout.content,/🎮|🎯|🎒|❤️|⌚|👨‍👩‍👧|⚙️/);
  assert.equal(layout.open,'true');assert.equal(layout.active,'more');assert.equal(layout.locked,true);
  assert.ok(layout.box.x>=0&&layout.box.right<=width+1,'Horizontal clipping '+JSON.stringify(layout));
  assert.ok(layout.box.bottom<=layout.navTop+2,'Sheet overlaps navigation '+JSON.stringify(layout));
  assert.ok(layout.box.height<=Math.min(610,height),'Sheet too tall');
  assert.ok(layout.scrollWidth<=layout.viewport+1,'Horizontal document overflow');
  assert.equal(await page.locator('#mobileMoreBackdrop').isVisible(),true);
  await page.locator('#mobileMoreSheet [data-more-close]').click();
  assert.equal(await sheet.isVisible(),false);
  assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  await trigger.click();
  await page.keyboard.press('Escape');
  assert.equal(await sheet.isVisible(),false);
  await trigger.click();
  await page.locator('#mobileMoreBackdrop').click({position:{x:6,y:6}});
  assert.equal(await sheet.isVisible(),false);
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
test('All seven cards link to real app pages',async()=>{
 const {page,errors}=await ready(390,844);
 for(const id of ['backpack','challenges','activity','devices','family','games','settings']){
  await page.locator('[data-mobile-page="more"]').click();
  await page.locator('#mobileMoreSheet .hg-more-action[onclick="mobileGo(\''+id+'\')"]').click();
  assert.equal(await page.locator('#mobileMoreSheet').isVisible(),false,'Sheet did not close '+id);
  assert.equal(await page.locator('#'+id+'.page.active').count(),1,'Wrong destination '+id);
  assert.equal(await page.locator('[data-mobile-page="more"]').getAttribute('aria-expanded'),'false');
 }
 assert.deepEqual(errors,[]);
 await page.close();
});
test('Desktop keeps sidebar without showing mobile More sheet',async()=>{
 const {page,errors}=await ready(1024,768);
 await page.evaluate(()=>toggleMobileMore(true));
 assert.equal(await page.locator('#mobileMoreSheet').isVisible(),false);
 assert.equal(await page.locator('#mobileMoreBackdrop').isVisible(),false);
 assert.equal(await page.locator('aside.sidebar').isVisible(),true);
 assert.deepEqual(errors,[]);
 await page.close();
});
