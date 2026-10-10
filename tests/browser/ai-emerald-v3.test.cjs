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
test.after(async()=>{
 await browser?.close();
 await new Promise(resolve=>server?.close(resolve));
});
for(const width of [360,390,768,1440]){
 test('AI Emerald mobile chat fits '+width+'px and preserves modes/history',async()=>{
  const page=await browser.newPage({viewport:{width,height:850}});
  await page.route('https://**/*',route=>route.abort());
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(()=>!!window.HealthGoServices&&document.getElementById('hgaHistorySearch'));
  await page.evaluate(async()=>{
   await HealthGoServices.start({uid:'ai-fixture',email:'fixture@example.invalid',providerData:[]});
   document.getElementById('authScreen').classList.remove('show');
   document.getElementById('splashScreen').classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(el=>el.classList.remove('auth-hidden'));
   document.body.dataset.dark='1';
   window.go('ai');
  });
  await page.waitForTimeout(150);
  // The first-login location permission prompt is unrelated to AI; decline it as a user would.
  // This prevents the modal from intercepting AI buttons on small screens.
  await page.evaluate(()=>window.HealthGoMapV2?.chooseWelcomeLocation(false));
  assert.equal(await page.locator('#ai .hga-chat-avatar').count(),1);
  assert.equal(await page.locator('#ai .ai-topic').count(),5);
  const colors=await page.evaluate(()=>{
   const cs=getComputedStyle(document.querySelector('#ai .ai-chat-panel'));
   const rs=getComputedStyle(document.querySelector('#ai .ai-response-bar'));
   const parse=color=>[...color.matchAll(/\d+/g)].slice(0,3).map(m=>Number(m[0]));
   return {chat:parse(cs.backgroundColor),response:parse(rs.backgroundColor)};
  });
  for(const channels of [colors.chat,colors.response]){
   assert.ok(channels.length===3&&channels.every(value=>value<110),'Dark screen unexpectedly white '+JSON.stringify(colors));
  }
  const sizes=await page.evaluate(()=>({
   scroll:document.documentElement.scrollWidth,
   client:document.documentElement.clientWidth
  }));
  assert.ok(sizes.scroll<=sizes.client+1,'AI viewport overflow '+width+'px '+JSON.stringify(sizes));

  await page.locator('#ai .ai-topic[data-ai-mode="explore"]').click();
  assert.equal(await page.locator('#ai .ai-topic[data-ai-mode="explore"]').getAttribute('aria-pressed'),'true');
  await page.locator('#ai .ai-response-mode[data-response-mode="medium"]').click();
  assert.match(await page.locator('#ai .ai-response-mode[data-response-mode="medium"]').getAttribute('class'),/active/);

  await page.evaluate(()=>{
   window.aiAddMessage('user','<p>Moja rozmowa o planetach</p>');
   window.aiAddMessage('assistant','<p>Saturn ma pierścienie.</p>');
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedAI=text;}}});
  });
  await page.waitForFunction(()=>document.querySelectorAll('#aiMessages .hga-copy').length>0);
  await page.locator('#aiMessages .hga-copy').last().click();
  assert.equal(await page.evaluate(()=>window.__copiedAI),'Saturn ma pierścienie.');
  await page.waitForFunction(()=>[...document.querySelectorAll('#aiHistory .ai-history-item')].some(x=>x.textContent.includes('Moja rozmowa')));
  if(width<=900)await page.locator('#aiHistoryToggle').click();
  await page.locator('#hgaHistorySearch').fill('planety');
  const visible=await page.locator('#aiHistory .ai-history-item:visible').count();
  assert.equal(visible,0);
  await page.locator('#hgaHistorySearch').fill('Moja rozmowa');
  assert.ok(await page.locator('#aiHistory .ai-history-item:visible').count()>0);
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
