'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('desktop account backend uses Supabase and no Firebase Auth/Firestore/Functions compat scripts',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  assert.match(html,/\.\/supabase-client\.js/);
  assert.match(html,/oqrfapmdcofguwdvhbeo\.supabase\.co/);
  assert.doesNotMatch(html,/firebase-auth-compat|firebase-firestore-compat|firebase-functions-compat/);
  assert.doesNotMatch(html,/healthGoDb|healthGoAuth/);
});

test('Supabase client contains only the publishable browser key',()=>{
  const client=fs.readFileSync('www/supabase-client.js','utf8');
  assert.match(client,/sb_publishable_/);
  assert.doesNotMatch(client,/sb_secret_|service_role/);
});

test('Supabase migration provides HealthGo server RPCs and RLS-backed state',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261004_healthgo_backend.sql','utf8');
  for(const name of [
    'healthgo_configure_account',
    'healthgo_record_progress_event',
    'healthgo_create_family',
    'healthgo_create_family_invite',
    'healthgo_accept_family_invite',
    'healthgo_update_family_permissions',
    'healthgo_update_location_settings',
    'healthgo_publish_location',
    'healthgo_get_family_state'
  ]) assert.match(sql,new RegExp('function public\\.'+name,'i'));
  assert.match(sql,/enable row level security/i);
});

test('Windows release is no longer blocked by Firebase Functions deployment',()=>{
  const workflow=fs.readFileSync('.github/workflows/windows-release.yml','utf8');
  assert.doesNotMatch(workflow,/firebase-deploy\.yml/);
  assert.doesNotMatch(workflow,/needs:\s*\[validate,\s*firebase\]/);
});


test('auth UI exposes Google and email login and restores confirmation redirects',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  const client=fs.readFileSync('www/supabase-client.js','utf8');
  assert.doesNotMatch(html,/appleLoginBtn|Kontynuuj z Apple/);
  assert.match(html,/googleLoginBtn/);
  assert.match(client,/access_token=/);
  assert.match(client,/sessionFromUrl/);
});


test('authenticated table grants match HealthGo RLS client access',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261006_healthgo_authenticated_table_grants.sql','utf8');
  assert.match(sql,/grant\s+select\s+on\s+table\s+public\.profiles\s+to\s+authenticated/i);
  assert.match(sql,/grant\s+select\s*,\s*insert\s*,\s*update\s+on\s+table\s+public\.account_state\s+to\s+authenticated/i);
  assert.match(sql,/grant\s+select\s*,\s*insert\s*,\s*update\s+on\s+table\s+public\.activity_daily\s+to\s+authenticated/i);
});


test('family code invite is code-only and backend returns named locations',()=>{
  const ui=fs.readFileSync('www/healthgo-v2-ui.js','utf8');
  const sql=fs.readFileSync('supabase/migrations/20261006_healthgo_family_code_and_location_names.sql','utf8');
  assert.match(sql,/function public\.healthgo_create_family_invite\(\)/i);
  assert.match(sql,/extensions\.digest\(/i);
  assert.match(sql,/'nickname'\s*,\s*coalesce\(p\.display_name/i);
  assert.match(ui,/Wygeneruj kod rodzinny/);
  assert.match(ui,/loc\.nickname/);
  assert.doesNotMatch(ui,/new QRCode|Kopiuj link|kod i QR|zeskanuj/i);
});

test('account type setup is one-shot and devices refresh from Supabase',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  const services=fs.readFileSync('www/healthgo-services.js','utf8');
  const devices=fs.readFileSync('www/healthgo-devices.js','utf8');
  assert.match(html,/p&&p\.configured&&p\.accountType/);
  assert.match(html,/modal\?\.classList\.remove\('show'\)/);
  assert.match(html,/setupAccountSaving/);
  assert.match(services,/async function refreshDevices\(\)/);
  assert.match(services,/S\.db\.select\('devices'/);
  assert.match(devices,/Odśwież listę/);
  assert.match(devices,/Services\.refreshDevices/);
  assert.match(devices,/Urządzenia zapisane na koncie HealthGo/);
});


test('family locations render on map with account names',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  assert.match(html,/function renderFamilyLocationsOnMap\(\)/);
  assert.match(html,/family\?\.locations|family\.locations/);
  assert.match(html,/loc\.nickname/);
  assert.match(html,/bindTooltip\(healthGoEscape\(name\)/);
  assert.match(html,/showFamilyOnMap\(\)/);
});

test('HealthGo AI exposes response effort modes and sends them to both backends',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  const server=fs.readFileSync('healthgo-ai-server.mjs','utf8');
  const main=fs.readFileSync('main.cjs','utf8');
  const mobile=fs.readFileSync('www/healthgo-ai-entry.js','utf8');
  assert.match(html,/Przeciętny/);
  assert.match(html,/Średni/);
  assert.match(html,/Wysoki/);
  assert.match(html,/responseMode:aiResponseMode/);
  assert.match(server,/responseProfile/);
  assert.match(server,/num_predict:\s*responseProfile\.maxTokens/);
  assert.match(main,/responseProfile/);
  assert.match(main,/num_predict:\s*\n?\s*responseProfile\.maxTokens/);
  assert.match(mobile,/generationConfig:\{maxOutputTokens\}/);
});


test('Windows AI uses the bundled cloud client with local fallback and other-member stats',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  const ui=fs.readFileSync('www/healthgo-v2-ui.js','utf8');
  const workflow=fs.readFileSync('.github/workflows/windows-release.yml','utf8');
  assert.match(html,/healthGoAITimed\(askHealthGoMobileAI\(q,imageData\)/);
  assert.match(html,/CLOUD_AND_LOCAL_AI_UNAVAILABLE/);
  assert.match(html,/healthgo-ai-bundle\.js\?v=11/);
  assert.match(workflow,/Zbuduj pakiet HealthGo Cloud AI/);
  assert.match(workflow,/healthgo-ai-bundle\.js/);
  assert.doesNotMatch(ui,/Moje statystyki/);
  assert.match(ui,/btn\('Statystyki',async function\(\)/);
  assert.match(ui,/viewFamilyMemberStats\(uid\)/);
});


test('optional 2FA prompt is dismissible and map uses profile markers',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  assert.match(html,/auth-mfa-close/);
  assert.match(html,/dismissible:true/);
  assert.match(html,/event\.target===back/);
  assert.match(html,/function healthGoProfileIcon\(/);
  assert.match(html,/L\.divIcon\(/);
  assert.match(html,/healthgo-profile-marker/);
});

test('hosted mobile uses App Check while localhost Electron avoids production attestation',()=>{
  const entry=fs.readFileSync('www/healthgo-ai-entry.js','utf8');
  const html=fs.readFileSync('www/index.html','utf8');
  assert.match(entry,/desktopLocal/);
  assert.match(entry,/initializeAppCheck\(aiApp/);
  assert.match(entry,/if\(!desktopLocal\)/);
  assert.match(entry,/getToken\(appCheck,true\)/);
  assert.match(html,/healthGoLoadAIBundle/);
  assert.match(html,/healthgo-ai-bundle\.js\?v=10/);
});


test('family member stats support standard members',()=>{
  const ui=fs.readFileSync('www/healthgo-v2-ui.js','utf8');
  const sql=fs.readFileSync('supabase/migrations/20261007_family_member_stats_permissions.sql','utf8');
  assert.match(ui,/if\(uid!==s\.uid\)/);
  assert.match(ui,/btn\('Statystyki'/);
  assert.match(ui,/Uprawnienia członka/);
  assert.match(sql,/target_role in \('child','member'\)/i);
  assert.match(sql,/caller_role not in \('guardian','child','member'\)/i);
});

test('AI uses cloud first and keeps Ollama as the persistent fallback',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  const main=fs.readFileSync('main.cjs','utf8');
  assert.match(html,/healthGoAITimed\(askHealthGoMobileAI/);
  assert.match(html,/AI lokalne — tryb awaryjny/);
  assert.match(html,/requestLocalHealthGoAI/);
  assert.match(main,/keep_alive:\s*\n?\s*"10m"/);
  assert.match(main,/average:\s*\{[\s\S]*?maxTokens:\s*140/);
  assert.match(main,/medium:\s*\{[\s\S]*?maxTokens:\s*320/);
  assert.match(main,/high:\s*\{[\s\S]*?maxTokens:\s*700/);
});


test('cloud-first AI and visible other-member stats',()=>{
  const html=fs.readFileSync('www/index.html','utf8');
  const ai=fs.readFileSync('www/healthgo-ai-entry.js','utf8');
  const ui=fs.readFileSync('www/healthgo-v2-ui.js','utf8');
  assert.match(html,/AI Cloud łączy się/);
  assert.match(html,/healthGoAITimed\(askHealthGoMobileAI/);
  assert.match(html,/AI lokalne — tryb awaryjny/);
  assert.match(ai,/gemini-3\.5-flash-lite/);
  assert.match(ai,/gemini-3\.8-flash/);
  assert.match(ai,/level==='average'/);
  assert.match(ai,/level==='medium'/);
  assert.match(ui,/uid!==s\.uid/);
  assert.match(ui,/Statystyki rodziny/);
});
