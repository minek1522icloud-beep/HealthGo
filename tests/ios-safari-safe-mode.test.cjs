'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

test('Safari diagnostics is a small independent page without app startup code',()=>{
 const html=fs.readFileSync('www/diagnostics.html','utf8');
 assert.ok(html.length<15000,'diagnostics must be lightweight');
 assert.match(html,/Sprawdź iPhone’a/);
 assert.match(html,/\.\/safe\.html\?hg_safe=1/);
 assert.match(html,/\.\/version\.json/);
 assert.doesNotMatch(html,/healthgo-ai-bundle\.js|healthgo-offline-ai-worker\.js|leaflet\.js/);
 assert.doesNotMatch(html,/localStorage\.clear\(|indexedDB\.deleteDatabase/);
});

test('Pages builds an opt-in lightweight HealthGo shell preserving account code',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'healthgo-safemode-'));
 const output=path.join(dir,'safe.html');
 try{
  execFileSync('python3',['scripts/build-safe-mobile.py','www/index.html',output]);
  const src=fs.readFileSync('www/index.html','utf8');
  const safe=fs.readFileSync(output,'utf8');
  assert.ok((safe.match(/<script src=/g)||[]).length < (src.match(/<script src=/g)||[]).length,'safe mode loads fewer executable modules');
  assert.match(safe,/name="healthgo-safe-mode" content="1"/);
  assert.match(safe,/HealthGoSupabase/);
  assert.match(safe,/HealthGoServices/);
  assert.match(safe,/id="aiMessages"/);
  assert.match(safe,/note\.id='hg-safe-note'/);
  assert.doesNotMatch(safe,/<script src="\.\/healthgo-(?:v2-ui|mobile-suite|pro|devices|offline-ai)\.js"/);
  assert.doesNotMatch(safe,/<script src="https:\/\/unpkg\.com\/leaflet@/);
  assert.doesNotMatch(safe,/if \(typeof setupMobilePWA === 'function'\) setupMobilePWA\(\);/);
  assert.match(src,/if \(typeof setupMobilePWA === 'function'\) setupMobilePWA\(\);/);
  assert.match(src,/<script src="\.\/healthgo-v2-ui\.js"><\/script>/);
 }finally{
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('Pages action ships diagnostic URLs and verifies safe mode files exist',()=>{
 const workflow=fs.readFileSync('.github/workflows/mobile-pages.yml','utf8');
 assert.match(workflow,/python3 scripts\/build-safe-mobile\.py www\/index\.html www\/safe\.html/);
 assert.match(workflow,/test -s www\/safe\.html/);
 assert.match(workflow,/test -s www\/diagnostics\.html/);
});
