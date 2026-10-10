-- HealthGo 2.2 — welcome chest and consent-based friends. No trading or purchases.
create extension if not exists pgcrypto;
create table if not exists public.healthgo_starter_chests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reward_kind text check (reward_kind in ('sticker','wallpaper')),
  reward_item text,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  constraint starter_reward_consistent check
    ((opened_at is null and reward_kind is null and reward_item is null)
     or (opened_at is not null and reward_kind is not null and reward_item is not null))
);
alter table public.healthgo_starter_chests enable row level security;
revoke all on public.healthgo_starter_chests from public, anon, authenticated;

create table if not exists public.healthgo_friend_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.healthgo_friend_codes enable row level security;
revoke all on public.healthgo_friend_codes from public, anon, authenticated;

create table if not exists public.healthgo_friend_links (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friends_no_self check(requester_id<>recipient_id)
);
create unique index if not exists healthgo_friend_unique_pair
  on public.healthgo_friend_links (least(requester_id,recipient_id),greatest(requester_id,recipient_id));
create index if not exists healthgo_friend_recipient_status on public.healthgo_friend_links(recipient_id,status);
alter table public.healthgo_friend_links enable row level security;
revoke all on public.healthgo_friend_links from public,anon,authenticated;
grant select on public.healthgo_friend_links to authenticated;
drop policy if exists healthgo_friend_participant_read on public.healthgo_friend_links;
create policy healthgo_friend_participant_read on public.healthgo_friend_links
 for select to authenticated using (requester_id=(select auth.uid()) or recipient_id=(select auth.uid()));

create table if not exists public.healthgo_friend_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  constraint healthgo_block_no_self check(blocker_id<>blocked_id)
);
alter table public.healthgo_friend_blocks enable row level security;
revoke all on public.healthgo_friend_blocks from public,anon,authenticated;

create or replace function public.healthgo_starter_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); box public.healthgo_starter_chests%rowtype;
begin
 if who is null then raise exception 'Logowanie jest wymagane'; end if;
 insert into public.healthgo_starter_chests(user_id) values(who) on conflict do nothing;
 select * into box from public.healthgo_starter_chests where user_id=who;
 return jsonb_build_object('available',box.opened_at is null,'opened',box.opened_at is not null,
  'reward_kind',case when box.opened_at is not null then box.reward_kind else null end,
  'reward_item',case when box.opened_at is not null then box.reward_item else null end);
end $$;

create or replace function public.healthgo_starter_open()
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); box public.healthgo_starter_chests%rowtype;
declare num int; kind text; prize text; wallpapers text[]:=array['aurora','nebula','sunset','forest','violet','arctic'];
begin
 if who is null then raise exception 'Logowanie jest wymagane'; end if;
 insert into public.healthgo_starter_chests(user_id) values(who) on conflict do nothing;
 select * into box from public.healthgo_starter_chests where user_id=who for update;
 if box.opened_at is null then
  -- Cosmetic-only free drop: 75% sticker, 25% wallpaper.
  num:=get_byte(extensions.gen_random_bytes(2),0);
  if num<192 then
   kind:='sticker';
   prize:='s'||lpad((1+floor(random()*72)::int)::text,2,'0');
  else
   kind:='wallpaper';
   prize:=wallpapers[1+floor(random()*array_length(wallpapers,1))::int];
  end if;
  update public.healthgo_starter_chests set reward_kind=kind,reward_item=prize,opened_at=now() where user_id=who;
 else kind:=box.reward_kind;prize:=box.reward_item;
 end if;
 return jsonb_build_object('available',false,'opened',true,'reward_kind',kind,'reward_item',prize);
end $$;

create or replace function public.healthgo_friend_code()
returns text language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); value text;
begin
 if who is null then raise exception 'Logowanie jest wymagane'; end if;
 insert into public.healthgo_friend_codes(user_id,code)
 values(who,upper(encode(extensions.gen_random_bytes(9),'hex'))) on conflict(user_id) do nothing;
 select code into value from public.healthgo_friend_codes where user_id=who;
 return value;
end $$;

create or replace function public.healthgo_friend_send(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); target uuid; existing uuid; n int;
begin
 if who is null then raise exception 'Logowanie jest wymagane'; end if;
 if length(trim(coalesce(p_code,'')))<>18 then raise exception 'Nieprawidłowy kod zaproszenia'; end if;
 select user_id into target from public.healthgo_friend_codes where code=upper(trim(p_code));
 if target is null then raise exception 'Nie znaleziono użytkownika o takim kodzie'; end if;
 if target=who then raise exception 'Nie można zaprosić siebie'; end if;
 if exists(select 1 from public.healthgo_friend_blocks where (blocker_id=who and blocked_id=target) or (blocker_id=target and blocked_id=who))
  then raise exception 'Nie można wysłać tego zaproszenia'; end if;
 if exists(select 1 from public.healthgo_friend_links where (requester_id=who and recipient_id=target) or (requester_id=target and recipient_id=who))
  then raise exception 'Zaproszenie lub znajomość już istnieje'; end if;
 select count(*) into n from public.healthgo_friend_links where requester_id=who and created_at>now()-interval '24 hours';
 if n>=20 then raise exception 'Limit zaproszeń na dziś został osiągnięty'; end if;
 select count(*) into n from public.healthgo_friend_links where requester_id=who or recipient_id=who;
 if n>=120 then raise exception 'Limit kontaktów został osiągnięty'; end if;
 insert into public.healthgo_friend_links(requester_id,recipient_id) values(who,target) returning id into existing;
 return jsonb_build_object('id',existing,'status','pending');
end $$;

create or replace function public.healthgo_friend_action(p_action text,p_id uuid,p_accept boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); edge public.healthgo_friend_links%rowtype; other uuid;
begin
 if who is null then raise exception 'Logowanie jest wymagane'; end if;
 if p_action not in ('respond','remove','block','unblock') then raise exception 'Nieznana akcja'; end if;
 if p_action='unblock' then
  delete from public.healthgo_friend_blocks where blocker_id=who and blocked_id=p_id;
  return jsonb_build_object('ok',true);
 end if;
 select * into edge from public.healthgo_friend_links
 where id=p_id and (requester_id=who or recipient_id=who) for update;
 if edge.id is null then raise exception 'Nie znaleziono zaproszenia lub znajomego'; end if;
 other:=case when edge.requester_id=who then edge.recipient_id else edge.requester_id end;
 if p_action='respond' then
  if edge.recipient_id<>who or edge.status<>'pending' then raise exception 'Nie możesz zaakceptować tego zaproszenia'; end if;
  if exists(select 1 from public.healthgo_friend_blocks where (blocker_id=who and blocked_id=other) or (blocker_id=other and blocked_id=who))
   then raise exception 'Nie można zaakceptować tego zaproszenia'; end if;
  if p_accept then
   update public.healthgo_friend_links set status='accepted',updated_at=now() where id=edge.id;
  else
   delete from public.healthgo_friend_links where id=edge.id;
  end if;
 elsif p_action='block' then
  insert into public.healthgo_friend_blocks(blocker_id,blocked_id) values(who,other) on conflict do nothing;
  delete from public.healthgo_friend_links where id=edge.id;
 else
  delete from public.healthgo_friend_links where id=edge.id;
 end if;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.healthgo_friends_snapshot()
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); code text; rec jsonb;
begin
 if who is null then raise exception 'Logowanie jest wymagane'; end if;
 code:=public.healthgo_friend_code();
 select jsonb_build_object(
 'code',code,
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'nickname',coalesce(nullif(p.display_name,''),'Użytkownik HealthGo'),'user_id',p.id))
   from public.healthgo_friend_links f join public.profiles p on p.id=case when f.requester_id=who then f.recipient_id else f.requester_id end
   where (f.requester_id=who or f.recipient_id=who) and f.status='accepted'),'[]'::jsonb),
 'incoming',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'nickname',coalesce(nullif(p.display_name,''),'Użytkownik HealthGo')))
   from public.healthgo_friend_links f join public.profiles p on p.id=f.requester_id
   where f.recipient_id=who and f.status='pending'),'[]'::jsonb),
 'outgoing',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'nickname',coalesce(nullif(p.display_name,''),'Użytkownik HealthGo')))
   from public.healthgo_friend_links f join public.profiles p on p.id=f.recipient_id
   where f.requester_id=who and f.status='pending'),'[]'::jsonb),
 'blocked',coalesce((select jsonb_agg(jsonb_build_object('user_id',b.blocked_id,'nickname',coalesce(nullif(p.display_name,''),'Użytkownik HealthGo')))
   from public.healthgo_friend_blocks b join public.profiles p on p.id=b.blocked_id
   where b.blocker_id=who),'[]'::jsonb)
 ) into rec;
 return rec;
end $$;

revoke all on function public.healthgo_starter_status() from public,anon;
revoke all on function public.healthgo_starter_open() from public,anon;
revoke all on function public.healthgo_friend_code() from public,anon;
revoke all on function public.healthgo_friend_send(text) from public,anon;
revoke all on function public.healthgo_friend_action(text,uuid,boolean) from public,anon;
revoke all on function public.healthgo_friends_snapshot() from public,anon;
grant execute on function public.healthgo_starter_status() to authenticated;
grant execute on function public.healthgo_starter_open() to authenticated;
grant execute on function public.healthgo_friend_code() to authenticated;
grant execute on function public.healthgo_friend_send(text) to authenticated;
grant execute on function public.healthgo_friend_action(text,uuid,boolean) to authenticated;
grant execute on function public.healthgo_friends_snapshot() to authenticated;