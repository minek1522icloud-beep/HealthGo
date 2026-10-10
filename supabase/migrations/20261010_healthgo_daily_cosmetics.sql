-- HealthGo 2.4: free daily cosmetic gift, once per authenticated account per UTC day.
-- Independent of XP, workouts, body metrics; no purchase, paid reroll or streak penalties.
create table if not exists public.healthgo_daily_cosmetics (
 user_id uuid not null references public.profiles(id) on delete cascade,
 gift_date date not null,
 reward_kind text not null check(reward_kind in ('sticker','wallpaper')),
 reward_item text not null check(reward_item ~ '^[a-z0-9-]{1,24}$'),
 claimed_at timestamptz not null default now(),
 primary key(user_id,gift_date)
);
alter table public.healthgo_daily_cosmetics enable row level security;
revoke all on public.healthgo_daily_cosmetics from public,anon,authenticated;

create or replace function public.healthgo_daily_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); day_key date:=(now() at time zone 'UTC')::date; prize public.healthgo_daily_cosmetics%rowtype;
begin
 if who is null then raise exception 'Wymagane zalogowanie'; end if;
 select * into prize from public.healthgo_daily_cosmetics where user_id=who and gift_date=day_key;
 return jsonb_build_object('date',day_key,'available',not found,
   'claimed',found,'reward_kind',prize.reward_kind,'reward_item',prize.reward_item);
end $$;

create or replace function public.healthgo_daily_claim()
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); day_key date:=(now() at time zone 'UTC')::date;
declare prize public.healthgo_daily_cosmetics%rowtype; kind text; item text; count_num int; wallpapers text[]:=array['aurora','nebula','sunset','forest','violet','arctic'];
begin
 if who is null then raise exception 'Wymagane zalogowanie'; end if;
 select * into prize from public.healthgo_daily_cosmetics where user_id=who and gift_date=day_key;
 if not found then
  -- The result is stored atomically before returning: same account/day => same reward.
  count_num:=get_byte(extensions.gen_random_bytes(2),0);
  if count_num<192 then
   kind:='sticker';
   item:='s'||lpad((1+floor(random()*72)::int)::text,2,'0');
  else
   kind:='wallpaper';
   item:=wallpapers[1+floor(random()*array_length(wallpapers,1))::int];
  end if;
  insert into public.healthgo_daily_cosmetics(user_id,gift_date,reward_kind,reward_item)
  values(who,day_key,kind,item) on conflict(user_id,gift_date) do nothing;
 end if;
 select * into prize from public.healthgo_daily_cosmetics where user_id=who and gift_date=day_key;
 return jsonb_build_object('date',day_key,'available',false,'claimed',true,
   'reward_kind',prize.reward_kind,'reward_item',prize.reward_item);
end $$;
revoke all on function public.healthgo_daily_status() from public,anon;
revoke all on function public.healthgo_daily_claim() from public,anon;
grant execute on function public.healthgo_daily_status() to authenticated;
grant execute on function public.healthgo_daily_claim() to authenticated;