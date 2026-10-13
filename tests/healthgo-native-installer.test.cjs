'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('installation hub has separate honest platform states and no unverified links',()=>{
 const html=read('www/install.html'),js=read('www/healthgo-installer.js');
 assert.match(html,/id="iosDownload"/);assert.match(html,/id="androidDownload"/);
 assert.match(html,/healthgo-installer\.js\?v=/);assert.match(html,/href="\.\/index\.html"/);
 assert.match(js,/releases\?per_page=10/);assert.match(js,/HealthGo-Android\.apk/);
 assert.match(js,/asset\.state==='uploaded'/);
 assert.match(js,/iosTestFlightUrl=null/);assert.match(js,/iosAppStoreUrl=null/);
 assert.doesNotMatch(html,/<a[^>]+href="https:\/\/testflight\.apple\.com/);
 new vm.Script(js);new vm.Script(read('www/healthgo-install-entry.js'));
});
test('native scaffold is separate from desktop Electron and includes both platforms',()=>{
 const cfg=JSON.parse(read('native-shell/capacitor.config.json'));
 const pkg=JSON.parse(read('native-shell/package.json'));
 assert.equal(cfg.appName,'HealthGo');assert.equal(cfg.webDir,'web');
 assert.ok(pkg.dependencies['@capacitor/android']);assert.ok(pkg.dependencies['@capacitor/ios']);
 assert.match(read('.github/workflows/native-android.yml'),/assembleDebug/);
 assert.match(read('.github/workflows/native-android.yml'),/ANDROID_KEYSTORE_BASE64/);
});
