/* Christmas Map: keep the existing full-screen Leaflet map, add only a tiny optional tree. */
(function(){
 'use strict';
 const canvas=document.querySelector('#map .map-canvas-wrap');
 if(!canvas||document.getElementById('hgXmasMapTree'))return;
 const tree=document.createElement('button');
 tree.type='button';
 tree.id='hgXmasMapTree';
 tree.className='hgxm-mini-tree';
 tree.setAttribute('aria-label','Rozświetl choinkę');
 tree.setAttribute('aria-pressed','false');
 tree.setAttribute('title','Dotknij, aby rozświetlić choinkę');
 tree.innerHTML='<span class="hgxm-mini-icon" aria-hidden="true">🎄</span><span class="hgxm-mini-spark" aria-hidden="true">✦</span>';
 const status=document.createElement('span');
 status.id='hgxmTreeStatus';
 status.className='hgxm-sr-only';
 status.setAttribute('role','status');
 status.setAttribute('aria-live','polite');
 tree.addEventListener('pointerdown',event=>event.stopPropagation());
 tree.addEventListener('click',event=>{
  event.preventDefault();
  event.stopPropagation();
  const lit=tree.classList.toggle('hgxm-mini-lit');
  tree.setAttribute('aria-pressed',String(lit));
  tree.setAttribute('aria-label',lit?'Zgaś lampki choinki':'Rozświetl choinkę');
  status.textContent=lit?'Lampki choinki włączone.':'Lampki choinki wyłączone.';
 });
 canvas.append(tree,status);
 window.HealthGoChristmasMap={ready:true};
})();