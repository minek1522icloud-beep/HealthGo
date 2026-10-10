/* HealthGo Plecak 2.0 — Hybrydowy PRO.
 * Real achievements/XP come exclusively from HealthGoEngine and HealthGoServices.
 * Checklist data is per-account local on this device; it cannot mint XP or coins.
 */
(function () {
  'use strict';
  var Engine=window.HealthGoEngine, Services=window.HealthGoServices;
  var page=document.getElementById('backpack');
  if(!page||!Engine||!Services)return;
  var root=document.createElement('div');
  root.id='hgPackProRoot';
  var ui={tab:'gear',filter:'all',category:'all',search:'',sort:'recent',modal:null};
  var owner='',data=fresh();
  var CATEGORIES={badges:'Odznaki',cups:'Puchary',sports:'Sportowe',special:'Specjalne',limited:'Limitowane',secret:'Sekretne',family:'Rodzinne'};
  var RARITY={common:'Zwykły',rare:'Rzadki',epic:'Epicki',legendary:'Legendarny',mythic:'Mityczny'};
  var ICONS={
    backpack:'<rect x="5" y="6" width="14" height="16" rx="4"/><path d="M9 6V5a3 3 0 0 1 6 0v1M9 13h6v5H9zM5 13H3v5h2m14-5h2v5h-2"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    award:'<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8"/>',
    trophy:'<path d="M7 4h10v7a5 5 0 0 1-10 0V4ZM7 6H4v3a4 4 0 0 0 4 4m9-7h3v3a4 4 0 0 1-4 4M12 16v4m-4 1h8"/>',
    footprints:'<ellipse cx="8" cy="17" rx="2.8" ry="4" transform="rotate(28 8 17)"/><ellipse cx="16" cy="8" rx="2.8" ry="4" transform="rotate(28 16 8)"/><path d="M4 12h.1M7 9h.1M11 8h.1M13 18h.1M17 20h.1M20 17h.1"/>',
    gem:'<path d="M4 9 8 4h8l4 5-8 12L4 9Zm0 0h16M8 4l4 5 4-5M12 9v12"/>',
    sparkles:'<path d="m12 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6ZM19 18l.8 2.2L22 21l-2.2.8L19 24l-.8-2.2L16 21l2.2-.8L19 18Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    star:'<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1L12 2Z"/>',
    layers:'<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M8 20h10a2 2 0 0 0 2-2V8"/>',
    gift:'<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 13h18M12 9v12M12 9c-8-1-7-8-3-8 3 0 3 5 3 8Zm0 0c8-1 7-8 3-8-3 0-3 5-3 8Z"/>',
    filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
    school:'<path d="M3 9 12 4l9 5v12H3V9ZM8 21v-7h8v7M3 10h18"/>',
    activity:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    travel:'<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2M4 12h16"/>',
    moon:'<path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z"/>',
    list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
    trash:'<path d="M4 7h16M10 4h4m-8 3 1 14h10l1-14M10 11v6m4-6v6"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',
    share:'<path d="M12 16V3m-5 5 5-5 5 5M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
    edit:'<path d="m4 20 4-.7L19 8a2 2 0 0 0-3-3L5 16l-1 4Zm10-13 3 3"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  var TEMPLATES={
    school:{name:'Do szkoły',icon:'school',items:['Plecak','Piórnik','Zeszyty','Podręczniki','Drugie śniadanie','Butelka wody']},
    sport:{name:'Na trening',icon:'activity',items:['Strój sportowy','Buty sportowe','Butelka wody','Ręcznik']},
    pool:{name:'Na basen',icon:'activity',items:['Strój kąpielowy','Ręcznik','Klapki','Czepek (jeśli potrzebny)','Żel pod prysznic']},
    travel:{name:'Na wyjazd',icon:'travel',items:['Ubrania','Ładowarka','Szczoteczka do zębów','Dokumenty','Butelka wody']},
    sleep:{name:'Na nocowanie',icon:'moon',items:['Piżama','Szczoteczka do zębów','Ubrania na zmianę','Ładowarka','Ręcznik (jeśli potrzebny)']}
  };
  function svg(name){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[name]||ICONS.backpack)+'</svg>';}
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function fresh(){return {version:2,lists:[],favorites:[],spotlight:null};}
  function safeText(value,max){return String(value==null?'':value).trim().slice(0,max);}
  function normalize(raw){
    var next=fresh();
    if(!raw||typeof raw!=='object')return next;
    next.lists=(Array.isArray(raw.lists)?raw.lists:[]).slice(0,100).filter(function(item){return item&&typeof item==='object'&&typeof item.id==='string'&&typeof item.name==='string';}).map(function(item){
      return {id:safeText(item.id,96),name:safeText(item.name,90)||'Moja lista',date:/^\d{4}-\d{2}-\d{2}$/.test(item.date||'')?item.date:'',archived:item.archived===true,created:typeof item.created==='number'?item.created:0,
        items:(Array.isArray(item.items)?item.items:[]).slice(0,100).filter(function(x){return x&&typeof x==='object'&&typeof x.name==='string';}).map(function(x){
          return {id:safeText(x.id,96),name:safeText(x.name,90),done:x.done===true};
        }).filter(function(x){return x.id&&x.name;})};
    }).filter(function(x){return x.id;});
    next.favorites=(Array.isArray(raw.favorites)?raw.favorites:[]).filter(function(x){return typeof x==='string'&&x.length<110;}).slice(0,200);
    next.spotlight=typeof raw.spotlight==='string'&&raw.spotlight.length<110?raw.spotlight:null;
    return next;
  }
  function userId(){return String(Services.state.uid||window.healthGoCurrentUid||'').trim();}
  function storageKey(){return owner?'healthgo.pack.pro.2.'+encodeURIComponent(owner):null;}
  function syncAccount(){
    var next=userId();
    if(next===owner)return;
    owner=next;data=fresh();ui.modal=null;
    if(owner){try{data=normalize(JSON.parse(localStorage.getItem(storageKey())||'null'));}catch(_){}}
  }
  function persist(){
    if(!owner)return false;
    try{localStorage.setItem(storageKey(),JSON.stringify(data));return true;}
    catch(err){window.console&&console.warn('Plecak: zapis lokalny niedostępny',err);return false;}
  }
  function mutate(fn){syncAccount();if(!owner)return;fn(data);var ok=persist();render();if(!ok)message('Zapis nie powiódł się. Sprawdź pamięć przeglądarki.');}
  function uuid(){return 'pack_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);}
  function achievements(){
    try{return Services.state.engine?Engine.viewAchievements(Services.state.engine):[];}
    catch(_){return [];}
  }
  function earnedCount(items){return items.filter(function(x){return x.earned===true;}).length;}
  function percent(list){return list.items.length?Math.round(list.items.filter(function(x){return x.done;}).length/list.items.length*100):0;}
  function due(list){
    if(!list.date||list.archived||percent(list)===100)return false;
    var d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    return list.date<=today;
  }
  function findList(id){return data.lists.find(function(x){return x.id===id;});}
  function findBadge(id){return achievements().find(function(x){return x.id===id;});}
  function notifyTitle(){return owner?'Zapis lokalny na tym urządzeniu · dla zalogowanego konta':'Zaloguj się, aby korzystać z Plecaka';}
  function hero(){
    var items=achievements(),engine=Services.state.engine,level=engine?Engine.getLevel(engine.totalXp||0):null;
    var packs=data.lists.filter(function(x){return !x.archived;}).length;
    var current=level?(level.needed?level.xp+' / '+level.needed+' XP':'MAX XP'):'Brak danych XP';
    return '<header class="hgp-top"><div><span class="hgp-kicker">HealthGo · HYBRYDOWY PRO</span><h2>Mój plecak</h2><p class="hgp-sub">Ekwipunek i codzienna organizacja</p></div><div class="hgp-actions"><button type="button" class="hgp-iconbtn" data-action="settings" aria-label="Informacje o plecaku">'+svg('settings')+'</button></div></header>'+
      '<section class="hgp-hero" aria-label="Postępy plecaka"><div class="hgp-herohead"><div><div class="hgp-kicker">Twój progres</div><div class="hgp-level">'+(level?'Poziom '+level.level:'Poziom —')+'</div><p class="hgp-sub">'+(level&&level.needed?level.remaining+' XP do następnego poziomu':'Postępy z konta HealthGo')+'</p></div><div class="hgp-bagicon">'+svg('backpack')+'</div></div>'+
      '<div class="hgp-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+(level?Math.round(level.percent):0)+'"><span style="width:'+(level?level.percent:0)+'%"></span></div>'+
      '<div class="hgp-trackmeta"><span>'+escapeHtml(current)+'</span><span>'+(level?'Zweryfikowane osiągnięcia':'Czekamy na synchronizację')+'</span></div>'+
      '<div class="hgp-stats"><div class="hgp-stat">'+svg('award')+'<b>'+earnedCount(items)+'</b><small>Zdobyte nagrody</small></div><div class="hgp-stat">'+svg('list')+'<b>'+packs+'</b><small>Moje listy</small></div><div class="hgp-stat">'+svg('gem')+'<b>—</b><small>HealthCoins wkrótce</small></div></div></section>';
  }
  function tabs(){
    return '<div class="hgp-tabs" role="tablist" aria-label="Rodzaj plecaka"><button type="button" role="tab" data-action="tab" data-value="gear" aria-selected="'+(ui.tab==='gear')+'">'+svg('award')+' Ekwipunek</button><button type="button" role="tab" data-action="tab" data-value="daily" aria-selected="'+(ui.tab==='daily')+'">'+svg('list')+' Codzienny</button></div>';
  }
  function badgeIcon(item){return item.category==='cups'?'trophy':item.category==='sports'?'footprints':item.category==='secret'&&!item.earned?'lock':item.category==='special'?'sparkles':item.rarity==='mythic'?'gem':'award';}
  function badgeCard(item){
    var isStar=data.favorites.indexOf(item.id)>=0,isSpotlight=data.spotlight===item.id;
    return '<button type="button" class="hgp-card" data-action="badge" data-id="'+escapeHtml(item.id)+'" data-earned="'+(!!item.earned)+'" data-spotlight="'+isSpotlight+'">'+
      (isSpotlight?'<span class="hgp-status">Wyróżnione</span>':item.earned?'<span class="hgp-status">'+(isStar?'★ Ulubione':'Zdobyte')+'</span>':'')+
      '<span class="hgp-art">'+svg(badgeIcon(item))+'</span><b>'+escapeHtml(item.name)+'</b>'+
      '<span class="hgp-rarity '+escapeHtml(item.rarity||'common')+'">'+escapeHtml(RARITY[item.rarity]||'Zwykły')+'</span>'+
      '<small>'+(item.earned?'Zdobyto'+(item.earnedAt?' · '+escapeHtml(new Date(item.earnedAt).toLocaleDateString('pl-PL')):''):(item.target==null?'Warunek ukryty':'Postęp: '+Math.round(item.progress||0)+' / '+Math.round(item.target||0)))+'</small></button>';
  }
  function gear(){
    var items=achievements(),filtered=items.filter(function(item){
      if(ui.category!=='all'&&item.category!==ui.category)return false;
      if(ui.filter==='earned'&&!item.earned)return false;
      if(ui.filter==='favorites'&&data.favorites.indexOf(item.id)<0)return false;
      if(ui.filter==='locked'&&item.earned)return false;
      return !ui.search||String(item.name+' '+item.description).toLocaleLowerCase('pl').includes(ui.search.toLocaleLowerCase('pl'));
    });
    filtered.sort(function(a,b){
      if(ui.sort==='name')return a.name.localeCompare(b.name,'pl');
      if(ui.sort==='rarity')return ['mythic','legendary','epic','rare','common'].indexOf(a.rarity)-['mythic','legendary','epic','rare','common'].indexOf(b.rarity);
      return Number(b.earned)-Number(a.earned)||(Date.parse(b.earnedAt)||0)-(Date.parse(a.earnedAt)||0);
    });
    var pills=[['all','Wszystkie'],['earned','Zdobyte'],['favorites','Ulubione'],['locked','Nieodkryte']];
    var classes=Object.keys(CATEGORIES).map(function(key){return '<option value="'+key+'" '+(ui.category===key?'selected':'')+'>'+CATEGORIES[key]+'</option>';}).join('');
    var pillsHtml=pills.map(function(x){return '<button type="button" class="hgp-pill" data-action="filter" data-value="'+x[0]+'" aria-pressed="'+(x[0]===ui.filter)+'">'+x[1]+'</button>';}).join('');
    return '<div class="hgp-heading"><h3>'+svg('award')+' Twoja kolekcja</h3><button type="button" class="hgp-secondary" data-action="collections">'+svg('layers')+' Kolekcje</button></div>'+
      '<div class="hgp-pills">'+pillsHtml+'</div><div class="hgp-toolrow">'+
      '<input class="hgp-control hgp-search" id="hgpackSearch" type="search" maxlength="80" autocomplete="off" placeholder="Szukaj nagrody..." aria-label="Szukaj nagrody" value="'+escapeHtml(ui.search)+'">'+
      '<select class="hgp-control hgp-select" data-change="category" aria-label="Kategoria osiągnięć"><option value="all">Wszystkie kategorie</option>'+classes+'</select>'+
      '<select class="hgp-control hgp-select" data-change="sort" aria-label="Sortowanie"><option value="recent" '+(ui.sort==='recent'?'selected':'')+'>Najnowsze</option><option value="rarity" '+(ui.sort==='rarity'?'selected':'')+'>Rzadkość</option><option value="name" '+(ui.sort==='name'?'selected':'')+'>Nazwa A–Z</option></select></div>'+
      (filtered.length?'<div class="hgp-grid">'+filtered.map(badgeCard).join('')+'</div>':
       emptyPanel(items.length?'Nic nie znaleziono':'Nagrody pojawią się po synchronizacji','Możesz zmienić filtry lub zdobywać odznaki przez prawdziwe wyzwania HealthGo.','trophy'))+
      '<div class="hgp-heading"><h3>'+svg('gift')+' Skrzynie i nagrody</h3><button type="button" class="hgp-secondary" data-action="chests">Zobacz '+svg('chevron')+'</button></div>'+
      '<div class="hgp-info">Skrzynie i HealthCoins będą aktywne po podłączeniu bezpiecznego systemu nagród. Nie pokazujemy fikcyjnych skrzyń ani monet.</div>';
  }
  function emptyPanel(title,subtitle,icon){
    return '<div class="hgp-empty">'+svg(icon||'backpack')+'<b>'+escapeHtml(title)+'</b><p>'+escapeHtml(subtitle)+'</p></div>';
  }
  function listCard(list){
    var count=list.items.filter(function(x){return x.done;}).length,p=percent(list);
    return '<button type="button" class="hgp-listcard" data-action="list" data-id="'+escapeHtml(list.id)+'"><span class="hgp-listhead">'+svg('backpack')+'<span><b>'+escapeHtml(list.name)+'</b><small>'+(list.date?'Termin: '+escapeHtml(list.date):'Bez terminu')+'</small></span>'+svg('chevron')+'</span>'+
      '<span class="hgp-meter"><span style="width:'+p+'%"></span></span><span class="hgp-listmeta"><span>'+count+' / '+list.items.length+' rzeczy spakowane</span><span>'+(p===100&&list.items.length?'Gotowe!':due(list)?'Na dziś / zaległe':p+'%')+'</span></span></button>';
  }
  function daily(){
    var active=data.lists.filter(function(x){return !x.archived;}),archived=data.lists.filter(function(x){return x.archived;}),late=active.filter(due);
    var templates=Object.keys(TEMPLATES).map(function(k){return '<button type="button" class="hgp-template" data-action="template" data-value="'+k+'">'+svg(TEMPLATES[k].icon)+' '+escapeHtml(TEMPLATES[k].name)+'</button>';}).join('');
    return '<div class="hgp-heading"><h3>'+svg('calendar')+' Codzienny organizer</h3><button type="button" class="hgp-primary" data-action="new">'+svg('plus')+' Nowa lista</button></div>'+
      (late.length?'<div class="hgp-info">'+svg('bell')+' Masz '+late.length+' niekompletnych list z terminem na dziś lub wcześniej. To przypomnienie jest widoczne po otwarciu aplikacji.</div>':'')+
      '<div class="hgp-heading"><h3>Gotowe szablony</h3></div><div class="hgp-template-row">'+templates+'</div>'+
      '<div class="hgp-heading"><h3>Moje listy ('+active.length+')</h3></div>'+
      (active.length?'<div class="hgp-listgrid">'+active.slice().sort(function(a,b){return b.created-a.created;}).map(listCard).join('')+'</div>':
       emptyPanel('Brak list do spakowania','Utwórz listę lub wybierz gotowy szablon.','list'))+
      (archived.length?'<div class="hgp-heading"><h3>Archiwum ('+archived.length+')</h3></div><div class="hgp-listgrid">'+archived.map(listCard).join('')+'</div>':'')+
      '<div class="hgp-heading"><h3>'+svg('sparkles')+' Podpowiedzi do pakowania</h3></div>'+
      '<div class="hgp-info">Szablony działają także offline. Aby uzyskać indywidualną propozycję, możesz przejść do HealthGo AI, a następnie samodzielnie dodać sugerowane rzeczy.</div>'+
      '<div style="margin-top:10px"><button type="button" class="hgp-secondary" data-action="ai">'+svg('sparkles')+' Otwórz HealthGo AI '+svg('arrow')+'</button></div>'+
      '<div class="hgp-info">'+escapeHtml(notifyTitle())+'. Listy nie synchronizują się jeszcze z chmurą. Zaznaczanie rzeczy nie nalicza automatycznie XP.</div>';
  }
  function collections(){
    var items=achievements(),categories=Object.keys(CATEGORIES).filter(function(key){return items.some(function(x){return x.category===key;});});
    return '<div class="hgp-heading"><h3>'+svg('layers')+' Kolekcje osiągnięć</h3><button type="button" class="hgp-secondary" data-action="back-gear">Wróć</button></div>'+
      '<div class="hgp-listgrid">'+categories.map(function(key){
        var group=items.filter(function(item){return item.category===key;}),done=earnedCount(group),progress=group.length?Math.round(done/group.length*100):0;
        return '<button type="button" class="hgp-listcard" data-action="open-category" data-value="'+key+'"><span class="hgp-listhead">'+svg(key==='cups'?'trophy':key==='sports'?'footprints':'award')+'<span><b>'+CATEGORIES[key]+'</b><small>'+done+' / '+group.length+' zdobytych</small></span>'+svg('chevron')+'</span><span class="hgp-meter"><span style="width:'+progress+'%"></span></span><span class="hgp-listmeta">'+progress+'% kolekcji</span></button>';
      }).join('')+'</div>';
  }
  function chests(){return '<div class="hgp-heading"><h3>'+svg('gift')+' Skrzynie</h3><button type="button" class="hgp-secondary" data-action="back-gear">Wróć</button></div>'+
      emptyPanel('Skrzynie nie są jeszcze dostępne','Nie uruchamiamy losowych nagród bez prawdziwego systemu przyznawania. Zdobyte odznaki możesz obejrzeć w Ekwipunku.','gift');}
  function viewHtml(){
    if(ui.tab==='daily')return daily();
    if(ui.tab==='collections')return collections();
    if(ui.tab==='chests')return chests();
    return gear();
  }
  function render(){
    syncAccount();
    root.innerHTML=hero()+tabs()+'<div id="hgpackPanel">'+(owner?viewHtml():emptyPanel('Zaloguj się do HealthGo','Plecak pokazuje nagrody i zapisuje listy dopiero po rozpoznaniu Twojego konta.','lock'))+'</div>';
    page.classList.add('hgpack-ready');
    if(ui.modal&&owner)displayModal();
  }
  function badgeDetail(item){
    var favorited=data.favorites.indexOf(item.id)>=0,spotlight=data.spotlight===item.id;
    var info='<div class="hgp-detail-icon">'+svg(badgeIcon(item))+'</div>'+
      '<p class="hgp-detail-desc">'+escapeHtml(item.description||item.requirementText||'')+'</p>'+
      '<div class="hgp-detail-rows"><span>Rzadkość</span><b>'+escapeHtml(RARITY[item.rarity]||'Zwykły')+'</b></div>'+
      '<div class="hgp-detail-rows"><span>Status</span><b>'+(item.earned?'Zdobyte':'Nieodkryte')+'</b></div>'+
      '<div class="hgp-detail-rows"><span>Zdobyto</span><b>'+escapeHtml(item.earnedAt?new Date(item.earnedAt).toLocaleDateString('pl-PL'):'—')+'</b></div>'+
      '<div class="hgp-detail-rows"><span>Źródło</span><b>'+escapeHtml(item.source||'Wyzwania i osiągnięcia')+'</b></div>'+
      '<div class="hgp-detail-rows"><span>Wymaganie</span><b>'+escapeHtml(item.requirementText||'—')+'</b></div>'+
      '<div class="hgp-dialog-actions">'+(item.earned?
        '<button type="button" class="hgp-secondary" data-action="favorite" data-id="'+escapeHtml(item.id)+'">'+svg('star')+' '+(favorited?'Usuń z ulubionych':'Dodaj do ulubionych')+'</button>'+
        '<button type="button" class="hgp-primary" data-action="spotlight" data-id="'+escapeHtml(item.id)+'">'+svg('award')+' '+(spotlight?'Usuń wyróżnienie':'Wyróżnij w plecaku')+'</button>':
        '<button type="button" class="hgp-secondary" data-action="challenges">Zobacz wyzwania '+svg('arrow')+'</button>')+'</div>';
    return info;
  }
  function listDetail(list){
    var count=list.items.filter(function(x){return x.done;}).length;
    return '<p class="hgp-detail-desc">Spakowano '+count+' z '+list.items.length+' rzeczy · '+percent(list)+'%'+(list.date?' · Termin: '+escapeHtml(list.date):'')+'</p>'+
      '<span class="hgp-meter"><span style="width:'+percent(list)+'%"></span></span>'+
      '<div style="margin-top:15px">'+list.items.map(function(item){
        return '<div class="hgp-itemrow '+(item.done?'is-done':'')+'"><label><input type="checkbox" data-change="toggle-item" data-list="'+escapeHtml(list.id)+'" data-id="'+escapeHtml(item.id)+'" '+(item.done?'checked':'')+'><span>'+escapeHtml(item.name)+'</span></label>'+
          '<button type="button" class="hgp-remove" data-action="remove-item" data-list="'+escapeHtml(list.id)+'" data-id="'+escapeHtml(item.id)+'" aria-label="Usuń '+escapeHtml(item.name)+'">'+svg('trash')+'</button></div>';
      }).join('')+'</div>'+
      '<form class="hgp-dialog-form" data-form="add-item" data-id="'+escapeHtml(list.id)+'" style="margin-top:16px"><label>Dodaj rzecz<input class="hgp-field" name="itemName" maxlength="90" required placeholder="Np. butelka wody" autocomplete="off"></label><button class="hgp-secondary" type="submit">'+svg('plus')+' Dodaj rzecz</button></form>'+
      '<div class="hgp-dialog-actions">'+
      '<button class="hgp-secondary" type="button" data-action="edit-list" data-id="'+escapeHtml(list.id)+'">'+svg('edit')+' Edytuj</button>'+
      '<button class="hgp-secondary" type="button" data-action="duplicate" data-id="'+escapeHtml(list.id)+'">'+svg('copy')+' Kopiuj</button>'+
      '<button class="hgp-secondary" type="button" data-action="share" data-id="'+escapeHtml(list.id)+'">'+svg('share')+' Udostępnij</button>'+
      '<button class="hgp-secondary" type="button" data-action="mark-all" data-id="'+escapeHtml(list.id)+'">'+svg('check')+' '+(percent(list)===100?'Odznacz wszystko':'Zaznacz wszystko')+'</button>'+
      '<button class="hgp-secondary" type="button" data-action="archive" data-id="'+escapeHtml(list.id)+'">'+svg('layers')+' '+(list.archived?'Przywróć':'Archiwizuj')+'</button>'+
      '<button class="hgp-secondary" type="button" data-action="delete" data-id="'+escapeHtml(list.id)+'">'+svg('trash')+' Usuń</button></div>';
  }
  function modalHtml(){
    if(!ui.modal)return null;
    var kind=ui.modal.type,entry=null,title='',body='';
    if(kind==='badge'){
      entry=findBadge(ui.modal.id);if(!entry)return null;
      title=entry.name;body=badgeDetail(entry);
    }else if(kind==='list'){
      entry=findList(ui.modal.id);if(!entry)return null;
      title=entry.name;body=listDetail(entry);
    }else if(kind==='edit'||kind==='new'){
      entry=kind==='edit'?findList(ui.modal.id):null;
      if(kind==='edit'&&!entry)return null;
      title=kind==='edit'?'Edytuj listę':'Nowa lista';
      body='<form class="hgp-dialog-form" data-form="list" data-id="'+(entry?escapeHtml(entry.id):'')+'">'+
        '<label>Nazwa listy<input class="hgp-field" name="listName" required maxlength="90" value="'+escapeHtml(entry?entry.name:'')+'" placeholder="Np. Plecak do szkoły" autocomplete="off"></label>'+
        '<label>Termin (opcjonalnie)<input class="hgp-field" name="listDate" type="date" value="'+escapeHtml(entry?entry.date:'')+'"></label>'+
        '<div class="hgp-dialog-actions"><button type="submit" class="hgp-primary">'+svg('check')+' '+(entry?'Zapisz zmiany':'Utwórz listę')+'</button></div></form>';
    }else if(kind==='settings'){
      title='O Plecaku 2.0';
      body='<p class="hgp-detail-desc">Plecak Hybrydowy PRO korzysta z istniejących osiągnięć oraz XP HealthGo. Checklista, ulubione i wyróżnienie są zapisywane tylko lokalnie na tym urządzeniu, osobno dla każdego konta.</p>'+
        '<div class="hgp-info">Powiadomienia w tle, synchronizacja list między urządzeniami, HealthCoins i skrzynie wymagają osobnego wdrożenia po stronie serwera.</div>';
    }
    return '<div class="hgp-overlay" data-overlay="1"><div class="hgp-dialog" role="dialog" aria-modal="true" aria-label="'+escapeHtml(title)+'">'+
      '<div class="hgp-dialog-head"><h3>'+escapeHtml(title)+'</h3><button type="button" class="hgp-iconbtn" data-action="close" aria-label="Zamknij">'+svg('x')+'</button></div>'+
      body+'</div></div>';
  }
  function displayModal(){
    var old=root.querySelector('.hgp-overlay');if(old)old.remove();
    var html=modalHtml();if(!html){ui.modal=null;return;}
    root.insertAdjacentHTML('beforeend',html);
    var closeBtn=root.querySelector('.hgp-overlay [data-action="close"]');if(closeBtn)closeBtn.focus({preventScroll:true});
  }
  function openModal(type,id){if(!owner)return;ui.modal={type:type,id:id||null};displayModal();}
  function closeModal(){ui.modal=null;var el=root.querySelector('.hgp-overlay');if(el)el.remove();}
  function message(text){if(typeof window.modal==='function')window.modal('Plecak 2.0',text);else window.alert(text);}
  function makeList(name,date,items){
    return {id:uuid(),name:safeText(name,90)||'Moja lista',date:date||'',archived:false,created:Date.now(),items:(items||[]).map(function(n){return {id:uuid(),name:safeText(n,90),done:false};})};
  }
  async function shareList(list){
    var out=list.name+'\n'+list.items.map(function(item){return (item.done?'☑ ':'☐ ')+item.name;}).join('\n');
    if(navigator.share){
      try{await navigator.share({title:list.name,text:out});return;}catch(err){if(err&&err.name==='AbortError')return;}
    }
    try{await navigator.clipboard.writeText(out);message('Lista skopiowana do schowka.');}
    catch(_){message('Nie udało się udostępnić listy w tej przeglądarce.');}
  }
  function navigate(pageId){
    closeModal();
    if(typeof window.mobileGo==='function')window.mobileGo(pageId);
    else if(typeof window.go==='function')window.go(pageId);
  }
  root.addEventListener('click',function(event){
    if(event.target.classList&&event.target.classList.contains('hgp-overlay')){closeModal();return;}
    var btn=event.target.closest('[data-action]');if(!btn||!root.contains(btn))return;
    var action=btn.getAttribute('data-action'),id=btn.getAttribute('data-id'),value=btn.getAttribute('data-value');
    if(action==='close'){closeModal();return;}
    if(action==='settings'||action==='new'){openModal(action==='new'?'new':'settings');return;}
    if(action==='ai'){navigate('ai');return;}
    if(action==='challenges'){navigate('challenges');return;}
    if(action==='badge'||action==='list'){openModal(action,id);return;}
    if(action==='tab'){ui.tab=value==='daily'?'daily':'gear';ui.modal=null;ui.search='';render();return;}
    if(action==='filter'){ui.filter=value;render();return;}
    if(action==='collections'){ui.tab='collections';render();return;}
    if(action==='chests'){ui.tab='chests';render();return;}
    if(action==='back-gear'){ui.tab='gear';render();return;}
    if(action==='open-category'){ui.tab='gear';ui.category=value;ui.filter='all';render();return;}
    if(action==='template'){
      var template=TEMPLATES[value];if(!template)return;
      mutate(function(d){d.lists.unshift(makeList(template.name,'',template.items));});
      if(data.lists[0])openModal('list',data.lists[0].id);
      return;
    }
    if(action==='favorite'||action==='spotlight'){
      var badge=findBadge(id);if(!badge||!badge.earned)return;
      mutate(function(d){
        if(action==='spotlight'){d.spotlight=d.spotlight===id?null:id;return;}
        d.favorites=d.favorites.indexOf(id)<0?d.favorites.concat(id):d.favorites.filter(function(x){return x!==id;});
      });
      return;
    }
    if(action==='edit-list'){openModal('edit',id);return;}
    var list=findList(id);if(!list)return;
    if(action==='duplicate'){
      mutate(function(d){var copy=makeList(list.name+' (kopia)',list.date,list.items.map(function(x){return x.name;}));d.lists.unshift(copy);ui.modal={type:'list',id:copy.id};});return;
    }
    if(action==='share'){shareList(list);return;}
    if(action==='delete'){
      if(!window.confirm('Usunąć listę „'+list.name+'”? Tej operacji nie można cofnąć.'))return;
      mutate(function(d){d.lists=d.lists.filter(function(x){return x.id!==id;});ui.modal=null;});return;
    }
    if(action==='archive'){
      mutate(function(){list.archived=!list.archived;ui.modal={type:'list',id:id};});return;
    }
    if(action==='mark-all'){
      var mark=percent(list)<100;
      mutate(function(){list.items.forEach(function(x){x.done=mark;});ui.modal={type:'list',id:id};});return;
    }
    if(action==='remove-item'){
      var itemId=btn.getAttribute('data-id'),listId=btn.getAttribute('data-list');
      var li=findList(listId);if(!li)return;
      mutate(function(){li.items=li.items.filter(function(x){return x.id!==itemId;});ui.modal={type:'list',id:listId};});return;
    }
  });
  root.addEventListener('change',function(event){
    var target=event.target,change=target.getAttribute('data-change');
    if(change==='category'){ui.category=target.value;render();return;}
    if(change==='sort'){ui.sort=target.value;render();return;}
    if(change==='toggle-item'){
      var li=findList(target.getAttribute('data-list'));if(!li)return;
      var item=li.items.find(function(x){return x.id===target.getAttribute('data-id');});if(!item)return;
      var checked=target.checked;
      mutate(function(){item.done=checked;ui.modal={type:'list',id:li.id};});return;
    }
  });
  root.addEventListener('input',function(event){
    var input=event.target;if(input.id!=='hgpackSearch')return;
    ui.search=input.value.slice(0,80);
    var focus=input.selectionStart;
    render();
    var newer=root.querySelector('#hgpackSearch');
    if(newer){newer.focus({preventScroll:true});try{newer.setSelectionRange(focus,focus);}catch(_){}}
  });
  root.addEventListener('submit',function(event){
    var form=event.target;if(!form.matches('[data-form]'))return;
    event.preventDefault();
    if(!owner)return;
    var kind=form.getAttribute('data-form');
    if(kind==='list'){
      var name=safeText(form.elements.listName.value,90),date=form.elements.listDate.value;
      if(!name)return;
      if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
      var lid=form.getAttribute('data-id');
      if(lid){
        var existing=findList(lid);if(!existing)return;
        mutate(function(){existing.name=name;existing.date=date;ui.modal={type:'list',id:lid};});
      }else{
        mutate(function(d){var created=makeList(name,date,[]);d.lists.unshift(created);ui.modal={type:'list',id:created.id};});
      }
      return;
    }
    if(kind==='add-item'){
      var id=form.getAttribute('data-id'),list=findList(id),itemName=safeText(form.elements.itemName.value,90);
      if(!list||!itemName||list.items.length>=100)return;
      mutate(function(){list.items.push({id:uuid(),name:itemName,done:false});ui.modal={type:'list',id:id};});
    }
  });
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&ui.modal)closeModal();});
  page.appendChild(root);
  Services.subscribe(function(){render();});
  window.addEventListener('pageshow',function(){render();});
  window.HealthGoPackPro={render:render,open:function(tab){ui.tab=tab==='daily'?'daily':'gear';navigate('backpack');render();}};
  render();
})();
