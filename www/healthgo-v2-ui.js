(function(){
'use strict';
var Engine=window.HealthGoEngine, Services=window.HealthGoServices, Data=window.HealthGoData;
if(!Engine||!Services){window.HealthGoV2UI={ready:false};return;}
var backpackFilter='badges', challengeFilter='all', familyInviteHandled=false;
function q(s,r){return (r||document).querySelector(s)}
function qa(s,r){return Array.from((r||document).querySelectorAll(s))}
function el(tag,cls,value){var n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined&&value!==null)n.textContent=String(value);return n}
function btn(label,fn,secondary){var b=el('button','btn'+(secondary?' secondary':''),label);b.type='button';b.addEventListener('click',fn);return b}
function num(v){return typeof v==='number'&&Number.isFinite(v)?v:null}
function int(v){return num(v)===null?'Brak danych':Math.round(v).toLocaleString('pl-PL')}
function date(v){if(!v)return '—';var d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}):'—'}
function pct(v){v=num(v);return v===null?0:Math.max(0,Math.min(100,v))}
function emptyEngine(){try{return Engine.createState(null,new Date().toISOString())}catch(_){return null}}
function currentEngine(){return Services.state.engine||emptyEngine()}
function progress(value){var a=el('div','hg2-progress'),b=el('span');b.style.width=pct(value)+'%';a.appendChild(b);return a}
function empty(title,copy){var n=el('div','hg2-empty');n.append(el('strong','',title),el('span','',copy));return n}

function injectStyle(){
 if(q('#healthgoV2Style'))return;
 var s=el('style');s.id='healthgoV2Style';
 s.textContent=
 '.hg2-card{min-width:0;max-width:100%;box-sizing:border-box;border:1px solid var(--border);background:var(--card);border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(15,23,42,.04)}'+
 '.hg2-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:14px;min-width:0}.hg2-stack{display:grid;gap:14px;min-width:0}'+
 '.hg2-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:10px}.hg2-stat{padding:13px;border-radius:13px;background:var(--soft);min-width:0}.hg2-stat small{display:block;color:var(--muted);margin-bottom:5px}.hg2-stat b{font-size:20px;overflow-wrap:anywhere}'+
 '.hg2-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.hg2-toolbar button{white-space:nowrap}.hg2-achievement{display:grid;grid-template-columns:48px minmax(0,1fr);gap:12px}.hg2-icon{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--soft);font-size:24px}'+
 '.hg2-achievement h4,.hg2-challenge h4{margin:0 0 4px;font-size:14px}.hg2-meta{color:var(--muted);font-size:12px;line-height:1.45}.hg2-progress{height:7px;border-radius:999px;background:var(--soft);overflow:hidden;margin-top:9px}.hg2-progress span{display:block;height:100%;background:currentColor;border-radius:inherit}.hg2-rarity,.hg2-status,.hg2-permission{display:inline-flex;padding:3px 7px;border-radius:999px;background:var(--soft);font-size:10px;font-weight:800}'+
 '.hg2-challenge{display:grid;gap:8px}.hg2-challenge-head{display:flex;gap:10px;justify-content:space-between;align-items:flex-start}.hg2-member{display:flex;align-items:center;gap:11px;padding:11px 0;border-top:1px solid var(--border)}.hg2-member:first-child{border-top:0}.hg2-avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--soft);font-weight:850}.hg2-grow{min-width:0;flex:1}.hg2-grow b,.hg2-grow small{display:block;overflow-wrap:anywhere}.hg2-grow small{color:var(--muted);margin-top:2px}.hg2-permissions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}'+
 '.hg2-empty{text-align:center;padding:22px 12px;color:var(--muted)}.hg2-empty strong{display:block;color:var(--text);font-size:15px;margin-bottom:5px}.hg2-notification{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:13px 0;border-top:1px solid var(--border)}.hg2-notification:first-child{border-top:0}.hg2-unread{font-weight:750}.hg2-note{padding:11px 12px;border-radius:12px;background:var(--soft);color:var(--muted);font-size:12px;line-height:1.5}'+
 '.hg2-section-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.hg2-section-title h3{margin:0}.hg2-section-title p{margin:4px 0 0;color:var(--muted);font-size:12px}.hg2-dialog-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);display:grid;place-items:center;padding:18px;z-index:2000}.hg2-dialog{width:min(480px,100%);max-height:90vh;overflow:auto;background:var(--card);border:1px solid var(--border);border-radius:18px;padding:20px}.hg2-dialog input{width:100%;box-sizing:border-box;margin:10px 0}.hg2-dialog-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.hg2-dialog-open{overflow:hidden}'+
 '.hg2-family-shell{display:grid;gap:14px}.hg2-family-welcome{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:14px;align-items:stretch}.hg2-family-main{padding:22px;border-radius:18px;background:linear-gradient(145deg,#111827,#1f2937);color:#fff;min-width:0}.hg2-family-main h3{font-size:24px;margin:0 0 7px}.hg2-family-main p{margin:0;color:#d1d5db;line-height:1.55}.hg2-family-role-card{padding:18px;border-radius:18px;border:1px solid var(--border);background:var(--card);display:grid;gap:12px;align-content:start}.hg2-family-role-icon{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:var(--soft);font-size:24px}.hg2-family-role-card h4{margin:0;font-size:17px}.hg2-family-role-card p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}.hg2-family-role-pill{display:inline-flex;width:max-content;max-width:100%;padding:6px 10px;border-radius:999px;background:#ecfdf5;color:#047857;font-weight:850;font-size:11px}.hg2-family-action-card{display:grid;gap:13px}.hg2-family-action-card h3{margin:0}.hg2-family-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.hg2-family-actions .btn{min-height:40px}.hg2-family-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:2px}.hg2-family-step{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--border);border-radius:13px;background:var(--soft)}.hg2-family-step-num{width:28px;height:28px;flex:0 0 28px;border-radius:9px;background:#111827;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:900}.hg2-family-name{font-size:24px;font-weight:900;letter-spacing:-.4px}.hg2-family-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.hg2-family-invite{display:block;margin-top:12px;padding:16px;border:1px solid var(--border);border-radius:16px;background:var(--soft)}.hg2-family-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:25px;font-weight:900;letter-spacing:4px;margin:7px 0;overflow-wrap:anywhere}.hg2-family-member-card{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 0;border-top:1px solid var(--border)}.hg2-family-member-card:first-of-type{border-top:0}.hg2-family-member-card .hg2-avatar{width:44px;height:44px}.hg2-family-danger{margin-top:14px;padding-top:14px;border-top:1px solid var(--border)}.hg2-family-loading{padding:28px;text-align:center}.hg2-family-loading b{display:block;margin-bottom:5px}.hg2-family-warning{padding:12px 13px;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:12px;line-height:1.5}'+
 '@media(max-width:600px){.hg2-card{padding:14px}.hg2-summary{grid-template-columns:1fr 1fr}.hg2-notification{grid-template-columns:1fr}.hg2-family-welcome{grid-template-columns:1fr}.hg2-family-steps{grid-template-columns:1fr}.hg2-family-actions{justify-content:flex-start}.hg2-family-member-card{grid-template-columns:44px minmax(0,1fr)}.hg2-family-member-card>.btn{grid-column:1/-1;width:100%}}';
 document.head.appendChild(s);
}
function ensurePage(id,title,desc){
 var page=q('#'+id);if(page)return page;
 page=el('section','page');page.id=id;
 var hero=el('div','hero');hero.append(el('h2','',title),el('p','',desc));page.appendChild(hero);
 var main=q('main.main')||q('.main');if(main)main.appendChild(page);return page;
}
function addNav(){
 var nav=q('.sidebar .nav');
 [['family','👨‍👩‍👧','Rodzina']].forEach(function(item){
  if(!nav||nav.querySelector('[data-page="'+item[0]+'"]'))return;
  var b=el('button');b.dataset.page=item[0];b.append(item[1]+' ',el('span','',item[2]));b.addEventListener('click',function(){go(item[0])});nav.appendChild(b);
 });
 var sheet=q('#mobileMoreSheet');
 if(sheet&&!sheet.querySelector('[data-hg2-family]')){
  var family=btn('👨‍👩‍👧 Rodzina',function(){window.mobileGo?mobileGo('family'):go('family')},true);family.dataset.hg2Family='1';
  var settings=Array.from(sheet.children).find(function(x){return /Ustawienia/.test(x.textContent)});
  sheet.insertBefore(family,settings||null);
 }
}
function ensureCards(){
 var map={backpack:'.level-panel,.pack-summary,.badge-panel',challenges:'.level-panel,.challenge-panel',activity:'.activity-ring-card,.activity-data-card,.card',devices:'.card'};
 Object.keys(map).forEach(function(id){var page=q('#'+id);if(!page)return;var list=qa(map[id],page);list.forEach(function(x){x.classList.add('hg2-card')});if(!list.length)page.appendChild(empty('Brak danych','Ten ekran czeka na dane HealthGo.'))});
}
function ensureBackpackFilters(){
 var page=q('#backpack'),row=page&&q('.row',page);if(!row||row.dataset.hg2Extended)return;row.dataset.hg2Extended='1';
 [['limited','⏳ Limitowane'],['secret','◇ Sekretne'],['family','🏡 Rodzinne']].forEach(function(item){row.appendChild(btn(item[1],function(){backpackFilter=item[0];renderBackpack()},true))});
}
function renderBackpack(){
 var engine=currentEngine(),grid=q('#badgeGrid');if(!engine||!grid)return;
 ensureBackpackFilters();
 var all=Engine.viewAchievements(engine),items=all.filter(function(x){return x.category===backpackFilter});
 grid.replaceChildren();grid.classList.add('hg2-grid');grid.style.display='grid';
 items.forEach(function(item){
  var card=el('article','hg2-card hg2-achievement'),icon=el('div','hg2-icon',item.icon||'◇'),copy=el('div','hg2-grow');
  copy.append(el('h4','',item.name),el('div','hg2-meta',item.description||item.requirementText||''),el('div','hg2-meta',item.earned?'Zdobyto'+(item.earnedAt?' · '+date(item.earnedAt):''):(item.target===null?'Postęp ukryty':int(item.progress)+' / '+int(item.target))),progress(item.percent||0),el('span','hg2-rarity',({common:'Zwykła',rare:'Rzadka',epic:'Epicka',legendary:'Legendarna',mythic:'Mityczna'})[item.rarity]||item.rarity||''));card.append(icon,copy);grid.appendChild(card);
 });
 if(!items.length)grid.appendChild(empty('Ta kolekcja jest jeszcze pusta.','Nagrody pojawią się po spełnieniu prawdziwych wymagań.'));
 var earned=all.filter(function(x){return x.earned}).length;
 if(q('#earnedBadgeCount'))q('#earnedBadgeCount').textContent=String(earned);
 if(q('#badgeCounter'))q('#badgeCounter').textContent=earned+' / '+all.length;
 if(q('#backpackTitle'))q('#backpackTitle').textContent=({badges:'Odznaki',cups:'Puchary',sports:'Sportowe',special:'Specjalne',limited:'Limitowane',secret:'Sekretne',family:'Rodzinne'})[backpackFilter]||'Plecak';
}
window.showBackpackTab=function(kind,button){backpackFilter=kind||'badges';qa('.backpack-tab').forEach(function(x){x.classList.add('secondary')});if(button)button.classList.remove('secondary');renderBackpack()};

function ensureChallengeFilters(){
 var panel=q('#challenges .challenge-panel');if(!panel||q('#hg2ChallengeFilters',panel))return;
 var bar=el('div','hg2-toolbar');bar.id='hg2ChallengeFilters';
 [['all','Wszystkie'],['daily','Dzienne'],['weekly','Tygodniowe'],['monthly','Miesięczne'],['sports','Sportowe'],['series','Serie'],['seasonal','Sezonowe'],['special','Specjalne']].forEach(function(item){bar.appendChild(btn(item[1],function(){challengeFilter=item[0];renderChallenges()},item[0]!==challengeFilter))});
 panel.insertBefore(bar,q('#realChallengeList',panel));
}
function renderChallenges(){
 var engine=currentEngine(),list=q('#realChallengeList');if(!engine||!list)return;
 ensureChallengeFilters();var items=Engine.viewChallenges(engine,new Date().toISOString()).filter(function(x){return challengeFilter==='all'||x.category===challengeFilter});
 list.replaceChildren();list.classList.add('hg2-grid');
 items.forEach(function(item){
  var card=el('article','hg2-card hg2-challenge'),head=el('div','hg2-challenge-head'),left=el('div','hg2-grow');
  left.append(el('h4','',item.name||item.title),el('div','hg2-meta',item.description||item.desc||''));head.append(left,el('span','hg2-status',item.status==='completed'?'Ukończone':item.status==='locked'?'Zablokowane':item.status==='expired'?'Zakończone':'Aktywne'));
  card.append(head,el('div','hg2-meta',(item.target===null?'Postęp ukryty':int(item.progress)+' / '+int(item.target))+' · '+int(item.xpReward||item.xp||0)+' XP'),progress(item.percent||0));
  if(item.confirmationRequired&&item.status==='active')card.appendChild(btn('Potwierdź wykonanie',function(){Services.record('DAILY_TASK_CONFIRMED',{taskId:item.definitionId,day:new Date().toISOString().slice(0,10)},'daily-confirm:'+item.id)},true));
  list.appendChild(card);
 });
 if(!items.length)list.appendChild(empty('Brak wyzwań w tej kategorii.','HealthGo nie tworzy fikcyjnego postępu.'));
 var level=Engine.getLevel(engine.totalXp||0);
 if(q('#levelValue'))q('#levelValue').textContent=level.level;if(q('#xpCurrent'))q('#xpCurrent').textContent=level.xp+' XP';if(q('#xpRequired'))q('#xpRequired').textContent=level.needed?level.needed+' XP':'MAX';if(q('#xpProgress'))q('#xpProgress').style.width=level.percent+'%';if(q('#levelCopy'))q('#levelCopy').textContent=level.needed?'Do następnego poziomu brakuje '+level.remaining+' XP.':'Maksymalny poziom.';
}
function renderActivity(){
 var s=Services.state,h=s.health,page=q('#activity');if(!page)return;ensureCards();
 var cards=qa('.activity-metric',page),values=[h&&num(h.steps)!==null?int(h.steps):'Brak danych',h&&num(h.distanceKm)!==null?Number(h.distanceKm).toLocaleString('pl-PL',{maximumFractionDigits:2})+' km':'Brak danych',h&&num(h.heartRate)!==null?Math.round(h.heartRate)+' bpm':'Brak danych',h&&num(h.sleepMinutes)!==null?Math.floor(h.sleepMinutes/60)+' h '+Math.round(h.sleepMinutes%60)+' min':'Brak danych'];
 cards.slice(0,4).forEach(function(c,i){var b=q('b',c);if(b)b.textContent=values[i]});
 var box=q('#hg2PersonalBests',page);if(!box){box=el('section','hg2-card');box.id='hg2PersonalBests';page.appendChild(box)}box.replaceChildren();
 var title=el('div','hg2-section-title'),copy=el('div');copy.append(el('h3','','Rekordy i źródło'),el('p','','Informacyjne podsumowanie prawdziwych danych. HealthGo nie stawia diagnoz.'));title.appendChild(copy);box.appendChild(title);
 var bests=currentEngine()?Engine.personalBests(currentEngine()):{},grid=el('div','hg2-summary');
 [['Najlepszy dzień',bests.bestDay?int(bests.bestDay.steps)+' kroków':'Brak danych'],['Najlepszy tydzień',bests.bestWeek?int(bests.bestWeek.steps)+' kroków':'Brak danych'],['Najdłuższa seria',bests.longestStreak?bests.longestStreak+' dni':'Brak danych'],['Źródło',h&&h.source?h.source:'Brak połączonego źródła']].forEach(function(item){var c=el('div','hg2-stat');c.append(el('small','',item[0]),el('b','',item[1]));grid.appendChild(c)});box.appendChild(grid);
}
function renderDevices(){
 var h=Services.state.health;ensureCards();
 if(q('#deviceSyncTitle'))q('#deviceSyncTitle').textContent=h?(h.source||'Połączone źródło'):'Brak połączonego źródła';
 if(q('#deviceSyncText'))q('#deviceSyncText').textContent=h?'HealthGo pokazuje ostatni snapshot otrzymany z urządzenia.':'Połącz Apple Health lub Health Connect w aplikacji mobilnej.';
 if(q('#deviceSyncTime'))q('#deviceSyncTime').textContent=h&&(h.updatedAt||h.timestamp)?'Ostatnia synchronizacja: '+date(h.updatedAt||h.timestamp):'Nigdy nie synchronizowano';
}
function familyPage(){var p=ensurePage('family','👨‍👩‍👧 HealthGo Family','Twórz rodzinę, zapraszaj bliskich i zarządzaj członkami w jednym miejscu.');if(!q('#hg2FamilyRoot',p)){var r=el('div','hg2-stack');r.id='hg2FamilyRoot';p.appendChild(r)}return p}
function notificationPage(){var p=ensurePage('notifications','🔔 Powiadomienia','Osiągnięcia, wyzwania, synchronizacja, urządzenia i zmiany rodzinne.');if(!q('#hg2NotificationRoot',p)){var r=el('div','hg2-card');r.id='hg2NotificationRoot';p.appendChild(r)}return p}
function scopes(value){var names={HEALTH_ACTIVITY:'Aktywność',HEALTH_SLEEP:'Sen',HEALTH_HEART_RATE:'Tętno',DEVICE_STATUS:'Stan urządzenia',LOCATION_APPROXIMATE:'Lokalizacja przybliżona',LOCATION_PRECISE:'Lokalizacja dokładna',ACHIEVEMENTS:'Osiągnięcia',CHALLENGE_PROGRESS:'Wyzwania',NOTIFICATIONS:'Powiadomienia'};return Object.keys(value||{}).filter(function(k){return value[k]===true}).map(function(k){return names[k]||k})}
function familyRole(role){return role==='guardian'?'Rodzic / opiekun':role==='child'?'Dziecko':role==='member'?'Członek':'Członek'}
function renderFamily(){
 var page=familyPage(),root=q('#hg2FamilyRoot',page),s=Services.state,f=s.family||{members:[],permissions:[],locations:[]};
 root.className='hg2-family-shell';root.replaceChildren();

 if(!s.profile){
  var loading=el('section','hg2-card hg2-family-loading');
  loading.append(el('b','',s.loading?'Wczytuję typ konta…':'Nie udało się odczytać profilu.'),el('span','hg2-meta',s.loading?'Za chwilę pokażę właściwe opcje Rodziny.':'Odśwież HealthGo i zaloguj się ponownie, jeśli problem nie zniknie.'));
  root.appendChild(loading);return;
 }

 var accountType=s.profile.accountType||'standard';
 var role=f.callerRole||(accountType==='guardian'?'guardian':accountType==='child'?'child':'member');
 var roleLabel=accountType==='guardian'?'Rodzic / opiekun':accountType==='child'?'Dziecko':'Konto zwykłe';
 var roleIcon=accountType==='guardian'?'🛡️':accountType==='child'?'🧸':'👤';

 var welcome=el('div','hg2-family-welcome');
 var intro=el('section','hg2-family-main');
 intro.append(el('h3','',f.id?(f.name||'Twoja rodzina'):'HealthGo Family'),el('p','',f.id?'Rodzina jest połączona z Twoim kontem. Tutaj zarządzasz członkami, zaproszeniami i uprawnieniami.':'Rodzic lub opiekun tworzy rodzinę. Pozostałe konta dołączają bezpiecznym kodem rodzinnym.'));
 var roleCard=el('section','hg2-family-role-card');
 roleCard.append(el('div','hg2-family-role-icon',roleIcon),el('span','hg2-family-role-pill',roleLabel),el('h4','',s.profile.nickname||'Konto HealthGo'));
 if(accountType==='guardian')roleCard.appendChild(el('p','','To konto może utworzyć HealthGo Family, generować zaproszenia i zarządzać uprawnieniami dziecka.'));
 else if(accountType==='child')roleCard.appendChild(el('p','','To konto może dołączyć do rodziny kodem od rodzica lub opiekuna. Nie może samo utworzyć rodziny.'));
 else roleCard.appendChild(el('p','','To konto może dołączyć do istniejącej rodziny. Tworzenie rodziny jest dostępne dla konta Rodzica / Opiekuna.'));
 welcome.append(intro,roleCard);root.appendChild(welcome);

 if(!f.id){
  var action=el('section','hg2-card hg2-family-action-card');
  if(accountType==='guardian'){
   action.append(el('div','hg2-section-title'));
   var title=q('.hg2-section-title',action),copy=el('div');
   copy.append(el('h3','','Utwórz swoją rodzinę'),el('p','','Nadaj jej nazwę. Po utworzeniu od razu dostaniesz możliwość wygenerowania kodu rodzinnego dla kolejnej osoby.'));
   title.appendChild(copy);
   var actions=el('div','hg2-family-actions');
   actions.appendChild(btn('＋ Utwórz rodzinę',createFamily,false));
   action.appendChild(actions);
  }else{
   var title2=el('div','hg2-section-title'),copy2=el('div');
   copy2.append(el('h3','','Dołącz do rodziny'),el('p','',accountType==='child'?'Poproś rodzica lub opiekuna o kod rodzinny.':'Wpisz kod zaproszenia otrzymany od opiekuna rodziny.'));
   title2.appendChild(copy2);action.appendChild(title2);
   var actions2=el('div','hg2-family-actions');actions2.appendChild(btn('Dołącz do rodziny',joinFamily,false));action.appendChild(actions2);
  }

  var steps=el('div','hg2-family-steps');
  var stepData=accountType==='guardian'
   ?[['1','Utwórz rodzinę','Nadaj jej nazwę.'],['2','Wygeneruj kod','HealthGo utworzy kod rodzinny.'],['3','Dodaj członka','Druga osoba wpisuje kod i dołącza.']]
   :[['1','Odbierz kod','Kod daje rodzic lub opiekun.'],['2','Wpisz kod','HealthGo sprawdzi zaproszenie.'],['3','Gotowe','Konto pojawi się w rodzinie.']];
  stepData.forEach(function(x){var row=el('div','hg2-family-step'),n=el('div','hg2-family-step-num',x[0]),txt=el('div','hg2-grow');txt.append(el('b','',x[1]),el('small','',x[2]));row.append(n,txt);steps.appendChild(row)});
  action.appendChild(steps);
  if(accountType==='guardian')action.appendChild(el('div','hg2-note','Na koncie Rodzica / Opiekuna przycisk „Dołącz” nie jest pokazywany jako główna akcja. To konto tworzy własną rodzinę.'));
  root.appendChild(action);return;
 }

 var summary=el('section','hg2-card'),summaryHead=el('div','hg2-section-title'),left=el('div'),right=el('div','hg2-family-actions');
 left.append(el('div','hg2-family-name',f.name||'Moja rodzina'),el('div','hg2-meta','HealthGo Family · prywatna przestrzeń rodzinna'));
 var badges=el('div','hg2-family-badges');
 badges.append(el('span','tag','● Połączono'),el('span','hg2-status',(f.members||[]).length+' '+((f.members||[]).length===1?'członek':'członków')),el('span','hg2-status',familyRole(role)));
 left.appendChild(badges);summaryHead.append(left,right);summary.appendChild(summaryHead);
 if(role==='guardian')right.appendChild(btn('＋ Zaproś osobę',createInvite,false));
 right.appendChild(btn('↻ Odśwież',function(){Services.initialize()},true));
 root.appendChild(summary);

 var members=el('section','hg2-card'),mh=el('div','hg2-section-title'),mc=el('div');
 mc.append(el('h3','','Członkowie rodziny'),el('p','','Każde konto ma własną rolę. Opiekun może zarządzać udostępnianiem statystyk innych członków rodziny.'));
 mh.appendChild(mc);members.appendChild(mh);
 var familyMembers=f.members||[];
 if(!familyMembers.length)members.appendChild(empty('Brak członków','Wygeneruj zaproszenie, aby dodać kolejną osobę.'));
 familyMembers.forEach(function(m){
  var uid=m.uid||m.id||'',row=el('div','hg2-family-member-card'),avatar=el('div','hg2-avatar',(m.nickname||m.displayName||'H').slice(0,1).toUpperCase()),memberCopy=el('div','hg2-grow');
  var name=m.nickname||m.displayName||(uid===s.uid?'Ty':'Członek rodziny');
  memberCopy.append(el('b','',name+(uid===s.uid?' · Ty':'')),el('small','',(m.joinedAt?'Dołączono '+date(m.joinedAt)+' · ':'')+familyRole(m.role)));
  var grant=(f.permissions||[]).find(function(p){return p.childUid===uid&&p.guardianUid===s.uid});
  if(grant){var ps=el('div','hg2-permissions');scopes(grant.scopes).forEach(function(x){ps.appendChild(el('span','hg2-permission',x))});if(ps.childNodes.length)memberCopy.appendChild(ps)}
  row.append(avatar,memberCopy);
  if(uid!==s.uid){
   row.appendChild(btn('Statystyki',async function(){
    if(role!=='guardian'){
      await dialog('Statystyki rodziny','Statystyki innej osoby może otworzyć konto Rodzica / Opiekuna, jeśli ta osoba ma udostępnione odpowiednie dane.');
      return;
    }
    await viewFamilyMemberStats(uid);
   },false));
   if(role==='guardian'&&m.role!=='guardian')row.appendChild(btn('Uprawnienia',function(){editPermissions(uid)},true));
  }
  members.appendChild(row);
 });
 root.appendChild(members);

 var locations=el('section','hg2-card'),lh=el('div','hg2-section-title'),lc=el('div');
 lc.append(el('h3','','Lokalizacja członków'),el('p','','HealthGo pokazuje nazwę użytkownika i stan udostępniania — bez wyświetlania identyfikatora konta.'));
 lh.appendChild(lc);locations.appendChild(lh);
 var locationRows=f.locations||[];
 if(!locationRows.length)locations.appendChild(empty('Brak udostępnionej lokalizacji','Gdy członek rodziny udostępni lokalizację za zgodą urządzenia, pojawi się tutaj jego nazwa.'));
 locationRows.forEach(function(loc){
  var row=el('div','hg2-family-member-card'),avatar=el('div','hg2-avatar',(loc.nickname||'U').slice(0,1).toUpperCase()),copy=el('div','hg2-grow');
  copy.append(el('b','',loc.nickname||'Użytkownik HealthGo'),el('small','',(loc.timestamp?'Udostępniono '+date(loc.timestamp):'Lokalizacja udostępniona')+(loc.device?' · '+loc.device:'')));
  row.append(avatar,copy);locations.appendChild(row);
 });
 var locSettings=s.locationSettings||{enabled:false,mode:'off'},locActions=el('div','hg2-family-actions');
 if(!locSettings.enabled||locSettings.mode==='off'){
  locActions.append(
   btn('Włącz przybliżoną',function(){setLocationMode('approximate')},true),
   btn('Włącz dokładną',function(){setLocationMode('precise')},false)
  );
 }else{
  var activeMode=locSettings.mode==='precise'?'Dokładna':'Przybliżona';
  locations.appendChild(el('div','hg2-note','Aktualny tryb lokalizacji: '+activeMode+'.'));
  locActions.append(
   btn('Udostępnij moją lokalizację',shareCurrentLocation,false),
   btn(locSettings.mode==='precise'?'Zmień na przybliżoną':'Zmień na dokładną',function(){setLocationMode(locSettings.mode==='precise'?'approximate':'precise')},true),
   btn('Wyłącz lokalizację',function(){setLocationMode('off')},true)
  );
 }
 locations.appendChild(locActions);
 root.appendChild(locations);

 var safety=el('section','hg2-card'),sh=el('div','hg2-section-title'),sc=el('div');
 sc.append(el('h3','','Kod rodzinny'),el('p','',role==='guardian'?'Wygeneruj prosty kod rodzinny. Kod wygasa automatycznie po 30 minutach.':'Kod rodzinny tworzy Rodzic / Opiekun.'));
 sh.appendChild(sc);safety.appendChild(sh);
 if(role==='guardian'){
  var saved=readFamilyInvite();
  if(saved){
   var inviteBox=el('div','hg2-family-invite'),inviteCopy=el('div');
   inviteCopy.append(el('small','hg2-meta','Aktualny kod rodzinny'),el('div','hg2-family-code',saved.code),el('p','hg2-meta','Ważny do '+date(saved.expiresAt)+'. Przekaż ten kod osobie, która ma dołączyć.'));
   var inviteTools=el('div','hg2-toolbar');
   inviteTools.append(btn('Kopiuj kod',function(){copyText(saved.code)},true),btn('Wygeneruj nowy kod',createInvite,false));
   inviteCopy.appendChild(inviteTools);inviteBox.appendChild(inviteCopy);safety.appendChild(inviteBox);
  }else{
   var inviteActions=el('div','hg2-family-actions');inviteActions.appendChild(btn('Wygeneruj kod rodzinny',createInvite,false));safety.appendChild(inviteActions);
  }
 }else{
  safety.appendChild(el('div','hg2-note','Aby dodać kolejną osobę, poproś opiekuna tej rodziny o wygenerowanie kodu rodzinnego.'));
 }
 safety.appendChild(el('div','hg2-note','Kod rodzinny służy tylko do dołączenia konta do rodziny. Nie udostępnia automatycznie danych zdrowotnych ani lokalizacji.'));
 var danger=el('div','hg2-family-danger');danger.appendChild(btn('Opuść rodzinę',leaveFamily,true));safety.appendChild(danger);root.appendChild(safety);
}
function renderNotifications(){
 var page=notificationPage(),root=q('#hg2NotificationRoot',page),items=Services.state.notifications||[];root.replaceChildren();var h=el('div','hg2-section-title'),copy=el('div');copy.append(el('h3','','Centrum powiadomień'),el('p','',items.length?items.length+' zapisanych powiadomień':'Wszystko jest aktualne.'));h.appendChild(copy);root.appendChild(h);
 if(!items.length){root.appendChild(empty('Brak powiadomień','Osiągnięcia, wyzwania, synchronizacja i zmiany Family pojawią się tutaj.'));return}
 items.forEach(function(item){var row=el('div','hg2-notification'+(item.read?'':' hg2-unread')),c=el('div','hg2-grow');c.append(el('b','',item.title||item.type||'HealthGo'),el('small','',(item.message||item.body||'')+(item.createdAt?' · '+date(item.createdAt):'')));row.appendChild(c);if(!item.read)row.appendChild(btn('Przeczytane',function(){Services.markNotificationRead(item.id)},true));root.appendChild(row)});
}
function ensureSettings(){
 var content=q('.settings-content'),menu=q('.settings-menu');if(!content||!menu)return;
 if(!q('#settingsFamily')){var f=el('section','settings-section hg2-card');f.id='settingsFamily';f.append(el('h3','','Rodzina i bezpieczeństwo'),el('p','','Zarządzaj relacją rodzinną, uprawnieniami i lokalizacją.'));var fb=el('div');fb.id='hg2SettingsFamilyBody';f.appendChild(fb);content.appendChild(f);var bf=el('button','','Rodzina');bf.type='button';bf.addEventListener('click',function(){f.scrollIntoView({behavior:'smooth',block:'start'})});menu.appendChild(bf)}
 if(!q('#settingsSecurity')){var s=el('section','settings-section hg2-card');s.id='settingsSecurity';s.append(el('h3','','Bezpieczeństwo'),el('p','','Rzeczywisty stan logowania i sesji bez sztucznego wyniku bezpieczeństwa.'));var sb=el('div');sb.id='hg2SecurityBody';s.appendChild(sb);content.appendChild(s);var bs=el('button','','Bezpieczeństwo');bs.type='button';bs.addEventListener('click',function(){s.scrollIntoView({behavior:'smooth',block:'start'})});menu.appendChild(bs)}
}
function renderSettings(){
 ensureSettings();var s=Services.state,f=q('#hg2SettingsFamilyBody'),sec=q('#hg2SecurityBody');
 if(f){f.replaceChildren();var g=el('div','hg2-summary');[['Status rodziny',s.family&&s.family.id?'Połączono':'Niepołączono'],['Typ konta',s.profile&&s.profile.accountType==='child'?'Konto dziecka':s.profile&&s.profile.accountType==='guardian'?'Rodzic / opiekun':'Konto standardowe'],['Lokalizacja',s.locationSettings&&s.locationSettings.enabled?s.locationSettings.mode:'Wyłączona']].forEach(function(x){var c=el('div','hg2-stat');c.append(el('small','',x[0]),el('b','',x[1]));g.appendChild(c)});f.append(g,btn('Otwórz HealthGo Family',function(){go('family')},true))}
 if(sec){sec.replaceChildren();var p=(s.session&&s.session.providers||[]).map(function(x){return x.replace('.com','')}).join(', ')||'Brak danych',g2=el('div','hg2-summary');[['Metody logowania',p],['MFA',s.session&&s.session.mfaFactors?'Włączone · '+s.session.mfaFactors:'Nie skonfigurowano'],['Sesja',s.uid?'Aktywna':'Wylogowano']].forEach(function(x){var c=el('div','hg2-stat');c.append(el('small','',x[0]),el('b','',x[1]));g2.appendChild(c)});sec.append(g2,el('div','hg2-note','Dane Family i XP są egzekwowane przez backend i reguły dostępu. HealthGo nie pokazuje funkcji 2FA/passkey jako aktywnych, jeśli dostawca ich naprawdę nie skonfigurował.'))}
}
function dialog(title,copy,field){
 return new Promise(function(resolve){var back=el('div','hg2-dialog-backdrop'),box=el('div','hg2-dialog');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.append(el('h3','',title),el('p','',copy));var input=null;if(field){input=el('input');input.type='text';input.placeholder=field.placeholder||'';input.maxLength=field.maxLength||80;box.appendChild(input)}var actions=el('div','hg2-dialog-actions');function close(v){back.remove();document.body.classList.remove('hg2-dialog-open');resolve(v)}actions.append(btn('Anuluj',function(){close(null)},true),btn(field?'Dalej':'OK',function(){close(input?input.value.trim():true)},false));box.appendChild(actions);back.appendChild(box);document.body.appendChild(back);document.body.classList.add('hg2-dialog-open');if(input)setTimeout(function(){input.focus()},0)});
}
async function createFamily(){
 var name=await dialog('Utwórz rodzinę','Nadaj rodzinie krótką nazwę, którą zobaczą jej członkowie.',{placeholder:'Np. Rodzina Kosteckich',maxLength:60});
 if(!name)return;
 try{await Services.call('createFamily',{name:name});await Services.initialize();await dialog('Rodzina utworzona','Gotowe. Teraz możesz wygenerować kod rodzinny i zaprosić kolejną osobę.')}catch(e){await dialog('Nie udało się utworzyć rodziny',e.message)}
}
async function copyText(value){
 try{await navigator.clipboard.writeText(value);return true}catch(_){}
 try{var t=document.createElement('textarea');t.value=value;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();var ok=document.execCommand('copy');t.remove();return ok}catch(_){return false}
}
async function inviteDialog(r){
 return new Promise(function(resolve){
  var back=el('div','hg2-dialog-backdrop'),box=el('div','hg2-dialog');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
  var code=String(r.code||''),expires=r.expiresAt?date(r.expiresAt):'za około 30 minut';
  box.append(el('h3','','🔑 Kod rodzinny'),el('p','','Przekaż ten kod osobie, która ma dołączyć do rodziny. Kod jest jednorazowy i wygasa '+expires+'.'));
  var wrap=el('div','hg2-family-invite'),copy=el('div');
  copy.append(el('small','hg2-meta','Kod rodzinny'),el('div','hg2-family-code',code),el('p','hg2-meta','Druga osoba wpisuje ten kod w HealthGo → Rodzina → Dołącz do rodziny.'));
  var tools=el('div','hg2-toolbar');tools.append(btn('Kopiuj kod',async function(){await copyText(code);},true));
  copy.appendChild(tools);wrap.appendChild(copy);box.appendChild(wrap);
  var actions=el('div','hg2-dialog-actions');function close(){back.remove();document.body.classList.remove('hg2-dialog-open');resolve(true)}
  actions.append(btn('Gotowe',close,false));box.appendChild(actions);back.appendChild(box);document.body.appendChild(back);document.body.classList.add('hg2-dialog-open');
 });
}
function familyInviteStorageKey(){return 'healthgo_family_invite_'+(Services.state.uid||'signed-out')}
function readFamilyInvite(){try{var x=JSON.parse(localStorage.getItem(familyInviteStorageKey())||'null');if(!x||!x.code||!x.expiresAt)return null;if(new Date(x.expiresAt).getTime()<=Date.now()){localStorage.removeItem(familyInviteStorageKey());return null}return x}catch(_){return null}}
function saveFamilyInvite(value){try{localStorage.setItem(familyInviteStorageKey(),JSON.stringify(value))}catch(_){}}
async function createInvite(){try{var r=await Services.call('createFamilyInvite',{});if(!r||!r.code)throw new Error('Nie udało się utworzyć kodu.');saveFamilyInvite({code:r.code,expiresAt:r.expiresAt});renderFamily();await inviteDialog(r)}catch(e){await dialog('Nie udało się utworzyć zaproszenia',e.message)}}
async function joinFamily(){
 var code=await dialog('Dołącz do rodziny','Wpisz kod rodzinny otrzymany od rodzica lub opiekuna.',{placeholder:'Kod rodzinny',maxLength:32});
 if(!code)return;
 try{await Services.call('acceptFamilyInvite',{code:code});await Services.initialize();await dialog('Dołączono do rodziny','Gotowe. To konto jest teraz członkiem HealthGo Family.')}catch(e){await dialog('Nie udało się połączyć konta',e.message)}
}
async function leaveFamily(){
 var ok=await dialog('Opuścić rodzinę?','Twoje konto przestanie należeć do tej rodziny. Jeśli jesteś jedynym opiekunem, a w rodzinie są inni członkowie, najpierw trzeba dodać drugiego opiekuna.');
 if(!ok)return;
 try{await Services.call('leaveFamily',{});await Services.initialize()}catch(e){await dialog('Nie udało się opuścić rodziny',e.message)}
}
async function consumeFamilyInviteFromUrl(){
 if(familyInviteHandled||!Services.state.uid)return;
 var code='';try{code=new URL(location.href).searchParams.get('family_invite')||''}catch(_){}
 if(!code)return;familyInviteHandled=true;
 try{
  if(history&&history.replaceState){var u=new URL(location.href);u.searchParams.delete('family_invite');history.replaceState(null,'',u.pathname+(u.search||'')+(u.hash||''))}
  if(Services.state.family&&Services.state.family.id){await dialog('Masz już rodzinę','To konto należy już do HealthGo Family.');return}
  var ok=await dialog('Dołączyć do rodziny?','Ten kod zawiera zaproszenie do HealthGo Family.');
  if(!ok)return;
  await Services.call('acceptFamilyInvite',{code:code});await Services.initialize();go('family');await dialog('Dołączono do rodziny','Gotowe. Zaproszenie zostało wykorzystane.');
 }catch(e){await dialog('Zaproszenie nie działa',e.message)}
}
async function setLocationMode(mode){try{await Services.call('updateLocationSettings',{enabled:mode!=='off',mode:mode,familySharing:mode!=='off'});await Services.initialize()}catch(e){await dialog('Nie udało się zmienić lokalizacji',e.message)}}
function familyHealthValue(value,suffix){
 return value==null||value===''?'Brak danych':String(Math.round(Number(value)))+(suffix||'');
}
async function viewFamilyMemberStats(memberUid){
 var s=Services.state,f=s.family||{},member=(f.members||[]).find(function(m){return (m.uid||m.id)===memberUid});
 if(!member){await dialog('Nie znaleziono użytkownika','Odśwież HealthGo i spróbuj ponownie.');return}
 try{
  var data=await Services.call('getFamilyMemberHealth',{memberUid:memberUid}),perms=data&&data.permissions||{};
  await new Promise(function(resolve){
   var back=el('div','hg2-dialog-backdrop'),box=el('div','hg2-dialog');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
   box.append(el('h3','', '📊 '+(data.nickname||member.nickname||'Użytkownik HealthGo')),
              el('p','', 'Pokazuję wyłącznie dane udostępnione temu opiekunowi w HealthGo Family.'));
   var grid=el('div','hg2-stats');
   if(perms.activity){
    [['Kroki',familyHealthValue(data.steps,'')],['Dystans',data.distanceMeters==null?'Brak danych':(Number(data.distanceMeters)/1000).toFixed(1)+' km'],['Aktywność',familyHealthValue(data.activeMinutes,' min')]].forEach(function(item){
      var card=el('div','hg2-stat');card.append(el('small','',item[0]),el('b','',item[1]));grid.appendChild(card);
    });
   }
   if(perms.sleep){
    var sleep=el('div','hg2-stat');sleep.append(el('small','','Sen'),el('b','',familyHealthValue(data.sleepMinutes,' min')));grid.appendChild(sleep);
   }
   if(perms.heartRate){
    var heart=el('div','hg2-stat');heart.append(el('small','','Tętno'),el('b','',familyHealthValue(data.heartRate,' bpm')));grid.appendChild(heart);
   }
   if(!grid.childNodes.length)box.appendChild(el('div','hg2-note','Brak udostępnionych statystyk. Włącz odpowiednie uprawnienia dla tego członka rodziny.'));
   else box.appendChild(grid);
   if(data.activityDate||data.updatedAt)box.appendChild(el('div','hg2-meta','Dane z '+(data.activityDate||date(data.updatedAt))+(data.source?' · '+data.source:'')));
   var actions=el('div','hg2-dialog-actions');
   function close(){back.remove();document.body.classList.remove('hg2-dialog-open');resolve()}
   actions.append(btn('Zamknij',close,true));box.appendChild(actions);back.appendChild(box);document.body.appendChild(back);document.body.classList.add('hg2-dialog-open');
  });
 }catch(e){await dialog('Nie udało się pobrać statystyk',e.message)}
}
async function editPermissions(childUid,revokeOnly,knownGrant){
 var s=Services.state,grant=knownGrant||(s.family.permissions||[]).find(function(p){return p.childUid===childUid&&p.guardianUid===s.uid})||{};
 var values=Object.assign({},grant.scopes||{}),labels={HEALTH_ACTIVITY:'Aktywność',HEALTH_SLEEP:'Sen',HEALTH_HEART_RATE:'Tętno',DEVICE_STATUS:'Stan urządzenia',LOCATION_APPROXIMATE:'Lokalizacja przybliżona',LOCATION_PRECISE:'Lokalizacja dokładna',CHALLENGE_PROGRESS:'Wyzwania',ACHIEVEMENTS:'Osiągnięcia',NOTIFICATIONS:'Powiadomienia'};
 await new Promise(function(resolve){var back=el('div','hg2-dialog-backdrop'),box=el('div','hg2-dialog');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.append(el('h3','',revokeOnly?'Ogranicz udostępnianie':'Uprawnienia członka'),el('p','',revokeOnly?'Możesz wyłączyć dostęp do wybranych danych. Włączenie nowego dostępu wymaga opiekuna.':'Wybierz dane, które ten opiekun może zobaczyć. Lokalizacja urządzenia nadal musi być osobno włączona przez użytkownika.'));
  Object.keys(labels).forEach(function(key){var line=el('label','hg2-member'),input=el('input');input.type='checkbox';input.checked=values[key]===true;if(revokeOnly&&!input.checked)input.disabled=true;var copy=el('div','hg2-grow');copy.append(el('b','',labels[key]),el('small','',key.indexOf('LOCATION_')===0?'Lokalizacja nie uruchamia się potajemnie; telefon musi mieć zgodę i aktywne udostępnianie.':'Dostęp można później cofnąć.'));line.append(input,copy);box.appendChild(line);input.addEventListener('change',function(){values[key]=input.checked})});
  var actions=el('div','hg2-dialog-actions');function close(v){back.remove();document.body.classList.remove('hg2-dialog-open');resolve(v)}actions.append(btn('Anuluj',function(){close(false)},true),btn('Zapisz',async function(){try{await Services.call('updateFamilyPermissions',{childUid:childUid,guardianUid:grant.guardianUid||s.uid,scopes:values});close(true);await Services.initialize()}catch(e){var note=el('div','hg2-note',e.message);box.insertBefore(note,actions)}},false));box.appendChild(actions);back.appendChild(box);document.body.appendChild(back);document.body.classList.add('hg2-dialog-open');
 });
}
async function shareCurrentLocation(){
 var settings=Services.state.locationSettings||{};if(!settings.enabled||!['approximate','precise'].includes(settings.mode)){await dialog('Lokalizacja jest wyłączona','Najpierw wybierz tryb udostępniania lokalizacji.');return}
 if(!navigator.geolocation){await dialog('Lokalizacja niedostępna','To urządzenie nie udostępnia lokalizacji przeglądarce.');return}
 try{var position=await new Promise(function(resolve,reject){navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:settings.mode==='precise',timeout:12000,maximumAge:30000})});var payload={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracyMeters:position.coords.accuracy,device:navigator.userAgent&&/iPhone|iPad/i.test(navigator.userAgent)?'iPhone':/Android/i.test(navigator.userAgent)?'Android':'Urządzenie HealthGo'};if(settings.mode==='approximate'&&Data&&Data.coarsenLocation)payload=Object.assign(payload,Data.coarsenLocation(payload));await Services.call('publishLocation',payload);await dialog('Lokalizacja zaktualizowana','HealthGo zapisał tylko lokalizację dozwoloną przez wybrany tryb.');await Services.initialize()}catch(_){await dialog('Nie udało się pobrać lokalizacji','Sprawdź uprawnienia lokalizacji urządzenia i spróbuj ponownie.')}
}
function renderPresentationCards(){
 var page=q('#start');if(!page)return;
 var box=q('#hg2PresentationCards',page);
 if(!box){box=el('section','hg2-grid');box.id='hg2PresentationCards';box.style.marginTop='14px';page.appendChild(box)}
 box.replaceChildren();
 var engine=currentEngine(),level=engine?Engine.getLevel(engine.totalXp||0):{level:1},challenges=engine?Engine.viewChallenges(engine,new Date().toISOString()):[];
 var completed=challenges.filter(function(x){return x.status==='completed'}).length;
 var score=Math.min(100,Math.round(Math.min(40,(level.level-1)*4)+Math.min(40,completed*8)+(Services.state.health?20:0)));
 var scoreCard=el('article','hg2-card'),scoreHead=el('div','hg2-section-title'),scoreCopy=el('div');
 scoreCopy.append(el('h3','','✨ HealthGo Score'),el('p','','Wynik postępu w aplikacji — poziom, ukończone wyzwania i synchronizacja. To nie jest ocena zdrowia ani wyglądu.'));
 scoreHead.appendChild(scoreCopy);scoreCard.append(scoreHead,el('div','hg2-stat'));q('.hg2-stat',scoreCard).append(el('small','','Dzisiejszy postęp'),el('b','',score+' / 100'),progress(score));box.appendChild(scoreCard);
 var sos=el('article','hg2-card'),sosHead=el('div','hg2-section-title'),sosCopy=el('div');sosCopy.append(el('h3','','🆘 SOS'),el('p','','Szybki ekran pomocy. HealthGo nie udaje, że wysłał alarm, jeśli telefon tego nie potwierdzi.'));sosHead.appendChild(sosCopy);sos.append(sosHead,btn('Otwórz SOS',async function(){await dialog('SOS — pomoc','Jeśli jesteś w bezpośrednim niebezpieczeństwie, skontaktuj się z numerem alarmowym 112 albo z zaufaną osobą dorosłą. HealthGo nie wysłał automatycznie żadnej wiadomości.');},false));box.appendChild(sos);
}
function renderAll(){ensureCards();renderBackpack();renderChallenges();renderActivity();renderDevices();renderFamily();renderSettings();renderPresentationCards()}

injectStyle();familyPage();notificationPage();addNav();ensureCards();
window.HealthGoV2UI={ready:true,render:renderAll,renderFamily:renderFamily,renderBackpack:renderBackpack,renderChallenges:renderChallenges,renderNotifications:renderNotifications};
Services.subscribe(function(){renderAll()});renderAll();
})();