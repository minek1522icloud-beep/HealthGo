'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../www/core/achievement-engine.js');

const NOW = '2026-10-04T12:00:00.000Z';
const initial = () => Engine.createState(null,NOW);
const event = (id,type,payload={},at=NOW) => ({id,type,payload,occurredAt:at});
const reduce = (state,id,type,payload={},at=NOW) => Engine.applyEvent(state,event(id,type,payload,at));
const health = (state,id,steps,day='2026-10-04',at=day+'T12:00:00.000Z',extra={}) =>
  reduce(state,id,'HEALTH_SYNCED',Object.assign({day,steps,source:'Apple Health',device:'iPhone',timestamp:at,syncId:id},extra),at);
const challenge = (state,id,at=NOW) => Engine.viewChallenges(state,at).find(c => c.id===id);
const awardXp = state => Object.values(state.rewards).reduce((sum,r)=>sum+r.xp,0);

test('catalog retains the original hundred distinct identities and corrects colliding level thresholds', () => {
  assert.equal(Engine.CATALOG.length,110);
  assert.equal(new Set(Engine.CATALOG.map(a=>a.id)).size,110);
  assert.equal(Engine.CATALOG.find(a=>a.id==='level_2').requirement.target,2);
  assert.equal(Engine.CATALOG.find(a=>a.id==='level_5').requirement.target,5);
  assert.equal(Engine.CATALOG.find(a=>a.id==='level_milestone_15').requirement.target,15);
  assert.equal(Engine.CATALOG.find(a=>a.id==='level_milestone_40').requirement.target,40);
  assert.ok(Object.isFrozen(Engine.CATALOG[0].requirement));
});

test('level boundaries use existing escalating thresholds', () => {
  assert.deepEqual(Engine.getLevel(399),{level:1,xp:399,needed:400,remaining:1,percent:99.75});
  assert.equal(Engine.getLevel(400).level,2);
  assert.equal(Engine.getLevel(400).xp,0);
  assert.equal(Engine.getLevel(811).remaining,1);
  assert.equal(Engine.getLevel(812).level,3);
  assert.equal(Engine.getLevel(812).needed,424);
});

test('ordinary total XP remains available after the old maximum level', () => {
  const level = Engine.getLevel(3000000);
  assert.equal(level.level,1000);
  assert.ok(level.xp>0);
  assert.equal(level.remaining,0);
  assert.throws(()=>Engine.getLevel(NaN),TypeError);
  assert.throws(()=>Engine.getLevel(Infinity),TypeError);
  assert.throws(()=>Engine.getLevel(-1),TypeError);
});

test('pure reducer does not modify the input or catalog', () => {
  const before=initial(),copy=JSON.stringify(before);
  const result=reduce(before,'profile','PROFILE_CONFIGURED',{accountType:'standard'});
  assert.equal(JSON.stringify(before),copy);
  assert.ok(result.state.achievements.health.earned);
  assert.equal(result.state.totalXp,awardXp(result.state));
  assert.equal(before.totalXp,0);
});

test('untrusted direct XP, reward, and achievement events are rejected', () => {
  for(const type of ['XP_GAINED','REWARD_GRANTED','ACHIEVEMENT_UNLOCKED','CHALLENGE_COMPLETED']) {
    assert.throws(()=>reduce(initial(),'bad',type,{xp:1000000}),TypeError);
  }
  const result=reduce(initial(),'profile','PROFILE_CONFIGURED',{accountType:'standard',xp:1000000});
  assert.ok(result.state.totalXp<1000);
});

test('replaying exactly the same event is a no-op', () => {
  const one=health(initial(),'sync-1',2000);
  const repeated=health(one.state,'sync-1',2000);
  assert.deepEqual(repeated.state,one.state);
  assert.deepEqual(repeated.events,[]);
});

test('a new event ID cannot repeat the same plan or daily reward', () => {
  const one=reduce(initial(),'plan-1','PLAN_CREATED',{planId:'item-1'});
  const two=reduce(one.state,'plan-retry','PLAN_CREATED',{planId:'item-1'});
  assert.equal(two.state.totalXp,one.state.totalXp);
  assert.equal(Object.keys(two.state.metrics.plans).length,1);
  assert.ok(two.state.rewards['plan:item-1']);
  const task=Engine.tasksForDay('2026-10-04')[0];
  const daily=reduce(two.state,'daily-1','DAILY_TASK_CONFIRMED',{day:'2026-10-04',taskId:task.id});
  const repeat=reduce(daily.state,'daily-new-id','DAILY_TASK_CONFIRMED',{day:'2026-10-04',taskId:task.id});
  assert.equal(repeat.state.totalXp,daily.state.totalXp);
  assert.equal(repeat.state.metrics.totalDailyTasks,1);
});

test('null health values remain absent and never become invented zero readings', () => {
  const result=health(initial(),'empty',null,'2026-10-04',NOW,{distanceKm:null,activeMinutes:null,heartRate:null,sleepMinutes:null});
  assert.equal(result.state.metrics.healthDays['2026-10-04'].steps,null);
  assert.equal(result.state.metrics.healthDays['2026-10-04'].heartRate,null);
  assert.equal(result.state.totalXp,0);
  assert.equal(challenge(result.state,'activity_sync').progress,0);
  assert.equal(Engine.personalBests(result.state).bestDay,null);
  assert.equal(Engine.personalBests(result.state).bestWeek,null);
});

test('a genuine zero is data but does not count as an active day', () => {
  const result=health(initial(),'zero',0);
  assert.equal(challenge(result.state,'activity_sync').status,'completed');
  assert.equal(challenge(result.state,'series_foundation_1').progress,0);
  assert.equal(result.state.metrics.activeDates.length,0);
  assert.equal(Engine.personalBests(result.state).bestDay.steps,0);
});

test('repeat sync replaces the daily aggregate and never sums overlapping devices', () => {
  let state=health(initial(),'sync-a',1000).state;
  const xp=state.totalXp;
  state=health(state,'sync-a-retry',1000).state;
  assert.equal(state.totalXp,xp);
  state=health(state,'sync-b',1200,'2026-10-04','2026-10-04T13:00:00.000Z',{source:'Health Connect',device:'Android'}).state;
  assert.equal(state.metrics.healthDays['2026-10-04'].steps,1200);
  assert.equal(challenge(state,'weekly_move:2026-09-28','2026-10-04T13:00:00.000Z').progress,1200);
  assert.equal(state.metrics.healthDays['2026-10-04'].device,'Android');
});

test('older source data cannot overwrite a newer reading', () => {
  const newer=health(initial(),'newer',1200,'2026-10-04','2026-10-04T13:00:00.000Z').state;
  const older=health(newer,'older',900,'2026-10-04',NOW).state;
  assert.equal(older.metrics.healthDays['2026-10-04'].steps,1200);
  assert.equal(older.updatedAt,'2026-10-04T13:00:00.000Z');
});

test('corrections lower active progress without revoking earned achievements or XP', () => {
  let state=health(initial(),'first',2000).state;
  const xp=state.totalXp;
  state=health(state,'corrected',500,'2026-10-04','2026-10-04T13:00:00.000Z').state;
  assert.equal(state.metrics.healthDays['2026-10-04'].steps,500);
  assert.ok(state.achievements.walking_start.earned);
  assert.equal(state.totalXp,xp);
  assert.equal(challenge(state,'daily_gentle_walk:2026-10-04','2026-10-04T13:00:00.000Z').status,'completed');
});

test('invalid health numbers, timestamps, and prototype identifiers are rejected atomically', () => {
  const empty=initial(),before=JSON.stringify(empty);
  for(const steps of ['100',-1,NaN,Infinity,1.2,250001]) assert.throws(()=>health(empty,'invalid',steps),TypeError);
  assert.throws(()=>health(empty,'bad-latency',10,'2026-10-04',NOW,{timestamp:'2026-10-05T12:00:00Z'}),TypeError);
  assert.throws(()=>reduce(empty,'bad-day','HEALTH_SYNCED',{day:'2026-02-30',steps:1,source:'Apple Health',device:'iPhone',timestamp:NOW,syncId:'bad-day'}),TypeError);
  assert.throws(()=>reduce(empty,'__proto__','PLAN_CREATED',{planId:'ok'}),TypeError);
  assert.throws(()=>reduce(empty,'bad-proto','PLAN_CREATED',{planId:'__proto__'}),TypeError);
  assert.equal(JSON.stringify(empty),before);
});

test('challenge windows use the configured timezone and daylight saving boundaries', () => {
  let state=reduce(initial(),'zone','PROFILE_CONFIGURED',{accountType:'standard',timeZone:'Europe/Warsaw'}).state;
  const daily=Engine.viewChallenges(state,NOW).find(c=>c.definitionId==='daily_gentle_walk');
  assert.equal(daily.startsAt,'2026-10-03T22:00:00.000Z');
  assert.equal(daily.endsAt,'2026-10-04T22:00:00.000Z');
  const dst=Engine.viewChallenges(state,'2026-10-25T12:00:00.000Z').find(c=>c.definitionId==='daily_gentle_walk');
  assert.equal(dst.startsAt,'2026-10-24T22:00:00.000Z');
  assert.equal(dst.endsAt,'2026-10-25T23:00:00.000Z');
});

test('weekly and monthly progress aggregate actual recorded days only', () => {
  let state=health(initial(),'oct-1',1000,'2026-10-01').state;
  state=health(state,'oct-4',1200).state;
  assert.equal(challenge(state,'weekly_move:2026-09-28').progress,2200);
  assert.equal(challenge(state,'monthly_regular:2026-10').progress,2);
  const next=Engine.viewChallenges(state,'2026-10-05T12:00:00.000Z');
  assert.equal(next.find(c=>c.id==='weekly_move:2026-10-05').progress,0);
  assert.equal(Engine.personalBests(state).bestWeek.steps,2200);
});

test('series stages unlock in order and establish a fresh baseline at each stage', () => {
  let state=health(initial(),'stage-1',1000).state;
  assert.equal(challenge(state,'series_foundation_1').status,'completed');
  assert.equal(challenge(state,'series_foundation_2').status,'active');
  assert.equal(challenge(state,'series_foundation_2').progress,0);
  assert.equal(challenge(state,'series_foundation_3').status,'locked');
  state=health(state,'stage-2',2500,'2026-10-04','2026-10-04T13:00:00.000Z').state;
  assert.equal(challenge(state,'series_foundation_2','2026-10-04T13:00:00.000Z').status,'completed');
  assert.equal(challenge(state,'series_foundation_3','2026-10-04T13:00:00.000Z').progress,0);
  for(const d of ['2026-10-06','2026-10-09','2026-10-12'])state=health(state,'active-'+d,500,d).state;
  assert.equal(challenge(state,'series_foundation_3','2026-10-12T12:00:00.000Z').status,'completed');
  assert.ok(state.achievements.series_foundation_cup.earned);
  assert.equal(Engine.personalBests(state).longestStreak,1);
});

test('child challenges have lower goals and no weight or rest penalties', () => {
  const state=reduce(initial(),'child','PROFILE_CONFIGURED',{accountType:'child'}).state;
  const views=Engine.viewChallenges(state,NOW);
  assert.equal(views.find(c=>c.definitionId==='daily_gentle_walk').target,1000);
  assert.equal(views.find(c=>c.definitionId==='monthly_regular').target,6);
  assert.ok(views.every(c=>!/(weight|BMI|calorie|fat|mass)/i.test(c.requirement&&c.requirement.type||'')));
  const oldXp=state.totalXp,rest=reduce(state,'rest-day','AI_USED',{},'2026-10-12T12:00:00.000Z').state;
  assert.ok(rest.totalXp>=oldXp);
});

test('legacy migration preserves XP, historical badges, and unknown acquisition dates', () => {
  const legacy={level:3,xp:50,totalXp:500,badges:['level_2','badge_77'],completed:['first_plan'],dailyHistory:{'2026-10-03':{taskIds:['relax'],completed:['relax'],countedPerfect:true}},perfectDayDates:['2026-10-03'],totalDailyTasks:1,bestDailyStreak:1};
  const state=Engine.migrateLegacy(legacy,NOW);
  assert.equal(state.totalXp,862);
  assert.ok(state.achievements.level_2.earned);
  assert.equal(state.achievements.level_2.earnedAt,null);
  assert.equal(state.rewards['achievement:level_2'].xp,0);
  assert.equal(state.challenges.first_plan.status,'completed');
  assert.equal(state.challenges.first_plan.completedAt,null);
  assert.equal(state.rewards['daily:2026-10-03:relax'].grantedAt,null);
  const historical=Engine.viewAchievements(state).find(a=>a.id==='badge_77');
  assert.ok(historical.earned&&historical.legacy);
  assert.equal(historical.earnedAt,null);
  assert.equal(state.achievements.level_milestone_15,undefined);
  assert.deepEqual(Engine.migrateLegacy(state,NOW),state);
});

test('full legacy root import retains plan and activity records without changing XP', () => {
  const state=Engine.migrateLegacy({progress:{totalXp:1234,level:2,xp:12,badges:['health']},profile:{configured:true,accountType:'child'},plan:[{id:'old-plan'}],manualActivities:[{id:'old-activity',seconds:120,createdAt:'2026-10-02T10:00:00Z'}]},NOW);
  assert.equal(state.totalXp,1234);
  assert.equal(state.metrics.accountType,'child');
  assert.ok(state.metrics.plans['old-plan']);
  assert.equal(state.metrics.manualActivities['old-activity'].seconds,120);
});

test('collection completion grants its cup and profile title exactly once', () => {
  let state=Engine.migrateLegacy({totalXp:1000,level:1,xp:0,badges:['health','planner','explorer','ai_first','active_first']},NOW);
  const first=reduce(state,'collection','AI_USED');
  state=first.state;
  assert.ok(state.achievements.collection_explorer_cup.earned);
  assert.ok(state.titles.includes('Odkrywca'));
  const xp=state.totalXp,next=reduce(state,'collection-retry','AI_USED');
  assert.equal(next.state.totalXp,xp);
  assert.equal(next.state.titles.filter(t=>t==='Odkrywca').length,1);
});

test('secret requirements remain hidden before earning', () => {
  const item=Engine.viewAchievements(initial()).find(a=>a.id==='secret_rest');
  assert.equal(item.name,'Sekretne osiągnięcie');
  assert.equal(item.requirement,null);
  assert.equal(item.requirementHidden,true);
});

test('season completion unlocks a real cosmetic and is idempotent', () => {
  let state=initial();
  for(let i=1;i<=12;i++){const date='2026-10-'+String(i).padStart(2,'0');state=health(state,'season-'+i,500,date).state;}
  assert.ok(state.achievements.season_autumn_2026.earned);
  assert.ok(state.cosmetics.some(c=>c.id==='autumn_frame_2026'&&c.type==='frame'));
  const xp=state.totalXp,next=health(state,'season-retry',500,'2026-10-12').state;
  assert.equal(next.totalXp,xp);
  assert.equal(next.cosmetics.length,state.cosmetics.length);
});

test('empty state produces truthful empty records and no fabricated personal best', () => {
  const state=initial();
  assert.equal(Engine.viewAchievements(state).filter(a=>a.earned).length,0);
  assert.ok(Engine.viewChallenges(state,NOW).every(c=>c.progress===0));
  assert.deepEqual(Engine.personalBests(state),{bestDay:null,bestWeek:null,longestStreak:0,bestChallengeMonth:null});
});

test('health deletion removes source data and pending progress while preserving earned rewards', () => {
  const original=health(initial(),'before-delete',2000).state;
  const cleared=Engine.clearHealthData(original);
  assert.deepEqual(cleared.metrics.healthDays,{});
  assert.deepEqual(cleared.metrics.manualActivities,{});
  assert.deepEqual(cleared.metrics.activeDates,[]);
  assert.equal(cleared.totalXp,original.totalXp);
  assert.deepEqual(cleared.rewards,original.rewards);
  assert.ok(cleared.achievements.walking_start.earned);
  assert.ok(cleared.history.every(e=>e.type!=='STEPS_UPDATED'));
  assert.equal(challenge(cleared,'weekly_move:2026-09-28').progress,0);
  assert.equal(Engine.personalBests(cleared).bestDay,null);
  assert.ok(Object.keys(original.metrics.healthDays).length===1);
});

test('plan rewards use a daily XP budget without erasing the real plan history',()=>{
 let state=initial();
 for(let i=0;i<100;i++)state=reduce(state,'budget-'+i,'PLAN_CREATED',{planId:'item-'+i}).state;
 assert.equal(Object.values(state.rewards).filter(r=>r.source==='plan').reduce((n,r)=>n+r.xp,0),100);
 assert.equal(Object.keys(state.metrics.plans).length,100);
 assert.ok(state.history.length<=120);
 const xp=state.totalXp;
 state=reduce(state,'repeat-budget','PLAN_CREATED',{planId:'item-99'}).state;
 assert.equal(state.totalXp,xp);
});
