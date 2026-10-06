(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HealthGoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // This reducer only accepts events verified by the authenticated backend.
  // Local storage and platform provenance are never authorization evidence.
  var VERSION = 2;
  var RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  var DAILY_TASKS = [
    {id:'plan_focus',icon:'📅',name:'Uporządkuj Plan Dnia',description:'Dodaj lub popraw jeden punkt swojego planu.',xpReward:35},
    {id:'screen_break',icon:'🌿',name:'Przerwa od ekranu',description:'Zrób spokojną przerwę, kiedy jej potrzebujesz.',xpReward:20},
    {id:'easy_move',icon:'🚶',name:'Trochę ruchu',description:'Wybierz lekką aktywność odpowiednią dla Ciebie.',xpReward:25},
    {id:'log_activity',icon:'⏱️',name:'Zapisz aktywność',description:'Zapisz rzeczywisty czas aktywności.',xpReward:30},
    {id:'ai_plan',icon:'🤖',name:'Zapytaj HealthGo AI',description:'Porozmawiaj o organizacji dnia lub swoim planie.',xpReward:25},
    {id:'prepare_tomorrow',icon:'🎒',name:'Przygotuj jedną rzecz na jutro',description:'Przygotuj coś, co ułatwi Ci jutrzejszy dzień.',xpReward:20},
    {id:'tidy_space',icon:'🧹',name:'Uporządkuj swoje miejsce',description:'Zajmij się małym fragmentem swojej przestrzeni.',xpReward:20},
    {id:'relax',icon:'🎧',name:'Chwila odpoczynku',description:'Zrób coś spokojnego, co pomaga Ci odpocząć.',xpReward:20},
    {id:'review_goals',icon:'🎯',name:'Sprawdź cele',description:'Sprawdź, czy Twoje cele nadal Ci odpowiadają.',xpReward:15},
    {id:'plan_finish',icon:'✅',name:'Dokończ punkt planu',description:'Oznacz wykonany punkt w swoim planie.',xpReward:30},
    {id:'stretch_easy',icon:'🧘',name:'Spokojne rozruszanie',description:'Jeśli masz ochotę, wybierz krótki, łagodny ruch.',xpReward:20},
    {id:'learn_small',icon:'📚',name:'Mały krok w nauce',description:'Poświęć chwilę nauce lub hobby.',xpReward:25}
  ];
  var UNITS = {xp:'XP',level:'poziom',dailyTasks:'zadań',streak:'dni',perfectDays:'dni',plans:'punktów planu',activities:'aktywności',activityMinutes:'min',challenges:'wyzwań',steps:'kroków',activeMinutes:'min',activeDays:'aktywnych dni',healthDays:'dni z danymi',familyChallenges:'wspólnych wyzwań',badgeCount:'osiągnięć'};
  var SOURCE = {xp:'Historia nagród HealthGo',level:'Łączne XP HealthGo',dailyTasks:'Potwierdzenia użytkownika',streak:'Historia potwierdzonych zadań',perfectDays:'Historia potwierdzonych zadań',plans:'Twój Plan Dnia',activities:'Ręcznie zapisane aktywności',activityMinutes:'Ręcznie zapisany czas',challenges:'Historia ukończonych wyzwań',steps:'Dzienny odczyt Apple Health / Health Connect',activeMinutes:'Dzienny odczyt Apple Health / Health Connect',activeDays:'Dane urządzenia lub jawnie zapisane aktywności',healthDays:'Historia synchronizacji urządzenia',configured:'Konfiguracja konta HealthGo',familyChallenges:'Potwierdzone wspólne wyzwania rodziny',collection:'Plecak HealthGo',badgeCount:'Plecak HealthGo',challengeId:'Historia ukończonych wyzwań',combo:'Historia HealthGo'};
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function number(value, max) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && (max === undefined || value <= max) ? value : null; }
  function timestamp(value) {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !day(value.slice(0,10))) return null;
    var ms = Date.parse(value);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  function timeArg(arg) { return timestamp(arg && typeof arg === 'object' && !(arg instanceof Date) ? arg.now : arg) || new Date().toISOString(); }
  function validateTimeZone(value) {
    if(typeof value!=='string'||value.length>100)throw new TypeError('Invalid time zone');
    try { new Intl.DateTimeFormat('en',{timeZone:value}).format(new Date(0)); } catch (_) { throw new TypeError('Invalid time zone'); }
    return value;
  }
  function localDay(iso,zone) {
    var parts=new Intl.DateTimeFormat('en',{timeZone:zone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso)), values={};
    parts.forEach(function(p){values[p.type]=p.value;});
    return values.year+'-'+values.month+'-'+values.day;
  }
  function midnight(date,zone) {
    var expected=Date.parse(date+'T00:00:00Z'), guess=expected;
    for(var i=0;i<3;i++) {
      var parts=new Intl.DateTimeFormat('en',{timeZone:zone||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)), values={};
      parts.forEach(function(p){values[p.type]=p.value;});
      var represented=Date.parse(values.year+'-'+values.month+'-'+values.day+'T'+values.hour+':'+values.minute+':'+values.second+'Z');
      var adjustment=expected-represented;guess+=adjustment;if(adjustment===0)break;
    }
    return new Date(guess).toISOString();
  }
  function day(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    var ms = Date.parse(value + 'T12:00:00Z');
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? value : null;
  }
  function identifier(value, label) {
    if (typeof value !== 'string' || ['__proto__','constructor','prototype'].indexOf(value)>=0 || !/^[a-zA-Z0-9_.:@-]{1,200}$/.test(value)) throw new TypeError('Invalid ' + label);
    return value;
  }
  function safeText(value, label, length) {
    if (typeof value !== 'string' || !value.trim() || value.length > length) throw new TypeError('Invalid ' + label);
    return value.trim();
  }
  function plain(value) { return value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
  function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).filter(function (x) { return typeof x === 'string' && ['__proto__','constructor','prototype'].indexOf(x)<0 && /^[a-zA-Z0-9_.:@-]{1,200}$/.test(x); }))); }
  function xpNeeded(level) { return 400 + Math.min(1600, Math.floor((level - 1) * 12)); }
  function getLevel(totalXp) {
    if (number(totalXp, Number.MAX_SAFE_INTEGER) === null) throw new TypeError('Invalid XP');
    var level = 1, xp = totalXp;
    while (level < 1000 && xp >= xpNeeded(level)) { xp -= xpNeeded(level); level++; }
    var needed = level === 1000 ? 0 : xpNeeded(level);
    return {level:level,xp:xp,needed:needed,remaining:Math.max(0,needed-xp),percent:needed ? Math.min(100,xp/needed*100) : 100};
  }
  function legacyTotal(progress) {
    var total = number(progress.totalXp, Number.MAX_SAFE_INTEGER) || 0;
    var level = number(progress.level, 1000), xp = number(progress.xp, Number.MAX_SAFE_INTEGER) || 0;
    if (level !== null && Number.isInteger(level) && level > 0) {
      for (var i = 1; i < level; i++) xp += xpNeeded(i);
      total = Math.max(total, xp);
    }
    return Math.min(Number.MAX_SAFE_INTEGER, total);
  }
  function requirementText(req) {
    if (req.type === 'configured') return 'Skonfiguruj profil HealthGo.';
    if (req.type === 'challengeId') return 'Ukończ powiązane wyzwanie HealthGo.';
    if (req.type === 'collection') return 'Zdobądź wszystkie ' + req.target.length + ' osiągnięć kolekcji.';
    if (req.type === 'combo') return Object.keys(req.target).map(function (key) { return req.target[key] + ' ' + (UNITS[key] || key); }).join(' · ');
    return 'Osiągnij ' + req.target + ' ' + (UNITS[req.type] || 'potwierdzonych działań') + '.';
  }
  function badge(id, icon, name, type, target, category) {
    return {id:id,icon:icon,name:name,description:requirementText({type:type,target:target}),category:category||'badges',rarity:'common',requirement:{type:type,target:target},xpReward:20,source:SOURCE[type] || 'Historia HealthGo'};
  }
  function group(prefix, icon, names, type, targets) {
    return names.map(function (name, i) {
      var id = prefix + '_' + (i + 1);
      if (prefix === 'level' && (id === 'level_2' || id === 'level_5')) id = 'level_milestone_' + targets[i];
      return badge(id, icon, name, type, targets[i]);
    });
  }
  var STARTER = [
    badge('health','❤️','Witaj w HealthGo','configured',1),
    badge('planner','📅','Pierwszy plan','plans',1),
    badge('explorer','🗺️','Odkrywca','challengeId','map_explorer'),
    badge('ai_first','🤖','Pierwsza rozmowa','challengeId','ai_first'),
    badge('active_first','🏃','Aktywny start','activities',3),
    badge('xp_first','✨','Pierwsze XP','xp',100),
    badge('daily_first','☀️','Regularny początek','dailyTasks',5),
    badge('perfect_first','🌟','Trzy pełne dni','perfectDays',3),
    badge('level_2','2️⃣','Poziom 2','level',2),
    badge('level_5','5️⃣','Poziom 5','level',5)
  ];
  var CATALOG = [].concat(STARTER,
    group('xp','⚡',['Iskra XP','250 XP','500 XP','1K XP','2K XP','3,5K XP','5K XP','7,5K XP','10K XP','25K XP'],'xp',[100,250,500,1000,2000,3500,5000,7500,10000,25000]),
    group('level','🏅',['Poziom 10','Poziom 15','Poziom 20','Poziom 30','Poziom 40','Poziom 50','Poziom 75','Poziom 100','Poziom 250','Poziom 500'],'level',[10,15,20,30,40,50,75,100,250,500]),
    group('daily','✅',['10 zadań','20 zadań','35 zadań','50 zadań','75 zadań','100 zadań','150 zadań','200 zadań','300 zadań','500 zadań'],'dailyTasks',[10,20,35,50,75,100,150,200,300,500]),
    group('streak','🔥',['Seria 2','Seria 3','Seria 5','Tydzień serii','Seria 10','Dwa tygodnie','Seria 21','Miesiąc serii','Seria 60','Seria 100'],'streak',[2,3,5,7,10,14,21,30,60,100]),
    group('perfect','🌞',['1 pełny dzień','3 pełne dni','5 pełnych dni','10 pełnych dni','20 pełnych dni','30 pełnych dni','50 pełnych dni','75 pełnych dni','100 pełnych dni','200 pełnych dni'],'perfectDays',[1,3,5,10,20,30,50,75,100,200]),
    group('plan','🗓️',['Plan 1','Plan 3','Plan 5','Plan 10','Plan 20','Plan 30','Plan 50','Plan 75','Plan 100','Plan 200'],'plans',[1,3,5,10,20,30,50,75,100,200]),
    group('activity','🏃',['Sesja 1','Sesje 2','Sesje 5','Sesje 10','Sesje 20','Sesje 30','Sesje 50','Sesje 75','Sesje 100','Sesje 200'],'activities',[1,2,5,10,20,30,50,75,100,200]),
    group('minutes','⏱️',['1 minuta','5 minut','10 minut','20 minut','30 minut','60 minut','120 minut','300 minut','600 minut','1200 minut'],'activityMinutes',[1,5,10,20,30,60,120,300,600,1200]),
    [
      badge('master_challenges_1','🎯','Wyzwania I','challenges',1),
      badge('master_challenges_2','🎯','Wyzwania II','challenges',2),
      badge('master_challenges_3','🎯','Wyzwania III','challenges',3),
      badge('master_challenges_4','🎯','Komplet wyzwań','challenges',4),
      badge('master_combo_1','💎','Wszechstronny I','combo',{level:10,dailyTasks:10,plans:5,activities:2}),
      badge('master_combo_2','💠','Wszechstronny II','combo',{level:25,dailyTasks:30,plans:20,activities:10}),
      badge('master_combo_3','👑','Wszechstronny III','combo',{level:50,dailyTasks:75,plans:50,activities:30}),
      badge('master_daily','🏆','Mistrz regularności','combo',{perfectDays:30,streak:14}),
      badge('master_pack','🎒','Kolekcjoner HealthGoPack','badgeCount',75),
      badge('maxxp','🏆','MAX XP','level',1000)
    ]).map(function (item, i) {
      item.model = 'HG-' + String(i + 1).padStart(3,'0');
      item.rarity = i < 30 ? 'common' : i < 60 ? 'rare' : i < 85 ? 'epic' : i < 95 ? 'legendary' : 'mythic';
      item.xpReward = [20,35,50,75,100][RARITIES.indexOf(item.rarity)];
      return item;
    });
  var COLLECTIONS = [{id:'explorer',name:'Odkrywca',achievementIds:['health','planner','explorer','ai_first','active_first'],rewardId:'collection_explorer_cup'}];
  CATALOG = CATALOG.concat([
    badge('health_sync_first','⌚','Pierwsze dane urządzenia','healthDays',1,'sports'),
    badge('walking_start','🚶','Spokojny spacer','steps',1500,'sports'),
    badge('moving_regular','🌱','Ruch w swoim tempie','activeDays',3,'sports'),
    badge('collection_explorer_cup','🏆','Puchar Odkrywcy','collection',COLLECTIONS[0].achievementIds,'cups'),
    badge('series_foundation_cup','🏆','Puchar dobrego początku','challengeId','series_foundation_3','cups'),
    badge('gentle_regular','✨','Regularny','activeDays',7,'special'),
    badge('season_autumn_2026','🍂','Jesień w swoim tempie','challengeId','season_autumn_2026','limited'),
    badge('secret_rest','🌙','Chwila dla siebie','challengeId','secret_rest','secret'),
    badge('family_first','🏡','Pierwsze rodzinne wyzwanie','familyChallenges',1,'family'),
    badge('family_seven','🤝','Wspólny rytm','familyChallenges',7,'family')
  ]);
  CATALOG.forEach(function (item) {
    if (item.category === 'cups') { item.rarity='legendary'; item.xpReward=100; }
    if (item.id==='collection_explorer_cup') { item.title='Odkrywca'; item.collectionId='explorer'; }
    if (item.id==='gentle_regular') item.title='Regularny';
    if (item.id==='master_challenges_4') item.title='Mistrz Wyzwań';
    if (item.id==='maxxp') item.title='Weteran HealthGo';
    if (item.category==='limited') { item.rarity='epic'; item.cosmetic={id:'autumn_frame_2026',type:'frame',name:'Jesienna ramka'}; }
    if (item.category==='secret') { item.secret=true; item.rarity='rare'; }
  });
  var SEASONS = [{id:'autumn_2026',name:'Jesień w swoim tempie',theme:'autumn',startsAt:'2026-09-01T00:00:00.000Z',endsAt:'2026-12-01T00:00:00.000Z',description:'Łagodna aktywność i czas na odpoczynek. Bez płatnego pasa i bez kar za przerwę.'}];
  function challenge(id,name,description,icon,category,period,metric,target,xp,reward) {
    return {id:id,name:name,description:description,icon:icon,category:category,period:period,requirement:{type:metric,target:target},xpReward:xp,additionalReward:reward||null,source:SOURCE[metric] || 'Historia HealthGo'};
  }
  var CHALLENGES = [
    challenge('first_plan','Zaplanuj dzień','Dodaj pierwszy rzeczywisty punkt planu.','📅','special','once','plans',1,60,'planner'),
    challenge('map_explorer','Poznaj okolicę','Wyszukaj prawdziwe miejsce na mapie HealthGo.','🗺️','special','once','mapExplored',1,80,'explorer'),
    challenge('ai_first','Skorzystaj z HealthGo AI','Otrzymaj odpowiedź działającego HealthGo AI.','🤖','special','once','aiUsed',1,50,'ai_first'),
    challenge('activity_sync','Pierwsza synchronizacja aktywności','Odczytaj dostępne dane urządzenia.','⌚','special','once','healthDays',1,100,'health_sync_first'),
    challenge('daily_gentle_walk','Spokojny spacer','Dobrowolny cel na dziś. Odpoczynek nie odbiera nagród.','🚶','daily','daily','steps',1500,60,null),
    challenge('weekly_move','Ruch w swoim tempie','Zbieraj spokojną aktywność w ciągu tygodnia.','🌿','weekly','weekly','steps',7500,150,null),
    challenge('monthly_regular','Regularność bez pośpiechu','Wybierz osiem dni na trochę aktywności. Dni nie muszą następować po sobie.','🗓️','monthly','monthly','activeDays',8,250,'gentle_regular'),
    challenge('sport_easy_minutes','Kilka minut ruchu','Zbieraj minuty aktywności w tym tygodniu.','⏱️','sports','weekly','activeMinutes',15,100,null),
    challenge('series_foundation_1','Dobry początek · pierwsza aktywność','Zapisz lub zsynchronizuj pierwszy aktywny dzień.','🌱','series','once','activeDays',1,40,null),
    challenge('series_foundation_2','Dobry początek · spokojny spacer','Po pierwszym etapie zbierz kolejny łagodny próg kroków.','🚶','series','once','steps',1500,70,null),
    challenge('series_foundation_3','Dobry początek · własny rytm','Po drugim etapie wybierz trzy kolejne aktywne dni. Mogą być rozdzielone odpoczynkiem.','🏆','series','once','activeDays',3,120,'series_foundation_cup'),
    challenge('season_autumn_2026','Jesień w swoim tempie','Zbieraj aktywne dni w sezonie, bez obowiązku codziennego wysiłku.','🍂','seasonal','season','activeDays',12,300,'season_autumn_2026')
  ];
  CHALLENGES.forEach(function (item) {
    if (item.category==='series') { item.seriesId='foundation'; item.stage=Number(item.id.slice(-1)); }
    if (item.period==='season') item.seasonId='autumn_2026';
    if (item.id==='monthly_regular') item.childTarget=6;
    if (item.id==='daily_gentle_walk') item.childTarget=1000;
    if (item.id==='weekly_move') item.childTarget=5000;
    if (item.id==='sport_easy_minutes') item.childTarget=10;
    if (item.id==='series_foundation_2') item.childTarget=1000;
    if (item.id==='season_autumn_2026') item.childTarget=8;
  });
  CATALOG.forEach(function(item){item.emoji=item.icon;item.desc=item.description;});
  CHALLENGES.forEach(function(item){item.title=item.name;item.desc=item.description;item.xp=item.xpReward;item.badge=item.additionalReward;});
  DAILY_TASKS.forEach(function(item){item.title=item.name;item.desc=item.description;item.xp=item.xpReward;});
  var VALID_EVENTS = ['PROFILE_CONFIGURED','PLAN_CREATED','PLAN_COMPLETED','AI_USED','MAP_EXPLORED','ACTIVITY_RECORDED','DAILY_TASK_CONFIRMED','HEALTH_SYNCED','FAMILY_CHALLENGE_COMPLETED'];
  function blank(now) {
    return {schemaVersion:VERSION,totalXp:0,createdAt:now,updatedAt:now,achievements:{},challenges:{},rewards:{},history:[],processedEvents:{},metrics:{timeZone:'UTC',accountType:'standard',configured:false,plans:{},planCompletions:{},manualActivities:{},healthDays:{},activeDates:[],dailyHistory:{},perfectDayDates:[],totalDailyTasks:0,dailyStreak:0,bestDailyStreak:0,aiUsed:0,mapExplored:0,familyChallenges:{},legacyCounts:{plans:0,activities:0,activityMinutes:0}},titles:[],cosmetics:[],selectedTitle:null,migration:{version:VERSION,imported:false}};
  }
  function tasksForDay(date, count) {
    if (!day(date)) throw new TypeError('Invalid day');
    var seed=0,pool=DAILY_TASKS.slice(),out=[],wanted=Math.max(3,Math.min(5,Number.isInteger(count)?count:3));
    for(var i=0;i<date.length;i++) seed=(seed*31+date.charCodeAt(i))>>>0;
    while(out.length<wanted) {seed=(Math.imul(seed,1664525)+1013904223)>>>0;var index=seed%pool.length;out.push(pool.splice(index,1)[0]);}
    return out.map(function (task) { return clone(task); });
  }
  function streak(dates, reference) {
    var sorted=unique(dates).filter(function (x) { return !!day(x); }).sort(),best=0,run=0,prev=null;
    sorted.forEach(function (d) {var gap=prev?(Date.parse(d+'T12:00:00Z')-Date.parse(prev+'T12:00:00Z'))/86400000:0;run=prev&&gap===1?run+1:1;best=Math.max(best,run);prev=d;});
    var current=0,last=sorted[sorted.length-1],ref=day(reference);
    if(last&&ref) {var delta=(Date.parse(ref+'T12:00:00Z')-Date.parse(last+'T12:00:00Z'))/86400000;if(delta===0||delta===1){current=1;for(var i=sorted.length-1;i>0&&Date.parse(sorted[i]+'T12:00:00Z')-Date.parse(sorted[i-1]+'T12:00:00Z')===86400000;i--)current++;}}
    return {current:current,best:best};
  }
  function migrateLegacy(legacy, nowArg) {
    var now=timeArg(nowArg);
    if (legacy && legacy.schemaVersion===VERSION) return clone(legacy);
    var root=plain(legacy)?legacy:{},p=plain(root.progress)?root.progress:root,state=blank(now);
    state.totalXp=legacyTotal(p);
    state.migration={version:VERSION,imported:!!legacy,importedAt:legacy?now:null};
    state.createdAt=timestamp(root.createdAt)||timestamp(root.profile&&root.profile.createdAt)||null;
    if(root.profile) {state.metrics.configured=!!root.profile.configured;state.metrics.accountType=root.profile.accountType==='child'?'child':root.profile.accountType==='guardian'?'guardian':'standard';}
    var ids=unique(p.badges);
    ids.forEach(function(id) {state.achievements[id]={earned:true,earnedAt:null,progress:null,eventId:null,origin:'legacy'};state.rewards['achievement:'+id]={rewardId:'achievement:'+id,eventId:null,grantedAt:null,xp:0,achievementId:id,origin:'legacy'};});
    unique(p.completed).forEach(function(id) {state.challenges[id]={id:id,definitionId:id,status:'completed',completedAt:null,progress:1,target:1,origin:'legacy'};state.rewards['challenge:'+id]={rewardId:'challenge:'+id,eventId:null,grantedAt:null,xp:0,challengeId:id,origin:'legacy'};});
    state.metrics.dailyHistory=plain(p.dailyHistory)?clone(p.dailyHistory):{};
    Object.keys(state.metrics.dailyHistory).forEach(function(date) {if(!day(date)||!plain(state.metrics.dailyHistory[date])) {delete state.metrics.dailyHistory[date];return;}var record=state.metrics.dailyHistory[date];record.taskIds=unique(record.taskIds);record.completed=unique(record.completed);record.completed.forEach(function(id) {state.rewards['daily:'+date+':'+id]={rewardId:'daily:'+date+':'+id,eventId:null,grantedAt:null,xp:0,origin:'legacy'};});});
    state.metrics.perfectDayDates=unique(p.perfectDayDates).filter(function(x){return !!day(x);});
    state.metrics.totalDailyTasks=Math.max(number(p.totalDailyTasks)||0,Object.values(state.metrics.dailyHistory).reduce(function(sum,x){return sum+x.completed.length;},0));
    var calculated=streak(state.metrics.perfectDayDates,now.slice(0,10));
    state.metrics.dailyStreak=calculated.current;state.metrics.bestDailyStreak=Math.max(calculated.best,number(p.bestDailyStreak)||0);
    (Array.isArray(root.plan)?root.plan:[]).forEach(function(item){if(item&&typeof item.id==='string'&&['__proto__','constructor','prototype'].indexOf(item.id)<0&&/^[a-zA-Z0-9_.:@-]{1,200}$/.test(item.id))state.metrics.plans[item.id]={createdAt:null,origin:'legacy'};});
    (Array.isArray(root.manualActivities)?root.manualActivities:[]).forEach(function(item,index){if(!item||number(item.seconds,86400)===null)return;var id=typeof item.id==='string'&&['__proto__','constructor','prototype'].indexOf(item.id)<0&&/^[a-zA-Z0-9_.:@-]{1,200}$/.test(item.id)?item.id:'legacy_activity_'+index;state.metrics.manualActivities[id]={seconds:item.seconds,day:timestamp(item.createdAt)?timestamp(item.createdAt).slice(0,10):null,origin:'legacy'};});
    // Imported awards are recorded without inventing their acquisition dates or XP.
    CATALOG.forEach(function(def){if(state.achievements[def.id]&&state.achievements[def.id].earned){if(def.title&&state.titles.indexOf(def.title)<0)state.titles.push(def.title);if(def.cosmetic&&!state.cosmetics.some(function(c){return c.id===def.cosmetic.id;}))state.cosmetics.push(clone(def.cosmetic));}});
    return state;
  }
  function createState(legacy, nowArg) { return legacy ? migrateLegacy(legacy,nowArg) : blank(timeArg(nowArg)); }
  function boundedDays(state, start, end) {
    return Object.keys(state.metrics.healthDays).filter(function(date) {return (!start||date>=start)&&(!end||date<end);});
  }
  function healthTotal(state, key, start, end) {
    return boundedDays(state,start,end).reduce(function(sum,date){var n=number(state.metrics.healthDays[date][key]);return sum+(n===null?0:n);},0);
  }
  function activeDates(state) {
    var dates=Object.keys(state.metrics.healthDays).filter(function(date){var h=state.metrics.healthDays[date];return (number(h.steps)||0)>0||(number(h.activeMinutes)||0)>0;});
    Object.values(state.metrics.manualActivities).forEach(function(a){if(day(a.day)&&a.seconds>0)dates.push(a.day);});
    return unique(dates).sort();
  }
  function metric(state,type,start,end) {
    var m=state.metrics;
    if(type==='xp')return state.totalXp;
    if(type==='level')return getLevel(state.totalXp).level;
    if(type==='configured')return m.configured?1:0;
    if(type==='plans')return Math.max(Object.keys(m.plans).length,m.legacyCounts.plans||0);
    if(type==='activities')return Math.max(Object.keys(m.manualActivities).length,m.legacyCounts.activities||0);
    if(type==='activityMinutes')return Math.max(Math.floor(Object.values(m.manualActivities).reduce(function(s,a){return s+a.seconds;},0)/60),m.legacyCounts.activityMinutes||0);
    if(type==='dailyTasks')return m.totalDailyTasks;
    if(type==='perfectDays')return m.perfectDayDates.length;
    if(type==='streak')return m.bestDailyStreak;
    if(type==='aiUsed'||type==='mapExplored')return m[type];
    if(type==='familyChallenges')return Object.keys(m.familyChallenges).length;
    if(type==='badgeCount')return Object.values(state.achievements).filter(function(a){return a.earned;}).length;
    if(type==='challenges')return Object.values(state.challenges).filter(function(c){return c.status==='completed';}).length;
    if(type==='healthDays')return boundedDays(state,start,end).filter(function(d){var h=m.healthDays[d];return ['steps','distanceKm','activeMinutes','heartRate','sleepMinutes'].some(function(k){return number(h[k])!==null;});}).length;
    if(type==='activeDays')return activeDates(state).filter(function(d){return (!start||d>=start)&&(!end||d<end);}).length;
    if(type==='steps'||type==='activeMinutes')return healthTotal(state,type,start,end);
    return 0;
  }
  function achievementProgress(state,req) {
    if(req.type==='challengeId') {
      var found=Object.values(state.challenges).some(function(c){return c.definitionId===req.target&&c.status==='completed';});
      if(req.target==='secret_rest')found=Object.keys(state.rewards).some(function(id){return /:relax$/.test(id);});
      return {progress:found?1:0,target:1};
    }
    if(req.type==='collection')return {progress:req.target.filter(function(id){return state.achievements[id]&&state.achievements[id].earned;}).length,target:req.target.length};
    if(req.type==='combo') {var ratios=Object.keys(req.target).map(function(key){return Math.min(1,metric(state,key)/req.target[key]);});return {progress:Math.min.apply(Math,ratios),target:1};}
    return {progress:metric(state,req.type),target:req.target};
  }
  function period(def, now, zone) {
    var date=localDay(now,zone||'UTC'),start,end,key=def.id;
    if(def.period==='daily'){start=date;end=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);key+=':'+date;}
    if(def.period==='weekly') {var d=new Date(date+'T00:00:00Z'),offset=(d.getUTCDay()+6)%7;start=new Date(d.getTime()-offset*86400000).toISOString().slice(0,10);end=new Date(Date.parse(start+'T00:00:00Z')+7*86400000).toISOString().slice(0,10);key+=':'+start;}
    if(def.period==='monthly'){start=date.slice(0,7)+'-01';var md=new Date(start+'T00:00:00Z');md.setUTCMonth(md.getUTCMonth()+1);end=md.toISOString().slice(0,10);key+=':'+date.slice(0,7);}
    if(def.period==='season'){var season=SEASONS.find(function(s){return s.id===def.seasonId;});start=season.startsAt.slice(0,10);end=season.endsAt.slice(0,10);}
    return {id:key,start:start||null,end:end||null,startsAt:start?midnight(start,zone||'UTC'):null,endsAt:end?midnight(end,zone||'UTC'):null};
  }
  function targetFor(state,def) { return state.metrics.accountType==='child'&&def.childTarget!==undefined?def.childTarget:def.requirement.target; }
  function challengeInstance(state,def,now) {
    var win=period(def,now,state.metrics.timeZone),saved=state.challenges[win.id],target=saved&&number(saved.target)!==null?saved.target:targetFor(state,def);
    if(state.metrics.accountType==='child')target=Math.min(target,targetFor(state,def));
    var item=Object.assign({},clone(def),win,{startsAt:win.startsAt||(saved&&saved.startsAt)||state.createdAt||now,definitionId:def.id,target:target,progress:0,percent:0,status:'active',completedAt:null});
    if(saved&&saved.status==='completed')return Object.assign(item,saved,{id:win.id,definitionId:def.id,progress:target,percent:100,status:'completed'});
    if(def.stage>1) {
      var prev=state.challenges['series_foundation_'+(def.stage-1)];
      if(!prev||prev.status!=='completed')return Object.assign(item,{status:'locked'});
    }
    var value=metric(state,def.requirement.type,win.start,win.end);
    if(def.category==='series'&&def.stage>1)value=Math.max(0,value-(saved&&saved.baseline||0));
    item.progress=Math.min(target,Math.max(0,value));item.percent=target?Math.min(100,item.progress/target*100):0;
    if(win.start&&now<item.startsAt)item.status='locked';
    if(win.end&&now>=item.endsAt)item.status='expired';
    return item;
  }
  function applyEvent(input, event) {
    if(!input||input.schemaVersion!==VERSION)throw new TypeError('State requires migration');
    if(!plain(event)||!plain(event.payload||{}))throw new TypeError('Invalid event');
    identifier(event.id,'event ID');
    if(VALID_EVENTS.indexOf(event.type)<0)throw new TypeError('Unsupported event');
    var now=timestamp(event.occurredAt);if(!now)throw new TypeError('Invalid event timestamp');
    if(own(input.processedEvents,event.id))return {state:clone(input),events:[]};
    var state=clone(input),out=[],p=event.payload||{},referenceDay=localDay(now,state.metrics.timeZone),beforeLevel=getLevel(state.totalXp).level;
    function emit(type,payload,key) {var item={id:event.id+':'+type+':'+(key||'0'),type:type,occurredAt:now,payload:payload};out.push(item);var historyItem=clone(item);if(type==='STEPS_UPDATED')delete historyItem.payload.steps;state.history.push(historyItem);}
    function grant(rewardId,xp,details) {
      if(own(state.rewards,rewardId))return false;
      if(number(xp,10000)===null||!Number.isInteger(xp)||state.totalXp>Number.MAX_SAFE_INTEGER-xp)throw new TypeError('Invalid catalog XP');
      var reward=Object.assign({rewardId:rewardId,eventId:event.id,grantedAt:now,xp:xp,origin:'engine'},details||{});
      state.rewards[rewardId]=reward;state.totalXp+=xp;emit('REWARD_GRANTED',clone(reward),rewardId);if(xp)emit('XP_GAINED',{xp:xp,totalXp:state.totalXp,rewardId:rewardId},rewardId);return true;
    }
    function planAward(rewardId) {
      var date=localDay(now,state.metrics.timeZone),budgets=state.metrics.planXpDays||(state.metrics.planXpDays={}),spent=number(budgets[date])||0;
      var xp=Math.min(10,Math.max(0,100-spent));
      if(grant(rewardId,xp,{source:'plan'}))budgets[date]=spent+xp;
    }
    function hasData(h) {return ['steps','distanceKm','activeMinutes','heartRate','sleepMinutes'].some(function(key){return number(h[key])!==null;});}
    function eventDay() {var value=day(p.day);if(!value)throw new TypeError('Invalid day');if(value>new Date(Date.parse(referenceDay+'T12:00:00Z')+86400000).toISOString().slice(0,10))throw new TypeError('Future data day');return value;}
    if(event.type==='PROFILE_CONFIGURED') {if(['standard','child','guardian'].indexOf(p.accountType)<0)throw new TypeError('Invalid account type');state.metrics.accountType=p.accountType;state.metrics.configured=true;if(p.timeZone)state.metrics.timeZone=validateTimeZone(p.timeZone);}
    if(event.type==='PLAN_CREATED') {identifier(p.planId,'plan ID');if(!own(state.metrics.plans,p.planId)){state.metrics.plans[p.planId]={createdAt:now};planAward('plan:'+p.planId);}}
    if(event.type==='PLAN_COMPLETED') {identifier(p.planId,'plan ID');var pd=eventDay();if(!own(state.metrics.plans,p.planId))throw new TypeError('Unknown plan');state.metrics.planCompletions[p.planId+':'+pd]={completedAt:now};planAward('plan_done:'+p.planId+':'+pd);}
    if(event.type==='AI_USED')state.metrics.aiUsed=1;
    if(event.type==='MAP_EXPLORED')state.metrics.mapExplored=1;
    if(event.type==='ACTIVITY_RECORDED') {
      identifier(p.activityId,'activity ID');var ad=eventDay();if(number(p.seconds,86400)===null||p.seconds===0||!Number.isInteger(p.seconds))throw new TypeError('Invalid duration');
      if(!own(state.metrics.manualActivities,p.activityId))state.metrics.manualActivities[p.activityId]={seconds:p.seconds,day:ad,timestamp:now,source:'manual'};
    }
    if(event.type==='DAILY_TASK_CONFIRMED') {
      identifier(p.taskId,'task ID');var dd=eventDay(),bank=DAILY_TASKS.find(function(t){return t.id===p.taskId;});if(!bank)throw new TypeError('Unknown daily task');
      var record=state.metrics.dailyHistory[dd];
      if(!record)record=state.metrics.dailyHistory[dd]={taskIds:tasksForDay(dd,3).map(function(t){return t.id;}),completed:[],countedPerfect:false};
      if(record.taskIds.indexOf(p.taskId)<0)throw new TypeError('Daily task was not assigned');
      if(record.completed.indexOf(p.taskId)<0){record.completed.push(p.taskId);state.metrics.totalDailyTasks++;grant('daily:'+dd+':'+p.taskId,bank.xpReward,{source:'self-confirmed',taskId:p.taskId});}
      if(record.completed.length>=record.taskIds.length&&!record.countedPerfect){record.countedPerfect=true;if(state.metrics.perfectDayDates.indexOf(dd)<0)state.metrics.perfectDayDates.push(dd);}
    }
    if(event.type==='HEALTH_SYNCED') {
      if(p.timeZone){state.metrics.timeZone=validateTimeZone(p.timeZone);referenceDay=localDay(now,state.metrics.timeZone);}var hd=eventDay(),observed=timestamp(p.timestamp);
      if(!observed||observed>now)throw new TypeError('Invalid observed timestamp');
      identifier(p.syncId,'sync ID');safeText(p.source,'source',120);safeText(p.device,'device',120);
      var health={day:hd,source:p.source,device:p.device,timestamp:observed,syncId:p.syncId};
      var limits={steps:250000,distanceKm:500,activeMinutes:1440,heartRate:350,sleepMinutes:1440};
      Object.keys(limits).forEach(function(key) {var v=p[key];if(v!==undefined&&v!==null&&number(v,limits[key])===null)throw new TypeError('Invalid health metric');if((key==='steps'||key==='activeMinutes'||key==='sleepMinutes')&&v!==null&&v!==undefined&&!Number.isInteger(v))throw new TypeError('Invalid integer health metric');health[key]=v===undefined?null:v;});
      var old=state.metrics.healthDays[hd];
      // One daily aggregate is selected; full snapshots from two sources never add together.
      if(!old||observed>old.timestamp||(observed===old.timestamp&&health.syncId>old.syncId))state.metrics.healthDays[hd]=health;
      if(hasData(health))emit('STEPS_UPDATED',{day:hd,steps:state.metrics.healthDays[hd].steps,source:state.metrics.healthDays[hd].source,syncId:state.metrics.healthDays[hd].syncId},hd);
    }
    if(event.type==='FAMILY_CHALLENGE_COMPLETED') {identifier(p.challengeId,'family challenge ID');identifier(p.familyId,'family ID');state.metrics.familyChallenges[p.familyId+':'+p.challengeId]={completedAt:now};}
    state.metrics.activeDates=activeDates(state);
    state.metrics.activeDates.forEach(function(date){grant('activity_day:'+date,15,{source:'activity',day:date});});
    var st=streak(state.metrics.perfectDayDates,referenceDay);state.metrics.dailyStreak=st.current;state.metrics.bestDailyStreak=Math.max(state.metrics.bestDailyStreak,st.best);

    // Freeze a new series stage at the current real baseline; stages cannot skip.
    CHALLENGES.forEach(function(def) {
      var item=challengeInstance(state,def,now);
      if(item.status==='locked'||item.status==='expired'||item.status==='completed')return;
      var saved=state.challenges[item.id];
      if(!saved) {
        saved=state.challenges[item.id]={id:item.id,definitionId:def.id,status:'active',target:item.target,progress:0,startsAt:item.startsAt||now,endsAt:item.endsAt,baseline:def.category==='series'&&def.stage>1?metric(state,def.requirement.type):0};
        item=challengeInstance(state,def,now);
      }
      saved.progress=item.progress;
      if(item.progress>=item.target) {
        saved.status='completed';saved.completedAt=now;saved.eventId=event.id;
        grant('challenge:'+item.id,def.xpReward,{challengeId:item.id,definitionId:def.id});
        emit('CHALLENGE_COMPLETED',{challengeId:item.id,definitionId:def.id,name:def.name,xp:def.xpReward,additionalReward:def.additionalReward},item.id);
      }
    });
    // Award missing eligible achievements to a fixed point, including XP milestones.
    for(var pass=0;pass<CATALOG.length;pass++) {
      var changed=false;
      CATALOG.forEach(function(def) {
        if(state.achievements[def.id]&&state.achievements[def.id].earned)return;
        var progress=achievementProgress(state,def.requirement);
        state.achievements[def.id]={earned:false,earnedAt:null,progress:Math.min(progress.target,progress.progress),eventId:null,origin:'engine'};
        if(progress.progress>=progress.target) {
          state.achievements[def.id]={earned:true,earnedAt:now,progress:progress.target,eventId:event.id,origin:'engine'};
          grant('achievement:'+def.id,def.xpReward,{achievementId:def.id});
          if(def.title&&state.titles.indexOf(def.title)<0)state.titles.push(def.title);
          if(def.cosmetic&&!state.cosmetics.some(function(c){return c.id===def.cosmetic.id;}))state.cosmetics.push(clone(def.cosmetic));
          emit('ACHIEVEMENT_UNLOCKED',{achievementId:def.id,name:def.name,icon:def.icon,category:def.category,rarity:def.rarity,xp:def.xpReward},def.id);
          changed=true;
        }
      });
      if(!changed)break;
    }
    var after=getLevel(state.totalXp);
    if(after.level>beforeLevel)emit('LEVEL_UP',{level:after.level,previousLevel:beforeLevel,totalXp:state.totalXp},String(after.level));
    state.updatedAt=now>state.updatedAt?now:state.updatedAt;state.processedEvents[event.id]={type:event.type,occurredAt:now};
    state.history=state.history.slice(-120);
    var ids=Object.keys(state.processedEvents);if(ids.length>512)ids.slice(0,ids.length-512).forEach(function(id){delete state.processedEvents[id];});
    return {state:state,events:out};
  }
  function viewAchievements(state) {
    var definitions=CATALOG.slice();
    Object.keys(state.achievements).forEach(function(id) {if(!definitions.some(function(d){return d.id===id;}))definitions.push({id:id,name:'Historyczna odznaka '+id.replace(/^badge_/,''),description:'Zachowana nagroda z wcześniejszej wersji HealthGo.',icon:'🏅',category:'special',rarity:'common',requirement:{type:'legacy',target:1},xpReward:0,source:'Migracja wcześniejszego Plecaka',legacy:true});});
    return definitions.map(function(def) {
      var record=state.achievements[def.id],earned=!!(record&&record.earned),value=achievementProgress(state,def.requirement);
      if(earned)value={progress:value.target,target:value.target};
      var hidden=def.secret&&!earned;
      return Object.assign({},clone(def),{name:hidden?'Sekretne osiągnięcie':def.name,description:hidden?'Wymaganie odkryjesz po zdobyciu nagrody.':def.description,icon:hidden?'◇':def.icon,requirement:hidden?null:clone(def.requirement),earned:earned,earnedAt:earned?record.earnedAt:null,progress:hidden?0:Math.min(value.target,value.progress),target:hidden?null:value.target,percent:hidden?0:earned?100:Math.min(100,value.progress/value.target*100),status:earned?'earned':hidden?'locked':'available',requirementText:hidden?'Ukryte do momentu zdobycia':requirementText(def.requirement),requirementHidden:!!hidden,history:state.history.filter(function(e){return e.payload&&e.payload.achievementId===def.id;})});
    });
  }
  function viewChallenges(state, nowArg) {
    var now=timestamp(nowArg&&typeof nowArg==='object'?nowArg.now:nowArg)||state.updatedAt;
    var items=CHALLENGES.map(function(def){return challengeInstance(state,def,now);});
    var date=localDay(now,state.metrics.timeZone),record=state.metrics.dailyHistory[date],tasks=record&&record.taskIds?record.taskIds.map(function(id){return DAILY_TASKS.find(function(t){return t.id===id;});}).filter(Boolean):tasksForDay(date,3);
    tasks.forEach(function(task){var id='daily:'+date+':'+task.id,reward=state.rewards[id],done=!!reward;items.push({id:id,definitionId:task.id,name:task.name,description:task.description,icon:task.icon,category:'daily',period:'daily',progress:done?1:0,target:1,percent:done?100:0,startsAt:midnight(date,state.metrics.timeZone),endsAt:midnight(new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10),state.metrics.timeZone),completedAt:done?reward.grantedAt:null,xpReward:task.xpReward,additionalReward:null,source:'Potwierdzenie użytkownika',status:done?'completed':'active',confirmationRequired:true});});
    Object.keys(state.challenges).forEach(function(id){if(items.some(function(c){return c.id===id;}))return;var saved=state.challenges[id],def=CHALLENGES.find(function(c){return c.id===saved.definitionId;});if(def)items.push(Object.assign({},clone(def),clone(saved),{percent:saved.status==='completed'?100:Math.min(100,(saved.progress||0)/(saved.target||1)*100),status:saved.status==='completed'?'completed':saved.endsAt&&now>=saved.endsAt?'expired':saved.status}));});
    return items;
  }
  function personalBests(state) {
    var days=Object.keys(state.metrics.healthDays),bestDay=null,weeks={};
    days.forEach(function(date){var steps=number(state.metrics.healthDays[date].steps);if(steps===null)return;if(!bestDay||steps>bestDay.steps)bestDay={day:date,steps:steps};var win=period({id:'week',period:'weekly'},date+'T12:00:00.000Z');weeks[win.start]=(weeks[win.start]||0)+steps;});
    var bestWeek=null;Object.keys(weeks).forEach(function(start){if(!bestWeek||weeks[start]>bestWeek.steps)bestWeek={startsOn:start,steps:weeks[start]};});
    var months={};Object.values(state.challenges).forEach(function(c){if(c.status==='completed'&&timestamp(c.completedAt)){var month=c.completedAt.slice(0,7);months[month]=(months[month]||0)+1;}});
    var bestChallengeMonth=null;Object.keys(months).forEach(function(month){if(!bestChallengeMonth||months[month]>bestChallengeMonth.count)bestChallengeMonth={month:month,count:months[month]};});
    var activityStreak=streak(activeDates(state),(state.updatedAt||'').slice(0,10));
    return {bestDay:bestDay,bestWeek:bestWeek,longestStreak:activityStreak.best,bestChallengeMonth:bestChallengeMonth};
  }
  function clearHealthData(input) {
    if(!input||input.schemaVersion!==VERSION)throw new TypeError('State requires migration');
    var state=clone(input);
    state.metrics.healthDays={};state.metrics.manualActivities={};state.metrics.activeDates=[];
    state.metrics.legacyCounts.activities=0;state.metrics.legacyCounts.activityMinutes=0;
    CATALOG.forEach(function(def){var record=state.achievements[def.id];if(record&&!record.earned&&['steps','activeMinutes','activeDays','healthDays','activities','activityMinutes','combo'].indexOf(def.requirement.type)>=0)record.progress=0;});
    Object.values(state.challenges).forEach(function(c){var def=CHALLENGES.find(function(d){return d.id===c.definitionId;});if(def&&c.status!=='completed'&&['steps','activeMinutes','activeDays','healthDays'].indexOf(def.requirement.type)>=0){c.progress=0;c.baseline=0;}});
    state.history=state.history.filter(function(e){return e.type!=='STEPS_UPDATED';});
    return state;
  }
  // Deep freeze shared definitions so UI or imported code cannot change server reward values.
  function freeze(value) {if(value&&typeof value==='object'){Object.keys(value).forEach(function(k){freeze(value[k]);});Object.freeze(value);}return value;}
  [CATALOG,CHALLENGES,COLLECTIONS,SEASONS,DAILY_TASKS].forEach(freeze);
  if(new Set(CATALOG.map(function(d){return d.id;})).size!==CATALOG.length)throw new Error('Duplicate achievement ID');
  return Object.freeze({VERSION:VERSION,CATALOG:CATALOG,CHALLENGES:CHALLENGES,COLLECTIONS:COLLECTIONS,SEASONS:SEASONS,DAILY_TASKS:DAILY_TASKS,VALID_EVENTS:Object.freeze(VALID_EVENTS),xpNeeded:xpNeeded,getLevel:getLevel,createState:createState,migrateLegacy:migrateLegacy,applyEvent:applyEvent,viewAchievements:viewAchievements,viewChallenges:viewChallenges,tasksForDay:tasksForDay,personalBests:personalBests,clearHealthData:clearHealthData});
});
