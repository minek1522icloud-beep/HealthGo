begin;
create extension if not exists pgcrypto;

create table if not exists public.account_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan jsonb not null default '[]'::jsonb,
  manual_activities jsonb not null default '[]'::jsonb,
  settings_v3 jsonb not null default '{}'::jsonb,
  selected_title text,
  updated_at timestamptz not null default now()
);
create table if not exists public.location_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'off' check (mode in ('off','approximate','precise')),
  family_sharing boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  inviter_uid uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.activity_daily add column if not exists heart_rate double precision check (heart_rate is null or (heart_rate >= 0 and heart_rate <= 350));
alter table public.activity_daily add column if not exists sleep_minutes integer check (sleep_minutes is null or (sleep_minutes >= 0 and sleep_minutes <= 1440));
alter table public.xp_events add column if not exists event_payload jsonb not null default '{}'::jsonb;
alter table public.xp_events add column if not exists client_event_id text;
alter table public.family_locations add column if not exists accuracy_meters double precision;
alter table public.family_locations add column if not exists device text;

alter table public.account_state enable row level security;
alter table public.location_settings enable row level security;
alter table public.family_invites enable row level security;

drop policy if exists "account_state_own" on public.account_state;
create policy "account_state_own" on public.account_state for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "location_settings_read_own" on public.location_settings;
create policy "location_settings_read_own" on public.location_settings for select to authenticated
using (user_id = auth.uid());

drop policy if exists "family_invites_none" on public.family_invites;
create policy "family_invites_none" on public.family_invites for all to authenticated using (false) with check (false);

drop policy if exists "family_location_write_own" on public.family_locations;
drop policy if exists "family_location_read_own" on public.family_locations;
create policy "family_location_read_own" on public.family_locations for select to authenticated using (user_id = auth.uid());

create or replace function public.healthgo_configure_account(p_nickname text, p_account_type text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); row public.profiles;
begin
 if u is null then raise exception 'unauthenticated'; end if;
 if p_account_type not in ('standard','child','guardian') then raise exception 'invalid-account-type'; end if;
 update public.profiles set display_name=left(nullif(trim(p_nickname),''),40),account_type=p_account_type,updated_at=now() where id=u returning * into row;
 if row.id is null then raise exception 'profile-not-found'; end if;
 return jsonb_build_object('id',row.id,'nickname',row.display_name,'accountType',row.account_type,'configured',row.display_name is not null,'xp',row.xp,'level',row.level,'createdAt',row.created_at);
end $$;

create or replace function public.healthgo_create_family()
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); fid uuid; p public.profiles;
begin
 if u is null then raise exception 'unauthenticated'; end if;
 select * into p from public.profiles where id=u;
 if p.account_type='child' then raise exception 'child-cannot-create-family'; end if;
 select family_id into fid from public.family_members where user_id=u limit 1;
 if fid is not null then return jsonb_build_object('familyId',fid,'existing',true); end if;
 insert into public.families(name,created_by) values(coalesce(nullif(p.display_name,''),'HealthGo')||' Family',u) returning id into fid;
 insert into public.family_members(family_id,user_id,role) values(fid,u,'guardian');
 return jsonb_build_object('familyId',fid,'existing',false);
end $$;

create or replace function public.healthgo_create_family_invite()
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); fid uuid; code text; exp timestamptz:=now()+interval '30 minutes';
begin
 if u is null then raise exception 'unauthenticated'; end if;
 select family_id into fid from public.family_members where user_id=u and role='guardian' limit 1;
 if fid is null then raise exception 'guardian-family-required'; end if;
 code:=upper(encode(gen_random_bytes(6),'hex'));
 insert into public.family_invites(family_id,inviter_uid,code_hash,expires_at)
 values(fid,u,encode(digest(code,'sha256'),'hex'),exp);
 return jsonb_build_object('code',code,'expiresAt',exp);
end $$;

create or replace function public.healthgo_accept_family_invite(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); inv public.family_invites; existing uuid; acct text;
begin
 if u is null then raise exception 'unauthenticated'; end if;
 select account_type into acct from public.profiles where id=u;
 if acct<>'child' then raise exception 'child-account-required'; end if;
 select * into inv from public.family_invites
 where code_hash=encode(digest(upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g')),'sha256'),'hex')
 and used_at is null and expires_at>now() order by created_at desc limit 1 for update;
 if inv.id is null then raise exception 'invite-invalid-or-expired'; end if;
 select family_id into existing from public.family_members where user_id=u limit 1;
 if existing is not null and existing<>inv.family_id then raise exception 'already-in-another-family'; end if;
 insert into public.family_members(family_id,user_id,role) values(inv.family_id,u,'child') on conflict do nothing;
 update public.family_invites set used_by=u,used_at=now() where id=inv.id;
 return jsonb_build_object('familyId',inv.family_id);
end $$;

create or replace function public.healthgo_update_family_permissions(p_child_id uuid,p_guardian_id uuid,p_scopes jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); fid uuid; caller_role text; k text; requested boolean; current_allowed boolean;
 keys text[]:=array['HEALTH_ACTIVITY','HEALTH_SLEEP','HEALTH_HEART_RATE','DEVICE_STATUS','LOCATION_APPROXIMATE','LOCATION_PRECISE','CHALLENGE_PROGRESS','ACHIEVEMENTS','NOTIFICATIONS'];
begin
 if u is null then raise exception 'unauthenticated'; end if;
 select family_id,role into fid,caller_role from public.family_members where user_id=u limit 1;
 if fid is null then raise exception 'family-required'; end if;
 if not exists(select 1 from public.family_members where family_id=fid and user_id=p_child_id and role='child') then raise exception 'invalid-child'; end if;
 if not exists(select 1 from public.family_members where family_id=fid and user_id=p_guardian_id and role='guardian') then raise exception 'invalid-guardian'; end if;
 if caller_role='guardian' and u<>p_guardian_id then raise exception 'guardian-mismatch'; end if;
 if caller_role='child' and u<>p_child_id then raise exception 'child-can-only-revoke-own'; end if;
 if caller_role not in ('guardian','child') then raise exception 'permission-denied'; end if;
 foreach k in array keys loop
  requested:=coalesce((p_scopes->>k)::boolean,false);
  select allowed into current_allowed from public.family_permissions where family_id=fid and child_id=p_child_id and guardian_id=p_guardian_id and permission_key=k;
  if caller_role='child' and requested and coalesce(current_allowed,false)=false then raise exception 'child-cannot-grant'; end if;
  insert into public.family_permissions(family_id,child_id,guardian_id,permission_key,allowed,updated_at)
  values(fid,p_child_id,p_guardian_id,k,requested,now())
  on conflict (family_id,child_id,guardian_id,permission_key) do update set allowed=excluded.allowed,updated_at=now();
 end loop;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.healthgo_update_location_settings(p_mode text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); enabled boolean;
begin
 if u is null then raise exception 'unauthenticated'; end if;
 if p_mode not in ('off','approximate','precise') then raise exception 'invalid-location-mode'; end if;
 enabled:=p_mode<>'off';
 insert into public.location_settings(user_id,enabled,mode,family_sharing,updated_at)
 values(u,enabled,p_mode,enabled,now())
 on conflict(user_id) do update set enabled=excluded.enabled,mode=excluded.mode,family_sharing=excluded.family_sharing,updated_at=now();
 return jsonb_build_object('enabled',enabled,'mode',p_mode,'familySharing',enabled,'updatedAt',now());
end $$;

create or replace function public.healthgo_publish_location(p_latitude double precision,p_longitude double precision,p_accuracy double precision,p_device text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); fid uuid; s public.location_settings; lat double precision:=p_latitude; lon double precision:=p_longitude; acc double precision:=greatest(coalesce(p_accuracy,0),0);
begin
 if u is null then raise exception 'unauthenticated'; end if;
 if lat is null or lon is null or abs(lat)>90 or abs(lon)>180 then raise exception 'invalid-coordinates'; end if;
 select * into s from public.location_settings where user_id=u;
 if s.user_id is null or not s.enabled or s.mode='off' or not s.family_sharing then raise exception 'location-sharing-disabled'; end if;
 select family_id into fid from public.family_members where user_id=u limit 1;
 if fid is null then raise exception 'family-required'; end if;
 if s.mode='approximate' then lat:=round(lat::numeric,2)::double precision;lon:=round(lon::numeric,2)::double precision;acc:=greatest(acc,1500);end if;
 insert into public.family_locations(user_id,family_id,share_mode,latitude,longitude,shared_at,accuracy_meters,device)
 values(u,fid,s.mode,lat,lon,now(),acc,left(coalesce(p_device,'HealthGo'),120))
 on conflict(user_id) do update set family_id=excluded.family_id,share_mode=excluded.share_mode,latitude=excluded.latitude,longitude=excluded.longitude,shared_at=excluded.shared_at,accuracy_meters=excluded.accuracy_meters,device=excluded.device;
 return jsonb_build_object('status','saved','mode',s.mode,'timestamp',now());
end $$;

create or replace function public.healthgo_mark_notification_read(p_notification_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'unauthenticated'; end if;
 update public.notifications set read_at=now() where id=p_notification_id and user_id=u;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.healthgo_record_progress_event(p_event_id text,p_event_type text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); dkey text; xp int:=0; inserted int:=0; day text; plan_id text; task_id text; payload jsonb:=coalesce(p_payload,'{}'::jsonb); a public.activity_daily;
begin
 if u is null then raise exception 'unauthenticated'; end if;
 case p_event_type
  when 'PROFILE_CONFIGURED' then dkey:='profile-configured';xp:=25;payload:=jsonb_build_object('accountType',(select account_type from public.profiles where id=u));
  when 'PLAN_CREATED' then plan_id:=payload->>'planId';if coalesce(plan_id,'')='' then raise exception 'plan-id-required';end if;dkey:='plan-created:'||plan_id;xp:=5;
  when 'PLAN_COMPLETED' then plan_id:=payload->>'planId';day:=payload->>'day';if coalesce(plan_id,'')='' or coalesce(day,'')='' then raise exception 'plan-day-required';end if;dkey:='plan-completed:'||plan_id||':'||day;xp:=15;
  when 'DAILY_TASK_CONFIRMED' then task_id:=payload->>'taskId';day:=payload->>'day';if coalesce(task_id,'')='' or coalesce(day,'')='' then raise exception 'task-day-required';end if;dkey:='daily:'||task_id||':'||day;xp:=10;
  when 'AI_USED' then dkey:='ai-used';xp:=10;
  when 'MAP_EXPLORED' then dkey:='map-explored';xp:=10;
  when 'ACTIVITY_RECORDED' then dkey:='activity:'||coalesce(payload->>'activityId',p_event_id);xp:=10;
  when 'HEALTH_SYNCED' then
   day:=payload->>'day';if coalesce(day,'')='' then raise exception 'health-day-required';end if;
   select * into a from public.activity_daily where user_id=u and activity_date=day::date;
   if a.user_id is null then raise exception 'health-day-not-found';end if;
   payload:=jsonb_build_object('day',a.activity_date::text,'steps',a.steps,'distanceKm',coalesce(a.distance_meters,0)/1000.0,'activeMinutes',a.active_minutes,'source',a.source,'syncId','supabase-'||a.activity_date::text);
   dkey:='health:'||day;xp:=5;
  when 'FAMILY_CHALLENGE_COMPLETED' then
   if not exists(select 1 from public.family_members where user_id=u and family_id=(payload->>'familyId')::uuid) then raise exception 'family-permission-denied';end if;
   dkey:='family-challenge:'||(payload->>'familyId')||':'||(payload->>'challengeId');xp:=20;
  else raise exception 'unsupported-event';
 end case;
 insert into public.xp_events(user_id,event_key,xp_amount,dedupe_key,event_payload,client_event_id,created_at)
 values(u,p_event_type,xp,dkey,payload,left(coalesce(p_event_id,dkey),180),now())
 on conflict(user_id,dedupe_key) do nothing;
 get diagnostics inserted=row_count;
 return jsonb_build_object('duplicate',inserted=0,'xpAwarded',case when inserted=1 then xp else 0 end,'event',jsonb_build_object('id',coalesce(p_event_id,dkey),'type',p_event_type,'payload',payload,'occurredAt',now()));
end $$;

create or replace function public.healthgo_get_family_state()
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); fid uuid; role text; members jsonb; perms jsonb; locs jsonb;
begin
 if u is null then raise exception 'unauthenticated'; end if;
 select family_id,fm.role into fid,role from public.family_members fm where user_id=u limit 1;
 if fid is null then return jsonb_build_object('id',null,'members','[]'::jsonb,'permissions','[]'::jsonb,'locations','[]'::jsonb,'devices','[]'::jsonb,'audit','[]'::jsonb,'invites','[]'::jsonb,'projections','{}'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('uid',fm.user_id,'id',fm.user_id,'role',fm.role,'nickname',p.display_name,'joinedAt',fm.joined_at) order by fm.joined_at),'[]'::jsonb)
 into members from public.family_members fm left join public.profiles p on p.id=fm.user_id where fm.family_id=fid;
 select coalesce(jsonb_agg(jsonb_build_object('childUid',x.child_id,'guardianUid',x.guardian_id,'scopes',x.scopes)),'[]'::jsonb) into perms
 from (
  select fp.child_id,fp.guardian_id,jsonb_object_agg(fp.permission_key,fp.allowed) scopes
  from public.family_permissions fp where fp.family_id=fid and (fp.guardian_id=u or fp.child_id=u or role='guardian')
  group by fp.child_id,fp.guardian_id
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('uid',l.user_id,'mode',case when precise.allowed then l.share_mode else 'approximate' end,
  'latitude',case when l.user_id=u or precise.allowed then l.latitude else round(l.latitude::numeric,2)::double precision end,
  'longitude',case when l.user_id=u or precise.allowed then l.longitude else round(l.longitude::numeric,2)::double precision end,
  'accuracyMeters',case when l.user_id=u or precise.allowed then l.accuracy_meters else greatest(coalesce(l.accuracy_meters,0),1500) end,
  'device',l.device,'timestamp',l.shared_at))
 ,'[]'::jsonb) into locs
 from public.family_locations l
 left join lateral (select coalesce(bool_or(fp.allowed),false) allowed from public.family_permissions fp where fp.family_id=fid and fp.child_id=l.user_id and fp.guardian_id=u and fp.permission_key='LOCATION_PRECISE') precise on true
 left join lateral (select coalesce(bool_or(fp.allowed),false) allowed from public.family_permissions fp where fp.family_id=fid and fp.child_id=l.user_id and fp.guardian_id=u and fp.permission_key='LOCATION_APPROXIMATE') approx on true
 where l.family_id=fid and l.share_mode<>'off' and (l.user_id=u or precise.allowed or approx.allowed);
 return jsonb_build_object('id',fid,'members',members,'permissions',perms,'locations',locs,'devices','[]'::jsonb,'audit','[]'::jsonb,'invites','[]'::jsonb,'projections','{}'::jsonb);
end $$;

grant execute on function public.healthgo_configure_account(text,text) to authenticated;
grant execute on function public.healthgo_create_family() to authenticated;
grant execute on function public.healthgo_create_family_invite() to authenticated;
grant execute on function public.healthgo_accept_family_invite(text) to authenticated;
grant execute on function public.healthgo_update_family_permissions(uuid,uuid,jsonb) to authenticated;
grant execute on function public.healthgo_update_location_settings(text) to authenticated;
grant execute on function public.healthgo_publish_location(double precision,double precision,double precision,text) to authenticated;
grant execute on function public.healthgo_mark_notification_read(uuid) to authenticated;
grant execute on function public.healthgo_record_progress_event(text,text,jsonb) to authenticated;
grant execute on function public.healthgo_get_family_state() to authenticated;

commit;
