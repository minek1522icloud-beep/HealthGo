'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const diagnostics=require('../www/healthgo-ai-diagnostics.js');

test('desktop AI provides safe cloud and Ollama error categories',()=>{
 const data=diagnostics.summarize(
   new Error('AI_AUTH_ERROR 403 permission-denied'),
   Object.assign(new Error('Lokalne HealthGo AI jest niedostępne.'),{code:'OLLAMA_NOT_RUNNING',status:503})
 );
 assert.equal(data.code,'CLOUD_ACCESS / LOCAL_OLLAMA');
 assert.match(data.cloud.label,/odrzuciła dostęp/i);
 assert.match(data.local.label,/Ollama/i);
});

test('desktop AI classifies missing Ollama models and provider rate limits',()=>{
 const cloud=new Error('AI_RATE_LIMIT 429 resource-exhausted');
 const local=Object.assign(new Error('Ollama nie ma zainstalowanego modelu AI.'),{code:'OLLAMA_NO_MODELS',status:503});
 const data=diagnostics.summarize(cloud,local);
 assert.equal(data.code,'CLOUD_LIMIT / LOCAL_MODEL');
});

test('desktop AI does not echo raw credentials or exception strings to visible diagnostics',()=>{
 const data=diagnostics.summarize(
   new Error('AI_AUTH_ERROR 403 secret API_TOKEN_SHOULD_NOT_LEAK'),
   new Error('failed to fetch https://localhost/?private=abc')
 );
 assert.equal(data.code,'CLOUD_ACCESS / LOCAL_NETWORK');
 assert.doesNotMatch(JSON.stringify(data),/API_TOKEN_SHOULD_NOT_LEAK|private=abc/);
});

test('desktop AI has explicit status endpoint, missing Ollama feedback and realistic fallback timeout',()=>{
 const main=fs.readFileSync('main.cjs','utf8');
 const html=fs.readFileSync('www/index.html','utf8');
 assert.match(main,/requestUrl\.pathname === '\/api\/ai\/status'/);
 assert.match(main,/OLLAMA_NO_MODELS/);
 assert.match(main,/spawnFailed/);
 assert.match(main,/localAvailable:/);
 assert.match(html,/healthgo-ai-diagnostics\.js/);
 assert.match(html,/Kod diagnostyczny:/);
 assert.match(html,/Sprawdź lokalne AI/);
 assert.match(html,/await fetch\('\/api\/ai\/status'/);
 assert.match(html,/aiResponseMode==='average'\?65000/);
 assert.match(html,/const cloudTimeout=aiResponseMode==='average'\?28000/);
});

test('desktop AI diagnostics leave the original map and mobile navigation untouched',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const suite=fs.readFileSync('www/healthgo-mobile-suite.js','utf8');
 assert.match(html,/function renderFamilyLocationsOnMap\(\)/);
 assert.match(html,/data-mobile-page="map"/);
 const section=suite.slice(suite.indexOf('function setupMobileNav'),suite.indexOf('function updateProfileIcon'));
 assert.doesNotMatch(section,/replaceChildren/);
});
