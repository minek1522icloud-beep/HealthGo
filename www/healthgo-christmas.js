/* Accessible, reversible holiday decoration. Default: November to 6 January. */
(() => {
 'use strict';
 const KEY='healthgo.christmas.enabled';
 const activeByDate = (date = new Date()) => {
  const month=date.getMonth(),day=date.getDate();
  return month===10 || month===11 || (month===0 && day<=6);
 };
 const read = () => {
  try {
   const stored=localStorage.getItem(KEY);
   if(stored==='on')return true;
   if(stored==='off')return false;
  } catch (_) {}
  return activeByDate();
 };
 const apply = (enabled) => {
  document.body.classList.toggle('hg-christmas',Boolean(enabled));
  const button=document.getElementById('hgChristmasToggle');
  if(button) {
   button.textContent=enabled?'Wyłącz dekoracje świąteczne':'Włącz dekoracje świąteczne';
   button.setAttribute('aria-pressed',String(Boolean(enabled)));
  }
 };
 const toggle = () => {
  const enabled=!document.body.classList.contains('hg-christmas');
  try { localStorage.setItem(KEY,enabled?'on':'off'); } catch (_) {}
  apply(enabled);
 };
 window.HealthGoChristmas={toggle,apply,activeByDate};
 const init=()=>apply(read());
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
