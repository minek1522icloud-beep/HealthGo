begin;

alter table public.profiles
  add column if not exists account_type_locked boolean not null default false;

update public.profiles p
set account_type = case
      when exists (select 1 from public.family_members fm where fm.user_id=p.id and fm.role='guardian') then 'guardian'
      when exists (select 1 from public.family_members fm where fm.user_id=p.id and fm.role='child') then 'child'
      else p.account_type
    end,
    account_type_locked = true,
    updated_at = now()
where exists (select 1 from public.family_members fm where fm.user_id=p.id);

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
  locked boolean;
  clean_name text:=left(nullif(trim(coalesce(p_nickname,'')),''),40);
begin
  if u is null then raise exception 'unauthenticated'; end if;
  if p_account_type not in ('standard','child','guardian') then raise exception 'invalid-account-type'; end if;
  if clean_name is null or char_length(clean_name)<3 then raise exception 'invalid-nickname'; end if;

  select account_type,account_type_locked into old_type,locked
  from public.profiles where id=u for update;

  if old_type is null then raise exception 'profile-not-found'; end if;
  if locked and old_type<>p_account_type then raise exception 'account-type-locked'; end if;

  update public.profiles
  set display_name=clean_name,
      account_type=case when locked then old_type else p_account_type end,
      account_type_locked=true,
      updated_at=now()
  where id=u
  returning * into row;

  insert into public.account_state(user_id) values(u)
  on conflict(user_id) do nothing;

  insert into public.xp_events(user_id,event_key,xp_amount,dedupe_key,event_payload,client_event_id,created_at)
  values(u,'PROFILE_CONFIGURED',25,'profile-configured',jsonb_build_object('accountType',row.account_type),'profile-configured',now())
  on conflict(user_id,dedupe_key) do nothing;

  return jsonb_build_object(
    'id',row.id,'nickname',row.display_name,'accountType',row.account_type,
    'configured',row.account_type_locked,'xp',row.xp,'level',row.level,'createdAt',row.created_at
  );
end $$;

revoke execute on function public.healthgo_configure_account(text,text) from public, anon;
grant execute on function public.healthgo_configure_account(text,text) to authenticated;

commit;
