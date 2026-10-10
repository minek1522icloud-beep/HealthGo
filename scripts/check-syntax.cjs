'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const files=['main.cjs','desktop-security.cjs','healthgo-ai-server.mjs','www/supabase-client.js','www/healthgo-services.js','www/healthgo-v2-ui.js','www/healthgo-pro.js','www/healthgo-emerald-dashboard.js','www/healthgo-ai-emerald-v3.js','www/healthgo-navigation-follow-v1.js','www/healthgo-plan-v4.js','www/healthgo-medals.js','www/healthgo-pack-pro.js','www/service-worker.js','www/core/achievement-engine.js','www/core/health-data.js'];
for(const file of files){if(file.endsWith('.mjs')){require('node:child_process').execFileSync(process.execPath,['--check',file]);}else new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});}
const html=fs.readFileSync('www/index.html','utf8');let count=0;
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(match[1].trim()){new vm.Script(match[1],{filename:'www/index.html:inline-'+(++count)});}}
for(const match of html.matchAll(/<script\s+src="\.\/([^"]+)"/g)){const file=path.join('www',match[1].split('?')[0]);if(!fs.existsSync(file))throw Error('Missing local script '+file);}
if(!html.includes('healthgo-emerald-2.css?v=1'))throw Error('Missing Emerald theme link');
if(!fs.existsSync('www/healthgo-emerald-2.css'))throw Error('Missing Emerald theme stylesheet');
if(!html.includes('healthgo-ai-emerald-v3.css?v=2'))throw Error('Missing HealthGo AI Emerald CSS');
if(!fs.existsSync('www/healthgo-ai-emerald-v3.css'))throw Error('Missing HealthGo AI Emerald CSS file');
if(!html.includes('healthgo-navigation-follow-v1.css?v=1'))throw Error('Missing moving GPS arrow stylesheet');
if(!fs.existsSync('www/healthgo-navigation-follow-v1.css'))throw Error('Moving GPS arrow stylesheet file is absent');
if(!html.includes('healthgo-plan-emerald-v4.css?v=2'))throw Error('Missing HealthGo Planner 4 CSS');
if(!fs.existsSync('www/healthgo-plan-emerald-v4.css'))throw Error('Missing HealthGo Planner CSS file');
if(!html.includes('healthgo-plan-v4.js?v=2'))throw Error('Missing HealthGo Planner 4 JS');
if(!html.includes('healthgo-pack-pro.js?v=2')||!html.includes('healthgo-pack-pro.css?v=2')||!html.includes('healthgo-medals.js?v=1'))throw Error('Missing Plecak 2.0 assets in HTML');
if(!fs.existsSync('www/healthgo-pack-pro.css'))throw Error('Missing Plecak 2.0 CSS');
if(!html.includes('healthgo-more-list-v5.css?v=1'))throw Error('Missing premium More menu stylesheet link');
if(!fs.existsSync('www/healthgo-more-list-v5.css'))throw Error('Missing premium More menu stylesheet');
if(!html.includes('id="hgMoreHeading"')||!html.includes('data-hg2-family="1"'))throw Error('More menu missing header or Family slot');
console.log('Validated application, Emerald assets and '+count+' inline scripts.');
