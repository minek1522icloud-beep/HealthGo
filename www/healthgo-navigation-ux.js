/* HealthGo Navigation UX: actionable route launcher and honest GPS status.
 * Existing MapV2/MapPro handle geometry and real turn instructions.
 */
(function(w){
'use strict';
const $=id=>document.getElementById(id);
function go(page){if(typeof w.mobileGo==='function')w.mobileGo(page);else if(typeof w.go==='function')w.go(page);}
const root=$('hgNavigationQuick');
if(!root)return;
root.innerHTML='<div class="hgnu-top"><div><span>HEALTHGO · NAWIGACJA</span><strong>Dokąd idziemy?</strong><p>Wyszukaj cel. HealthGo pobierze rzeczywistą trasę i poprosi o zgodę na GPS.</p></div>'+
 '<div class="hgnu-actions"><button type="button" data-hgnu-search>⌕ Wpisz cel</button><button type="button" class="hgnu-primary" data-hgnu-route>➤ Rozpocznij</button></div></div>'+
 '<p class="hgnu-feedback" id="hgNavigationQuickStatus" role="status" aria-live="polite">Przygotuj nawigację. Przełączanie na widok prowadzenia nastąpi dopiero po poprawnym wyznaczeniu trasy i uruchomieniu GPS.</p>';
function say(text){const p=$('hgNavigationQuickStatus');if(p)p.textContent=text;}
function openPlanner(){
 go('map');
 const nav=w.HealthGoMapV2;
 if(!nav||typeof nav.toggle!=='function'){say('Mapa jeszcze się uruchamia. Spróbuj za chwilę.');return;}
 nav.toggle('route');
 const target=$('mapV2RouteTo');
 if(target){target.focus({preventScroll:true});target.scrollIntoView?.({behavior:'smooth',block:'center'});}
 say('Wpisz miejscowość, ulicę albo nazwę celu, następnie wybierz „Wyznacz trasę i prowadź”.');
}
async function begin(){
 go('map');
 const api=w.HealthGoMapV2;
 if(!api?.toggle||!api?.planRoute){say('Silnik trasy jest niedostępny. Sprawdź połączenie.');return}
 if(w.HealthGoMapPro?.isNavigating?.()){say('Prowadzenie GPS już działa.');return}
 api.toggle('route');
 const field=$('mapV2RouteTo');
 if(!String(field?.value||'').trim()){openPlanner();return}
 say('Sprawdzam cel i GPS…');
 const ok=await api.planRoute();
 if(ok&&w.HealthGoMapPro?.isNavigating?.()){
  say('Prowadzenie GPS jest włączone. Możesz użyć przycisku głosu.');
 }else{
  say(String($('mapV2RouteOutput')?.textContent||'Nie udało się uruchomić prowadzenia. Sprawdź dostęp GPS i spróbuj ponownie.'));
 }
}
root.addEventListener('click',event=>{
 if(event.target.closest('[data-hgnu-search]'))openPlanner();
 else if(event.target.closest('[data-hgnu-route]')){void begin();}
});
w.HealthGoNavigationQuick=Object.freeze({openPlanner,begin});
})(window);