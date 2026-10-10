'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
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
  }catch(_){res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve))});
for(const [width,height] of [[360,740],[390,844],[414,896],[430,932]]){
 test('iPhone AI controls and welcome fit '+width+' x '+height,async()=>{
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('https://**/*',route=>route.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   // Simulate a previously saved conversation without visible content.
   localStorage.setItem('healthgo_ai_conversations_v2_ai-iphone-fixture',JSON.stringify([
    {id:'empty',title:'Rozmowa',messages:[{role:'assistant',text:'  '}],updated:Date.now()}
   ]));
  });
  await page.goto(origin);
  await page.waitForFunction(()=>!!window.HealthGoServices&&!!document.getElementById('hgaHistorySearch'));
  await page.evaluate(async()=>{
   await HealthGoServices.start({uid:'ai-iphone-fixture',email:'iphone@example.invalid',providerData:[]});
   document.getElementById('authScreen')?.classList.remove('show');
   document.getElementById('splashScreen')?.classList.add('hide');
   document.querySelectorAll('.auth-hidden').forEach(node=>node.classList.remove('auth-hidden'));
   document.body.dataset.dark='1';
   window.go('ai');
  });
  await page.locator('#aiMessages .ai-welcome h2').waitFor({timeout:4500});
  const bounds=await page.evaluate(()=>{
   const sel=s=>document.querySelector(s);
   const rect=s=>{
    const e=sel(s);const r=e?.getBoundingClientRect();
    return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null;
   };
   const camera=sel('#ai .ai-composer-tools button:first-child');
   const send=sel('#aiSendBtn');
   return {
    fullWidth:document.documentElement.scrollWidth,
    innerWidth:document.documentElement.clientWidth,
    composer:rect('#ai .ai-composer'),
    camera:rect('#ai .ai-composer-tools button:first-child'),
    send:rect('#aiSendBtn'),
    text:rect('#aiInput'),
    footer:rect('#ai .ai-footnote'),
    nav:rect('.mobile-nav'),
    messages:rect('#aiMessages'),
    welcome:rect('#aiMessages .ai-welcome'),
    avatarDisplay:getComputedStyle(sel('#ai .hga-chat-avatar')).display,
    avatarFont:getComputedStyle(sel('#ai .hga-chat-avatar')).fontSize,
    cameraPseudo:getComputedStyle(camera,'::after').content,
    sendPseudo:getComputedStyle(send,'::after').content
   };
  });
  assert.ok(bounds.fullWidth<=bounds.innerWidth+1,'Page overflows horizontally: '+JSON.stringify(bounds));
  assert.ok(bounds.composer&&bounds.camera&&bounds.send&&bounds.text,'Missing composer parts');
  for(const name of ['camera','send','text']){
   const r=bounds[name],parent=bounds.composer;
   assert.ok(r.left>=parent.left-2 && r.right<=parent.right+2 &&
    r.top>=parent.top-2 && r.bottom<=parent.bottom+2,
    name+' escapes message composer: '+JSON.stringify(bounds));
  }
  assert.ok(['none','normal'].includes(bounds.cameraPseudo),'Old camera + overlay: '+JSON.stringify(bounds));
  assert.ok(['none','normal'].includes(bounds.sendPseudo),'Old send arrow overlay: '+JSON.stringify(bounds));
  assert.equal(bounds.avatarDisplay,'grid');
  assert.ok(parseFloat(bounds.avatarFont)>=20,'Assistant icon is missing: '+JSON.stringify(bounds));
  assert.ok(bounds.welcome?.height>100 && bounds.welcome.top>=bounds.messages.top-2,'Welcome missing: '+JSON.stringify(bounds));
  assert.ok(bounds.footer.bottom<=bounds.nav.top+4,'Footer overlaps navigation: '+JSON.stringify(bounds));
  await page.locator('#ai .ai-topic[data-ai-mode="activity"]').click();
  assert.equal(await page.locator('#ai .ai-topic[data-ai-mode="activity"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
