/* Seasonal icon synchronization for the installed native iOS app. */
(() => {
  'use strict';
  let last = 0;
  async function sync() {
    const plugin = window.Capacitor?.Plugins?.HealthGoSeasonalIcon;
    if (!plugin || typeof plugin.syncSeasonalIcon !== 'function' || Date.now()-last < 60000) return;
    last = Date.now();
    try { await plugin.syncSeasonalIcon(); }
    catch (error) { console.warn('[HealthGo] Seasonal icon sync failed:', error); }
  }
  document.addEventListener('DOMContentLoaded', sync, {once:true});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('pageshow', sync);
})();
