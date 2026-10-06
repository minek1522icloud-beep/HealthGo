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
