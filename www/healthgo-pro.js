(function(){
'use strict';

var PRO_VERSION='2.0';
var DAILY_BANK=[
{id:'plan_focus',icon:'📅',title:'Uporządkuj Plan Dnia',desc:'Dodaj lub popraw jeden prawdziwy punkt w Planie Dnia.',xp:35},
{id:'screen_break',icon:'🌿',title:'Krótka przerwa od ekranu',desc:'Zrób spokojną przerwę od ekranu i wróć, gdy będziesz gotowy.',xp:20},
{id:'easy_move',icon:'🚶',title:'Trochę ruchu',desc:'Wybierz lekką aktywność odpowiednią dla Ciebie. Nie ścigaj się z wynikiem.',xp:25},
{id:'log_activity',icon:'⏱️',title:'Zapisz aktywność',desc:'Użyj ręcznego pomiaru HealthGo i zapisz prawdziwy czas aktywności.',xp:30},
{id:'ai_plan',icon:'🤖',title:'Zapytaj HealthGo AI',desc:'Zapytaj AI o organizację dnia, naukę albo plan działania.',xp:25},
{id:'prepare_tomorrow',icon:'🎒',title:'Przygotuj jedną rzecz na jutro',desc:'Przygotuj jedną rzecz, która ułatwi Ci jutrzejszy dzień.',xp:20},
{id:'tidy_space',icon:'🧹',title:'Ogarnij mały fragment przestrzeni',desc:'Uporządkuj biurko, półkę albo inne małe miejsce.',xp:20},
{id:'relax',icon:'🎧',title:'Chwila odpoczynku',desc:'Zrób coś spokojnego, co pomaga Ci odpocząć.',xp:20},
{id:'review_goals',icon:'🎯',title:'Sprawdź cele',desc:'Przejrzyj cele HealthGo i upewnij się, że nadal Ci pasują.',xp:15},
{id:'plan_finish',icon:'✅',title:'Dokończ punkt planu',desc:'Oznacz jako wykonany jeden prawdziwy punkt z Planu Dnia.',xp:30},
{id:'stretch_easy',icon:'🧘',title:'Spokojne rozruszanie',desc:'Jeśli czujesz się dobrze, zrób krótkie i łagodne rozruszanie bez forsowania.',xp:20},
{id:'learn_small',icon:'📚',title:'Mały krok w nauce',desc:'Poświęć chwilę na jedno małe zadanie związane z nauką lub hobby.',xp:25}
];

function descFor(type,target){
 if(type==='xp')return 'Zdobądź łącznie '+target.toLocaleString('pl-PL')+' XP.';
 if(type==='level')return 'Osiągnij poziom '+target+'.';
 if(type==='dailyTasks')return 'Ukończ łącznie '+target+' Zadań Dnia.';
 if(type==='streak')return 'Utrzymaj serię pełnych dni przez '+target+' dni.';
 if(type==='perfectDays')return 'Ukończ wszystkie Zadania Dnia przez '+target+' różne dni.';
 if(type==='plans')return 'Utwórz łącznie '+target+' punktów Planu Dnia.';
 if(type==='activities')return 'Zapisz '+target+' aktywności ręcznych.';
 if(type==='activityMinutes')return 'Zapisz łącznie '+target+' minut prawdziwej aktywności.';
 if(type==='challenges')return 'Ukończ '+target+' wyzwań HealthGo.';
 return 'Osiągnij wymagany cel.';
}
function makeGroup(prefix,icon,names,type,targets,hue){
 return names.map(function(name,i){return{id:prefix+'_'+(i+1),icon:icon,name:name,desc:descFor(type,targets[i]),criterion:{type:type,target:targets[i]},hue:(hue+i*17)%360};});
}

var STARTER=[
{id:'health',icon:'❤️',name:'Witaj w HealthGo',desc:'Skonfiguruj konto HealthGo.',criterion:{type:'configured',target:1}},
{id:'planner',icon:'📅',name:'Pierwszy plan',desc:'Dodaj pierwszy punkt do Planu Dnia.',criterion:{type:'plans',target:1}},
{id:'explorer',icon:'🗺️',name:'Odkrywca',desc:'Ukończ wyzwanie odkrywcy mapy.',criterion:{type:'challengeId',target:'map_explorer'}},
{id:'ai_first',icon:'🤖',name:'Pierwsza rozmowa',desc:'Ukończ pierwsze wyzwanie z HealthGo AI.',criterion:{type:'challengeId',target:'ai_first'}},
{id:'active_first',icon:'🏃',name:'Aktywny start',desc:'Zapisz pierwszą prawdziwą aktywność ręczną.',criterion:{type:'activities',target:1}},
{id:'xp_first',icon:'✨',name:'Pierwsze XP',desc:'Zdobądź pierwsze punkty XP.',criterion:{type:'xp',target:1}},
{id:'daily_first',icon:'☀️',name:'Pierwsze Zadanie Dnia',desc:'Ukończ pierwsze Zadanie Dnia.',criterion:{type:'dailyTasks',target:1}},
{id:'perfect_first',icon:'🌟',name:'Pełny dzień',desc:'Ukończ wszystkie Zadania Dnia jednego dnia.',criterion:{type:'perfectDays',target:1}},
{id:'level_2',icon:'2️⃣',name:'Poziom 2',desc:'Osiągnij poziom 2.',criterion:{type:'level',target:2}},
{id:'level_5',icon:'5️⃣',name:'Poziom 5',desc:'Osiągnij poziom 5.',criterion:{type:'level',target:5}}
];
var XP=makeGroup('xp','⚡',['Iskra XP','250 XP','500 XP','1K XP','2K XP','3,5K XP','5K XP','7,5K XP','10K XP','25K XP'],'xp',[100,250,500,1000,2000,3500,5000,7500,10000,25000],35);
var LEVEL=makeGroup('level','🏅',['Poziom 10','Poziom 15','Poziom 20','Poziom 30','Poziom 40','Poziom 50','Poziom 75','Poziom 100','Poziom 250','Poziom 500'],'level',[10,15,20,30,40,50,75,100,250,500],70);
var DAILY=makeGroup('daily','✅',['3 zadania','5 zadań','10 zadań','20 zadań','30 zadań','50 zadań','75 zadań','100 zadań','150 zadań','250 zadań'],'dailyTasks',[3,5,10,20,30,50,75,100,150,250],110);
var STREAK=makeGroup('streak','🔥',['Seria 2','Seria 3','Seria 5','Tydzień serii','Seria 10','Dwa tygodnie','Seria 21','Miesiąc serii','Seria 60','Seria 100'],'streak',[2,3,5,7,10,14,21,30,60,100],150);
var PERFECT=makeGroup('perfect','🌞',['1 pełny dzień','3 pełne dni','5 pełnych dni','10 pełnych dni','20 pełnych dni','30 pełnych dni','50 pełnych dni','75 pełnych dni','100 pełnych dni','200 pełnych dni'],'perfectDays',[1,3,5,10,20,30,50,75,100,200],190);
var PLAN=makeGroup('plan','🗓️',['Plan 1','Plan 3','Plan 5','Plan 10','Plan 20','Plan 30','Plan 50','Plan 75','Plan 100','Plan 200'],'plans',[1,3,5,10,20,30,50,75,100,200],225);
var ACTIVITY=makeGroup('activity','🏃',['Sesja 1','Sesje 2','Sesje 5','Sesje 10','Sesje 20','Sesje 30','Sesje 50','Sesje 75','Sesje 100','Sesje 200'],'activities',[1,2,5,10,20,30,50,75,100,200],260);
var MINUTES=makeGroup('minutes','⏱️',['1 minuta','5 minut','10 minut','20 minut','30 minut','60 minut','120 minut','300 minut','600 minut','1200 minut'],'activityMinutes',[1,5,10,20,30,60,120,300,600,1200],295);
var MASTER=[
{id:'master_challenges_1',icon:'🎯',name:'Wyzwania I',desc:'Ukończ 1 wyzwanie HealthGo.',criterion:{type:'challenges',target:1}},
{id:'master_challenges_2',icon:'🎯',name:'Wyzwania II',desc:'Ukończ 2 wyzwania HealthGo.',criterion:{type:'challenges',target:2}},
{id:'master_challenges_3',icon:'🎯',name:'Wyzwania III',desc:'Ukończ 3 wyzwania HealthGo.',criterion:{type:'challenges',target:3}},
{id:'master_challenges_4',icon:'🎯',name:'Komplet wyzwań',desc:'Ukończ 4 podstawowe wyzwania HealthGo.',criterion:{type:'challenges',target:4}},
{id:'master_combo_1',icon:'💎',name:'Wszechstronny I',desc:'Poziom 10, 10 Zadań Dnia, 5 planów i 2 aktywności.',criterion:{type:'combo',target:{level:10,dailyTasks:10,plans:5,activities:2}}},
{id:'master_combo_2',icon:'💠',name:'Wszechstronny II',desc:'Poziom 25, 30 Zadań Dnia, 20 planów i 10 aktywności.',criterion:{type:'combo',target:{level:25,dailyTasks:30,plans:20,activities:10}}},
{id:'master_combo_3',icon:'👑',name:'Wszechstronny III',desc:'Poziom 50, 75 Zadań Dnia, 50 planów i 30 aktywności.',criterion:{type:'combo',target:{level:50,dailyTasks:75,plans:50,activities:30}}},
{id:'master_daily',icon:'🏆',name:'Mistrz regularności',desc:'30 pełnych dni i seria co najmniej 14 dni.',criterion:{type:'combo',target:{perfectDays:30,streak:14}}},
{id:'master_pack',icon:'🎒',name:'Kolekcjoner HealthGoPack',desc:'Zdobądź 75 innych odznak.',criterion:{type:'badgeCount',target:75}},
{id:'maxxp',icon:'🏆',name:'MAX XP',desc:'Osiągnij poziom 1000.',criterion:{type:'level',target:1000}}
];

var BADGES=[].concat(STARTER,XP,LEVEL,DAILY,STREAK,PERFECT,PLAN,ACTIVITY,MINUTES,MASTER).map(function(b,index){
 b.model='HG-'+String(index+1).padStart(3,'0');
 if(typeof b.hue!=='number')b.hue=(index*29+12)%360;
 b.rarity=index<30?'Standard':index<60?'Advanced':index<85?'Epic':index<95?'Legendary':'Master';
 return b;
});
if(BADGES.length!==100)console.error('HealthGo: expected 100 badges, got',BADGES.length);

function safeSuffix(){
 try{return typeof hgSafeKey==='function'?hgSafeKey(hgUserKey()):'default';}catch(_){return'default';}
}
function settingsKey(){return'healthgo_settings_v3_'+safeSuffix();}
function loadSettings(){
 var d={dailyTasksEnabled:true,dailyTaskCount:3,notificationsDaily:true,notificationsBadges:true,notificationsStreak:true,watchSync:true,units:'metric',reduceMotion:false,highContrast:false,largeText:false,privateMode:false,cloudSync:true};
 try{return Object.assign(d,JSON.parse(localStorage.getItem(settingsKey())||'{}'));}catch(_){return d;}
}
function saveSettings(s){
 localStorage.setItem(settingsKey(),JSON.stringify(s));
 if(typeof syncHealthGoCloudState==='function')syncHealthGoCloudState({settingsV3:s}).catch(function(){});
 applySettings(s);renderSettings();renderDaily();
}
function progress(){
 var p=typeof loadProgress==='function'?loadProgress():{};
 if(!p.dailyHistory||typeof p.dailyHistory!=='object')p.dailyHistory={};
 if(!Array.isArray(p.perfectDayDates))p.perfectDayDates=[];
 if(!Number.isFinite(p.totalDailyTasks))p.totalDailyTasks=0;
 if(!Number.isFinite(p.dailyStreak))p.dailyStreak=0;
 if(!Number.isFinite(p.bestDailyStreak))p.bestDailyStreak=0;
 if(!Array.isArray(p.badges))p.badges=[];
 if(!Array.isArray(p.completed))p.completed=[];
 return p;
}
function dateKey(date){
 date=date||new Date();
 return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
function dayDiff(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);}
function recalcStreak(p){
 var dates=Array.from(new Set(p.perfectDayDates||[])).sort(),best=0,run=0,prev=null;
 dates.forEach(function(d){run=prev&&dayDiff(prev,d)===1?run+1:1;best=Math.max(best,run);prev=d;});
 var cur=0;
 if(dates.length){
  var i=dates.length-1,latest=dates[i],gap=dayDiff(latest,dateKey());
  if(gap===0||gap===1){cur=1;while(i>0&&dayDiff(dates[i-1],dates[i])===1){cur++;i--;}}
 }
 p.dailyStreak=cur;p.bestDailyStreak=best;
}
function tasksFor(date,count){
 var seed=0,i,pool=DAILY_BANK.slice(),out=[],wanted=Math.max(3,Math.min(5,Number(count)||3));
 for(i=0;i<date.length;i++)seed=(seed*31+date.charCodeAt(i))>>>0;
 while(out.length<wanted&&pool.length){seed=(seed*1664525+1013904223)>>>0;i=seed%pool.length;out.push(pool.splice(i,1)[0]);}
 return out;
}
function ensureToday(p){
 var k=dateKey(),s=loadSettings();
 if(!p.dailyHistory[k])p.dailyHistory[k]={taskIds:tasksFor(k,s.dailyTaskCount).map(function(x){return x.id;}),completed:[],countedPerfect:false};
 var r=p.dailyHistory[k];
 if(!Array.isArray(r.taskIds)||!r.taskIds.length)r.taskIds=tasksFor(k,s.dailyTaskCount).map(function(x){return x.id;});
 if(!Array.isArray(r.completed))r.completed=[];
 return r;
}
function metric(){
 var p=progress(),plans=typeof loadHealthGoPlan==='function'?loadHealthGoPlan():[],acts=typeof loadManualActivities==='function'?loadManualActivities():[],profile=typeof loadHealthGoProfile==='function'?loadHealthGoProfile():{};
 return{level:Number(p.level)||1,xp:Number(p.totalXp)||0,dailyTasks:Number(p.totalDailyTasks)||0,streak:Math.max(Number(p.dailyStreak)||0,Number(p.bestDailyStreak)||0),perfectDays:(p.perfectDayDates||[]).length,plans:Array.isArray(plans)?plans.length:0,activities:Array.isArray(acts)?acts.length:0,activityMinutes:Array.isArray(acts)?Math.floor(acts.reduce(function(s,x){return s+(Number(x.seconds)||0);},0)/60):0,challenges:p.completed.length,configured:profile.configured?1:0,completed:p.completed,badges:p.badges};
}
function met(c,m){
 if(!c)return false;
 if(c.type==='challengeId')return m.completed.indexOf(c.target)>=0;
 if(c.type==='configured')return m.configured>=c.target;
 if(c.type==='badgeCount')return m.badges.length>=c.target;
 if(c.type==='combo')return Object.keys(c.target).every(function(k){return(m[k]||0)>=c.target[k];});
 return(m[c.type]||0)>=c.target;
}
function evaluate(animate){
 var p=progress(),m=metric(),newOnes=[];
 BADGES.forEach(function(b){if(p.badges.indexOf(b.id)>=0)return;m.badges=p.badges;if(met(b.criterion,m)){p.badges.push(b.id);newOnes.push(b);}});
 if(newOnes.length){putProgress(p);if(animate&&typeof showBadgeAward==='function')showBadgeAward(newOnes[0]);}
 return newOnes;
}
function completeDaily(id){
 if(!loadSettings().dailyTasksEnabled)return;
 var p=progress(),r=ensureToday(p),task=DAILY_BANK.find(function(x){return x.id===id;});
 if(!task||r.taskIds.indexOf(id)<0||r.completed.indexOf(id)>=0)return;
 r.completed.push(id);p.totalDailyTasks++;
 if(r.completed.length>=r.taskIds.length&&!r.countedPerfect){r.countedPerfect=true;if(p.perfectDayDates.indexOf(dateKey())<0)p.perfectDayDates.push(dateKey());recalcStreak(p);}
 putProgress(p);addXP(task.xp);evaluate(true);renderDaily();renderProgressUI();
}

window.awardBadge=function(id,animate){
 var b=BADGES.find(function(x){return x.id===id;}),p=progress();
 if(!b||p.badges.indexOf(id)>=0)return false;
 p.badges.push(id);putProgress(p);renderProgressUI();if(animate!==false&&typeof showBadgeAward==='function')showBadgeAward(b);return true;
};
window.ensureHealthBadge=function(animate){return window.awardBadge('health',animate);};
window.showBadgeAward=function(b){
 var root=document.getElementById('badgeAward');if(!root)return;
 var e=document.getElementById('badgeAwardEmoji');if(e){e.textContent=b.icon||b.emoji||'🏅';e.style.background='linear-gradient(145deg,hsl('+b.hue+' 80% 92%),hsl('+((b.hue+35)%360)+' 85% 74%))';}
 var t=document.getElementById('badgeAwardTitle');if(t)t.textContent=b.name;
 var x=document.getElementById('badgeAwardText');if(x)x.textContent=b.desc+' · Model '+(b.model||'HealthGo')+' · '+(b.rarity||'Standard');
 root.classList.add('show');
};
window.renderProgressUI=function(){
 evaluate(false);
 var p=progress(),need=typeof xpNeeded==='function'?xpNeeded(p.level):400;
 function set(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
 set('levelValue',p.level);set('levelCopy',p.level>=1000?'Maksymalny poziom osiągnięty.':'Do następnego poziomu potrzebujesz '+Math.max(0,need-p.xp)+' XP.');set('xpCurrent',p.xp+' XP');set('xpRequired',p.level>=1000?'MAX':need+' XP');set('earnedBadgeCount',p.badges.length);set('badgeCounter',p.badges.length+' / 100');
 var bar=document.getElementById('xpProgress');if(bar)bar.style.width=(p.level>=1000?100:Math.min(100,p.xp/need*100))+'%';
 var list=document.getElementById('realChallengeList');
 if(list&&typeof HG_CHALLENGES!=='undefined'){list.innerHTML='';HG_CHALLENGES.forEach(function(ch){var done=p.completed.indexOf(ch.id)>=0,row=document.createElement('div');row.className='challenge-real'+(done?' done':'');row.innerHTML='<div class="challenge-symbol">'+ch.icon+'</div><div class="challenge-copy"><b>'+ch.title+'</b><small>'+ch.desc+'</small></div><div class="challenge-xp">'+(done?'✓ Ukończone':'+'+ch.xp+' XP')+'</div>';list.appendChild(row);});}
 var grid=document.getElementById('badgeGrid');
 if(grid){grid.innerHTML='';BADGES.forEach(function(b){var earned=p.badges.indexOf(b.id)>=0,slot=document.createElement('div');slot.className='badge-slot hg-pro-badge '+(earned?'earned':'locked');slot.title=b.desc;slot.innerHTML='<div class="hg-pro-badge-model" style="--badge-h:'+b.hue+'"><span>'+(earned?b.icon:'◇')+'</span><small>'+b.model+'</small></div><b>'+b.name+'</b><span class="hg-badge-rarity">'+b.rarity+'</span>';grid.appendChild(slot);});}
 if(typeof renderHealthGoProfile==='function')renderHealthGoProfile();renderDaily();
};
function renderDaily(){
 var root=document.getElementById('hgDailyTasks');if(!root)return;
 var s=loadSettings();if(!s.dailyTasksEnabled){root.innerHTML='<div class="settings-note">Zadania Dnia są wyłączone w Ustawieniach.</div>';return;}
 var p=progress(),r=ensureToday(p);putProgress(p);
 var tasks=r.taskIds.map(function(id){return DAILY_BANK.find(function(x){return x.id===id;});}).filter(Boolean);
 var left=tasks.filter(function(t){return r.completed.indexOf(t.id)<0;}).reduce(function(sum,t){return sum+t.xp;},0);
 root.innerHTML='<div class="hg-daily-head"><div><b>Zadania Dnia</b><span>'+r.completed.length+' / '+tasks.length+' wykonane · seria: '+(p.dailyStreak||0)+' dni</span></div><div class="hg-daily-xp">'+left+' XP do zdobycia</div></div><div class="hg-daily-list"></div><div class="hg-daily-note">Zadania wykonywane poza aplikacją potwierdzasz samodzielnie. HealthGo nie udaje, że je wykrył.</div>';
 var list=root.querySelector('.hg-daily-list');
 tasks.forEach(function(task){var done=r.completed.indexOf(task.id)>=0,card=document.createElement('article');card.className='hg-daily-task'+(done?' done':'');card.innerHTML='<div class="hg-daily-icon">'+task.icon+'</div><div><b>'+task.title+'</b><p>'+task.desc+'</p></div><div class="hg-daily-action"><span>+'+task.xp+' XP</span><button type="button" '+(done?'disabled':'')+'>'+(done?'✓ Zrobione':'Potwierdź')+'</button></div>';var btn=card.querySelector('button');if(btn&&!done)btn.addEventListener('click',function(){completeDaily(task.id);});list.appendChild(card);});
}
function injectDaily(){
 if(document.getElementById('hgDailyTasksPanel'))return;var target=document.querySelector('#challenges .challenge-overview');if(!target)return;var sec=document.createElement('section');sec.id='hgDailyTasksPanel';sec.className='hg-daily-panel';sec.innerHTML='<div id="hgDailyTasks"></div>';target.insertAdjacentElement('afterend',sec);
}
function injectSettings(){
 var nav=document.querySelector('#settings .settings-menu'),content=document.querySelector('#settings .settings-content');if(!nav||!content||document.getElementById('settingsGoals'))return;
 [['settingsGoals','Cele'],['settingsNotifications','Powiadomienia'],['settingsDevices','Zegarki i urządzenia'],['settingsData','Dane i synchronizacja'],['settingsAccessibility','Dostępność'],['settingsAbout','O HealthGo']].forEach(function(x){var b=document.createElement('button');b.type='button';b.textContent=x[1];b.onclick=function(){scrollSettings(x[0]);};nav.appendChild(b);});
 content.insertAdjacentHTML('beforeend','<section id="settingsGoals" class="settings-section"><h3>Cele i Zadania Dnia</h3><p>Ustaw sposób działania codziennych celów. HealthGo nie tworzy celów dotyczących masy ciała ani nadmiernego wysiłku.</p><div class="settings-row"><label>Zadania Dnia</label><label class="hg-switch-row"><input id="hgSetDailyEnabled" type="checkbox"> Włączone</label></div><div class="settings-row"><label>Liczba zadań</label><select id="hgSetDailyCount"><option value="3">3 zadania</option><option value="4">4 zadania</option><option value="5">5 zadań</option></select></div><div class="settings-row"><label>Jednostki</label><select id="hgSetUnits"><option value="metric">Metryczne (km)</option><option value="imperial">Imperialne (mile)</option></select></div></section>'+
 '<section id="settingsNotifications" class="settings-section"><h3>Powiadomienia</h3><p>Wybierz, o jakich wydarzeniach HealthGo może przypominać.</p><div class="settings-row"><label>Zadania Dnia</label><label class="hg-switch-row"><input id="hgSetNotifDaily" type="checkbox"> Powiadomienia</label></div><div class="settings-row"><label>Nowe odznaki</label><label class="hg-switch-row"><input id="hgSetNotifBadges" type="checkbox"> Powiadomienia</label></div><div class="settings-row"><label>Seria dni</label><label class="hg-switch-row"><input id="hgSetNotifStreak" type="checkbox"> Powiadomienia</label></div><div class="settings-row"><label>Synchronizacja zegarka</label><label class="hg-switch-row"><input id="hgSetWatchSync" type="checkbox"> Informuj o problemach</label></div></section>'+
 '<section id="settingsDevices" class="settings-section"><h3>Zegarki i urządzenia</h3><p>HealthGo obsługuje osobne aplikacje dla Apple Watch i Wear OS. Dane zdrowotne są odczytywane dopiero po zgodzie systemowej.</p><div class="hg-device-card"><div><b> Apple Watch</b><span>watchOS · aplikacja HealthGo Watch</span></div><strong class="hg-status neutral">Gotowe do konfiguracji</strong></div><div class="hg-device-card"><div><b>⌚ Wear OS</b><span>Wear OS · zgodne zegarki z Androidem</span></div><strong class="hg-status neutral">Gotowe do konfiguracji</strong></div><div class="settings-note">Jeśli urządzenie nie przekaże danych, HealthGo pokaże „Brak danych” zamiast przykładowych liczb.</div></section>'+
 '<section id="settingsData" class="settings-section"><h3>Dane i synchronizacja</h3><p>Zarządzaj danymi zapisanymi przez HealthGo.</p><div class="settings-row"><label>Synchronizacja konta</label><label class="hg-switch-row"><input id="hgSetCloudSync" type="checkbox"> Synchronizuj, gdy konto jest połączone</label></div><div class="settings-row"><label>Status chmury</label><div id="hgCloudStatus" class="muted">Sprawdzanie…</div></div><div class="row"><button class="btn secondary" type="button" onclick="exportHealthGoData()">Eksportuj moje dane</button><button class="btn gray" type="button" onclick="refreshHealthGoStatus()">Odśwież status</button></div></section>'+
 '<section id="settingsAccessibility" class="settings-section"><h3>Dostępność</h3><p>Dostosuj interfejs bez zmiany danych i postępu.</p><div class="settings-row"><label>Większy tekst</label><label class="hg-switch-row"><input id="hgSetLargeText" type="checkbox"> Włącz</label></div><div class="settings-row"><label>Ogranicz animacje</label><label class="hg-switch-row"><input id="hgSetReduceMotion" type="checkbox"> Włącz</label></div><div class="settings-row"><label>Wyższy kontrast</label><label class="hg-switch-row"><input id="hgSetHighContrast" type="checkbox"> Włącz</label></div><div class="settings-row"><label>Tryb prywatny</label><label class="hg-switch-row"><input id="hgSetPrivateMode" type="checkbox"> Ukrywaj dodatkowe podglądy</label></div></section>'+
 '<section id="settingsAbout" class="settings-section"><h3>O HealthGo</h3><p>Informacje techniczne o tej wersji.</p><div class="settings-row"><label>HealthGo Professional</label><div class="muted">Moduł '+PRO_VERSION+'</div></div><div class="settings-row"><label>Odznaki</label><div class="muted">100 modeli · 100 warunków zdobycia</div></div><div class="settings-row"><label>Zegarki</label><div class="muted">Apple Watch + Wear OS</div></div><div class="settings-note">Dane zdrowotne mają charakter informacyjny. HealthGo nie zastępuje lekarza ani profesjonalnej porady medycznej.</div></section><div class="row" style="margin-bottom:20px"><button class="btn" type="button" onclick="saveHealthGoProfessionalSettings()">Zapisz ustawienia</button><span id="hgSettingsSaved" class="muted"></span></div>');
}
function renderSettings(){
 var s=loadSettings();function ck(id,v){var e=document.getElementById(id);if(e)e.checked=!!v;}function val(id,v){var e=document.getElementById(id);if(e)e.value=String(v);}
 ck('hgSetDailyEnabled',s.dailyTasksEnabled);val('hgSetDailyCount',s.dailyTaskCount);val('hgSetUnits',s.units);ck('hgSetNotifDaily',s.notificationsDaily);ck('hgSetNotifBadges',s.notificationsBadges);ck('hgSetNotifStreak',s.notificationsStreak);ck('hgSetWatchSync',s.watchSync);ck('hgSetCloudSync',s.cloudSync);ck('hgSetLargeText',s.largeText);ck('hgSetReduceMotion',s.reduceMotion);ck('hgSetHighContrast',s.highContrast);ck('hgSetPrivateMode',s.privateMode);refreshHealthGoStatus();
}
window.saveHealthGoProfessionalSettings=function(){
 function q(id){return document.getElementById(id);}var s=loadSettings(),n=Object.assign({},s,{dailyTasksEnabled:!!(q('hgSetDailyEnabled')&&q('hgSetDailyEnabled').checked),dailyTaskCount:Number(q('hgSetDailyCount')?q('hgSetDailyCount').value:3),units:q('hgSetUnits')?q('hgSetUnits').value:'metric',notificationsDaily:!!(q('hgSetNotifDaily')&&q('hgSetNotifDaily').checked),notificationsBadges:!!(q('hgSetNotifBadges')&&q('hgSetNotifBadges').checked),notificationsStreak:!!(q('hgSetNotifStreak')&&q('hgSetNotifStreak').checked),watchSync:!!(q('hgSetWatchSync')&&q('hgSetWatchSync').checked),cloudSync:!!(q('hgSetCloudSync')&&q('hgSetCloudSync').checked),largeText:!!(q('hgSetLargeText')&&q('hgSetLargeText').checked),reduceMotion:!!(q('hgSetReduceMotion')&&q('hgSetReduceMotion').checked),highContrast:!!(q('hgSetHighContrast')&&q('hgSetHighContrast').checked),privateMode:!!(q('hgSetPrivateMode')&&q('hgSetPrivateMode').checked)});
 saveSettings(n);var e=q('hgSettingsSaved');if(e){e.textContent='Zapisano.';setTimeout(function(){e.textContent='';},1800);}
};
window.refreshHealthGoStatus=function(){var e=document.getElementById('hgCloudStatus');if(!e)return;var ok=!!(window.healthGoDb&&typeof hgUid==='function'&&hgUid());e.textContent=ok?'Połączono z kontem HealthGo':'Tryb lokalny / brak aktywnej synchronizacji konta';};
window.exportHealthGoData=function(){
 var payload={exportedAt:new Date().toISOString(),profile:typeof loadHealthGoProfile==='function'?loadHealthGoProfile():null,progress:typeof loadProgress==='function'?loadProgress():null,settings:loadSettings(),plan:typeof loadHealthGoPlan==='function'?loadHealthGoPlan():[],manualActivities:typeof loadManualActivities==='function'?loadManualActivities():[]};
 var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='HealthGo-export-'+dateKey()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
};
function applySettings(s){s=s||loadSettings();document.body.classList.toggle('hg-large-text',!!s.largeText);document.body.classList.toggle('hg-reduce-motion',!!s.reduceMotion);document.body.classList.toggle('hg-high-contrast',!!s.highContrast);document.body.classList.toggle('hg-private-mode',!!s.privateMode);}
function injectStyles(){
 if(document.getElementById('hgProfessionalStyles'))return;var style=document.createElement('style');style.id='hgProfessionalStyles';style.textContent='.hg-daily-panel{margin:14px 0;border:1px solid var(--border);background:var(--card);border-radius:18px;padding:18px}.hg-daily-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}.hg-daily-head b{font-size:18px}.hg-daily-head span{display:block;color:var(--muted);font-size:12px;margin-top:4px}.hg-daily-xp{font-size:12px;font-weight:850;color:#087f5b;background:#e9f8f3;padding:7px 10px;border-radius:999px;white-space:nowrap}.hg-daily-list{display:grid;gap:9px}.hg-daily-task{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;border:1px solid var(--border);border-radius:14px;padding:12px;background:var(--soft)}.hg-daily-task.done{opacity:.66}.hg-daily-icon{font-size:26px}.hg-daily-task b{font-size:13px}.hg-daily-task p{font-size:12px;color:var(--muted);margin:3px 0 0;line-height:1.35}.hg-daily-action{text-align:right}.hg-daily-action span{display:block;font-size:11px;font-weight:850;color:#087f5b;margin-bottom:5px}.hg-daily-action button{border:0;border-radius:9px;padding:7px 10px;background:#111827;color:#fff;font-weight:750}.hg-daily-action button:disabled{background:#d1d5db;color:#4b5563}.hg-daily-note{font-size:11px;color:var(--muted);margin-top:10px}.badge-grid{grid-template-columns:repeat(4,minmax(0,1fr));max-height:560px;gap:10px}.badge-slot.hg-pro-badge{min-height:142px;padding:10px;justify-content:flex-start;background:var(--card)}.hg-pro-badge-model{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;position:relative;background:linear-gradient(145deg,hsl(var(--badge-h) 78% 94%),hsl(calc(var(--badge-h) + 38) 78% 70%));box-shadow:inset 0 0 0 1px rgba(255,255,255,.7),0 8px 22px rgba(0,0,0,.09);font-size:26px}.hg-pro-badge-model small{position:absolute;bottom:-16px;font-size:7px;letter-spacing:.5px;color:var(--muted);font-weight:800}.hg-pro-badge>b{margin-top:17px;font-size:11px!important}.hg-badge-rarity{font-size:9px;color:var(--muted)}.badge-slot.locked .hg-pro-badge-model{filter:grayscale(1);opacity:.48}.badge-slot.locked{opacity:.7}.hg-device-card{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid var(--border);padding:14px 0}.hg-device-card:first-of-type{border-top:0}.hg-device-card b,.hg-device-card span{display:block}.hg-device-card span{font-size:12px;color:var(--muted);margin-top:4px}.hg-status{font-size:10px;border-radius:999px;padding:7px 9px}.hg-status.neutral{background:var(--soft);color:var(--muted)}.hg-switch-row{display:flex;align-items:center;gap:8px;font-weight:600!important}.hg-switch-row input{width:18px;height:18px}body.hg-large-text{font-size:112%}body.hg-reduce-motion *,body.hg-reduce-motion *::before,body.hg-reduce-motion *::after{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}body.hg-high-contrast{--border:#6b7280}body.hg-private-mode .account-name,body.hg-private-mode #settingsEmail{filter:blur(5px)}@media(max-width:1000px){.badge-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:620px){.badge-grid{grid-template-columns:repeat(2,1fr)}.hg-daily-task{grid-template-columns:auto 1fr}.hg-daily-action{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between}.hg-daily-head{flex-direction:column}}';document.head.appendChild(style);
}
function hook(){
 if(typeof window.toggleManualActivity==='function'&&!window.toggleManualActivity.__hgpro){var a=window.toggleManualActivity,w=function(){var before=typeof manualActivityStartedAt!=='undefined'&&!!manualActivityStartedAt,r=a.apply(this,arguments);if(before)setTimeout(function(){evaluate(true);renderProgressUI();},60);return r;};w.__hgpro=true;window.toggleManualActivity=w;}
 if(typeof window.savePlanItem==='function'&&!window.savePlanItem.__hgpro){var s=window.savePlanItem,sw=function(){var before=typeof loadHealthGoPlan==='function'?loadHealthGoPlan().length:0,r=s.apply(this,arguments),after=typeof loadHealthGoPlan==='function'?loadHealthGoPlan().length:0;if(after>before){evaluate(true);renderProgressUI();}return r;};sw.__hgpro=true;window.savePlanItem=sw;}
}
function init(){injectStyles();injectDaily();injectSettings();applySettings();renderSettings();hook();evaluate(false);renderProgressUI();setInterval(function(){refreshHealthGoStatus();evaluate(false);},30000);console.info('HealthGo Professional '+PRO_VERSION+': '+BADGES.length+' badge models loaded.');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();