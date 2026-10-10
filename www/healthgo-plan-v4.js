/* HealthGo PLAN 4.0
 * Progressive enhancements for the existing account-scoped plan.
 * This module never invents a day's tasks, steps, XP or health data.
 */
(function(){
 'use strict';
 const find=id=>document.getElementById(id);
 const now=()=>new Date();
 const str=v=>String(v==null?'':v);
 const taskId=()=>('plan_'+Date.now()+'_'+Math.random().toString(36).slice(2,11));
 const validDay=s=>/^\d{4}-\d\d-\d\d$/.test(str(s))&&!Number.isNaN(new Date(s+'T12:00:00').getTime())&&
  new Date(s+'T12:00:00').getDate()===Number(str(s).slice(8,10));
 const formatDay=d=>typeof planDateKey==='function'?planDateKey(d):[d.getFullYear(),str(d.getMonth()+1).padStart(2,'0'),str(d.getDate()).padStart(2,'0')].join('-');
 const fromDay=s=>new Date(str(s)+'T12:00:00');
 const addDays=(d,n)=>{const date=new Date(d.getTime());date.setDate(date.getDate()+n);return date};
 const currentDay=()=>typeof currentPlanDate==='function'?currentPlanDate():formatDay(now());
 const itemsAll=()=>typeof loadHealthGoPlan==='function'?loadHealthGoPlan():[];
 const occurs=(item,date)=>typeof planOccursOnDate==='function'&&planOccursOnDate(item,date);
 const finished=(item,date)=>typeof isPlanDoneOnDate==='function'&&isPlanDoneOnDate(item,date);
 const filteredFor=(date,items)=>items.filter(x=>occurs(x,date));
 const timeNumber=v=>{if(!/^\d{2}:\d{2}$/.test(str(v)))return NaN;const [h,m]=v.split(':').map(Number);return h<24&&m<60?h*60+m:NaN};
 const niceDate=s=>{
  const d=fromDay(s);
  return validDay(s)?new Intl.DateTimeFormat('pl-PL',{month:'long',year:'numeric'}).format(d):'Kalendarz';
 };
 const uniqueList=arr=>[...new Set(arr)];
 const make=(tag,cls,textValue)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(textValue!==undefined)n.textContent=str(textValue);
  return n;
 };
 let view='week',lastKey='',pendingToast=null,notificationEnabledCache=null;
 let bottomViewedMonth=null,bottomLastSelectedDate=null;
 const dayNames=['Pn','Wt','Śr','Cz','Pt','So','Nd'];
 const repetition=['none','daily','weekdays','weekly','weekends','monthly','fortnight'];
 const allowedPriorities=['normal','high','medium','low'];
 const allowedCategories=['other','school','activity','health','meeting','travel','rest','hobby','home','family'];
 const reminderOptions=[0,5,10,15,30,60];
 function userId(){
  const uid=typeof hgUid==='function'?hgUid():window.healthGoCurrentUid;
  return str(uid||'').trim();
 }
 function localKey(suffix){
  const uid=userId();
  // Never share opt-in reminder preferences between unrelated accounts.
  return uid?'healthgo.plan4.'+suffix+'.'+encodeURIComponent(uid):null;
 }
 function readPref(suffix,def){
  try{const key=localKey(suffix);if(!key)return def;const v=localStorage.getItem(key);return v===null?def:JSON.parse(v)}catch(_){return def}
 }
 function writePref(suffix,data){
  try{const key=localKey(suffix);if(!key)return false;localStorage.setItem(key,JSON.stringify(data));return true}catch(_){return false}
 }
 function clashes(items){
  const collision=new Set(),pairs=[];
  const intervals=items.map(item=>({
   id:str(item.id),start:timeNumber(item.time),end:timeNumber(item.endTime)
  })).filter(x=>Number.isFinite(x.start));
  for(let a=0;a<intervals.length;a++)for(let b=a+1;b<intervals.length;b++){
   const x=intervals[a],y=intervals[b];
   if(x.id===y.id)continue;
   // An event with no end time has no assumed duration: only equal
   // start times can conflict. Full intervals are checked precisely.
   const overlap=
    x.start===y.start||
    (Number.isFinite(x.end)&&y.start>=x.start&&y.start<x.end)||
    (Number.isFinite(y.end)&&x.start>=y.start&&x.start<y.end)||
    (Number.isFinite(x.end)&&Number.isFinite(y.end)&&
     x.start<y.end&&y.start<x.end);
   if(overlap){collision.add(x.id);collision.add(y.id);pairs.push([x.id,y.id]);}
  }
  return {ids:collision,pairs};
 }
 function isCurrent(item,date){
  if(date!==formatDay(now())||finished(item,date))return false;
  const t=now(),minute=t.getHours()*60+t.getMinutes(),start=timeNumber(item.time),end=timeNumber(item.endTime);
  return Number.isFinite(start)&&Number.isFinite(end)&&end>start&&minute>=start&&minute<end;
 }
 function dueNext(items,date){
  if(date!==formatDay(now()))return null;
  const t=now(),minute=t.getHours()*60+t.getMinutes();
  return items.find(x=>!finished(x,date)&&!isCurrent(x,date)&&
   Number.isFinite(timeNumber(x.time))&&timeNumber(x.time)>=minute)||null;
 }
 function updateStats(items,date){
  const total=items.length,done=items.filter(x=>finished(x,date)).length;
  const percent=total?Math.round(100*done/total):0;
  const next=dueNext(items,date);
  const current=items.find(x=>isCurrent(x,date));
  const map={
   hgpStatCount:total?str(total):'0',
   hgpStatProgress:total?percent+'%':'—',
   hgpStatUpcoming:current?'Teraz':next?str(next.time):'—',
   hgpStatCountNote:total?'Zaplanowane na wybrany dzień':'Nie dodano jeszcze zadań',
   hgpStatProgressNote:total?done+' z '+total+' wykonane':'Dodaj punkt, by śledzić postęp',
   hgpStatUpcomingNote:current?current.title:next?next.title:'Brak kolejnego punktu na dziś'
  };
  for(const [id,text] of Object.entries(map)){const el=find(id);if(el)el.textContent=text;}
  const state=find('hgpLiveStatus');
  if(state){
   state.replaceChildren();
   const caption=make('strong','',current?'● Trwa teraz':next?'↗ Następny punkt':date===formatDay(now())?'✓ Dzisiaj':'📅 Wybrany dzień');
   state.appendChild(caption);
   const detail=current
    ?' '+current.time+(current.endTime?'–'+current.endTime:'')+' · '+current.title
    :next?' '+next.time+' · '+next.title
    :total?' '+done+' z '+total+' wykonane.':' Brak zaplanowanych wydarzeń.';
   state.appendChild(make('span','',detail));
   const overlap=clashes(items).pairs.length;
   if(overlap)state.appendChild(make('span','hgp-warning','⚠ '+overlap+' '+(overlap===1?'nakładająca się para':'nakładające się pary')+' wydarzeń'));
  }
 }
 function dayDots(items,date,selected){
  const total=filteredFor(date,items).length;
  const holder=make('span','hgp-dots');
  for(let i=0;i<Math.min(total,3);i++)holder.appendChild(make('span'));
  return holder;
 }
 function jumpToDay(date){
  if(!validDay(date))return false;
  const field=find('planDate');if(!field)return false;
  field.value=date;
  if(typeof renderPlanDay==='function')renderPlanDay();
  return true;
 }
 function renderWeek(date,items){
  const root=find('hgpWeekStrip');if(!root)return;
  root.replaceChildren();
  const target=fromDay(date),day=(target.getDay()+6)%7;
  const monday=addDays(target,-day);
  for(let i=0;i<7;i++){
   const d=addDays(monday,i),key=formatDay(d),button=make('button','hgp-day-tile');
   button.type='button';
   if(key===date)button.setAttribute('aria-current','date');
   button.setAttribute('aria-label',new Intl.DateTimeFormat('pl-PL',{weekday:'long',day:'numeric',month:'long'}).format(d));
   button.appendChild(make('span','day-name',dayNames[i]));
   button.appendChild(make('span','day-num',d.getDate()));
   button.appendChild(dayDots(items,key,key===date));
   button.addEventListener('click',()=>jumpToDay(key));
   root.appendChild(button);
  }
 }
 function renderMonth(date,items){
  const root=find('hgpMonthGrid');if(!root)return;
  root.replaceChildren();
  const d=fromDay(date),first=new Date(d.getFullYear(),d.getMonth(),1,12);
  const offset=(first.getDay()+6)%7;
  const weeks=Math.ceil((offset+new Date(d.getFullYear(),d.getMonth()+1,0).getDate())/7);
  for(const short of dayNames)root.appendChild(make('span','hgp-month-heading',short));
  for(let i=0;i<weeks*7;i++){
   const cell=addDays(first,i-offset),key=formatDay(cell),isOutside=cell.getMonth()!==first.getMonth();
   const button=make('button','hgp-month-day'+(isOutside?' outside':''));
   button.type='button';button.appendChild(make('span','',cell.getDate()));
   if(key===date)button.setAttribute('aria-current','date');
   button.setAttribute('aria-label',new Intl.DateTimeFormat('pl-PL',{weekday:'long',day:'numeric',month:'long'}).format(cell));
   button.appendChild(dayDots(items,key,key===date));
   button.addEventListener('click',()=>jumpToDay(key));
   root.appendChild(button);
  }
 }
 function renderCalendar(date){
  if(!validDay(date))return;
  const all=itemsAll();
  const label=find('hgpCalendarTitle');if(label)label.textContent=niceDate(date);
  const week=find('hgpWeekStrip'),month=find('hgpMonthGrid');
  if(week)week.hidden=view!=='week';
  if(month)month.hidden=view!=='month';
  const w=find('hgpWeekButton'),m=find('hgpMonthButton');
  if(w)w.setAttribute('aria-pressed',String(view==='week'));
  if(m)m.setAttribute('aria-pressed',String(view==='month'));
  if(view==='month')renderMonth(date,all);else renderWeek(date,all);
 }

 // A standard full-month calendar at the BOTTOM of Plan Dnia. Unlike the
 // compact week/month switch above, this calendar is always visible.
 // Browsing a different month does not accidentally change the selected day.
 function bottomMonthDate(value){
  if(!/^\d{4}-\d{2}$/.test(str(value)))return null;
  const [year,month]=value.split('-').map(Number);
  if(year<1900||year>2100||month<1||month>12)return null;
  return new Date(year,month-1,1,12);
 }
 function shiftBottomMonth(steps){
  const selected=currentDay();
  const base=bottomMonthDate(bottomViewedMonth)||bottomMonthDate(selected.slice(0,7));
  if(!base)return false;
  const next=new Date(base.getFullYear(),base.getMonth()+steps,1,12);
  if(next.getFullYear()<1900||next.getFullYear()>2100)return false;
  bottomViewedMonth=formatDay(next).slice(0,7);
  renderBottomCalendar(selected);
  return true;
 }
 function showBottomToday(){
  const today=formatDay(now());
  bottomViewedMonth=today.slice(0,7);
  jumpToDay(today);
  return true;
 }
 function selectBottomDate(day){
  if(!validDay(day))return false;
  bottomViewedMonth=day.slice(0,7);
  return jumpToDay(day);
 }
 function bottomEventDots(items,date){
  const total=filteredFor(date,items).length;
  const dots=make('span','hgp-fullcalendar-event-dots');
  for(let i=0;i<Math.min(3,total);i++)dots.appendChild(make('i'));
  return dots;
 }
 function renderBottomCalendar(selectedDate){
  const grid=find('hgpFullCalendarGrid');
  if(!grid||!validDay(selectedDate))return false;
  if(bottomLastSelectedDate!==selectedDate){
   // Selecting a new day through the date picker or upper calendar also
   // brings the bottom calendar to the correct month.
   bottomViewedMonth=selectedDate.slice(0,7);
   bottomLastSelectedDate=selectedDate;
  }
  const month=bottomMonthDate(bottomViewedMonth)||bottomMonthDate(selectedDate.slice(0,7));
  if(!month)return false;
  const first=new Date(month.getFullYear(),month.getMonth(),1,12);
  const padding=(first.getDay()+6)%7;
  const monthLength=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const dayCount=Math.ceil((padding+monthLength)/7)*7;
  const all=itemsAll(),today=formatDay(now());
  const label=find('hgpFullCalendarMonth');
  if(label)label.textContent=new Intl.DateTimeFormat('pl-PL',{month:'long',year:'numeric'}).format(first);
  const previous=find('hgpFullCalendarPrevious'),next=find('hgpFullCalendarNext');
  if(previous)previous.disabled=month.getFullYear()===1900&&month.getMonth()===0;
  if(next)next.disabled=month.getFullYear()===2100&&month.getMonth()===11;
  grid.replaceChildren();
  for(let i=0;i<dayCount;i++){
   const day=addDays(first,i-padding);
   const date=formatDay(day),outside=day.getMonth()!==month.getMonth();
   const entries=filteredFor(date,all),done=entries.filter(item=>finished(item,date)).length;
   const button=make('button','hgp-fullcalendar-date'+(outside?' outside':'')+
    (date===today?' today':'')+(date===selectedDate?' selected':''));
   button.type='button';
   button.dataset.date=date;
   if(date===selectedDate)button.setAttribute('aria-pressed','true');
   else button.setAttribute('aria-pressed','false');
   if(date===today)button.setAttribute('aria-current','date');
   const full=new Intl.DateTimeFormat('pl-PL',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(day);
   button.setAttribute('aria-label',full+(entries.length?' — '+entries.length+' wydarzeń, '+done+' ukończonych':' — brak wydarzeń'));
   button.title=full;
   button.appendChild(make('span','hgp-fullcalendar-number',day.getDate()));
   button.appendChild(bottomEventDots(all,date));
   button.addEventListener('click',()=>selectBottomDate(date));
   grid.appendChild(button);
  }
  const dateHeading=find('hgpFullCalendarSelectedDate');
  if(dateHeading)dateHeading.textContent=new Intl.DateTimeFormat('pl-PL',
   {weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(fromDay(selectedDate));
  const agenda=find('hgpFullCalendarAgenda');
  if(agenda){
   agenda.replaceChildren();
   const events=filteredFor(selectedDate,all).sort((a,b)=>str(a.time).localeCompare(str(b.time)));
   if(!events.length){
    agenda.appendChild(make('p','hgp-fullcalendar-empty','Brak wydarzeń na ten dzień. Możesz dodać nowe zadanie w Planie dnia.'));
   }else{
    for(const item of events.slice(0,6)){
     const row=make('div','hgp-fullcalendar-agenda-entry');
     row.appendChild(make('span','hgp-fullcalendar-agenda-time',item.time));
     const details=make('span','hgp-fullcalendar-agenda-name',item.title);
     if(finished(item,selectedDate))details.classList.add('done');
     row.appendChild(details);
     row.appendChild(make('span','hgp-fullcalendar-agenda-status',
       finished(item,selectedDate)?'✓':'○'));
     agenda.appendChild(row);
    }
    if(events.length>6)agenda.appendChild(make('p','hgp-fullcalendar-more',
     'I jeszcze '+(events.length-6)+' wydarzeń — zobacz pełną listę w Planie dnia.'));
   }
  }
  return true;
 }
 function jumpFromBottom(){
  const board=find('plan')?.querySelector('.plan-board');
  board?.scrollIntoView?.({behavior:'smooth',block:'start'});
 }

 function setView(mode){
  view=mode==='month'?'month':'week';
  renderCalendar(currentDay());
 }
 function renderSkipped(date){
  const root=find('hgpSkipped');if(!root)return;
  root.replaceChildren();
  const skipped=itemsAll().filter(x=>
   Array.isArray(x.skipDates)&&x.skipDates.includes(date)&&x.date<=date&&
   x.repeat&&x.repeat!=='none');
  for(const item of skipped){
   const line=make('div','hgp-skipped-item');
   line.appendChild(make('span','',item.time+' · '+item.title+' (pominięte)'));
   const button=make('button','','Przywróć ten dzień');
   button.type='button';
   button.addEventListener('click',()=>restoreOccurrence(item.id,date));
   line.appendChild(button);root.appendChild(line);
  }
 }
 function renderSupplemental(items,date){
  if(!validDay(date))return;
  updateStats(items,date);
  renderCalendar(date);
  renderBottomCalendar(date);
  renderSkipped(date);
  lastKey=date;
 }
 function status(id,message,type=''){
  const box=find(id);if(!box)return;
  box.textContent=message;
  box.classList.toggle('good',type==='good');
  box.classList.toggle('error',type==='error');
 }
 function skipOccurrence(id,date){
  if(!validDay(date)||!userId())return false;
  const all=itemsAll(),item=all.find(x=>x.id===id);
  if(!item||item.repeat==='none')return false;
  item.skipDates=uniqueList([...(Array.isArray(item.skipDates)?item.skipDates:[]),date]).sort();
  // Completed entries on other dates remain untouched.
  try{saveHealthGoPlan(all)}catch(_){status('hgpBackupStatus','Nie zapisano zmiany. Sprawdź miejsce w pamięci.', 'error');return false}
  renderPlanDay();renderTodayPlanPreview();
  return true;
 }
 function restoreOccurrence(id,date){
  const all=itemsAll(),item=all.find(x=>x.id===id);
  if(!item)return false;
  item.skipDates=(Array.isArray(item.skipDates)?item.skipDates:[]).filter(d=>d!==date);
  try{saveHealthGoPlan(all)}catch(_){return false}
  renderPlanDay();renderTodayPlanPreview();
  return true;
 }
 function setupTemplate(id){
  const presets={
   learning:{title:'Nauka / praca domowa',category:'school',priority:'normal',note:''},
   outdoors:{title:'Spacer / czas na świeżym powietrzu',category:'activity',priority:'normal',note:''},
   relax:{title:'Odpoczynek',category:'rest',priority:'low',note:''},
   meeting:{title:'Spotkanie',category:'meeting',priority:'normal',note:''}
  };
  const item=presets[id];if(!item)return false;
  const name=find('planTitleInput'),category=find('planCategory'),priority=find('planPriority'),note=find('planNote');
  if(name)name.value=item.title;
  if(category)category.value=item.category;
  if(priority)priority.value=item.priority;
  if(note)note.value=item.note;
  status('planEditorStatus','Szablon wypełnia tylko formularz. Wybierz godzinę i kliknij „Dodaj do planu”.','good');
  openEditor(false);
  return true;
 }
 function openEditor(clear=false){
  if(clear&&typeof cancelPlanEdit==='function')cancelPlanEdit();
  const editor=find('planEditorTitle')?.closest('.plan-editor');
  if(editor)editor.scrollIntoView?.({behavior:'smooth',block:'start'});
  window.setTimeout?.(()=>find('planTime')?.focus?.({preventScroll:true}),170);
 }
 function updateReminderHelp(){
  const supported='Notification' in window;
  const permission=supported?Notification.permission:'unsupported';
  const enabled=!!readPref('notifications',false);
  notificationEnabledCache=enabled;
  const label=find('hgpReminderStatus'),button=find('hgpToggleReminders');
  if(label){
   const info=!supported?'Powiadomienia przeglądarki nie są dostępne na tym urządzeniu.':
    permission==='denied'?'System zablokował powiadomienia. Możesz zmienić to w ustawieniach telefonu.':
    enabled&&permission==='granted'?'Przypomnienia włączone, gdy HealthGo pozostaje otwarte i aktywne.':
    'Przypomnienia wyłączone. Włącz je świadomie, jeśli chcesz otrzymywać alerty.';
   label.textContent=info;
  }
  if(button)button.textContent=enabled&&permission==='granted'?'Wyłącz przypomnienia':'Włącz przypomnienia';
 }
 async function toggleReminders(){
  if(!userId()){status('hgpReminderStatus','Zaloguj się, aby włączyć osobiste przypomnienia.','error');return false}
  if(readPref('notifications',false)){
   writePref('notifications',false);updateReminderHelp();
   return true;
  }
  if(!('Notification' in window)){
   status('hgpReminderStatus','Ta wersja iOS/przeglądarki nie oferuje takich powiadomień.','error');
   return false;
  }
  let permission=Notification.permission;
  if(permission==='default')try{permission=await Notification.requestPermission()}catch(_){permission='denied'}
  if(permission!=='granted'){
   writePref('notifications',false);updateReminderHelp();return false;
  }
  if(!writePref('notifications',true)){
   status('hgpReminderStatus','Nie można zapamiętać zgody na tym urządzeniu.','error');
   return false;
  }
  updateReminderHelp();checkReminders();return true;
 }
 function remindToast(message){
  const box=find('hgpReminderToast');if(!box)return;
  box.textContent=message;box.hidden=false;
  if(pendingToast)window.clearTimeout?.(pendingToast);
  pendingToast=window.setTimeout?.(()=>{box.hidden=true},11000);
 }
 function checkReminders(){
  if(!userId()||!readPref('notifications',false)||document.visibilityState==='hidden')return 0;
  const day=formatDay(now()),list=filteredFor(day,itemsAll()),n=now();
  const current=n.getHours()*60+n.getMinutes();
  let sent=readPref('sent',{});if(!sent||typeof sent!=='object'||Array.isArray(sent))sent={};
  let count=0,changed=false;
  for(const task of list){
   if(finished(task,day))continue;
   const ahead=Number(task.reminderMinutes)||0;
   if(!reminderOptions.includes(ahead)||ahead===0)continue;
   const target=timeNumber(task.time)-ahead;
   const difference=current-target;
   // Allow up to 60 seconds of late app resumption. No overdue flooding.
   if(!Number.isFinite(target)||difference<0||difference>1)continue;
   const ident=day+':'+str(task.id)+':'+ahead;
   if(sent[ident])continue;
   sent[ident]=Date.now();changed=true;count++;
   const description='Za '+ahead+' min: '+str(task.title).slice(0,90);
   if('Notification' in window&&Notification.permission==='granted'){
    try{new Notification('HealthGo · Plan dnia',{body:description,tag:'healthgo-plan-'+str(task.id)})}catch(_){}
   }
   remindToast(description);
  }
  if(changed){
   const recent=Object.entries(sent).filter(([_,timestamp])=>Date.now()-Number(timestamp)<3*86400000).slice(-160);
   writePref('sent',Object.fromEntries(recent));
  }
  return count;
 }
 function escapeIcs(s){
  return str(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 }
 function icsDate(date,time){
  if(!validDay(date)||!Number.isFinite(timeNumber(time)))return null;
  return date.replaceAll('-','')+'T'+time.replace(':','')+'00';
 }
 function createICS(items){
  const dt=now().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HealthGo//Plan Dnia 4//PL','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const x of items){
   const start=icsDate(x.date,x.time);
   if(!start)continue;
   lines.push('BEGIN:VEVENT','UID:'+escapeIcs(x.id)+'@healthgo.local',
    'DTSTAMP:'+dt,'DTSTART:'+start);
   if(x.endTime&&timeNumber(x.endTime)>timeNumber(x.time)){
    const end=icsDate(x.date,x.endTime);if(end)lines.push('DTEND:'+end);
   }
   lines.push('SUMMARY:'+escapeIcs(x.title));
   if(x.place)lines.push('LOCATION:'+escapeIcs(x.place));
   if(x.note)lines.push('DESCRIPTION:'+escapeIcs(x.note));
   if(x.repeat==='daily')lines.push('RRULE:FREQ=DAILY');
   if(x.repeat==='weekly')lines.push('RRULE:FREQ=WEEKLY');
   if(x.repeat==='fortnight')lines.push('RRULE:FREQ=WEEKLY;INTERVAL=2');
   if(x.repeat==='weekdays')lines.push('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
   if(x.repeat==='weekends')lines.push('RRULE:FREQ=WEEKLY;BYDAY=SA,SU');
   if(x.repeat==='monthly')lines.push('RRULE:FREQ=MONTHLY');
   lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n')+'\r\n';
 }
 function download(content,name,mime){
  const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob);
  const anchor=make('a');anchor.href=url;anchor.download=name;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  window.setTimeout?.(()=>URL.revokeObjectURL(url),15000);
 }
 function exportCalendar(){
  const items=itemsAll();
  if(!items.length){status('hgpBackupStatus','Nie ma jeszcze wydarzeń do eksportu.');return false}
  download(createICS(items),'HealthGo-Plan-Dnia.ics','text/calendar;charset=utf-8');
  status('hgpBackupStatus','Utworzono plik kalendarza (.ics). Możesz zaimportować go do aplikacji kalendarza.','good');
  return true;
 }
 function exportBackup(){
  if(!userId()){status('hgpBackupStatus','Zaloguj się, aby eksportować osobisty plan.','error');return false}
  const backup={format:'HealthGoPlan',version:4,exportedAt:now().toISOString(),
   items:itemsAll()};
  download(JSON.stringify(backup,null,2),'HealthGo-Plan-Kopia-'+formatDay(now())+'.json','application/json;charset=utf-8');
  status('hgpBackupStatus','Pobrano kopię Twojego planu w formacie JSON.','good');
  return true;
 }
 function sanitizeImported(x){
  if(!x||typeof x!=='object'||!validDay(x.date)||!Number.isFinite(timeNumber(x.time)))return null;
  const title=str(x.title).trim().slice(0,80);
  if(!title)return null;
  let end=str(x.endTime||'').slice(0,5);
  if(!Number.isFinite(timeNumber(end))||timeNumber(end)<=timeNumber(x.time))end='';
  const repeat=repetition.includes(x.repeat)?x.repeat:'none';
  return {
   id:taskId(),date:x.date,time:x.time,endTime:end,title,
   place:str(x.place||'').slice(0,120),note:str(x.note||'').slice(0,300),
   category:allowedCategories.includes(x.category)?x.category:'other',
   priority:allowedPriorities.includes(x.priority)?x.priority:'normal',
   repeat,done:!!x.done,doneDates:repeat==='none'?[]:
    uniqueList(Array.isArray(x.doneDates)?x.doneDates.filter(validDay).slice(0,365):[]).sort(),
   skipDates:repeat==='none'?[]:
    uniqueList(Array.isArray(x.skipDates)?x.skipDates.filter(validDay).slice(0,365):[]).sort(),
   reminderMinutes:reminderOptions.includes(Number(x.reminderMinutes))?Number(x.reminderMinutes):0
  };
 }
 async function importBackup(event){
  const input=event?.target||find('hgpBackupInput'),file=input?.files?.[0];
  if(input)input.value='';
  if(!file)return false;
  if(!userId()){status('hgpBackupStatus','Najpierw zaloguj się do własnego konta.','error');return false}
  if(file.size>1024*1024){
   status('hgpBackupStatus','Plik jest zbyt duży (maksymalnie 1 MB).','error');return false;
  }
  try{
   const decoded=JSON.parse(await file.text());
   if(decoded?.format!=='HealthGoPlan'||!Array.isArray(decoded.items)){
    status('hgpBackupStatus','To nie jest poprawna kopia planu HealthGo.','error');
    return false;
   }
   if(decoded.items.length>500){status('hgpBackupStatus','Kopia zawiera zbyt wiele wpisów (limit 500).','error');return false}
   const clean=decoded.items.map(sanitizeImported).filter(Boolean);
   if(!clean.length){status('hgpBackupStatus','Plik nie zawiera prawidłowych zadań.','error');return false}
   const current=itemsAll();
   if(current.length+clean.length>1000){
    status('hgpBackupStatus','Limit wynosi 1000 wpisów na konto. Nie zaimportowano pliku.','error');return false;
   }
   // Import deliberately appends new IDs. It never silently overwrites the
   // account's existing local or cloud-synchronized planner.
   saveHealthGoPlan([...current,...clean]);
   renderPlanDay();renderTodayPlanPreview();
   status('hgpBackupStatus','Dodano '+clean.length+' wpisów z kopii. Istniejący plan pozostał bez zmian.','good');
   return true;
  }catch(_){
   status('hgpBackupStatus','Nie udało się otworzyć pliku JSON. Sprawdź jego zawartość.','error');
   return false;
  }
 }
 function updateFilters(){
  const date=currentDay();
  const all=filteredFor(date,itemsAll());
  const cat=find('hgpCategoryFilter'),done=find('hgpStatusFilter');
  const checked=all.filter(item=>{
   if(cat&&cat.value!=='all'&&item.category!==cat.value)return false;
   if(done?.value==='done'&&!finished(item,date))return false;
   if(done?.value==='pending'&&finished(item,date))return false;
   if(done?.value==='important'&&!['high','medium'].includes(item.priority))return false;
   return true;
  });
  return checked;
 }
 function insertEvents(){
  find('hgpFullCalendarPrevious')?.addEventListener('click',()=>shiftBottomMonth(-1));
  find('hgpFullCalendarNext')?.addEventListener('click',()=>shiftBottomMonth(1));
  find('hgpFullCalendarToday')?.addEventListener('click',showBottomToday);
  find('hgpFullCalendarJump')?.addEventListener('click',jumpFromBottom);
  find('hgpWeekButton')?.addEventListener('click',()=>setView('week'));
  find('hgpMonthButton')?.addEventListener('click',()=>setView('month'));
  find('hgpOpenEditor')?.addEventListener('click',()=>openEditor(true));
  find('hgpToggleReminders')?.addEventListener('click',toggleReminders);
  find('hgpCalendarExport')?.addEventListener('click',exportCalendar);
  find('hgpBackupExport')?.addEventListener('click',exportBackup);
  find('hgpBackupImport')?.addEventListener('click',()=>find('hgpBackupInput')?.click());
  find('hgpBackupInput')?.addEventListener('change',importBackup);
  find('hgpTemplateLearning')?.addEventListener('click',()=>setupTemplate('learning'));
  find('hgpTemplateOutdoors')?.addEventListener('click',()=>setupTemplate('outdoors'));
  find('hgpTemplateRelax')?.addEventListener('click',()=>setupTemplate('relax'));
  find('hgpTemplateMeeting')?.addEventListener('click',()=>setupTemplate('meeting'));
  find('hgpCategoryFilter')?.addEventListener('change',renderPlanDay);
  find('hgpStatusFilter')?.addEventListener('change',renderPlanDay);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkReminders();if(find('plan')?.classList.contains('active'))renderPlanDay()}});
  window.HealthGoServices?.events?.addEventListener?.('SESSION_CHANGED',()=>{
   notificationEnabledCache=null;updateReminderHelp();
   if(find('plan')?.classList.contains('active'))renderPlanDay();
  });
 }
 window.HealthGoPlanner={
  clashes,renderSupplemental,renderCalendar,renderBottomCalendar,shiftBottomMonth,selectBottomDate,setView,updateFilters,
  skipOccurrence,restoreOccurrence,setupTemplate,openEditor,
  toggleReminders,checkReminders,createICS,exportCalendar,exportBackup,importBackup,
  updateReminderHelp,sanitizeImported,isCurrent,timeNumber,status,
  get view(){return view}
 };
 insertEvents();
 updateReminderHelp();
 window.setInterval?.(()=>{checkReminders();if(find('plan')?.classList.contains('active'))renderPlanDay()},60000);
})();
