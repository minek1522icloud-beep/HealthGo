'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=path.resolve(__dirname,'../../www/core/achievement-engine.js');
const target=path.resolve(__dirname,'achievement-engine.cjs');
if(!fs.existsSync(source))throw new Error('Missing HealthGo achievement engine');
fs.copyFileSync(source,target);
console.log('Prepared server achievement engine');
