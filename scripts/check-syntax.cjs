'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const files=['main.cjs','desktop-security.cjs','healthgo-ai-server.mjs','www/supabase-client.js','www/healthgo-services.js','www/healthgo-v2-ui.js','www/healthgo-pro.js','www/healthgo-emerald-dashboard.js','www/healthgo-ai-emerald-v3.js','www/service-worker.js','www/core/achievement-engine.js','www/core/health-data.js'];
for(const file of files){if(file.endsWith('.mjs')){require('node:child_process').execFileSync(process.execPath,['--check',file]);}else new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});}
const html=fs.readFileSync('www/index.html','utf8');let count=0;
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(match[1].trim()){new vm.Script(match[1],{filename:'www/index.html:inline-'+(++count)});}}
for(const match of html.matchAll(/<script\s+src="\.\/([^"]+)"/g)){const file=path.join('www',match[1].split('?')[0]);if(!fs.existsSync(file))throw Error('Missing local script '+file);}
if(!html.includes('healthgo-emerald-2.css?v=1'))throw Error('Missing Emerald theme link');
if(!fs.existsSync('www/healthgo-emerald-2.css'))throw Error('Missing Emerald theme stylesheet');
if(!html.includes('healthgo-ai-emerald-v3.css?v=2'))throw Error('Missing HealthGo AI Emerald CSS');
if(!fs.existsSync('www/healthgo-ai-emerald-v3.css'))throw Error('Missing HealthGo AI Emerald CSS file');
console.log('Validated application, Emerald assets and '+count+' inline scripts.');
