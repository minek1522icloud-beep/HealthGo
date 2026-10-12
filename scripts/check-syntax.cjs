'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const files=['main.cjs','desktop-security.cjs','healthgo-ai-server.mjs','www/supabase-client.js','www/healthgo-services.js','www/healthgo-v2-ui.js','www/healthgo-pro.js','www/healthgo-emerald-dashboard.js','www/healthgo-ai-emerald-v3.js','www/healthgo-navigation-follow-v1.js','www/healthgo-navigation-mode.js','www/healthgo-route-3d-overlay.js','www/healthgo-map-extras.js','www/healthgo-plan-v4.js','www/healthgo-point.js','www/healthgo-treasure.js','www/healthgo-navigation-ux.js','www/healthgo-collectible-art.js','www/healthgo-medals.js','www/healthgo-badge-3d.js','www/healthgo-badge-simple.js','www/healthgo-badge-photo.js','www/healthgo-badge-shields.js','www/healthgo-map-recovery.js','www/healthgo-badge-vector.js','www/healthgo-collector-room.js','www/healthgo-rewards.js','www/healthgo-friends.js','www/healthgo-profile-pro.js','www/healthgo-pack-pro.js','www/healthgo-release-notes.js','www/service-worker.js','www/core/achievement-engine.js','www/core/health-data.js'];
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
if(!html.includes('healthgo-pack-pro.js?v=9')||!html.includes('healthgo-pack-pro.css?v=3')||!html.includes('healthgo-rewards.js?v=4')||!html.includes('healthgo-release-notes.js?v=16')||!html.includes('healthgo-medals.js?v=2'))throw Error('Missing Plecak 2.0 assets in HTML');
if(!fs.existsSync('www/healthgo-pack-pro.css'))throw Error('Missing Plecak 2.0 CSS');
if(!html.includes('healthgo-more-list-v5.css?v=1'))throw Error('Missing premium More menu stylesheet link');
if(!fs.existsSync('www/healthgo-more-list-v5.css'))throw Error('Missing premium More menu stylesheet');
if(!html.includes('id="hgMoreHeading"')||!html.includes('data-hg2-family="1"'))throw Error('More menu missing header or Family slot');
console.log('Validated application, Emerald assets and '+count+' inline scripts.');

if(!html.includes('healthgo-rewards.css?v=3')||!html.includes('healthgo-release-notes.css?v=1'))throw Error('Missing rewards CSS or release notes CSS');

if(!html.includes('healthgo-friends.js?v=1')||!html.includes('healthgo-friends.css?v=1'))throw Error('Missing friends assets');

if(!html.includes('healthgo-profile-pro.js?v=5')||!html.includes('healthgo-profile-pro.css?v=4'))throw Error('Missing Profile PRO bundle');

if(!html.includes('healthgo-collectible-art.js?v=2'))throw Error('Missing original collectible artwork');

if(!html.includes('healthgo-badge-3d.js?v=3')||!html.includes('healthgo-badge-3d.css?v=3'))throw Error('Missing interactive Badge Forge 3D assets');

if(!html.includes('healthgo-collector-room.js?v=1')||!html.includes('healthgo-collector-room.css?v=1'))throw Error('Missing collector room assets');

if(!html.includes('healthgo-badge-simple.js?v=1')||!html.includes('healthgo-badge-simple.css?v=1'))throw Error('Missing simple collectible badges');
if(html.includes('src="./healthgo-badge-board.js')||html.includes('href="./healthgo-badge-board.css'))throw Error('Broken poster crop renderer must not be loaded');
if(html.includes('healthgo-badge-vector.js?v=1')||html.includes('healthgo-badge-vector.css?v=1'))throw Error('Old vector badge UI must not load');
if(!fs.existsSync('www/healthgo-badge-simple.js'))throw Error('Simple badge JS missing');
if(html.includes('healthgo-badge-gallery.js')||html.includes('healthgo-badge-gallery.css'))throw Error('Legacy blurry photo badge gallery must not load');

if(!html.includes('healthgo-badge-photo.js?v=1')||!html.includes('healthgo-badge-photo.css?v=1'))throw Error('Original badge images must be loaded after simple fallback');
