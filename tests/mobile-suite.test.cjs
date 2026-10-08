'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('2FA enrollment is managed from settings instead of being offered after login',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  const start=html.indexOf('async function finishMfaStep');
  const end=html.indexOf('async function busy',start);
  assert.ok(start>=0&&end>start);
  const finish=html.slice(start,end);
  assert.doesNotMatch(finish,/askEnableMfa\(/);
  assert.match(html,/window\.HealthGoMFASettings/);
  assert.match(html,/auth\.mfa\.unenroll/);
});

test('mobile AI prevents double sends, restores current chat context and uses a timeout',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  assert.match(html,/window\.healthGoAIRequestBusy=false/);
  assert.match(html,/if\(!requestUid\|\|window\.healthGoAIRequestBusy\)return/);
  assert.match(html,/function aiSyncHistoryFromDom\(\)/);
  assert.match(html,/healthGoAITimed\(askHealthGoMobileAI\(q,imageData\),mobileTimeout\)/);
  assert.match(html,/AI offline · tryb podstawowy/);
});

test('mobile suite adds child account, privacy, notifications, offline, appearance and AI settings',()=>{
  const suite=fs.readFileSync('www/healthgo-mobile-suite.js','utf8');
  for(const id of [
    'settingsChildPro','settingsGoalsPro','settingsNotificationsPro','settingsPrivacyPro',
    'settingsSecurityPro','settingsAppearancePro','settingsEmergencyPro','settingsOfflinePro',
    'settingsAIPro','settingsMorePro'
  ]) assert.match(suite,new RegExp(id));
  const navStart=suite.indexOf('function setupMobileNav');
  const navEnd=suite.indexOf('function updateProfileIcon',navStart);
  assert.ok(navStart>=0&&navEnd>navStart);
  const nav=suite.slice(navStart,navEnd);
  assert.doesNotMatch(nav,/replaceChildren/);
  assert.match(nav,/Zachowujemy oryginalny pasek mobilny/);
});

test('mobile suite settings can sync through HealthGo services',()=>{
  const services=fs.readFileSync('www/healthgo-services.js','utf8');
  assert.match(services,/case 'updateSettings'/);
  assert.match(services,/settingsV3:settings/);
});

test('offline worker includes new mobile suite assets',()=>{
  const sw=fs.readFileSync('www/service-worker.js','utf8');
  assert.match(sw,/healthgo-mobile-suite\.js/);
  assert.match(sw,/healthgo-mobile-suite\.css/);
  assert.match(sw,/update-verified/);
});
