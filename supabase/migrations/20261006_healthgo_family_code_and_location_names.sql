begin;

create or replace function public.healthgo_create_family_invite()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  u uuid:=auth.uid();
  fid uuid;
  caller_role text;
  raw_code text;
  code_hash_value text;
  expiry timestamptz:=now()+interval '30 minutes';
begin
  if u is null then raise exception 'unauthenticated'; end if;

  select family_id,role into fid,caller_role
  from public.family_members
  where user_id=u
  limit 1;

  if fid is null then raise exception 'family-not-found'; end if;
  if caller_role<>'guardian' then raise exception 'guardian-account-required'; end if;

  update public.family_invites
  set expires_at=now()
  where family_id=fid and used_at is null and expires_at>now();

  loop
    raw_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    code_hash_value:=encode(extensions.digest(raw_code,'sha256'),'hex');
    exit when not exists(select 1 from public.family_invites where code_hash=code_hash_value);
  end loop;

  insert into public.family_invites(family_id,inviter_uid,code_hash,expires_at)
  values(fid,u,code_hash_value,expiry);

  return jsonb_build_object('code',raw_code,'expiresAt',expiry,'familyId',fid);
end $$;

create or replace function public.healthgo_accept_family_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  u uuid:=auth.uid();
  inv public.family_invites;
  existing uuid;
  acct text;
  join_role text;
  clean_code text;
begin
  if u is null then raise exception 'unauthenticated'; end if;

  select account_type into acct from public.profiles where id=u;
  if acct is null then raise exception 'profile-not-found'; end if;

  clean_code:=upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g'));

  select * into inv
  from public.family_invites
  where code_hash=encode(extensions.digest(clean_code,'sha256'),'hex')
    and used_at is null
    and expires_at>now()
  order by created_at desc
  limit 1
  for update;

  if inv.id is null then raise exception 'invite-invalid-or-expired'; end if;

  select family_id into existing from public.family_members where user_id=u limit 1;
  if existing is not null and existing<>inv.family_id then raise exception 'already-in-another-family'; end if;

  join_role:=case
    when acct='child' then 'child'
    when acct='guardian' then 'guardian'
    else 'member'
  end;

  insert into public.family_members(family_id,user_id,role)
  values(inv.family_id,u,join_role)
  on conflict(family_id,user_id) do nothing;

  update public.family_invites
  set used_by=u,used_at=now()
  where id=inv.id;

  return jsonb_build_object('familyId',inv.family_id,'role',join_role);
end $$;

create or replace function public.healthgo_get_family_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  u uuid:=auth.uid();
  fid uuid;
  caller_role text;
  family_name text;
  family_created timestamptz;
  members jsonb;
  perms jsonb;
  locs jsonb;
begin
  if u is null then raise exception 'unauthenticated'; end if;

  select fm.family_id,fm.role,f.name,f.created_at
  into fid,caller_role,family_name,family_created
  from public.family_members fm
  join public.families f on f.id=fm.family_id
  where fm.user_id=u
  limit 1;

  if fid is null then
    return jsonb_build_object(
      'id',null,'name',null,'createdAt',null,'callerRole',null,
      'members','[]'::jsonb,'permissions','[]'::jsonb,'locations','[]'::jsonb,
      'devices','[]'::jsonb,'audit','[]'::jsonb,'invites','[]'::jsonb,'projections','{}'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'uid',fm.user_id,'id',fm.user_id,'role',fm.role,
        'nickname',p.display_name,'joinedAt',fm.joined_at
      )
      order by fm.joined_at
    ),
    '[]'::jsonb
  )
  into members
  from public.family_members fm
  left join public.profiles p on p.id=fm.user_id
  where fm.family_id=fid;

  select coalesce(
    jsonb_agg(jsonb_build_object('childUid',x.child_id,'guardianUid',x.guardian_id,'scopes',x.scopes)),
    '[]'::jsonb
  )
  into perms
  from (
    select fp.child_id,fp.guardian_id,jsonb_object_agg(fp.permission_key,fp.allowed) scopes
    from public.family_permissions fp
    where fp.family_id=fid
      and (fp.guardian_id=u or fp.child_id=u or caller_role='guardian')
    group by fp.child_id,fp.guardian_id
  ) x;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'uid',l.user_id,
        'nickname',coalesce(p.display_name,'Użytkownik HealthGo'),
        'mode',case when precise.allowed then l.share_mode else 'approximate' end,
        'latitude',case when l.user_id=u or precise.allowed then l.latitude else round(l.latitude::numeric,2)::double precision end,
        'longitude',case when l.user_id=u or precise.allowed then l.longitude else round(l.longitude::numeric,2)::double precision end,
        'accuracyMeters',case when l.user_id=u or precise.allowed then l.accuracy_meters else greatest(coalesce(l.accuracy_meters,0),1500) end,
        'device',l.device,
        'timestamp',l.shared_at
      )
      order by l.shared_at desc nulls last
    ),
    '[]'::jsonb
  )
  into locs
  from public.family_locations l
  left join public.profiles p on p.id=l.user_id
  left join lateral (
    select coalesce(bool_or(fp.allowed),false) allowed
    from public.family_permissions fp
    where fp.family_id=fid and fp.child_id=l.user_id and fp.guardian_id=u and fp.permission_key='LOCATION_PRECISE'
  ) precise on true
  left join lateral (
    select coalesce(bool_or(fp.allowed),false) allowed
    from public.family_permissions fp
    where fp.family_id=fid and fp.child_id=l.user_id and fp.guardian_id=u and fp.permission_key='LOCATION_APPROXIMATE'
  ) approx on true
  where l.family_id=fid
    and l.share_mode<>'off'
    and (l.user_id=u or precise.allowed or approx.allowed);

  return jsonb_build_object(
    'id',fid,'name',family_name,'createdAt',family_created,'callerRole',caller_role,
    'members',members,'permissions',perms,'locations',locs,
    'devices','[]'::jsonb,'audit','[]'::jsonb,'invites','[]'::jsonb,'projections','{}'::jsonb
  );
end $$;

revoke execute on function public.healthgo_create_family_invite() from public, anon;
revoke execute on function public.healthgo_accept_family_invite(text) from public, anon;
revoke execute on function public.healthgo_get_family_state() from public, anon;
grant execute on function public.healthgo_create_family_invite() to authenticated;
grant execute on function public.healthgo_accept_family_invite(text) to authenticated;
grant execute on function public.healthgo_get_family_state() to authenticated;

commit;
