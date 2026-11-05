'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
let server,browser,origin;
test.before(async()=>{
 const base=path.resolve('www');
 server=http.createServer((req,res)=>{
  const file=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  try{
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
   res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
   res.end(fs.readFileSync(file));
  }catch(_){res.writeHead(404);res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
});
test.after(async()=>{
 await browser?.close();
 await new Promise(resolve=>server?.close(resolve));
});

for(const width of [390,768,1440]){
 test('premium Christmas look covers each tab at '+width+'px without changing its content',async()=>{
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('https://**/*',route=>route.abort());
  await page.goto(origin);
  await page.waitForFunction(()=>!!window.HealthGoServices&&!!document.getElementById('hgStartV3'));
  await page.evaluate(async()=>{
   await HealthGoServices.start({uid:'christmas-ui-fixture',email:'fixture@example.invalid',providerData:[]});
   document.getElementById('authScreen')?.classList.remove('show');
   document.getElementById('splashScreen')?.classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(el=>el.classList.remove('auth-hidden'));
   window.HealthGoChristmas.apply(true);
   window.HealthGoMapV2?.chooseWelcomeLocation(false);
  });
  const pages=['ai','map','explore','points','contests','plan','challenges','backpack','activity','devices','settings','family','notifications'];
  for(const id of pages){
   await page.evaluate(id=>window.go(id),id);
   await page.waitForFunction(id=>document.getElementById(id)?.classList.contains('active'),id);
   await page.waitForFunction(id=>!!document.querySelector('#'+id+' > .hgx-holiday-page'),id);
   assert.match(await page.locator('#'+id+' .hgx-holiday-greeting').innerText(),/Wesołych Świąt!/);
   assert.equal(await page.locator('#'+id+' .hgx-shortcut').count(),3);
   assert.ok(await page.locator('#'+id+' .hgx-holiday-hero').isVisible(),id+' premium banner invisible');
   const viewport=await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,
    client:document.documentElement.clientWidth
   }));
   assert.ok(viewport.scroll<=viewport.client+1,id+' Christmas layout overflows: '+JSON.stringify(viewport));
  }
  // Route buttons must open other tabs, not just show hover animation.
  await page.evaluate(()=>window.go('family'));
  await page.locator('#family .hgx-shortcut[data-hgx-go="points"]').click();
  assert.ok(await page.locator('#points').evaluate(n=>n.classList.contains('active')));
  // User control disables the whole global holiday layer without removing existing content.
  await page.evaluate(()=>window.HealthGoChristmas.apply(false));
  assert.equal(await page.locator('#points .hgx-holiday-page').evaluate(n=>getComputedStyle(n).display),'none');
  assert.ok(await page.locator('#hgPointCenter').count()===1);
  await page.evaluate(()=>window.HealthGoChristmas.apply(true));
  assert.ok(await page.locator('#points .hgx-holiday-hero').isVisible());
  await page.close();
 });
}
