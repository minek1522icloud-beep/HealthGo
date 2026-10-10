'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function read(file){return fs.readFileSync(path.join(__dirname,'..',file),'utf8');}

test('Emerald AI 3.0 loads last, retains the established five chat modes and history',()=>{
 const html=read('www/index.html');
 assert.match(html,/healthgo-ai-emerald-v3\.css\?v=1/);
 assert.match(html,/healthgo-ai-emerald-v3\.js\?v=1/);
 assert.ok(html.indexOf('healthgo-ai-emerald-v3.css')>html.indexOf('healthgo-emerald-2.css'));
 assert.ok(html.indexOf('healthgo-ai-emerald-v3.js')>html.indexOf('healthgo-emerald-dashboard.js'));
 for(const mode of ['assistant','plan','food','activity','explore'])
  assert.ok(html.includes('data-ai-mode="'+mode+'"'));
 for(const level of ['average','medium','high'])
  assert.ok(html.includes('data-response-mode="'+level+'"'));
 assert.match(html,/healthgo_ai_conversations_v2_/);
 assert.match(html,/function askAI\(\)/);
});

test('New AI controls are a presentation enhancer and copy/history search work without new server routes',()=>{
 const js=read('www/healthgo-ai-emerald-v3.js');
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(js,/hgaHistorySearch/);
 assert.match(js,/navigator\.clipboard/);
 assert.match(js,/MutationObserver/);
 assert.match(js,/healthgoAiEmerald/);
 assert.doesNotMatch(js,/Math\.random/);
 assert.doesNotMatch(js,/fetch\(/);
 assert.doesNotMatch(js,/\.generateContent\(/);
});

test('AI background, composer and chat cards use Emerald tokens in both themes',()=>{
 const css=read('www/healthgo-ai-emerald-v3.css');
 for(const selector of [
  'body.hg-emerald #ai .ai-workspace',
  'body.hg-emerald #ai .ai-chat-panel',
  'body.hg-emerald #ai .ai-response-bar',
  'body.hg-emerald #ai .ai-composer',
  'body.hg-emerald #ai .ai-welcome-suggestions',
  'body.hg-emerald #ai .ai-history',
  'body.hg-emerald #ai .ai-msg.assistant .hga-copy'
 ])assert.ok(css.includes(selector),'Missing AI style '+selector);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/var\(--emerald-accent-ink\)/);
});

test('Phone images are validated and desktop fallback retains request mode and context',()=>{
 const html=read('www/index.html');
 assert.match(html,/const allowed=\['image\/png','image\/jpeg','image\/webp'\]/);
 assert.match(html,/file\.size>8\*1024\*1024/);
 assert.match(html,/if\(aiPendingPhoto!==file\)return/);
 assert.match(html,/mode:requestMode,responseMode:requestLevel,history:requestHistory,\s*signal:mobileController\.signal/);
 assert.match(html,/Przywróć pytanie/);
 assert.match(html,/healthGoAITimed\(askHealthGoMobileAI\(q,imageData,\{/);
});

test('GitHub Pages generates phone AI bundle during deployment, not tracked in source',()=>{
 const workflow=read('.github/workflows/mobile-pages.yml');
 assert.match(workflow,/www\/healthgo-ai-entry\.js/);
 assert.match(workflow,/--outfile=\.\.\/www\/healthgo-ai-bundle\.js/);
 assert.match(workflow,/test -s www\/healthgo-ai-bundle\.js/);
});
