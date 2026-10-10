-- HealthGo Profile PRO: selectively shared, cosmetic-only profile data.
-- No location, email, heart rate or other health fields are exposed.
create table if not exists public.healthgo_profile_cards (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  visibility text not null default 'friends' check(visibility in ('private','friends','public')),
  about text not null default '' check(length(about)<=160),
  avatar text not null default 'leaf' check(avatar in ('leaf','rocket','shield','star','fox','wave','crown','moon')),
  wallpaper text not null default 'default' check(wallpaper in ('default','aurora','nebula','sunset','forest','violet','arctic')),
  frame text not null default 'mint' check(frame in ('mint','silver','gold','violet','cyber','emerald')),
  sticker text not null default '' check(length(sticker)<=24),
  featured text[] not null default '{}'::text[] check(cardinality(featured)<=3),
  updated_at timestamptz not null default now()
);
alter table public.healthgo_profile_cards enable row level security;
revoke all on public.healthgo_profile_cards from public, anon, authenticated;

create or replace function public.healthgo_profile_save(
 p_visibility text, p_about text, p_avatar text, p_wallpaper text, p_frame text, p_sticker text, p_featured text[]
) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); person_type text; selected text[];
begin
 if who is null then raise exception 'Logowanie wymagane'; end if;
 select account_type into person_type from public.profiles where id=who;
 if person_type is null then raise exception 'Nie znaleziono profilu'; end if;
 if p_visibility not in ('private','friends','public') then raise exception 'Nieprawidłowa prywatność'; end if;
 if person_type='child' and p_visibility='public' then raise exception 'Profil dziecka nie może być publiczny'; end if;
 if length(coalesce(p_about,''))>160 then raise exception 'Opis jest zbyt długi'; end if;
 if p_avatar not in ('leaf','rocket','shield','star','fox','wave','crown','moon') then raise exception 'Nieprawidłowy awatar'; end if;
 if p_wallpaper not in ('default','aurora','nebula','sunset','forest','violet','arctic') then raise exception 'Nieprawidłowe tło'; end if;
 if p_frame not in ('mint','silver','gold','violet','cyber','emerald') then raise exception 'Nieprawidłowa ramka'; end if;
 if length(coalesce(p_sticker,''))>24 or p_sticker!~'^([a-z0-9-]{0,24})$' then raise exception 'Nieprawidłowa naklejka'; end if;
 -- The showcased badges must have actual verified unlocks in the database.
 select coalesce(array_agg(x.achievement_code order by x.pos),'{}'::text[])
 into selected
 from (
  select u.achievement_code, min(src.pos) as pos
  from unnest(coalesce(p_featured,'{}'::text[])) with ordinality src(code,pos)
  join public.user_achievements u on u.user_id=who and u.achievement_code=src.code
  where length(src.code)<=80
  group by u.achievement_code
  order by min(src.pos)
  limit 3
 ) x;
 insert into public.healthgo_profile_cards(user_id,visibility,about,avatar,wallpaper,frame,sticker,featured)
 values(who,p_visibility,coalesce(p_about,''),p_avatar,p_wallpaper,p_frame,coalesce(p_sticker,''),selected)
 on conflict(user_id) do update set visibility=excluded.visibility,about=excluded.about,
 avatar=excluded.avatar,wallpaper=excluded.wallpaper,frame=excluded.frame,sticker=excluded.sticker,
 featured=excluded.featured,updated_at=now();
 return jsonb_build_object('saved',true,'visibility',p_visibility);
end $$;

create or replace function public.healthgo_profile_get(p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); target uuid:=coalesce(p_user_id,auth.uid());
declare card public.healthgo_profile_cards%rowtype;
declare nick text; level_value int; is_friend boolean:=false; kind text;
declare showcased jsonb;
begin
 if who is null or target is null then raise exception 'Logowanie wymagane'; end if;
 if exists(select 1 from public.healthgo_friend_blocks where
 (blocker_id=who and blocked_id=target) or (blocker_id=target and blocked_id=who))
 then return jsonb_build_object('available',false,'reason','blocked'); end if;
 select p.display_name, p.level, p.account_type into nick,level_value,kind
 from public.profiles p where p.id=target;
 if not found then return jsonb_build_object('available',false,'reason','not_found'); end if;
 select * into card from public.healthgo_profile_cards where user_id=target;
 if target<>who then
  select exists(select 1 from public.healthgo_friend_links f where f.status='accepted'
  and ((f.requester_id=who and f.recipient_id=target) or (f.recipient_id=who and f.requester_id=target))) into is_friend;
  if coalesce(card.visibility,'friends')='private' or
    (coalesce(card.visibility,'friends')='friends' and not is_friend) or
    (kind='child' and not is_friend) then
    return jsonb_build_object('available',false,'reason','private');
  end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('code',a.code,'name',a.name,'rarity',a.rarity)),'[]'::jsonb)
 into showcased from public.achievements a
 join public.user_achievements u on u.achievement_code=a.code and u.user_id=target
 where a.code=any(coalesce(card.featured,'{}'::text[]));
 return jsonb_build_object('available',true,'user_id',target,'nickname',coalesce(nullif(nick,''),'Użytkownik HealthGo'),
   'level',coalesce(level_value,1),'visibility',coalesce(card.visibility,'friends'),
   'about',coalesce(card.about,''),'avatar',coalesce(card.avatar,'leaf'),
   'wallpaper',coalesce(card.wallpaper,'default'),'frame',coalesce(card.frame,'mint'),
   'sticker',coalesce(card.sticker,''),'featured',showcased,
   'is_self',target=who,'is_friend',is_friend);
end $$;

-- Explicitly grant only authenticated account holders.
revoke all on function public.healthgo_profile_save(text,text,text,text,text,text,text[]) from public,anon;
revoke all on function public.healthgo_profile_get(uuid) from public,anon;
grant execute on function public.healthgo_profile_save(text,text,text,text,text,text,text[]) to authenticated;
grant execute on function public.healthgo_profile_get(uuid) to authenticated;