'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const browser=fs.readFileSync('www/healthgo-terra50.js','utf8');
const link=fs.readFileSync('supabase/functions/healthgo-terra-link/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/healthgo-terra-webhook/index.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20261013_healthgo_terra_connections.sql','utf8');
const html=fs.readFileSync('www/index.html','utf8');
const css=fs.readFileSync('www/healthgo-terra50.css','utf8');
function fixture(initial={configured:false,connections:[]}){
 const els=[],seen=[],responses=[initial],calls=[],links=[];
 class El{
  constructor(tag){this.tag=tag;this.className='';this.id='';this.children=[];this.disabled=false;this.listeners={};this.textContent='';this.attrs={};els.push(this);}
  append(...children){for(const c of children){this.children.push(c);if(c&&typeof c==='object')c.parentElement=this;}}
  appendChild(c){this.append(c);return c;}
  replaceChildren(...children){this.children=[];this.append(...children);}
  addEventListener(type,fn){this.listeners[type]=fn;}
  setAttribute(k,v){this.attrs[k]=v;}
 }
 const document={createElement:tag=>new El(tag),getElementById:id=>els.find(x=>x.id===id)};
 const root=document.createElement('section');
 const S={state:{uid:'alice'}};
 const supabase={
  request:async(path,options)=>{
   calls.push({path,options});
   if(options.method==='GET')return responses[0];
   if(options.body?.action==='connect')return{url:'https://widget.tryterra.co/session/example',expires_in:900};
   if(options.body?.action==='disconnect')return{status:'disconnected'};
   throw Error('unexpected request');
  },
  db:{select:async(table)=>table==='hg_terra_daily_metrics'?[]:[]}
 };
 const win={document,HealthGoServices:S,HealthGoSupabase:supabase,
  HealthGoDevicesPro45:{render(){}},
  location:{assign(url){links.push(url)}},
  confirm:()=>true};
 vm.runInNewContext(browser,{window:win,document,URL,Date,Number,String,Array,console},
  {filename:'healthgo-terra50.js'});
 const text=x=>[x.textContent||'',...(x.children||[]).flatMap(text)].join(' ');
 return {document,root,win,responses,calls,links,
  render:()=>win.HealthGoTerra50.render(root),
  allText:()=>text(root),
  button:s=>els.filter(x=>x.tag==='button'&&x.textContent.includes(s)&&x.parentElement?.children.includes(x)).at(-1)
 };
}
test('Terra frontend is valid JavaScript and does not expose secret keys',()=>{
 new vm.Script(browser);
 assert.doesNotMatch(browser,/const\s+(TERRA_API_KEY|TERRA_WEBHOOK_SECRET|TERRA_DEV_ID)\s*=/);
 assert.doesNotMatch(html,/src="\.\/healthgo-terra50\.js/);
 assert.doesNotMatch(html,/href="\.\/healthgo-terra50\.css/);
 assert.match(css,/hg50-terra-btn:disabled/);
 assert.match(browser,/HealthGoSupabase/);
});
test('Terra is unconfigured by default: no fake connection, no charges, no widget',async()=>{
 const f=fixture();
 f.render();
 await new Promise(setImmediate);
 assert.equal(f.win.HealthGoTerra50.getState().configured,false);
 assert.match(f.allText(),/nie jest jeszcze skonfigurowana/i);
 const b=f.button('Połącz konto producenta');
 assert.ok(b);assert.equal(b.disabled,true);
 assert.equal(f.calls.filter(x=>x.options.method==='POST').length,0);
 assert.equal(f.links.length,0);
});
test('widget auth is user-initiated and uses provider domain, not a fake connection',async()=>{
 const f=fixture({configured:true,connections:[]});
 f.render();await new Promise(setImmediate);
 assert.equal(f.win.HealthGoTerra50.getState().configured,true);
 const button=f.button('Połącz konto producenta');
 assert.ok(button);assert.equal(button.disabled,false);
 await button.listeners.click();
 assert.deepEqual(f.links,['https://widget.tryterra.co/session/example']);
 assert.equal(f.calls.filter(x=>x.options.body?.action==='connect').length,1);
 assert.doesNotMatch(f.allText(),/Połączono z Garminem|Połączono z Samsungiem/);
});
test('connection list shows signed event state rather than a user-chosen model',async()=>{
 const f=fixture({configured:true,connections:[{id:'server-valid-id',provider:'GARMIN',status:'connected',last_sync_at:'2026-10-13T08:00:00Z'}]});
 f.render();await new Promise(setImmediate);
 assert.match(f.allText(),/GARMIN/);
 assert.match(f.allText(),/Potwierdzone połączenie konta/);
 assert.ok(f.button('Odłącz i usuń odczyty'));
});
test('server-only keys, signed raw Terra webhooks, bound account and restrictive RLS',()=>{
 assert.match(link,/Deno\.env\.get\("TERRA_API_KEY"\)/);
 assert.match(link,/Deno\.env\.get\("TERRA_DEV_ID"\)/);
 assert.match(link,/auth\.getUser\(token\)/);
 assert.match(link,/crypto\.randomUUID\(\)/);
 assert.match(link,/expires_at:expires/);
 assert.match(link,/generateWidgetSession/);
 assert.match(link,/auth\/deauthenticateUser/);
 assert.match(webhook,/Deno\.env\.get\("TERRA_WEBHOOK_SECRET"\)/);
 assert.match(webhook,/req\.headers\.get\("terra-signature"\)/);
 assert.match(webhook,/Date\.now\(\)\/1000-Number\(t\)\)>300/);
 assert.match(webhook,/encoder\.encode\(t\+"\."\+raw\)/);
 assert.match(webhook,/name:"HMAC",hash:"SHA-256"/);
 assert.match(webhook,/event\.reference_id\|\|user\.reference_id/);
 assert.match(webhook,/connection_owner_conflict/);
 assert.match(webhook,/link\.status!=="connected"/);
 assert.doesNotMatch(webhook,/from\("activity_daily"\)|from\("xp_events"\)/);
 assert.match(migration,/enable row level security/g);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/revoke insert,update,delete/);
 assert.match(migration,/hg_terra_daily_metrics/);
});
