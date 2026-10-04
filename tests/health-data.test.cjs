'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../www/core/health-data.js');
test('missing metrics stay missing; genuine zero is retained',()=>{
 const d=D.normalize({steps:null,distanceKm:'',activeMinutes:0,heartRate:undefined,sleepMinutes:'420'});
 assert.equal(d.steps,null);assert.equal(d.distanceKm,null);assert.equal(d.activeMinutes,0);assert.equal(d.heartRate,null);assert.equal(d.sleepMinutes,null);assert.deepEqual(d.available,['activeMinutes']);
});
test('rejects negative, nonfinite and nonnumeric metrics',()=>{
 assert.equal(D.normalize({steps:-1}).steps,null);assert.equal(D.number(Infinity),null);assert.equal(D.number(NaN),null);assert.equal(D.number('5000'),null);
});
test('native and cached Firestore timestamps retain the same instant',()=>{
 const ms=1791097800250;
 assert.equal(D.timestamp({seconds:Math.floor(ms/1000),nanoseconds:250000000}),ms);
 assert.equal(D.timestamp({toMillis:()=>ms}),ms);assert.equal(D.timestamp(new Date(ms).toISOString()),ms);
 assert.equal(D.timestamp('bad'),null);
});
test('location age and offline state never imply live stale data',()=>{
 const now=1791097800000,settings={enabled:true,mode:'approximate'};
 assert.equal(D.locationStatus({timestamp:now-120000},settings,true,now),'RECENT');
 assert.equal(D.locationStatus({timestamp:now-1000000},settings,true,now),'STALE');
 assert.equal(D.locationStatus({timestamp:now},settings,false,now),'OFFLINE');
 assert.equal(D.locationStatus(null,settings,true,now),'NO_DATA');
 assert.equal(D.locationStatus({timestamp:now},{enabled:false},true,now),'DISABLED');
});
test('approximate location loses precision before transmission',()=>{
 const input={latitude:50.812345,longitude:19.123456,accuracyMeters:4};
 const coarse=D.coarsenLocation(input);assert.notEqual(coarse.latitude,input.latitude);assert.notEqual(coarse.longitude,input.longitude);assert.equal(coarse.mode,'approximate');assert.ok(coarse.accuracyMeters>=1500);assert.throws(()=>D.coarsenLocation({latitude:95,longitude:1}));
});

test('backend location settings show real foreground sharing without legacy enabled flag',()=>{
 assert.equal(D.locationStatus({timestamp:Date.now()},{mode:'approximate',familySharing:true},true),'LIVE');
 assert.equal(D.locationStatus(null,{mode:'off',familySharing:false},true),'DISABLED');
});
