begin;

create or replace function public.healthgo_update_family_permissions(p_child_id uuid, p_guardian_id uuid, p_scopes jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 u uuid:=auth.uid();
 fid uuid;
 caller_role text;
 target_role text;
 k text;
 requested boolean;
 current_allowed boolean;
 keys text[]:=array['HEALTH_ACTIVITY','HEALTH_SLEEP','HEALTH_HEART_RATE','DEVICE_STATUS','LOCATION_APPROXIMATE','LOCATION_PRECISE','CHALLENGE_PROGRESS','ACHIEVEMENTS','NOTIFICATIONS'];
begin
 if u is null then raise exception 'unauthenticated'; end if;
 select family_id,role into fid,caller_role from public.family_members where user_id=u limit 1;
 if fid is null then raise exception 'family-required'; end if;

 select role into target_role
 from public.family_members
 where family_id=fid and user_id=p_child_id
 limit 1;

 if target_role is null or target_role='guardian' then raise exception 'invalid-member'; end if;
 if not exists(select 1 from public.family_members where family_id=fid and user_id=p_guardian_id and role='guardian') then raise exception 'invalid-guardian'; end if;
 if caller_role='guardian' and u<>p_guardian_id then raise exception 'guardian-mismatch'; end if;
 if caller_role in ('child','member') and u<>p_child_id then raise exception 'member-can-only-revoke-own'; end if;
 if caller_role not in ('guardian','child','member') then raise exception 'permission-denied'; end if;

 foreach k in array keys loop
  requested:=coalesce((p_scopes->>k)::boolean,false);
  select allowed into current_allowed
  from public.family_permissions
  where family_id=fid and child_id=p_child_id and guardian_id=p_guardian_id and permission_key=k;

  if caller_role in ('child','member') and requested and coalesce(current_allowed,false)=false then
    raise exception 'member-cannot-grant';
  end if;

  insert into public.family_permissions(family_id,child_id,guardian_id,permission_key,allowed,updated_at)
  values(fid,p_child_id,p_guardian_id,k,requested,now())
  on conflict (family_id,child_id,guardian_id,permission_key)
  do update set allowed=excluded.allowed,updated_at=now();
 end loop;

 return jsonb_build_object('ok',true);
end $$;

create or replace function public.healthgo_get_family_member_health(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  u uuid:=auth.uid();
  fid uuid;
  caller_role text;
  target_role text;
  target_name text;
  allow_activity boolean:=false;
  allow_sleep boolean:=false;
  allow_heart boolean:=false;
  latest public.activity_daily;
begin
  if u is null then raise exception 'unauthenticated'; end if;

  select family_id,role into fid,caller_role
  from public.family_members
  where user_id=u
  limit 1;

  if fid is null then raise exception 'family-required'; end if;

  select fm.role,coalesce(p.display_name,'Użytkownik HealthGo')
  into target_role,target_name
  from public.family_members fm
  left join public.profiles p on p.id=fm.user_id
  where fm.family_id=fid and fm.user_id=p_member_id
  limit 1;

  if target_role is null then raise exception 'member-not-found'; end if;

  if p_member_id=u then
    allow_activity:=true;
    allow_sleep:=true;
    allow_heart:=true;
  elsif caller_role='guardian' and target_role in ('child','member') then
    select coalesce(bool_or(allowed),false) into allow_activity
    from public.family_permissions
    where family_id=fid and child_id=p_member_id and guardian_id=u and permission_key='HEALTH_ACTIVITY';

    select coalesce(bool_or(allowed),false) into allow_sleep
    from public.family_permissions
    where family_id=fid and child_id=p_member_id and guardian_id=u and permission_key='HEALTH_SLEEP';

    select coalesce(bool_or(allowed),false) into allow_heart
    from public.family_permissions
    where family_id=fid and child_id=p_member_id and guardian_id=u and permission_key='HEALTH_HEART_RATE';
  else
    raise exception 'permission-denied';
  end if;

  select * into latest
  from public.activity_daily
  where user_id=p_member_id
  order by activity_date desc
  limit 1;

  return jsonb_build_object(
    'uid',p_member_id,
    'nickname',target_name,
    'role',target_role,
    'activityDate',latest.activity_date,
    'source',case when allow_activity or allow_sleep or allow_heart then latest.source else null end,
    'updatedAt',case when allow_activity or allow_sleep or allow_heart then latest.updated_at else null end,
    'permissions',jsonb_build_object('activity',allow_activity,'sleep',allow_sleep,'heartRate',allow_heart),
    'steps',case when allow_activity then latest.steps else null end,
    'distanceMeters',case when allow_activity then latest.distance_meters else null end,
    'activeMinutes',case when allow_activity then latest.active_minutes else null end,
    'calories',case when allow_activity then latest.calories else null end,
    'sleepMinutes',case when allow_sleep then latest.sleep_minutes else null end,
    'heartRate',case when allow_heart then latest.heart_rate else null end
  );
end $$;

revoke execute on function public.healthgo_update_family_permissions(uuid,uuid,jsonb) from public, anon;
revoke execute on function public.healthgo_get_family_member_health(uuid) from public, anon;
grant execute on function public.healthgo_update_family_permissions(uuid,uuid,jsonb) to authenticated;
grant execute on function public.healthgo_get_family_member_health(uuid) to authenticated;

commit;
