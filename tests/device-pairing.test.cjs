'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('web device pairing uses real Bluetooth capabilities and iPhone native handoff',()=>{
  const devices=fs.readFileSync('www/healthgo-devices.js','utf8');
  assert.match(devices,/navigator\.bluetooth\.requestDevice/);
  assert.match(devices,/optionalServices:\['battery_service','heart_rate','device_information'\]/);
  assert.match(devices,/return 'healthgo:\/\/'\+host/);
  assert.match(devices,/'connect-bluetooth'/);
  assert.match(devices,/startNotifications\(\)/);
  assert.match(devices,/heart_rate_measurement/);
  assert.match(devices,/battery_level/);
  assert.match(devices,/nie udostępnia standardowych usług BLE/i);
});

test('Android watch pairing is native BLE and uses the same Supabase backend',()=>{
  const manifest=fs.readFileSync('mobile/android/app/src/main/AndroidManifest.xml','utf8');
  const manager=fs.readFileSync('mobile/android/app/src/main/java/com/healthgo/mobile/BluetoothWatchManager.kt','utf8');
  const session=fs.readFileSync('mobile/android/app/src/main/java/com/healthgo/mobile/HealthGoSession.kt','utf8');
  const main=fs.readFileSync('mobile/android/app/src/main/java/com/healthgo/mobile/MainActivity.kt','utf8');
  const sync=fs.readFileSync('mobile/android/app/src/main/java/com/healthgo/mobile/HealthSync.kt','utf8');
  const gradle=fs.readFileSync('mobile/android/app/build.gradle.kts','utf8');

  assert.match(manifest,/android\.permission\.BLUETOOTH_SCAN/);
  assert.match(manifest,/android\.permission\.BLUETOOTH_CONNECT/);
  assert.match(manager,/BluetoothLeScanner|bluetoothLeScanner/);
  assert.match(manager,/HEART_RATE_SERVICE/);
  assert.match(manager,/BATTERY_SERVICE/);
  assert.match(main,/Połącz zegarek Bluetooth/);
  assert.match(session,/oqrfapmdcofguwdvhbeo\.supabase\.co/);
  assert.match(session,/healthgo_register_device/);
  assert.match(sync,/rest\/v1\/activity_daily/);
  assert.doesNotMatch(main,/FirebaseAuth/);
  assert.doesNotMatch(sync,/FirebaseFirestore|FirebaseAuth/);
  assert.doesNotMatch(gradle,/firebase-auth|firebase-firestore|google-services/);
});

test('iPhone watch pairing uses CoreBluetooth and registers the selected device',()=>{
  const manager=fs.readFileSync('mobile/ios/HealthGoMobile/BluetoothWatchManager.swift','utf8');
  const view=fs.readFileSync('mobile/ios/HealthGoMobile/ContentView.swift','utf8');
  const session=fs.readFileSync('mobile/ios/HealthGoMobile/HealthGoSession.swift','utf8');
  const plist=fs.readFileSync('mobile/ios/HealthGoMobile/Info.plist','utf8');

  assert.match(manager,/import CoreBluetooth/);
  assert.match(manager,/scanForPeripherals/);
  assert.match(manager,/CBUUID\(string:"180D"\)/);
  assert.match(manager,/CBUUID\(string:"180F"\)/);
  assert.match(view,/Szukaj zegarka/);
  assert.match(view,/bluetooth\.connect\(device\)/);
  assert.match(session,/func registerDevice/);
  assert.match(session,/healthgo_register_device/);
  assert.match(plist,/NSBluetoothAlwaysUsageDescription/);
});

test('mobile suite no longer replaces the original bottom navigation',()=>{
  const suite=fs.readFileSync('www/healthgo-mobile-suite.js','utf8');
  const html=fs.readFileSync('www/index.html','utf8');
  const start=suite.indexOf('function setupMobileNav');
  const end=suite.indexOf('function updateProfileIcon',start);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(suite.slice(start,end),/replaceChildren/);
  assert.match(html,/data-mobile-page="start"/);
  assert.match(html,/data-mobile-page="ai"/);
  assert.match(html,/data-mobile-page="map"/);
  assert.match(html,/data-mobile-page="plan"/);
  assert.match(html,/data-mobile-page="more"/);
});
