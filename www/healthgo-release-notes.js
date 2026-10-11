/* HealthGo release announcements. Shown after login once per deployed build. */
(function(){
'use strict';
var Services=window.HealthGoServices;
if(!Services)return;
var RELEASE='healthgo-2.8-original-image-badges-20261011';
var TITLE='Prawdziwe grafiki odznak i prosty podgląd 3D';
var sections=[
 {title:'🏅 Odznaki dokładnie z Twojej planszy',items:[
 'Przygotowaliśmy atlas 252 osobnych grafik odznak bezpośrednio z przesłanego obrazu.',
 'Odznaki w Plecaku, profilu i gablocie pokazują ilustracje z kolekcji zamiast podobnych medali tworzonych algorytmem.',
 'Każdy odblokowany przedmiot pozostaje powiązany z rzeczywiście zdobytym osiągnięciem. Grafika nie przyznaje dodatkowego XP.',
 'W katalogu do obejrzenia nadal dostępne są warianty wzorów, ale nie oznaczają one zdobytych osiągnięć.'
 ]},
 {title:'🔄 Obracanie odznaki palcem',items:[
 'Kliknij odznakę w Plecaku, aby natychmiast otworzyć prosty obracany podgląd z frontem z obrazka i ozdobnym tyłem.',
 'Przesuwaj palcem lub myszką, aby obracać, przybliżaj dwoma palcami i używaj przycisków obracania.',
 'Przycisk Szczegóły nadal pokazuje warunki zdobycia, ulubione i gablotę.',
 'Podgląd wykorzystuje grafiki 2D w przestrzennej oprawie — nie jest skanem fizycznych medali 3D.'
 ]},
 {title:'🏅 Nowe modele i naprawa deformacji',items:[
 'Zastąpiliśmy niemal jednakowe, falowane koła 24 różnymi rodzinami sylwetek odznak: tarczami, koronami, kryształami, gwiazdami, skrzydłami i innymi.',
 'Wyraźniejsze emblematy środkowe odzwierciedlają temat zdobytego osiągnięcia.',
 'Naprawiliśmy style SVG, które mogły usuwać wypełnienia i szczegóły odznak.',
 'Medale w Plecaku, profilu i katalogu zachowują właściwe proporcje 1:1, bez rozciągania.'
 ]},
 {title:'🔍 Poprawiony podgląd 3D',items:[
 'Widok WebGL zachowuje proporcje geometryczne także na szerokim ekranie iPhona.',
 'Miniatury powstają teraz bez obliczania pełnej siatki 3D, dzięki czemu przewijanie Plecaka wymaga mniej zasobów.',
 'Nadal można obracać odznakę o 360°, przybliżać i wybierać ustawienie światła.'
 ]},
 {title:'🏛️ Twój Pokój Kolekcjonera',items:[
  'Po kliknięciu swojego awatara na ekranie Start otworzysz Mój profil, a nie ustawienia.',
  'W profilu dostępny jest Pokój Kolekcjonera z sześcioma podświetlanymi gablotami dla naprawdę zdobytych odznak.',
  'Wybierz szmaragdowy, arktyczny lub królewski wystrój pokoju. Własny wybór jest zapisywany na telefonie.',
  'Kliknij odznakę w pokoju, aby otworzyć jej obracany podgląd 360°.',
  'Możesz zapisać lokalnie kolekcjonerską kartę SVG. Nie zawiera prywatnych danych zdrowotnych.'
 ]},
 {title:'✨ Profesjonalne Inspect 3D',items:[
  'W gablocie odznaka unosi się nad podświetlanym cokołem w szklanej ekspozycji.',
  'Możesz obracać palcem, powiększać, włączyć autoobrót i przełączać oświetlenie szmaragdowe, arktyczne lub złote.',
  'Można też zapisać PNG przy włączonym WebGL lub przypiąć własną zdobytą odznakę do gabloty.',
  'Modele dostały 24 wzory środkowych emblematów dopasowywanych do kategorii osiągnięć.'
 ]},
 {title:'🎁 Darmowe kolekcje',items:[
  'Naklejki holograficzne, darmowe kosmetyczne skrzynie i codzienny upominek pozostają dostępne bez kupowania losowań.',
  'Osiągnięcia, XP i informacje zdrowotne nadal pochodzą z prawdziwych danych, nie z pokazowych wartości.'
 ]},
 {title:'🏅 240 autorskich modeli 3D',items:[
  'W Plecak → Ekwipunek znajdziesz katalog 240 różnych brył odznak. Można je oglądać, ale katalog sam w sobie nie przyznaje osiągnięć ani XP.',
  'Modele mają osobne kontury, reliefy, wystające części, zróżnicowaną grubość, metaliczne materiały i grawerunki.',
  'Po kliknięciu odznaki wybierz „Obejrzyj 3D”, by obracać ją palcem, oglądać rewers, przybliżać i zmieniać światło.',
  'Na urządzeniach obsługujących WebGL modele są prawdziwą geometrią przestrzenną; w pozostałych dostępny jest podgląd zastępczy.'
 ]},
 {title:'🏆 Ewolucja i gablota',items:[
  'Modele ewoluują wizualnie po zdobyciu odznaki, potem przy trzech i dziesięciu naprawdę zdobytych odznakach z tej samej kategorii.',
  'Gablota w profilu mieści teraz do sześciu zdobytych i zweryfikowanych odznak.',
  'Znajomi mogą oglądać Twój pokaz odznak zgodnie z ustawieniami prywatności profilu.',
  'Kliknij medal w gablocie, by otworzyć jego Inspect 360°.'
 ]},
 {title:'✨ Holograficzne naklejki i przestrzenne skrzynie',items:[
  'Holograficzne naklejki odbijają światło przy ruchu palca i można obejrzeć ich indywidualną fakturę.',
  'Ozdobną skrzynię możesz także oglądać jako model 3D, bez otwierania i zużywania darmowej nagrody.',
  'Darmowa skrzynia nadal zawiera kosmetyczną nagrodę i można pominąć animację. Nie ma płatnego losowania ani nagród o wartości pieniężnej.',
  'Nagroda dzienna i skrzynia powitalna pozostają darmowe, bez przymusu codziennego logowania.'
 ]},
 {title:'🏅 Osobna faktura każdej odznaki',items:['Każda odznaka ma indywidualną grafikę reliefu, grawerunek i numer seryjny przypisany do modelu.','Odznaki tej samej rzadkości różnią się wzorem i strukturą powierzchni, a nie tylko kolorem.']},
 {title:'✨ Kolekcjonerskie naklejki',items:['80 naklejek otrzymało indywidualne wzory i faktury holograficzne, metaliczne lub foliowane.','Dodaliśmy powiększony podgląd tekstury i dokładniejsze ilustracje skrzyń.']},
 {title:'🎁 Otwieranie i codzienne prezenty',items:['Przewijana taśma pokazuje kolekcję przedmiotów, a następnie zatrzymuje się na przyznanej ozdobie.','Pomiń animację w dowolnym momencie, by natychmiast zobaczyć ten sam wynik.','Codziennie możesz odebrać jedną bezpłatną ozdobę na konto, bez serii i kar za pominięte dni.','Nie ma płatnych skrzyń, zakładów, wymiany ani nagród o wartości pieniężnej.']},
 {title:'👤 Profil w stylu platformy gamingowej',items:['Profil i gablota mają nowe wielowarstwowe panele, metaliczne obramowania i teksturowane naklejki.','Publicznie udostępniasz tylko wybrane ozdoby. Prywatne dane zdrowotne pozostają chronione.']},
 {title:'👤 Profil PRO',items:[
  'Kliknij swój awatar w prawym górnym rogu, aby otworzyć pełną kartę profilu HealthGo.',
  'Wybierz jeden z ośmiu autorskich awatarów, zmień tapetę, ramkę, naklejkę i opis „O mnie”.',
  'Wybierz maksymalnie sześć naprawdę zdobytych odznak do gabloty profilu.',
  'Zapisz do trzech zestawów wyglądu i zmieniaj kosmetyki jednym kliknięciem.',
  'Własne zdjęcie avatara jest przechowywane tylko na tym urządzeniu, bez udostępniania znajomym.'
 ]},
 {title:'🤝 Profile znajomych i prywatność',items:[
  'W panelu Znajomi kliknij nick zaakceptowanego znajomego, aby zobaczyć jego kartę.',
  'Widoczność profilu można ustawić na prywatną lub dostępną dla zaakceptowanych znajomych.',
  'Publiczna karta to opcjonalny wybór dla kont, które ją obsługują. Konta dzieci nie mogą jej włączyć.',
  'E-mail, lokalizacja, dane zdrowotne i zdjęcie lokalne pozostają prywatne.',
  'Zestawy wyglądu i ozdobne ramki pomagają spersonalizować profil.'
 ]},
 {title:'🎁 Skrzynia powitalna',items:[
  'Po pierwszym zalogowaniu się do HealthGo otrzymujesz jedną darmową skrzynię na konto.',
  'Skrzynia zawiera losową kosmetyczną nagrodę: naklejkę albo tapetę profilu.',
  'Możesz obejrzeć animację otwierania albo kliknąć „Pomiń animację” i od razu zobaczyć prezent.',
  'Skrzynia startowa jest zapisywana na koncie, więc nie można jej odbierać ponownie przez zmianę telefonu.'
 ]},
 {title:'🤝 Znajomi i zaproszenia',items:[
  'W Ustawienia → Konto dostępny jest nowy panel znajomych.',
  'Każdy ma prywatny kod zaproszeń, który można dobrowolnie udostępnić drugiej osobie.',
  'Przyjmuj lub odrzucaj zaproszenia, usuwaj znajomych i blokuj niechciane kontakty.',
  'System nie ujawnia znajomym adresu e-mail, lokalizacji ani danych zdrowotnych.'
 ]},
 {title:'✨ Wielka kolekcja naklejek',items:[
  'Nowa kolekcja obejmuje 80 naklejek profilowych o różnych kolorach, kształtach i motywach.',
  'Ozdoby są bezpłatne i dostępne za osiągnięcia oraz w skrzyniach.',
  'Skrzynie losują naklejkę z szansą 75% albo tapetę z szansą 25%. Wszystkie są tylko kosmetyczne.',
  'Możesz zmieniać wyposażoną naklejkę i tapetę w Plecak → Prezenty.'
 ]},
 {title:'🎁 Nowość: prezenty za osiągnięcia',items:[
  'Każde rzeczywiście zdobyte osiągnięcie w HealthGo odblokowuje jeden darmowy prezent.',
  'W Plecaku znajdziesz nową gablotę „Prezenty i skrzynie” z liczbą upominków do odebrania.',
  'Część nagród to naklejki profilowe, a część to darmowe skrzynie kosmetyczne.',
  'Skrzynia może zawierać naklejkę lub jedną z autorskich tapet na profil. Zawartość jest przypisana do osiągnięcia.',
  'Prezenty nie wymagają płatności, nie mają wartości pieniężnej i nie można ich wymieniać na pieniądze.'
 ]},
 {title:'✨ Twój własny profil',items:[
  'Naklejkę możesz przypiąć do avatara HealthGo.',
  'Nową tapetą możesz ozdobić kartę profilu.',
  'Podgląd naklejki i tapety pojawia się w Ustawienia → Konto.',
  'Możesz zmieniać odblokowane dodatki, zdejmować naklejkę i przywracać domyślne tło.',
  'Dodatki są zapisane lokalnie na urządzeniu dla zalogowanego konta — synchronizacja między urządzeniami to osobny etap.'
 ]},
 {title:'🏅 Plecak 2.0 i odznaki',items:[
  'Zachowaliśmy metaliczne, trójwymiarowe odznaki o różnych kształtach i kolorach rzadkości.',
  'Zdobyte odznaki nadal pochodzą z prawdziwego systemu wyzwań.',
  'Otwieranie prezentów nie nalicza fałszywego XP ani nie odblokowuje osiągnięć bez wykonania zadania.',
  'Kalendarze, plan dnia, AI i nawigacja pozostają osobnymi funkcjami HealthGo.'
 ]},
 {title:'📱 Aktualizacje jak w grach',items:[
  'Po zainstalowaniu nowej wersji aplikacji zobaczysz pełnoekranowy dziennik zmian.',
  'Ogłoszenie można przewijać, a po zamknięciu nie będzie zasłaniać aplikacji przy każdym uruchomieniu tej samej wersji.',
  'W menu Pomoc możesz wrócić do informacji o aktualizacji.',
  'Zmiany są przygotowane z myślą o iPhonie, Androidzie oraz obsłudze dotykowej.'
 ]}
];
var KEY='healthgo.release-notes.last-build.v1';
var RELEASE_KEY='healthgo.release-notes.last-release.v1';
var scheduled=false,sessionShown='',focusBefore=null;
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function build(){return document.querySelector('meta[name="healthgo-build"]')?.getAttribute('content')||'';}
function knownBuild(){return /^[0-9a-f]{40}$/i.test(build());}
function hasSeen(){try{return localStorage.getItem(KEY)===build();}catch(_){return sessionShown===build();}}
function lastRelease(){try{return localStorage.getItem(RELEASE_KEY);}catch(_){return null;}}
function markRead(){
 sessionShown=build();
 try{localStorage.setItem(KEY,build());localStorage.setItem(RELEASE_KEY,RELEASE);}catch(_){}
}
function sectionHtml(item){
 return '<section class="hgu-section"><h3>'+escapeHtml(item.title)+'</h3><ul>'+item.items.map(function(s){return '<li>'+escapeHtml(s)+'</li>';}).join('')+'</ul></section>';
}
function newestContent(){
 var major=lastRelease()!==RELEASE;
 if(major)return sections.map(sectionHtml).join('');
 return sectionHtml({title:'Nowa wersja HealthGo',items:[
  'Aplikacja została uruchomiona w nowszej kompilacji.',
  'Ta kompilacja korzysta z obecnej funkcjonalności HealthGo. Szczegółowy opis zmian w kodzie znajdziesz w historii GitHub.',
  'Twoje dotychczasowe dane konta, listy w Plecaku i zdobyte osiągnięcia nie są kasowane przez to okno.',
  'Informacje o najważniejszych funkcjach bieżącego wydania możesz otworzyć ponownie z Ustawień.'
 ]})+sections.slice(0,2).map(sectionHtml).join('');
}
function setupButton(){
 var help=document.getElementById('settingsHelp');
 if(!help||document.getElementById('hguOpenNotes'))return;
 var b=document.createElement('button');b.id='hguOpenNotes';b.type='button';b.className='btn secondary hgu-settings-button';b.textContent='Co nowego w HealthGo?';
 b.addEventListener('click',function(){show(true);});
 help.appendChild(b);
}
function close(){
 var root=document.getElementById('hguReleaseOverlay');
 if(!root)return;
 root.remove();document.body.classList.remove('hgu-notes-open');
 markRead();
 if(focusBefore&&typeof focusBefore.focus==='function')focusBefore.focus({preventScroll:true});
 focusBefore=null;
}
function show(manual){
 setupButton();
 if(!manual&&(!knownBuild()||hasSeen()||sessionShown===build()))return false;
 if(!Services.state.uid||Services.state.loading)return false;
 var app=document.querySelector('.app');
 if(app&&app.classList.contains('auth-hidden'))return false;
 var setup=document.getElementById('accountSetup');
 if(setup&&setup.classList.contains('show'))return false;
 if(document.getElementById('hguReleaseOverlay'))return true;
 var root=document.createElement('div');root.id='hguReleaseOverlay';root.className='hgu-overlay';
 root.setAttribute('role','presentation');
 focusBefore=document.activeElement;
 var url=knownBuild()?'https://github.com/minek1522icloud-beep/HealthGo/commit/'+build():'https://github.com/minek1522icloud-beep/HealthGo/commits/main';
 root.innerHTML='<div class="hgu-modal" role="dialog" aria-modal="true" aria-labelledby="hguReleaseHeading" aria-describedby="hguReleaseCaption">'+
 '<header class="hgu-hero"><span class="hgu-overline">HEALTHGO • DZIENNIK AKTUALIZACJI</span><div class="hgu-version">AKTUALIZACJA 2.8</div>'+
 '<h2 id="hguReleaseHeading">'+escapeHtml(TITLE)+'</h2>'+
 '<p id="hguReleaseCaption">Witaj w nowej wersji! Poniżej znajdziesz pełną listę zmian i nowych możliwości.</p>'+
 '<div class="hgu-tags"><span>PREZENTY</span><span>NAKLEJKI</span><span>TAPETY</span><span>PLECAK 2.0</span></div></header>'+
 '<div class="hgu-body">'+(manual?sections.map(sectionHtml).join(''):newestContent())+
 '<div class="hgu-footer-note">Informacje dotyczą kosmetycznych dodatków, nie zakupów. Wszystkie prezenty są bezpłatne. <a href="'+url+'" target="_blank" rel="noopener noreferrer">Zobacz tę kompilację na GitHubie</a>.</div></div>'+
 '<footer class="hgu-actions"><span>Wersja: '+escapeHtml(knownBuild()?build().slice(0,8):'lokalna')+'</span>'+
 '<button type="button" id="hguCloseNotes">Zaczynamy!</button></footer></div>';
 root.addEventListener('click',function(ev){
  if(ev.target===root||ev.target.closest('#hguCloseNotes'))close();
 });
 root.addEventListener('keydown',function(ev){
  if(ev.key==='Escape'){ev.preventDefault();close();}
  if(ev.key!=='Tab')return;
  var focusables=Array.from(root.querySelectorAll('button,a[href]'));
  if(!focusables.length)return;
  var first=focusables[0],last=focusables[focusables.length-1];
  if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}
  else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}
 });
 document.body.appendChild(root);document.body.classList.add('hgu-notes-open');
 root.querySelector('#hguCloseNotes').focus({preventScroll:true});
 return true;
}
function maybeShow(){
 if(!knownBuild())return;
 show(false);
}
function schedule(){
 setupButton();
 if(scheduled)return;
 scheduled=true;
 setTimeout(function(){scheduled=false;maybeShow();},950);
}
Services.subscribe(function(s){setupButton();if(s.uid&&!s.loading)schedule();});
var setup=document.getElementById('accountSetup');
if(setup&&typeof MutationObserver==='function'){
 new MutationObserver(function(){if(!setup.classList.contains('show'))schedule();}).observe(setup,{attributes:true,attributeFilter:['class']});
}
window.addEventListener('pageshow',schedule);
window.HealthGoWhatsNew={show:function(){return show(true);},maybeShow:maybeShow,release:RELEASE};
})();
