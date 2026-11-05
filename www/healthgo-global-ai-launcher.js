(function(){
'use strict';
const ID='hgGlobalAiLauncher';
function activePage(){
 return document.querySelector('.page.active')?.id||'start';
}
function openAssistant(){
 if(typeof window.mobileGo==='function')window.mobileGo('ai');
 else if(typeof window.go==='function')window.go('ai');
 else{
  const target=document.getElementById('ai');
  if(target){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p===target));}
 }
 const input=document.querySelector('#ai textarea, #ai input[type="text"], #ai [contenteditable="true"]');
 if(input)setTimeout(()=>input.focus({preventScroll:true}),120);
}
function mount(){
 if(document.getElementById(ID))return;
 const button=document.createElement('button');
 button.id=ID;button.type='button';button.className='hg-global-ai-launcher';
 button.setAttribute('aria-label','Otwórz HealthGo AI');
 button.setAttribute('title','Otwórz HealthGo AI');
 button.innerHTML='<span class="hg-global-ai-orb" aria-hidden="true">✦</span><span class="hg-global-ai-label">Zapytaj AI</span>';
 button.addEventListener('click',openAssistant);
 document.body.appendChild(button);
 const sync=()=>{
  const page=activePage();
  button.classList.toggle('is-ai-page',page==='ai');
  button.setAttribute('aria-hidden',page==='ai'?'true':'false');
  button.tabIndex=page==='ai'?-1:0;
 };
 new MutationObserver(sync).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
