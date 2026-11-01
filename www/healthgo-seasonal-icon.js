/* Seasonal icon synchronization for the installed native iOS app. */
(() => {
  'use strict';
  let plugin = null;
  let last = 0;
  function nativePlugin() {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.() || cap.getPlatform?.() !== 'ios' || typeof cap.registerPlugin !== 'function') return null;
    try { return plugin || (plugin = cap.registerPlugin('HealthGoSeasonalIcon')); }
    catch (_) { return null; }
  }
  async function sync() {
    const api = nativePlugin();
    if (!api || typeof api.syncSeasonalIcon !== 'function' || Date.now() - last < 60000) return;
    last = Date.now();
    try { await api.syncSeasonalIcon(); }
    catch (error) { console.warn('[HealthGo] Seasonal icon sync failed:', error); }
  }
  document.addEventListener('DOMContentLoaded', sync, {once:true});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('pageshow', sync);
  window.setInterval(sync, 30 * 60 * 1000);
})();
