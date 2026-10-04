'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  isHealthGoOrigin,
  isAllowedAuthPopupUrl,
  secureWebPreferences
}=require('../desktop-security.cjs');

test('desktop trusts only the local HealthGo application origin',()=>{
  assert.equal(isHealthGoOrigin('http://127.0.0.1:5500/index.html'),true);
  assert.equal(isHealthGoOrigin('http://localhost:5500/'),true);
  assert.equal(isHealthGoOrigin('http://127.0.0.1:5501/'),false);
  assert.equal(isHealthGoOrigin('https://127.0.0.1:5500/'),false);
  assert.equal(isHealthGoOrigin('javascript:alert(1)'),false);
});

test('auth popup allowlist rejects hostname lookalikes and unsafe schemes',()=>{
  assert.equal(isAllowedAuthPopupUrl('https://accounts.google.com/o/oauth2/auth'),true);
  assert.equal(isAllowedAuthPopupUrl('https://healthgo-e45be.firebaseapp.com/__/auth/handler'),true);
  assert.equal(isAllowedAuthPopupUrl('https://identitytoolkit.googleapis.com/v1/test'),true);
  assert.equal(isAllowedAuthPopupUrl('https://evil.example/?next=accounts.google.com'),false);
  assert.equal(isAllowedAuthPopupUrl('https://accounts.google.com.evil.example/'),false);
  assert.equal(isAllowedAuthPopupUrl('javascript:alert(1)'),false);
  assert.equal(isAllowedAuthPopupUrl('file:///C:/secret.txt'),false);
});

test('Electron renderer security settings stay locked down',()=>{
  const prefs=secureWebPreferences();
  assert.equal(prefs.contextIsolation,true);
  assert.equal(prefs.nodeIntegration,false);
  assert.equal(prefs.webSecurity,true);
  assert.equal(prefs.sandbox,true);
  assert.equal(prefs.allowRunningInsecureContent,false);
});
