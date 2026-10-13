/* Visible installer entry inside HealthGo settings, no fake native download. */
(function(w,d){
'use strict';
function mount(){
 const parent=d.getElementById('settingsHelp');
 if(!parent||d.getElementById('healthgoInstallEntry'))return;
 const link=d.createElement('a');
 link.id='healthgoInstallEntry';
 link.href='./install.html';
 link.textContent='📲 Pobierz HealthGo na telefon';
 link.style.cssText='display:flex;align-items:center;justify-content:center;min-height:48px;margin-top:12px;padding:12px 16px;border-radius:14px;border:1px solid #7ce2ad;background:#15472f;color:#dffff0;font-weight:800;text-decoration:none;text-align:center';
 parent.appendChild(link);
}
mount();d.addEventListener('DOMContentLoaded',mount);w.addEventListener('pageshow',mount);
})(window,document);
