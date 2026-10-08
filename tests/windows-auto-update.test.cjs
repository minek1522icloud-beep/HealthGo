'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createAutomaticUpdateChecks}=require('../desktop-update-scheduler.cjs');

function fakeClock(){
  let time=0;
  let tick=null;
  let intervalMs=null;
  let cleared=false;
  return{
    get now(){return time},
    advance(ms){time+=ms},
    get tick(){return tick},
    get intervalMs(){return intervalMs},
    get cleared(){return cleared},
    setIntervalFn(fn,ms){
      tick=fn;
      intervalMs=ms;
      return{unref(){}};
    },
    clearIntervalFn(){cleared=true;tick=null}
  };
}

test('Windows update checks run automatically on launch, periodically and after focus',async()=>{
  const clock=fakeClock();
  const reasons=[];
  const updates=createAutomaticUpdateChecks({
    check:async reason=>reasons.push(reason),
    now:()=>clock.now,
    setIntervalFn:clock.setIntervalFn,
    clearIntervalFn:clock.clearIntervalFn,
    intervalMs:600000,
    minGapMs:120000
  });

  updates.start();
  await Promise.resolve();
  assert.deepEqual(reasons,['startup']);
  assert.equal(clock.intervalMs,600000);

  clock.advance(30000);
  assert.equal(await updates.checkNow('focus'),false);
  assert.deepEqual(reasons,['startup']);

  clock.advance(120000);
  assert.equal(await updates.checkNow('focus'),true);
  assert.deepEqual(reasons,['startup','focus']);

  clock.advance(600000);
  clock.tick();
  await Promise.resolve();
  assert.deepEqual(reasons,['startup','focus','periodic']);
  updates.stop();
  assert.equal(clock.cleared,true);
});

test('update checks never overlap or interrupt download and installation',async()=>{
  const clock=fakeClock();
  let done;
  const pending=new Promise(resolve=>{done=resolve});
  let count=0,busy=false;
  const updates=createAutomaticUpdateChecks({
    check:async()=>{count++;await pending},
    isBusy:()=>busy,
    now:()=>clock.now,
    setIntervalFn:clock.setIntervalFn,
    clearIntervalFn:clock.clearIntervalFn,
    minGapMs:0
  });
  updates.start();
  assert.equal(count,1);
  clock.advance(180000);
  assert.equal(await updates.checkNow('focus'),false);
  assert.equal(count,1);
  done();
  await pending;
  await Promise.resolve();
  busy=true;
  assert.equal(await updates.checkNow('periodic'),false);
  assert.equal(count,1);
  busy=false;
  assert.equal(await updates.checkNow('periodic'),true);
  assert.equal(count,2);
  updates.stop();
});

test('failed network check is automatically retried at the next allowed interval',async()=>{
  const clock=fakeClock();
  let calls=0;
  const errors=[];
  const updates=createAutomaticUpdateChecks({
    check:async()=>{
      calls++;
      if(calls===1)throw Error('Network offline');
    },
    onError:(e,reason)=>errors.push([e.message,reason]),
    now:()=>clock.now,
    setIntervalFn:clock.setIntervalFn,
    clearIntervalFn:clock.clearIntervalFn,
    minGapMs:120000
  });
  updates.start();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls,1);
  assert.deepEqual(errors,[['Network offline','startup']]);
  clock.advance(60000);
  assert.equal(await updates.checkNow('focus'),false);
  clock.advance(180000);
  assert.equal(await updates.checkNow('focus'),true);
  assert.equal(calls,2);
  updates.stop();
});

test('scheduler start is idempotent and cleanup blocks further update checks',async()=>{
  const clock=fakeClock();
  const calls=[];
  const updates=createAutomaticUpdateChecks({
    check:async reason=>calls.push(reason),
    now:()=>clock.now,
    setIntervalFn:clock.setIntervalFn,
    clearIntervalFn:clock.clearIntervalFn
  });
  updates.start();
  updates.start();
  await Promise.resolve();
  assert.equal(calls.length,1);
  updates.stop();
  clock.advance(600000);
  assert.equal(await updates.checkNow('focus'),false);
  assert.equal(calls.length,1);
});

test('packaged Windows installer includes scheduler and auto-downloads/install releases',()=>{
  const main=fs.readFileSync('main.cjs','utf8');
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  const workflow=fs.readFileSync('.github/workflows/windows-release.yml','utf8');
  assert.ok(pkg.build.files.includes('desktop-update-scheduler.cjs'));
  assert.match(main,/createAutomaticUpdateChecks/);
  assert.match(main,/updateChecks\.start\(\)/);
  assert.match(main,/updateChecks\?\.checkNow\("focus"\)/);
  assert.match(main,/intervalMs:\s*10\s*\*\s*60\s*\*\s*1000/);
  assert.match(main,/autoUpdater\.autoDownload\s*=\s*true/);
  assert.match(main,/autoUpdater\.autoInstallOnAppQuit\s*=\s*true/);
  assert.match(main,/\.quitAndInstall\(/);
  assert.match(main,/app\.on\("before-quit"/);
  assert.match(workflow,/gh release create \$tag \$files/);
  assert.match(workflow,/dist\/latest\.yml/);
  assert.match(workflow,/dist\/\*\.blockmap/);
});
