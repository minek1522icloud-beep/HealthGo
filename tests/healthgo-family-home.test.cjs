'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const js=fs.readFileSync('www/healthgo-family-home.js','utf8');
const html=fs.readFileSync('www/index.html','utf8');
test('Family Home module parses and is loaded after authenticated services',()=>{
 new vm.Script(js);
 assert.match(html,/healthgo-services\.js/);
 assert.match(html,/healthgo-family-home\.js\?v=1/);
 assert.match(html,/healthgo-family-home\.css\?v=1/);
 assert.ok(html.indexOf('healthgo-services.js')<html.indexOf('healthgo-family-home.js'));
});
test('Family Home uses authenticated family RPC operations and does not auto-share health data',()=>{
 assert.match(js,/call\('createFamily'/);
 assert.match(js,/call\('createFamilyInvite'/);
 assert.match(js,/call\('acceptFamilyInvite'/);
 assert.match(js,/family\.callerRole==='guardian'/);
 assert.match(js,/Dane zdrowotne i lokalizacja nie są udostępniane automatycznie/);
 assert.doesNotMatch(js,/localStorage|navigator\.geolocation|healthgo_get_family_member_health/);
});
