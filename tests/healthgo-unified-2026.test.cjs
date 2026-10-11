'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=p=>fs.readFileSync(p,'utf8');
const html=src('www/index.html');
const sql=src('supabase/migrations/20261011_healthgo_point_treasure.sql');
test('broken third-party games are gone, their code is not bundled, but the rest of HealthGo remains',()=>{
 assert.match(html,/id="hgPointCenter"/);
 assert.match(html,/id="hgTreasureCenter"/);
 assert.match(html,/id="hgNavigationQuick"/);
 for(const bad of ['community-games/','healthgo-arcade40.js','healthgo-game-library.js','id="hgArcadeMaze"','id="hgGameLibrary"'])
  assert.ok(!html.includes(bad),'legacy game in HealthGo: '+bad);
 assert.ok(!fs.existsSync('www/community-games/fruit-slice/index.html'));
 assert.match(html,/id="backpack"/);
 assert.match(html,/healthgo-badge-shields.js\?v=1/);
 assert.match(html,/healthgo-map-v2.js\?v=4/);
 assert.match(html,/healthgo-profile-pro.js\?v=5/);
});
test('new scripts compile and are wired to the main HTML',()=>{
 for(const name of ['healthgo-point','healthgo-treasure','healthgo-navigation-ux']){
  new vm.Script(src('www/'+name+'.js'),{filename:name});
  assert.ok(html.includes(name+'.js?v=1'));
 }
 assert.match(html,/healthgo-point.css\?v=1/);
 assert.match(html,/healthgo-unified-polish.css\?v=1/);
});
test('server-side HealthGo Point never lets browser mint spendable balance',()=>{
 assert.match(sql,/create table if not exists public\.hg_point_wallets/);
 assert.match(sql,/alter table public\.hg_point_wallets enable row level security/);
 assert.match(sql,/revoke all on public\.hg_point_wallets/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/create or replace function public\.hg_point_claim/);
 assert.match(sql,/create or replace function public\.hg_point_redeem/);
 assert.match(sql,/create or replace function public\.hg_point_gift/);
 assert.match(sql,/status='accepted'/);
 assert.match(sql,/p_accuracy not between 1 and 35/);
 assert.match(sql,/distance_m>60/);
 assert.match(sql,/is_public_safe/);
 assert.match(sql,/daily_count>=8/);
 assert.match(sql,/units=units-1|units=units-product\.price_units/);
 assert.doesNotMatch(src('www/healthgo-point.js'),/insert\(['"]hg_point_wallets/);
});
test('no cash-out or physical product redemption is implemented',()=>{
 assert.match(sql,/digital_only boolean not null default true check\(digital_only = true\)/);
 assert.match(sql,/p_units not between 1 and 10/);
 assert.doesNotMatch(sql,/credit_card|stripe|payment|payout|cashout/i);
 assert.match(src('www/healthgo-point.js'),/wyłącznie wirtualne/i);
});
test('treasure flow uses opt-in GPS, camera file, second fix and SHA256; no fake photo recognition',()=>{
 const s=src('www/healthgo-treasure.js');
 assert.match(s,/getCurrentPosition/);
 assert.match(s,/const first=await gps\(\)/);
 assert.match(s,/const second=await gps\(\)/);
 assert.match(s,/photo\.arrayBuffer\(\)/);
 assert.match(s,/SHA-256/);
 assert.match(s,/api\.rpc\('hg_point_claim'/);
 assert.match(s,/photo.*rozpoznaje|rozpoznaje jeszcze/i);
 assert.doesNotMatch(s,/watchPosition/);
});
test('navigation uses existing MapV2 actual route plan instead of static fake map',()=>{
 const s=src('www/healthgo-navigation-ux.js');
 assert.match(s,/api\.planRoute\(\)/);
 assert.match(s,/HealthGoMapPro\?\.isNavigating/);
 assert.match(s,/tryb|GPS|trasa|nawigacj/i);
 assert.match(html,/id="hgNavigationPerspective"/);
});