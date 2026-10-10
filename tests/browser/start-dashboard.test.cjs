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

for(const width of [360,390,768,1440]){
 test('START 3.0 fits '+width+'px and never fabricates missing readings',async()=>{
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('https://**/*',route=>route.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.waitForFunction(()=>!!window.HealthGoServices&&!!document.getElementById('hgStartV3'));
  await page.evaluate(async()=>{
   await HealthGoServices.start({uid:'start-fixture',email:'fixture@example.invalid',providerData:[]});
   document.getElementById('authScreen').classList.remove('show');
   document.getElementById('splashScreen').classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(node=>node.classList.remove('auth-hidden'));
   window.go('start');
  });
  await page.waitForTimeout(110);
  assert.equal(await page.locator('#hgStartV3 .hgs-metric').count(),3);
  assert.equal(await page.locator('#hgsBars .hgs-bar-col').count(),7);
  assert.match(await page.locator('#hgsSteps').innerText(),/Brak danych/);
  assert.equal(await page.locator('#hgsCalories').innerText(),'—');
  const sizing=await page.evaluate(()=>({
   scroll:document.documentElement.scrollWidth,
   client:document.documentElement.clientWidth,
   active:document.getElementById('start').classList.contains('active')
  }));
  assert.ok(sizing.active,'Start is visible');
  assert.ok(sizing.scroll<=sizing.client+1,'Start overflows '+width+'px: '+JSON.stringify(sizing));

  // Test-only fixture; HealthGo itself must never manufacture these metrics.
  await page.evaluate(()=>{
   const d=new Date(),stamp=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
   HealthGoServices.state.healthDays=[{day:stamp,id:stamp,steps:7235,distanceKm:5.2,heartRate:73,source:'Test fixture',updatedAt:Date.now()}];
   document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(()=>document.getElementById('hgsSteps')?.textContent.includes('7'));
  assert.match(await page.locator('#hgsSteps').innerText(),/7[\s\u00a0]?235/);
  assert.match(await page.locator('#hgsDistance').innerText(),/5,2/);
  await page.locator('#hgsChartRange').selectOption('month');
  assert.equal(await page.locator('#hgsBars .hgs-bar-col').count(),4);

  await page.locator('#hgsGoalButton').click();
  await page.locator('#hgsGoalInput').fill('8000');
  await page.locator('#hgsGoalForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.getElementById('hgsStepPercent')?.textContent.includes('90%'));
  assert.match(await page.locator('#hgsGoalLabel').innerText(),/Cel: 8[\s\u00a0]?000/);
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
