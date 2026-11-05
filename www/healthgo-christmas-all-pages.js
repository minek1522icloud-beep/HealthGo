/* HealthGo Holiday 2026 — the premium Christmas look for every app page.
 * Page content and data stay intact; this layer only adds seasonal presentation.
 * Dynamic Family/Notifications pages are included via a low-cost root observer. */
(() => {
 'use strict';
 const descriptions={
  ai:{icon:'✨',title:'Świąteczne HealthGo AI',subtitle:'Twój asystent na zimowe dni',message:'Rozmawiaj, planuj i odkrywaj przydatne funkcje HealthGo.',links:['plan','family','activity']},
  map:{icon:'🗺️',title:'Zimowa Mapa HealthGo',subtitle:'Odkrywaj zimowy świat',message:'Wyszukuj miejsca i trasy korzystając ze swojej mapy.',links:['explore','plan','activity']},
  explore:{icon:'🧭',title:'Świąteczne odkrywanie',subtitle:'Małe przygody, wielka radość',message:'Odkrywaj miejsca i zdobywaj prawdziwe osiągnięcia.',links:['map','points','challenges']},
  points:{icon:'🎁',title:'Świąteczne HealthGo Point',subtitle:'Twoje punkty i nagrody',message:'Sprawdź swoje punkty, nagrody i świąteczne odkrycia.',links:['backpack','challenges','explore']},
  contests:{icon:'🏆',title:'Zimowe konkursy',subtitle:'Nowe cele i wyzwania',message:'Sprawdź dostępne wyzwania i swoje osiągnięcia.',links:['challenges','points','backpack']},
  plan:{icon:'📅',title:'Świąteczny Plan Dnia',subtitle:'Zaplanuj wyjątkowe dni',message:'Twoje wydarzenia, cele i przypomnienia w jednym miejscu.',links:['activity','challenges','map']},
  challenges:{icon:'⭐',title:'Świąteczne wyzwania',subtitle:'Małe kroki, wielkie osiągnięcia',message:'Podejmuj dostępne wyzwania i śledź postępy.',links:['points','backpack','plan']},
  backpack:{icon:'🎒',title:'Świąteczny Plecak',subtitle:'Twoja kolekcja osiągnięć',message:'Zobacz zdobyte odznaki, nagrody i puchary.',links:['points','challenges','explore']},
  devices:{icon:'⌚',title:'Świąteczne urządzenia',subtitle:'Twoje połączone źródła danych',message:'Sprawdzaj odczyty i stan synchronizacji urządzeń.',links:['activity','settings','family']},
  activity:{icon:'👟',title:'Zimowa aktywność',subtitle:'Twój ruch i zdrowe nawyki',message:'Śledź rzeczywiste odczyty z połączonych urządzeń.',links:['devices','plan','challenges']},
  settings:{icon:'⚙️',title:'Świąteczne ustawienia',subtitle:'Dopasuj HealthGo do siebie',message:'Konto, bezpieczeństwo, prywatność i wygląd aplikacji.',links:['family','ai','devices']},
  family:{icon:'👨‍👩‍👧',title:'Świąteczne Family',subtitle:'Razem podczas świąt',message:'Zarządzaj rodziną i uprawnieniami w jednym miejscu.',links:['plan','challenges','points']},
  notifications:{icon:'🔔',title:'Świąteczne powiadomienia',subtitle:'Wszystkie ważne informacje',message:'Sprawdzaj aktualności i powiadomienia z HealthGo.',links:['settings','family','ai']}
 };
 const labels={
  start:['🏠','Start'],ai:['✨','AI'],map:['📍','Mapa'],explore:['🧭','Odkrywaj'],
  points:['🎁','HealthGo Point'],contests:['🏆','Konkursy'],plan:['📅','Plan dnia'],
  challenges:['⭐','Wyzwania'],backpack:['🎒','Plecak'],devices:['⌚','Urządzenia'],
  activity:['👟','Aktywność'],settings:['⚙️','Ustawienia'],family:['👪','Rodzina'],
  notifications:['🔔','Powiadomienia']
 };
 const fallback={
  icon:'🎮',title:'Świąteczna przygoda',subtitle:'Świąteczny świat HealthGo',
  message:'Odkrywaj kolejne funkcje w zimowym stylu.',links:['challenges','points','backpack']
 };
 const element=(tag,className,content)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(content!==undefined)node.textContent=content;
  return node;
 };
 const pageRoot=()=>document.querySelector('main.main');
 function decorate(page){
  if(!page || !page.classList?.contains('page') || !page.id || page.id==='start')return;
  if(page.querySelector(':scope > .hgx-holiday-page'))return;
  const info=descriptions[page.id]||fallback;
  const root=element('div','hgx-holiday-page');
  root.dataset.hgxOwner=page.id;
  const head=element('header','hgx-holiday-head');
  head.setAttribute('aria-label','Świąteczny wygląd HealthGo');
  const logo=element('div','hgx-holiday-logo');
  logo.innerHTML='<span aria-hidden="true">💚</span><span>Health<strong>Go</strong></span>';
  head.append(logo,element('h2','hgx-holiday-greeting','Wesołych Świąt!'),element('p','hgx-holiday-subtitle','Zadbaj o zdrowie w świątecznym stylu'));
  const divider=element('span','hgx-gold-divider','✦ 🎀 ✦');divider.setAttribute('aria-hidden','true');head.append(divider);
  const hero=element('section','hgx-holiday-hero');
  hero.setAttribute('aria-label',info.title);
  const ribbon=element('span','hgx-holiday-ribbon','🎀');ribbon.setAttribute('aria-hidden','true');
  const copy=element('div','hgx-holiday-hero-copy');
  const overline=element('span','hgx-holiday-kicker','✦ HEALTHGO CHRISTMAS');
  copy.append(overline,element('h3','hgx-holiday-title',info.title),element('p','hgx-holiday-message',info.message));
  const pill=element('span','hgx-holiday-hero-tag',info.icon+' '+info.subtitle);
  copy.append(pill);hero.append(ribbon,copy);
  const nav=element('nav','hgx-holiday-shortcuts');
  nav.setAttribute('aria-label','Świąteczny szybki dostęp');
  const h=element('h3','hgx-shortcuts-title','⚡ Szybki dostęp');
  const row=element('div','hgx-shortcuts-row');
  for(const id of info.links){
   const label=labels[id];
   if(!label)continue;
   const button=element('button','hgx-shortcut');
   button.type='button';button.dataset.hgxGo=id;
   const icon=element('span','hgx-shortcut-icon',label[0]);
   icon.setAttribute('aria-hidden','true');
   const caption=element('span','hgx-shortcut-caption',label[1]);
   button.append(icon,caption);row.append(button);
  }
  nav.append(h,row);
  root.append(head,hero,nav);
  page.prepend(root);
 }
 function applyAll(){
  const main=pageRoot();
  if(!main)return;
  for(const page of main.querySelectorAll(':scope > section.page'))decorate(page);
 }
 document.addEventListener('click',event=>{
  const button=event.target?.closest?.('.hgx-holiday-page [data-hgx-go]');
  if(!button)return;
  const destination=button.dataset.hgxGo;
  if(!Object.hasOwn(labels,destination))return;
  if(document.getElementById(destination) && typeof window.go==='function')window.go(destination);
 },false);
 function init(){
  applyAll();
  const main=pageRoot();
  if(!main || typeof MutationObserver!=='function')return;
  const observer=new MutationObserver(records=>{
   for(const record of records){
    for(const node of record.addedNodes){
     if(node.nodeType===1 && node.matches?.('section.page')){
      decorate(node);
     }
    }
   }
  });
  observer.observe(main,{childList:true});
  window.addEventListener('pageshow',applyAll);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
