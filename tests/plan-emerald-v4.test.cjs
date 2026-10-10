'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

const html=fs.readFileSync('www/index.html','utf8');
const source=fs.readFileSync('www/healthgo-plan-v4.js','utf8');
const css=fs.readFileSync('www/healthgo-plan-emerald-v4.css','utf8');
const recurrence=html.slice(html.indexOf('function planOccursOnDate('),html.indexOf('function isPlanDoneOnDate('));
const dateFunction=html.slice(html.indexOf('function planDateObj('),html.indexOf('function healthGoPlanStorageKey('));

function fixture(){
 let items=[],id='plan-account';
 const store=new Map(),elements={};
 const document={
  getElementById(name){return elements[name]||null},
  addEventListener(){},
  visibilityState:'visible'
 };
 const window={
  setInterval(){return 1},setTimeout(){return 1},clearTimeout(){},
  HealthGoServices:{events:{addEventListener(){}}}
 };
 const context={document,window,console,localStorage:{
  getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)},removeItem(k){store.delete(k)}
 },hgUid(){return id},Date,Intl,URL,Blob,Math,Number,String,Set,JSON,
  loadHealthGoPlan(){return items.map(x=>({...x}))},
  saveHealthGoPlan(list){items=list.map(x=>({...x}))},
  renderPlanDay(){},renderTodayPlanPreview(){},
  currentPlanDate(){return '2026-10-10'}
 };
 vm.runInNewContext(dateFunction+recurrence,context);
 vm.runInNewContext(source,context);
 return {api:context.window.HealthGoPlanner,context,
  get items(){return items},
  set items(value){items=value},
  store,document,setId(value){id=value}};
}
test('Plan 4 shipped files, valid syntax, accessible month/week and responsive layouts',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.ok(html.includes('healthgo-plan-v4.js?v=2'));
 assert.ok(html.includes('healthgo-plan-emerald-v4.css?v=2'));
 for(const id of ['hgpWeekStrip','hgpMonthGrid','hgpStatCount','hgpStatProgress','hgpLiveStatus','hgpToggleReminders','hgpBackupImport','hgpCategoryFilter','hgpReminderToast','planReminderMinutes']){
  assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
 }
 assert.match(css,/body\.hg-emerald #plan/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/\[hidden\]\{display:none!important\}/);
 assert.doesNotMatch(source,/Math\.random.*\\b(calories|steps|heartRate)\\b/);
});

test('Additional recurring events honor original date and skipped dates',()=>{
 const f=fixture().context.planOccursOnDate;
 const task=(date,repeat,skipDates=[])=>({date,repeat,skipDates});
 assert.equal(f(task('2026-10-05','fortnight'),'2026-10-19'),true);
 assert.equal(f(task('2026-10-05','fortnight'),'2026-10-12'),false);
 assert.equal(f(task('2026-10-05','weekdays'),'2026-10-10'),false);
 assert.equal(f(task('2026-10-05','weekdays'),'2026-10-12'),true);
 assert.equal(f(task('2026-10-05','weekends'),'2026-10-11'),true);
 assert.equal(f(task('2026-10-05','monthly'),'2026-11-05'),true);
 assert.equal(f(task('2026-10-31','monthly'),'2026-11-30'),false);
 assert.equal(f(task('2026-10-05','daily',['2026-10-10']),'2026-10-10'),false);
 assert.equal(f(task('2026-10-05','daily',['2026-10-10']),'2026-10-11'),true);
});

test('Schedule conflicts use real end times and do not invent missing event duration',()=>{
 const {api}=fixture();
 const jobs=[
  {id:'one',time:'10:00',endTime:'11:00'},
  {id:'two',time:'10:45',endTime:'11:30'},
  {id:'three',time:'12:00',endTime:''}
 ];
 const c=api.clashes(jobs);
 assert.equal(c.pairs.length,1);
 assert.equal(c.ids.has('one'),true);assert.equal(c.ids.has('two'),true);
 assert.equal(c.ids.has('three'),false);
 assert.equal(api.clashes([{id:'x',time:'13:00'},{id:'y',time:'13:15'}]).pairs.length,0);
 assert.equal(api.clashes([{id:'x',time:'13:00'},{id:'y',time:'13:00'}]).pairs.length,1);
});

test('Portable calendar includes only actual events, recurrence and escaped user text',()=>{
 const {api}=fixture();
 const result=api.createICS([
  {id:'x-1',date:'2026-10-10',time:'10:15',endTime:'11:00',title:'Wizyta, test; zdrowie',note:'A\nB',place:'Park',repeat:'weekly'},
  {id:'x-2',date:'2026-10-11',time:'15:00',endTime:'',title:'Odpoczynek',repeat:'none'}
 ]);
 assert.match(result,/BEGIN:VCALENDAR/);
 assert.match(result,/DTSTART:20261010T101500/);
 assert.match(result,/DTEND:20261010T110000/);
 assert.match(result,/RRULE:FREQ=WEEKLY/);
 assert.match(result,/SUMMARY:Wizyta\\, test\\; zdrowie/);
 assert.match(result,/DESCRIPTION:A\\nB/);
 assert.match(result,/SUMMARY:Odpoczynek/);
 assert.doesNotMatch(result,/DURATION:PT30M/);
 assert.match(result,/END:VCALENDAR/);
});

test('Backup validation rejects bad time, missing name and changes untrusted values to safe defaults',()=>{
 const {api}=fixture();
 assert.equal(api.sanitizeImported({date:'2026-02-30',time:'09:00',title:'Invalid'}),null);
 assert.equal(api.sanitizeImported({date:'2026-10-10',time:'26:55',title:'Invalid'}),null);
 assert.equal(api.sanitizeImported({date:'2026-10-10',time:'09:00',title:'  '}),null);
 const saved=api.sanitizeImported({
  date:'2026-10-10',time:'09:00',endTime:'08:00',
  title:' A '.repeat(100),place:'B'.repeat(150),note:'C'.repeat(340),
  category:'dangerous',priority:'extreme',repeat:'daily',reminderMinutes:999,
  doneDates:['2026-10-11','not a date'],skipDates:['2026-10-12']
 });
 assert.ok(saved.id.startsWith('plan_'));
 assert.equal(saved.title.length,80);
 assert.equal(saved.endTime,'');
 assert.equal(saved.category,'other');
 assert.equal(saved.priority,'normal');
 assert.equal(saved.reminderMinutes,0);
 assert.deepEqual(Array.from(saved.doneDates),['2026-10-11']);
 assert.deepEqual(Array.from(saved.skipDates),['2026-10-12']);
});

test('Skipping one repeating occurrence preserves the series and can be reversed',()=>{
 const f=fixture(),api=f.api;
 f.items=[{id:'one',date:'2026-10-01',time:'09:00',title:'Szkoła',repeat:'daily',doneDates:['2026-10-09'],skipDates:[]}];
 assert.equal(api.skipOccurrence('one','2026-10-10'),true);
 assert.deepEqual(Array.from(f.items[0].skipDates),['2026-10-10']);
 assert.deepEqual(Array.from(f.items[0].doneDates),['2026-10-09']);
 assert.equal(f.context.planOccursOnDate(f.items[0],'2026-10-10'),false);
 assert.equal(f.context.planOccursOnDate(f.items[0],'2026-10-11'),true);
 assert.equal(api.restoreOccurrence('one','2026-10-10'),true);
 assert.deepEqual(Array.from(f.items[0].skipDates),[]);
});

test('JSON backup import appends isolated sanitized entries without removing existing tasks',async()=>{
 const f=fixture();
 f.items=[{id:'old',date:'2026-10-10',time:'08:00',title:'Stare zadanie',repeat:'none'}];
 const file={
  size:230,
  text:async()=>JSON.stringify({format:'HealthGoPlan',version:4,items:[
   {id:'untrusted',date:'2026-10-11',time:'18:00',title:'Nowe zadanie',category:'hobby',priority:'high'},
   {date:'not-a-date',time:'09:00',title:'Niepoprawny'}
  ]})
 };
 assert.equal(await f.api.importBackup({target:{files:[file],value:'backup.json'}}),true);
 assert.equal(f.items.length,2);
 assert.equal(f.items[0].id,'old');
 assert.equal(f.items[1].title,'Nowe zadanie');
 assert.notEqual(f.items[1].id,'untrusted');
 assert.equal(f.items[1].category,'hobby');
 f.setId('another-account');
 const isolated=()=>f.api.toggleReminders();
 assert.equal(f.api.skipOccurrence('old','2026-10-10'),false);
});
