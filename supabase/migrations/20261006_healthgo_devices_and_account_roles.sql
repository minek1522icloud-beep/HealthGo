begin;

alter table public.devices
  add column if not exists external_id text,
  add column if not exists connection_type text,
  add column if not exists battery_level integer check (battery_level is null or (battery_level between 0 and 100)),
  add column if not exists last_connected_at timestamptz,
  add column if not exists last_disconnected_at timestamptz;

create unique index if not exists devices_user_external_unique
on public.devices(user_id, external_id)
where external_id is not null;

create or replace function public.healthgo_register_device(
  p_external_id text,
  p_name text,
  p_platform text,
  p_device_type text,
  p_connection_type text default 'ble',
  p_battery_level integer default null,
  p_connected boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  u uuid:=auth.uid();
  row public.devices;
  ext text:=left(nullif(trim(coalesce(p_external_id,'')),''),200);
begin
  if u is null then raise exception 'unauthenticated'; end if;
  if ext is null then raise exception 'device-id-required'; end if;

  insert into public.devices(
    user_id,name,platform,device_type,external_id,connection_type,
    battery_level,last_sync_at,last_connected_at,last_disconnected_at
  )
  values(
    u,
    left(coalesce(nullif(trim(p_name),''),'Urządzenie Bluetooth'),120),
    left(coalesce(p_platform,'unknown'),60),
    left(coalesce(p_device_type,'bluetooth'),60),
    ext,
    left(coalesce(p_connection_type,'ble'),40),
    p_battery_level,
    now(),
    case when p_connected then now() else null end,
    case when p_connected then null else now() end
  )
  on conflict (user_id,external_id) where external_id is not null
  do update set
    name=excluded.name,
    platform=excluded.platform,
    device_type=excluded.device_type,
    connection_type=excluded.connection_type,
    battery_level=coalesce(excluded.battery_level,public.devices.battery_level),
    last_sync_at=now(),
    last_connected_at=case when p_connected then now() else public.devices.last_connected_at end,
    last_disconnected_at=case when p_connected then public.devices.last_disconnected_at else now() end
  returning * into row;

  return jsonb_build_object(
    'id',row.id,
    'externalId',row.external_id,
    'name',row.name,
    'platform',row.platform,
    'deviceType',row.device_type,
    'connectionType',row.connection_type,
    'batteryLevel',row.battery_level,
    'lastSyncAt',row.last_sync_at,
    'lastConnectedAt',row.last_connected_at,
    'lastDisconnectedAt',row.last_disconnected_at
  );
end $$;

create or replace function public.healthgo_configure_account(p_nickname text, p_account_type text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  u uuid:=auth.uid();
  row public.profiles;
  old_type text;
  old_name text;
begin
  if u is null then raise exception 'unauthenticated'; end if;
  if p_account_type not in ('standard','child','guardian') then raise exception 'invalid-account-type'; end if;

  select account_type,display_name into old_type,old_name
  from public.profiles
  where id=u
  for update;

  if old_type is null then raise exception 'profile-not-found'; end if;

  if old_name is not null and old_type<>p_account_type then
    raise exception 'account-type-locked';
  end if;

  update public.profiles
  set display_name=left(nullif(trim(p_nickname),''),40),
      account_type=case when old_name is null then p_account_type else old_type end,
      updated_at=now()
  where id=u
  returning * into row;

  insert into public.account_state(user_id) values(u)
  on conflict(user_id) do nothing;

  insert into public.xp_events(user_id,event_key,xp_amount,dedupe_key,event_payload,client_event_id,created_at)
  values(u,'PROFILE_CONFIGURED',25,'profile-configured',jsonb_build_object('accountType',row.account_type),'profile-configured',now())
  on conflict(user_id,dedupe_key) do nothing;

  return jsonb_build_object(
    'id',row.id,
    'nickname',row.display_name,
    'accountType',row.account_type,
    'configured',row.display_name is not null,
    'xp',row.xp,
    'level',row.level,
    'createdAt',row.created_at
  );
end $$;

create or replace function public.healthgo_create_family_named(p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  u uuid:=auth.uid();
  fid uuid;
  p public.profiles;
  family_name text;
begin
  if u is null then raise exception 'unauthenticated'; end if;
  select * into p from public.profiles where id=u;
  if p.id is null then raise exception 'profile-not-found'; end if;
  if p.account_type<>'guardian' then raise exception 'guardian-account-required'; end if;

  select family_id into fid from public.family_members where user_id=u limit 1;
  if fid is not null then
    return jsonb_build_object('familyId',fid,'existing',true);
  end if;

  family_name:=left(nullif(trim(coalesce(p_name,'')),''),60);
  if family_name is null then
    family_name:=left(coalesce(nullif(p.display_name,''),'HealthGo')||' Family',60);
  end if;

  insert into public.families(name,created_by)
  values(family_name,u)
  returning id into fid;

  insert into public.family_members(family_id,user_id,role)
  values(fid,u,'guardian');

  return jsonb_build_object('familyId',fid,'name',family_name,'existing',false);
end $$;

revoke execute on function public.healthgo_register_device(text,text,text,text,text,integer,boolean) from public, anon;
revoke execute on function public.healthgo_configure_account(text,text) from public, anon;
revoke execute on function public.healthgo_create_family_named(text) from public, anon;

grant execute on function public.healthgo_register_device(text,text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.healthgo_configure_account(text,text) to authenticated;
grant execute on function public.healthgo_create_family_named(text) to authenticated;

commit;
