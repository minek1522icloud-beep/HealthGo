/* HealthGo Christmas interactive map — preserves the real Leaflet/OSM map and navigation. */
(function(){
 'use strict';
 const root=document.getElementById('map');
 const map=document.getElementById('healthgoMap');
 if(!root||!map||document.getElementById('hgXmasMapIntro'))return;
 const intro=document.createElement('section');
 intro.id='hgXmasMapIntro';
 intro.className='hgxm-intro';
 intro.setAttribute('aria-label','Świąteczne narzędzia mapy');
 intro.innerHTML=[
  '<header class="hgxm-heading">',
   '<span class="hgxm-logo"><span aria-hidden="true">💚</span> Health<strong>Go</strong> <small>MAPS</small></span>',
   '<span class="hgxm-tag">❄️ ZIMOWA EDYCJA</span>',
  '</header>',
  '<div class="hgxm-hero">',
   '<span class="hgxm-snow hgxm-snow-one" aria-hidden="true">❄</span>',
   '<span class="hgxm-snow hgxm-snow-two" aria-hidden="true">❄</span>',
   '<span class="hgxm-snow hgxm-snow-three" aria-hidden="true">✧</span>',
   '<div class="hgxm-copy">',
    '<span class="hgxm-eyebrow">✦ ŚWIĄTECZNA MAPA HEALTHGO</span>',
    '<h2>Odkrywaj zimowy świat!</h2>',
    '<p>Twoja prawdziwa mapa, ulubione miejsca i nawigacja w świątecznej odsłonie.</p>',
    '<div class="hgxm-actions" role="group" aria-label="Szybkie działania na mapie">',
     '<button type="button" class="hgxm-action" data-hgxm-action="locate"><span aria-hidden="true">📍</span> Moja lokalizacja</button>',
     '<button type="button" class="hgxm-action" data-hgxm-action="search"><span aria-hidden="true">🔎</span> Znajdź miejsce</button>',
     '<button type="button" class="hgxm-action hgxm-action-red" data-hgxm-action="route"><span aria-hidden="true">🧭</span> Trasa</button>',
    '</div>',
   '</div>',
   '<button class="hgxm-tree" type="button" data-hgxm-action="tree" aria-pressed="false" aria-label="Rozświetl świąteczną choinkę">',
     '<span class="hgxm-star" aria-hidden="true">★</span>',
     '<span class="hgxm-tree-tier hgxm-tier-one" aria-hidden="true"></span>',
     '<span class="hgxm-tree-tier hgxm-tier-two" aria-hidden="true"></span>',
     '<span class="hgxm-tree-tier hgxm-tier-three" aria-hidden="true"></span>',
     '<span class="hgxm-tree-trunk" aria-hidden="true"></span>',
     '<span class="hgxm-tree-light hgxm-light-one" aria-hidden="true"></span>',
     '<span class="hgxm-tree-light hgxm-light-two" aria-hidden="true"></span>',
     '<span class="hgxm-tree-light hgxm-light-three" aria-hidden="true"></span>',
     '<span class="hgxm-tree-light hgxm-light-four" aria-hidden="true"></span>',
     '<span class="hgxm-tree-light hgxm-light-five" aria-hidden="true"></span>',
     '<span class="hgxm-present hgxm-present-red" aria-hidden="true">🎁</span>',
     '<span class="hgxm-present hgxm-present-gold" aria-hidden="true">🎁</span>',
     '<span class="hgxm-tree-caption" aria-hidden="true">Dotknij choinki ✨</span>',
   '</button>',
  '</div>',
  '<div class="hgxm-map-label">',
    '<span><b>🗺️ Twoja mapa</b><small>OpenStreetMap • rzeczywiste miejsca</small></span>',
    '<button type="button" class="hgxm-map-link" data-hgxm-action="explore">🎁 Odkrywaj</button>',
  '</div>',
  '<p id="hgxmStatus" class="hgxm-status" role="status" aria-live="polite"></p>'
 ].join('');
 const nav=document.getElementById('hgNavigationQuick');
 root.insertBefore(intro,nav||root.firstChild);
 const announce=(message)=>{
  const status=document.getElementById('hgxmStatus');
  if(status)status.textContent=message;
 };
 intro.addEventListener('click',function(event){
  const button=event.target.closest('[data-hgxm-action]');
  if(!button)return;
  const action=button.dataset.hgxmAction;
  if(action==='tree'){
   const lit=button.classList.toggle('hgxm-lit');
   button.setAttribute('aria-pressed',String(lit));
   button.setAttribute('aria-label',lit?'Zgaś świąteczne lampki':'Rozświetl świąteczną choinkę');
   announce(lit?'Choinka świeci! 🎄':'Lampki choinki wyłączone.');
   return;
  }
  if(action==='locate'){
   const existing=document.querySelector('#map .map-bar-btn[onclick="useMyLocation()"]');
   if(existing){existing.click();announce('Uruchamiam lokalizację po Twoim kliknięciu.');}
   else announce('Funkcja lokalizacji jest chwilowo niedostępna.');
  }else if(action==='search'){
   const search=document.getElementById('mapAddressInput');
   if(search){
    search.scrollIntoView({block:'center',behavior:'smooth'});
    search.focus({preventScroll:true});
    announce('Wpisz nazwę miejsca lub adres w polu wyszukiwania.');
   }else announce('Pole wyszukiwania mapy jest chwilowo niedostępne.');
  }else if(action==='route'){
   if(typeof window.HealthGoMapV2?.toggle==='function'){
    window.HealthGoMapV2.toggle('route');
    announce('Otwieram planowanie trasy. GPS zostanie użyty dopiero po zgodzie.');
   }else announce('Planowanie trasy jest chwilowo niedostępne.');
  }else if(action==='explore'){
   if(typeof window.go==='function')window.go('explore');
  }
 });
 window.HealthGoChristmasMap={ready:true};
})();