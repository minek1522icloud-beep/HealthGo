'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('www/index.html','utf8').replace(/\r\n/g,'\n');
const css=fs.readFileSync('www/healthgo-chat-modern.css','utf8');

test('Phone chat has one standard interface, without cloud/offline installer panels',()=>{
 assert.match(html,/id="aiMessages"/);
 assert.match(html,/id="aiInput"/);
 assert.match(html,/id="aiSendBtn"/);
 assert.match(html,/healthgo-chat-modern\.css/);
 assert.doesNotMatch(html,/id="hgOfflineAiSetup"/);
 assert.doesNotMatch(html,/id="hgOfflineAiDeviceBadge"/);
 assert.doesNotMatch(html,/<script src="\.\/healthgo-offline-ai\.js"/);
 assert.doesNotMatch(html,/class="mobile-ai-note"/);
 assert.match(css,/#ai \.ai-chat-top\{display:flex!important/);
});

test('Five visible topic buttons and all three response levels are present',()=>{
 for(const topic of ['assistant','plan','food','activity','explore'])
   assert.match(html,new RegExp('data-ai-mode="'+topic+'"'));
 for(const level of ['average','medium','high'])
   assert.match(html,new RegExp('data-response-mode="'+level+'"'));
 assert.match(html,/function aiSetMode\(mode,btn\)/);
 assert.match(html,/healthgo\.ai\.topicMode/);
 assert.match(html,/healthgo\.ai\.responseMode/);
 assert.match(html,/aria-pressed/);
 assert.match(css,/#ai \.ai-topic\{flex:0 0 auto;width:auto!important/);
});

test('iPhone App Check can load required reCAPTCHA assets under the CSP',()=>{
 const policy=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
 assert.ok(policy,'explicit CSP exists');
 const directives=Object.fromEntries(policy.split(';').map(x=>x.trim()).filter(Boolean).map(x=>[x.split(' ')[0],x]));
 assert.ok(directives['script-src']?.includes('https://www.gstatic.com/recaptcha/'),'reCAPTCHA script host allowed');
 assert.ok(directives['frame-src']?.includes('https://recaptcha.google.com/recaptcha/'),'reCAPTCHA iframe host allowed');
 assert.ok(directives['img-src']?.includes('https://www.gstatic.com/recaptcha/'),'reCAPTCHA images allowed');
 assert.ok(!(directives['script-src']||'').split(' ').includes("'unsafe-eval'"),'CSP never grants unrestricted JS eval');
});

test('Phone chat automatically uses the existing AI without selecting a provider',()=>{
 const start=html.indexOf('if(isHostedMobileHealthGo()){\n     const statusText');
 const end=html.indexOf('}else{\n     let cloudError=null,localError=null;',start);
 assert.ok(start>0&&end>start,'phone AI branch exists');
 const phone=html.slice(start,end);
 assert.match(phone,/healthGoAITimed\(askHealthGoMobileAI\(q,imageData,\{/);
 assert.match(phone,/mode:requestMode,responseMode:requestLevel,history:requestHistory/);
 assert.match(phone,/signal:mobileController\.signal/);
 assert.match(phone,/navigator\.onLine===false/);
 assert.doesNotMatch(phone,/HealthGoOfflineAI|local\.ask\(|LOCAL_OFFLINE_MODEL_MISSING/);
 assert.match(html,/function aiShowWelcome\(\)/);
 assert.match(html,/function aiToggleHistory\(force\)/);
 assert.match(html,/id="aiHistoryToggle"/);
});

test('Phone chat keeps account-specific history and refuses duplicate sends',()=>{
 assert.match(html,/if\(!requestUid\|\|window\.healthGoAIRequestBusy\)return/);
 assert.match(html,/healthgo_ai_conversations_v2_/);
 assert.match(html,/window\.healthGoClearAIHistory=/);
 assert.match(html,/aiToggleHistory\(false\)/);
});

test('Every inline JavaScript block in HealthGo index parses',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>2);
 let parsed=0;
 for(const match of scripts){
  const code=match[1].trim();
  if(!code)continue;
  new vm.Script(code,{filename:'www/index.html inline script '+(parsed+1)});
  parsed++;
 }
 assert.ok(parsed>2);
});
