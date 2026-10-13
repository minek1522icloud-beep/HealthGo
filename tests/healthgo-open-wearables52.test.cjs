'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ui=fs.readFileSync('www/healthgo-open-wearables52.js','utf8');
const backend=fs.readFileSync('supabase/functions/healthgo-open-wearables/index.ts','utf8');
const sql=fs.readFileSync('supabase/migrations/20261013_healthgo_open_wearables_links.sql','utf8');
const html=fs.readFileSync('www/index.html','utf8');
function fixture(response={configured:false,connections:[]}){
 const seen=[],calls=[],navigate=[];
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.id='';this.className='';this.textContent='';this.attributes={};seen.push(this);}
  append(...x){for(const e of x){e.parentElement=this;this.children.push(e)}}
  appendChild(x){this.append(x);return x}
  replaceChildren(...x){this.children=[];this.append(...x)}
  setAttribute(k,v){this.attributes[k]=v}
  addEventListener(k,v){this.listeners[k]=v}
 }
 const doc={createElement(tag){return new Element(tag)},
  getElementById(id){return seen.filter(e=>e.id===id&&e.parentElement).slice(-1)[0]||null}};
 const host=doc.createElement('main');
 let latestResponse=response;
 const S={state:{uid:'account-owner'}};
 const w={document:doc,HealthGoServices:S,HealthGoSupabase:{
  request:async(path,opts)=>{
   calls.push({path,opts});
   if(opts.method==='GET')return latestResponse;
   if(opts.body?.action==='connect')return {authorization_url:'https://connect.garmin.com/oauth/authorize'};
   if(opts.body?.action==='disconnect')return {disconnected:true};
   throw Error('unexpected');
  }
 },HealthGoDevicesPro45:{render(){}},
 location:{assign(u){navigate.push(u)}},confirm(){return true}};
 vm.runInNewContext(ui,{window:w,document:doc,Date,URL,Set,String,Array,console},{filename:'healthgo-open-wearables52.js'});
 const walk=e=>([e.textContent||'',...(e.children||[]).flatMap(walk)]);
 return {w,S,host,calls,navigate,walk:()=>walk(host).join(' '),
  render:()=>w.HealthGoOpenWearables52.render(host),
  button:t=>seen.filter(e=>e.tag==='button'&&e.textContent.includes(t)&&e.parentElement?.children.includes(e)).at(-1),
  setResponse:data=>{latestResponse=data;}};
}
test('Open Wearables 5.2 JS compiles; old Terra panel is absent from the iPhone bundle',()=>{
 new vm.Script(ui);
 assert.match(html,/healthgo-open-wearables52\.js\?v=1/);
 assert.match(html,/healthgo-open-wearables52\.css\?v=1/);
 assert.doesNotMatch(html,/src="\.\/healthgo-terra50\.js/);
 assert.doesNotMatch(html,/href="\.\/healthgo-terra50\.css/);
 const devices=fs.readFileSync('www/healthgo-devices-pro45.js','utf8');
 assert.match(devices,/HealthGoOpenWearables52/);
 assert.match(devices,/hg52-advanced/);
 assert.match(devices,/advancedOpen/);
});
test('without OW hosting, no OAuth is attempted and no connected statuses are invented',async()=>{
 const f=fixture();f.render();await new Promise(setImmediate);
 assert.equal(f.w.HealthGoOpenWearables52.getState().status,'not-configured');
 assert.match(f.walk(),/Serwer Open Wearables nie jest jeszcze uruchomiony/);
 assert.equal(f.button('Połącz Garmin'),undefined);
 assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);
 assert.equal(f.navigate.length,0);
});
test('OAuth begins only after user action with configured backend and never pretends to be completed',async()=>{
 const f=fixture({configured:true,connections:[]});f.render();await new Promise(setImmediate);
 assert.equal(f.w.HealthGoOpenWearables52.getState().status,'ready');
 const start=f.button('Połącz Garmin');
 assert.ok(start);await start.listeners.click();
 assert.deepEqual(f.navigate,['https://connect.garmin.com/oauth/authorize']);
 assert.equal(f.calls.filter(x=>x.opts.method==='POST'&&x.opts.body?.provider==='garmin').length,1);
 assert.doesNotMatch(f.walk(),/Garmin: połączono|100% połączenia/);
});
test('real OW API connections are displayed with real server state, not local selection',async()=>{
 const f=fixture({configured:true,connections:[{provider:'polar',status:'active',last_synced_at:'2026-10-13T11:10:00Z'}]});
 f.render();await new Promise(setImmediate);
 assert.match(f.walk(),/Polar/);
 assert.match(f.walk(),/Połączone/);
 const b=f.button('Odłącz');assert.ok(b);
 await b.listeners.click();
 assert.equal(f.calls.filter(x=>x.opts.body?.action==='disconnect'&&x.opts.body?.provider==='polar').length,1);
});
test('user change clears remembered provider connections without leaking sensitive data',async()=>{
 const f=fixture({configured:true,connections:[{provider:'garmin',status:'active'}]});f.render();await new Promise(setImmediate);
 assert.equal(f.w.HealthGoOpenWearables52.getState().connections,1);
 f.S.state.uid='different-user';f.setResponse({configured:false,connections:[]});f.render();await new Promise(setImmediate);
 assert.equal(f.w.HealthGoOpenWearables52.getState().owner,'different-user');
 assert.equal(f.w.HealthGoOpenWearables52.getState().connections,0);
});
test('backend validates Supabase JWT and only maps its authenticated owner, no public credentials',()=>{
 assert.match(backend,/getUser\(token\)/);
 assert.match(backend,/\.eq\("user_id",uid\)/);
 assert.match(backend,/X-Open-Wearables-API-Key/);
 assert.match(backend,/Deno\.env\.get\("OW_API_KEY"\)/);
 assert.match(backend,/https:/);
 assert.match(backend,/configured:false/);
 assert.match(backend,/redirect:"error"/);
 assert.match(backend,/PROVIDERS\.has\(provider\)/);
 assert.match(backend,/\/api\/v1\/users/);
 assert.match(backend,/\/api\/v1\/oauth\//);
 assert.match(backend,/\/connections\//);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.hg_open_wearables_links from anon,authenticated/);
 assert.doesNotMatch(backend,/grantXP|xp_events|awardXp|INSERT INTO activity_daily/);
 assert.doesNotMatch(ui,/OW_API_KEY|SUPABASE_SERVICE_ROLE_KEY|localStorage|Math\.random/);
});
