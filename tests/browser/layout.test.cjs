'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
let server,browser,origin;
test.before(async()=>{
 const base=path.resolve('www');
 server=http.createServer((req,res)=>{
  const file=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  try{const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch();
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
for(const width of [390,768,1440]){
 test('empty HealthGo screens fit viewport '+width,async()=>{
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('https://**/*',route=>route.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.waitForFunction(()=>!!window.HealthGoServices);
  await page.waitForFunction(()=>!!window.HealthGoV2UI,undefined,{timeout:5000});
  await page.evaluate(async()=>{
   // Explicit test fixture: no health metrics, device, XP or family data fabricated.
   await HealthGoServices.start({uid:'ui-test',email:'fixture@example.invalid',providerData:[]});
   document.getElementById('authScreen').classList.remove('show');document.getElementById('splashScreen').classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(el=>el.classList.remove('auth-hidden'));
  });
  for(const screen of ['backpack','challenges','activity','devices','family','notifications']){
   await page.evaluate(id=>window.go(id),screen);
   await page.waitForTimeout(80);
   const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
   assert.ok(size.scroll<=size.client+1,screen+' overflows at '+width);
   assert.ok(await page.locator('#'+screen+' .hg2-card').count()>0,screen+' must render its HealthGo 2.0 view');
  }
  assert.deepEqual(errors,[]);await page.close();
 });
}
