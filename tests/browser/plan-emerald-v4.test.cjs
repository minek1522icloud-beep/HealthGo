'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
let server,browser,origin;
test.before(async()=>{
 const base=path.resolve('www');
 server=http.createServer((req,res)=>{
  const file=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return}
  try{
   const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webmanifest':'application/manifest+json'};
   res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
   res.end(fs.readFileSync(file));
  }catch(_){res.writeHead(404);res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve))});
async function openPlan(width,height){
 const page=await browser.newPage({viewport:{width,height},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',route=>route.abort());
 await page.goto(origin);
 await page.waitForFunction(()=>!!window.HealthGoServices&&!!window.HealthGoPlanner&&!!document.getElementById('hgpWeekStrip'));
 await page.evaluate(async()=>{
  await HealthGoServices.start({uid:'plan-iphone-fixture',email:'plan@example.invalid',providerData:[]});
  window.healthGoCurrentUid='plan-iphone-fixture';
  document.getElementById('authScreen')?.classList.remove('show');
  document.getElementById('splashScreen')?.classList.add('hide');
  document.querySelectorAll('.auth-hidden').forEach(el=>el.classList.remove('auth-hidden'));
  document.body.dataset.dark='1';
  go('plan');
  document.getElementById('planDate').value='2026-10-10';
  renderPlanDay();
 });
 return {page,errors};
}
for(const [width,height] of [[360,740],[390,844],[430,932],[1024,768]]){
 test('Plan 4 Emerald task creation, filtering and calendar fit '+width+'px',async()=>{
  const {page,errors}=await openPlan(width,height);
  await page.locator('#hgpWeekStrip .hgp-day-tile').first().waitFor();
  const baseline=await page.evaluate(()=>{
   const p=document.getElementById('plan');
   const card=p.querySelector('.plan-board');
   const style=getComputedStyle(card);
   const inputStyle=getComputedStyle(document.getElementById('planTitleInput'));
   return {
    documentWidth:document.documentElement.scrollWidth,
    viewport:document.documentElement.clientWidth,
    background:style.backgroundColor,inputBackground:inputStyle.backgroundColor,
    stats:document.querySelectorAll('#plan .hgp-overview .hgp-stat').length,
    visibleWeek:document.getElementById('hgpWeekStrip').offsetParent!==null,
    invisibleMonth:document.getElementById('hgpMonthGrid').hidden
   };
  });
  assert.ok(baseline.documentWidth<=baseline.viewport+1,'Planner overflow: '+JSON.stringify(baseline));
  assert.notEqual(baseline.background,'rgb(255, 255, 255)','White legacy board');
  assert.notEqual(baseline.inputBackground,'rgb(255, 255, 255)','White legacy form');
  assert.equal(baseline.stats,3);
  assert.equal(baseline.visibleWeek,true);
  assert.equal(baseline.invisibleMonth,true);

  await page.locator('#hgpTemplateLearning').click();
  assert.equal(await page.locator('#planTitleInput').inputValue(),'Nauka / praca domowa');
  assert.equal(await page.locator('#planList .plan-item').count(),0,'Templates must not add fake tasks');
  await page.locator('#planTime').fill('14:15');
  await page.locator('#planEndTime').fill('15:30');
  await page.locator('#planReminderMinutes').selectOption('15');
  await page.locator('#planRepeat').selectOption('monthly');
  await page.locator('#planSaveBtn').click();
  assert.equal(await page.locator('#planList .plan-item').count(),1);
  assert.match(await page.locator('#planList .plan-item').first().innerText(),/Nauka/);
  assert.match(await page.locator('#planList .plan-item').first().innerText(),/15 min/);
  assert.equal(await page.locator('#hgpStatCount').innerText(),'1');
  assert.equal(await page.locator('#hgpStatProgress').innerText(),'0%');

  await page.locator('#hgpMonthButton').click();
  assert.equal(await page.locator('#hgpMonthButton').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#hgpMonthGrid').isVisible(),true);
  assert.equal(await page.locator('#hgpWeekStrip').isVisible(),false);
  assert.ok(await page.locator('#hgpMonthGrid button').count()>=28);

  await page.locator('#hgpStatusFilter').selectOption('pending');
  assert.equal(await page.locator('#planList .plan-item').count(),1);
  await page.locator('#planList .plan-done-btn').click();
  assert.equal(await page.locator('#hgpStatProgress').innerText(),'100%');
  assert.equal(await page.locator('#planList .plan-item').count(),0,'Completed item should leave pending filter');
  await page.locator('#hgpStatusFilter').selectOption('all');
  assert.equal(await page.locator('#planList .plan-item').count(),1);
  await page.locator('#hgpCategoryFilter').selectOption('family');
  assert.equal(await page.locator('#planList .plan-item').count(),0);
  await page.locator('#hgpCategoryFilter').selectOption('all');

  const saved=await page.evaluate(()=>{
   const row=loadHealthGoPlan()[0];
   return {date:row?.date,reminder:row?.reminderMinutes,repeat:row?.repeat,done:row?.doneDates||[]}
  });
  assert.equal(saved.date,'2026-10-10');
  assert.equal(saved.reminder,15);
  assert.equal(saved.repeat,'monthly');
  assert.ok(saved.done.includes('2026-10-10'));
  assert.deepEqual(errors,[]);
  await page.close();
 });
}
test('Plan 4 repeated occurrence is skipped for one selected day only and can be restored',async()=>{
 const {page,errors}=await openPlan(390,844);
 await page.locator('#planTime').fill('08:15');
 await page.locator('#planTitleInput').fill('Powtarzający się plan');
 await page.locator('#planRepeat').selectOption('daily');
 await page.locator('#planSaveBtn').click();
 await page.locator('#planList button[aria-label="Pomiń to wystąpienie"]').click();
 assert.equal(await page.locator('#planList .plan-item').count(),0);
 assert.equal(await page.locator('#hgpSkipped .hgp-skipped-item').count(),1);
 const skipped=await page.evaluate(()=>loadHealthGoPlan()[0].skipDates.slice());
 assert.deepEqual(skipped,['2026-10-10']);
 await page.locator('#hgpSkipped button').click();
 assert.equal(await page.locator('#planList .plan-item').count(),1);
 await page.locator('#planDate').fill('2026-10-11');
 await page.locator('#planDate').dispatchEvent('change');
 assert.equal(await page.locator('#planList .plan-item').count(),1,'Daily repetition should remain on next day');
 assert.deepEqual(errors,[]);
 await page.close();
});
test('Plan 4 detects actual overlapping time slots and preserves user edits',async()=>{
 const {page,errors}=await openPlan(390,844);
 await page.locator('#planTime').fill('11:00');
 await page.locator('#planEndTime').fill('12:00');
 await page.locator('#planTitleInput').fill('Spotkanie');
 await page.locator('#planSaveBtn').click();
 await page.locator('#planTime').fill('11:30');
 await page.locator('#planEndTime').fill('12:45');
 await page.locator('#planTitleInput').fill('Wizyta');
 await page.locator('#planSaveBtn').click();
 assert.equal(await page.locator('#planList .plan-item.hgp-conflict').count(),2);
 assert.match(await page.locator('#hgpLiveStatus').innerText(),/nakładająca się para/);
 await page.locator('#planList .plan-item button[title="Edytuj"]').first().click();
 assert.equal(await page.locator('#planSaveBtn').innerText(),'Zapisz zmiany');
 await page.locator('#planTitleInput').fill('Poprawione spotkanie');
 await page.locator('#planSaveBtn').click();
 assert.match(await page.locator('#planList').innerText(),/Poprawione spotkanie/);
 assert.deepEqual(errors,[]);
 await page.close();
});
test('Plan 4 exports a real ICS calendar and imports safe JSON without deleting entries',async()=>{
 const {page,errors}=await openPlan(390,844);
 await page.locator('#planTime').fill('09:30');
 await page.locator('#planTitleInput').fill('Odwiedzić bibliotekę');
 await page.locator('#planPlace').fill('Biblioteka');
 await page.locator('#planSaveBtn').click();
 const promise=page.waitForEvent('download');
 await page.locator('#hgpCalendarExport').click();
 const downloaded=await promise;
 assert.ok(downloaded.suggestedFilename().endsWith('.ics'));
 await page.locator('#hgpBackupInput').setInputFiles({
  name:'copy.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({format:'HealthGoPlan',version:4,items:[
   {date:'2026-10-10',time:'15:00',title:'Kino',category:'rest',repeat:'none'},
   {date:'yesterday',time:'18:00',title:'Nieprawidłowe'}
  ]}))
 });
 await page.waitForFunction(()=>document.getElementById('hgpBackupStatus').textContent.includes('Dodano 1'));
 assert.equal(await page.locator('#planList .plan-item').count(),2);
 assert.deepEqual(errors,[]);
 await page.close();
});


for(const width of [360,390,430]){
 test('Bottom full monthly calendar is visible, responsive and selects a date at '+width+'px',async()=>{
  const {page,errors}=await openPlan(width,844);
  const bottom=page.locator('#hgpFullCalendarSection');
  assert.equal(await bottom.isVisible(),true,'Calendar hidden below day planner');
  await page.locator('#hgpFullCalendarGrid .hgp-fullcalendar-date').first().waitFor();
  const start=await page.evaluate(()=>({
   month:document.getElementById('hgpFullCalendarMonth').textContent,
   days:document.querySelectorAll('#hgpFullCalendarGrid button[data-date]').length,
   weekdays:document.querySelectorAll('#hgpFullCalendarSection .hgp-fullcalendar-weekdays span').length,
   lastInPlan:document.getElementById('plan').lastElementChild?.id,
   bottomBelowForm:document.getElementById('hgpFullCalendarSection').getBoundingClientRect().top>=
    document.querySelector('#plan .plan-shell').getBoundingClientRect().bottom-2,
   scrollWidth:document.documentElement.scrollWidth,
   clientWidth:document.documentElement.clientWidth
  }));
  assert.match(start.month,/październik 2026/i);
  assert.equal(start.days,35,'October 2026 should have five calendar rows');
  assert.equal(start.weekdays,7);
  assert.equal(start.bottomBelowForm,true,'Full calendar must be below plan, not next to form');
  assert.ok(start.scrollWidth<=start.clientWidth+1,'Bottom calendar creates horizontal overflow');
  await page.locator('#hgpFullCalendarNext').click();
  assert.match(await page.locator('#hgpFullCalendarMonth').innerText(),/listopad 2026/i);
  assert.equal(await page.locator('#planDate').inputValue(),'2026-10-10',
    'Browsing another month must not change selected day');
  await page.locator('#hgpFullCalendarPrevious').click();
  assert.match(await page.locator('#hgpFullCalendarMonth').innerText(),/październik 2026/i);
  await page.locator('#hgpFullCalendarGrid button[data-date="2026-10-12"]').click();
  assert.equal(await page.locator('#planDate').inputValue(),'2026-10-12');
  assert.match(await page.locator('#hgpFullCalendarSelectedDate').innerText(),/12 października 2026/i);
  assert.equal(await page.locator('#hgpFullCalendarGrid button[aria-pressed="true"]').count(),1);
  assert.deepEqual(errors,[]);
  await page.close();
 });
}

test('Bottom calendar shows real user entries and updates when another date is selected',async()=>{
 const {page,errors}=await openPlan(390,844);
 await page.locator('#planTime').fill('16:30');
 await page.locator('#planTitleInput').fill('Spacer z przyjaciółmi');
 await page.locator('#planSaveBtn').click();
 const onDay=page.locator('#hgpFullCalendarGrid button[data-date="2026-10-10"]');
 assert.ok(await onDay.locator('.hgp-fullcalendar-event-dots i').count()>=1,
  'Saved event should be represented by a dot');
 assert.match(await page.locator('#hgpFullCalendarAgenda').innerText(),/Spacer z przyjaciółmi/);
 await page.locator('#hgpFullCalendarGrid button[data-date="2026-10-11"]').click();
 assert.equal(await page.locator('#planDate').inputValue(),'2026-10-11');
 assert.match(await page.locator('#hgpFullCalendarAgenda').innerText(),/Brak wydarzeń/);
 await page.locator('#hgpFullCalendarGrid button[data-date="2026-10-10"]').click();
 assert.match(await page.locator('#hgpFullCalendarAgenda').innerText(),/Spacer z przyjaciółmi/);
 assert.equal(await page.locator('#planList .plan-item').count(),1);
 assert.deepEqual(errors,[]);
 await page.close();
});

test('Bottom calendar follows date picker changes and handles February 2028 leap day',async()=>{
 const {page,errors}=await openPlan(390,844);
 await page.locator('#planDate').fill('2028-02-29');
 await page.locator('#planDate').dispatchEvent('change');
 assert.match(await page.locator('#hgpFullCalendarMonth').innerText(),/luty 2028/i);
 assert.equal(await page.locator('#hgpFullCalendarGrid button[data-date="2028-02-29"]').count(),1);
 assert.equal(await page.locator('#hgpFullCalendarGrid button[data-date="2028-02-29"][aria-pressed="true"]').count(),1);
 await page.locator('#hgpFullCalendarJump').click();
 assert.equal(await page.locator('#planDate').inputValue(),'2028-02-29');
 assert.deepEqual(errors,[]);
 await page.close();
});
