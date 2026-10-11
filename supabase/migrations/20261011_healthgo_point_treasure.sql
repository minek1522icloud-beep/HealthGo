-- HealthGo Point 1.0: cosmetic-only, non-cash virtual points.
-- Never use this balance for real food / coupons or anything of monetary value.
-- Approved public sites are curated by administrators; players cannot create reward sites.
create extension if not exists pgcrypto;

create table if not exists public.hg_point_wallets(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 units integer not null default 0 check(units between 0 and 100000),
 updated_at timestamptz not null default now()
);
create table if not exists public.hg_point_events(
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 units integer not null check(units<>0 and units between -100 and 100),
 kind text not null check(kind in ('treasure','virtual_item','gift_sent','gift_received')),
 source_id text not null,
 created_at timestamptz not null default now(),
 unique(user_id,kind,source_id)
);
create index if not exists hg_point_events_owner_date on public.hg_point_events(user_id,created_at desc);

create table if not exists public.hg_treasure_sites(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 3 and 100),
 description text not null default '',
 lat double precision not null check(lat between -90 and 90),
 lon double precision not null check(lon between -180 and 180),
 photo_url text,
 is_public_safe boolean not null default false,
 approved boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.hg_treasure_claims(
 user_id uuid not null references public.profiles(id) on delete cascade,
 site_id uuid not null references public.hg_treasure_sites(id) on delete cascade,
 photo_sha256 text not null check(photo_sha256 ~ '^[a-f0-9]{64}$'),
 gps_accuracy_m integer not null check(gps_accuracy_m between 0 and 35),
 claimed_at timestamptz not null default now(),
 primary key(user_id,site_id)
);
create index if not exists hg_treasure_claims_today on public.hg_treasure_claims(user_id,claimed_at desc);
create table if not exists public.hg_point_catalog(
 id text primary key check(id ~ '^[a-z0-9-]{3,40}$'),
 title text not null,description text not null default '',
 emoji text not null default '✦',
 price_units integer not null check(price_units between 1 and 200),
 digital_only boolean not null default true check(digital_only = true),
 active boolean not null default true
);
create table if not exists public.hg_point_inventory(
 user_id uuid not null references public.profiles(id) on delete cascade,
 item_id text not null references public.hg_point_catalog(id),
 quantity integer not null default 1 check(quantity between 1 and 1000),
 primary key(user_id,item_id)
);
create table if not exists public.hg_point_gifts(
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 receiver_id uuid not null references public.profiles(id) on delete cascade,
 units integer not null check(units between 1 and 10),
 nonce uuid not null,
 created_at timestamptz not null default now(),
 unique(sender_id,nonce),
 check(sender_id<>receiver_id)
);
create index if not exists hg_point_gifts_sender_time on public.hg_point_gifts(sender_id,created_at desc);

-- Private ledger: all writes happen in authenticated, validated RPC transactions.
alter table public.hg_point_wallets enable row level security;
alter table public.hg_point_events enable row level security;
alter table public.hg_treasure_sites enable row level security;
alter table public.hg_treasure_claims enable row level security;
alter table public.hg_point_catalog enable row level security;
alter table public.hg_point_inventory enable row level security;
alter table public.hg_point_gifts enable row level security;

revoke all on public.hg_point_wallets,public.hg_point_events,public.hg_treasure_sites,
 public.hg_treasure_claims,public.hg_point_catalog,public.hg_point_inventory,public.hg_point_gifts
 from public,anon,authenticated;

-- A fixed, nonrandom catalog. No loot boxes, gambling, cashouts or real-world products.
insert into public.hg_point_catalog(id,title,description,emoji,price_units)
values
 ('explorer-sticker','Naklejka Odkrywcy','Cyfrowa naklejka w kolekcji HealthGo.','🧭',4),
 ('forest-sticker','Naklejka Leśna','Cyfrowa ozdoba Plecaka.','🌿',6),
 ('mint-banner','Miętowy Baner','Cyfrowy element kolekcji.','💚',10),
 ('cosmic-badge','Kosmiczny Żeton','Kolekcjonerski symbol HealthGo.','🌌',14),
 ('golden-compass','Złoty Kompas','Cyfrowy przedmiot kolekcjonerski.','🧭',20)
on conflict(id) do nothing;

create or replace function public.hg_point_snapshot()
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); points integer; upcoming jsonb; rewards jsonb; collection jsonb; history jsonb;
begin
 if who is null then raise exception 'Wymagane logowanie' using errcode='28000'; end if;
 insert into public.hg_point_wallets(user_id) values(who) on conflict do nothing;
 select units into points from public.hg_point_wallets where user_id=who;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,
   'lat',s.lat,'lon',s.lon,'photoUrl',s.photo_url,'claimed',c.site_id is not null) order by s.name),'[]'::jsonb)
 into upcoming
 from public.hg_treasure_sites s left join public.hg_treasure_claims c
 on c.site_id=s.id and c.user_id=who where s.approved=true and s.is_public_safe=true;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,
  'emoji',emoji,'priceUnits',price_units) order by price_units),'[]'::jsonb)
 into rewards from public.hg_point_catalog where active=true and digital_only=true;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.item_id,'quantity',i.quantity)),'[]'::jsonb)
 into collection from public.hg_point_inventory i where i.user_id=who;
 select coalesce(jsonb_agg(jsonb_build_object('kind',e.kind,'units',e.units,'date',e.created_at)
  order by e.created_at desc),'[]'::jsonb) into history
 from (select kind,units,created_at from public.hg_point_events where user_id=who order by created_at desc limit 20) e;
 return jsonb_build_object('units',points,'sites',upcoming,'catalog',rewards,'inventory',collection,
  'events',history,'verified',true,'virtualOnly',true);
end $$;

create or replace function public.hg_point_claim(
 p_site uuid,p_lat double precision,p_lon double precision,p_accuracy integer,p_photo_sha256 text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();site public.hg_treasure_sites%rowtype;distance_m double precision;daily_count integer;
begin
 if who is null then raise exception 'Wymagane logowanie' using errcode='28000'; end if;
 if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 or
  p_accuracy is null or p_accuracy not between 1 and 35 or
  coalesce(p_photo_sha256,'') !~ '^[a-f0-9]{64}$'
 then raise exception 'Wymagane zdjęcie i dokładny pomiar GPS'; end if;
 select * into site from public.hg_treasure_sites where id=p_site and approved and is_public_safe;
 if not found then raise exception 'To miejsce nie jest zatwierdzonym skarbem'; end if;
 -- Approximate great-circle distance, in metres. Geofence does not prevent OS-level GPS spoofing.
 distance_m:=6371000*2*asin(least(1,sqrt(
  power(sin(radians(p_lat-site.lat)/2),2)+
  cos(radians(p_lat))*cos(radians(site.lat))*power(sin(radians(p_lon-site.lon)/2),2))));
 if distance_m>60 then raise exception 'Jesteś za daleko od tego skarbu'; end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,13570));
 if exists(select 1 from public.hg_treasure_claims where user_id=who and site_id=p_site)
 then return jsonb_build_object('claimed',true,'already',true,'awardedUnits',0); end if;
 select count(*) into daily_count from public.hg_treasure_claims where user_id=who
 and claimed_at>now()-interval '24 hours';
 if daily_count>=8 then raise exception 'Osiągnięto limit 8 skarbów na dobę'; end if;
 insert into public.hg_treasure_claims(user_id,site_id,photo_sha256,gps_accuracy_m)
 values(who,p_site,p_photo_sha256,p_accuracy);
 insert into public.hg_point_wallets(user_id,units) values(who,0) on conflict do nothing;
 update public.hg_point_wallets set units=units+1,updated_at=now() where user_id=who;
 insert into public.hg_point_events(user_id,units,kind,source_id)
 values(who,1,'treasure',p_site::text);
 return jsonb_build_object('claimed',true,'already',false,'awardedUnits',1);
end $$;

create or replace function public.hg_point_redeem(p_item text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();product public.hg_point_catalog%rowtype;balance integer;
begin
 if who is null then raise exception 'Wymagane logowanie' using errcode='28000'; end if;
 select * into product from public.hg_point_catalog where id=p_item and active and digital_only;
 if not found then raise exception 'Przedmiot jest niedostępny'; end if;
 insert into public.hg_point_wallets(user_id) values(who) on conflict do nothing;
 select units into balance from public.hg_point_wallets where user_id=who for update;
 if balance<product.price_units then raise exception 'Za mało HealthGo Point'; end if;
 if exists(select 1 from public.hg_point_inventory where user_id=who and item_id=p_item)
 then raise exception 'Już masz ten przedmiot'; end if;
 insert into public.hg_point_inventory(user_id,item_id) values(who,p_item);
 update public.hg_point_wallets set units=units-product.price_units,updated_at=now() where user_id=who;
 insert into public.hg_point_events(user_id,units,kind,source_id)
 values(who,-product.price_units,'virtual_item',p_item);
 return jsonb_build_object('redeemed',true,'item',p_item,'units',balance-product.price_units);
end $$;

create or replace function public.hg_point_gift(p_friend uuid,p_units integer,p_nonce uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();available integer;existing public.hg_point_gifts%rowtype;daily_sent bigint;
begin
 if who is null then raise exception 'Wymagane logowanie' using errcode='28000'; end if;
 if p_friend is null or p_friend=who or p_nonce is null or p_units is null or p_units not between 1 and 10
 then raise exception 'Nieprawidłowa wymiana'; end if;
 if not exists(select 1 from public.healthgo_friend_links
  where status='accepted' and ((requester_id=who and recipient_id=p_friend) or
    (requester_id=p_friend and recipient_id=who)))
 then raise exception 'Wysyłanie tylko do zaakceptowanych znajomych'; end if;
 if exists(select 1 from public.healthgo_friend_blocks
  where (blocker_id=who and blocked_id=p_friend) or (blocker_id=p_friend and blocked_id=who))
 then raise exception 'Wymiana jest zablokowana'; end if;
 -- Serialize each sender and recipient to prevent double-spending or deadlocks.
 perform pg_advisory_xact_lock(hashtextextended(least(who,p_friend)::text,8675309));
 perform pg_advisory_xact_lock(hashtextextended(greatest(who,p_friend)::text,8675309));
 select * into existing from public.hg_point_gifts where sender_id=who and nonce=p_nonce;
 if found then
  if existing.receiver_id<>p_friend or existing.units<>p_units then raise exception 'Ten identyfikator wymiany został użyty';end if;
  return jsonb_build_object('sent',true,'already',true,'units',existing.units);
 end if;
 select coalesce(sum(units),0) into daily_sent from public.hg_point_gifts
 where sender_id=who and created_at>now()-interval '24 hours';
 if daily_sent+p_units>20 then raise exception 'Limit przekazywania: 10 punktów HG dziennie';end if;
 insert into public.hg_point_wallets(user_id) values(who),(p_friend) on conflict do nothing;
 select units into available from public.hg_point_wallets where user_id=who for update;
 if available<p_units then raise exception 'Za mało HealthGo Point'; end if;
 update public.hg_point_wallets set units=units-p_units,updated_at=now() where user_id=who;
 update public.hg_point_wallets set units=units+p_units,updated_at=now() where user_id=p_friend;
 insert into public.hg_point_gifts(sender_id,receiver_id,units,nonce)
 values(who,p_friend,p_units,p_nonce);
 insert into public.hg_point_events(user_id,units,kind,source_id)
 values(who,-p_units,'gift_sent',p_nonce::text),(p_friend,p_units,'gift_received',p_nonce::text);
 return jsonb_build_object('sent',true,'already',false,'units',p_units);
end $$;

-- No table is writable from the client. RPCs only, and they check auth.uid().
revoke all on function public.hg_point_snapshot() from public,anon;
revoke all on function public.hg_point_claim(uuid,double precision,double precision,integer,text) from public,anon;
revoke all on function public.hg_point_redeem(text) from public,anon;
revoke all on function public.hg_point_gift(uuid,integer,uuid) from public,anon;
grant execute on function public.hg_point_snapshot() to authenticated;
grant execute on function public.hg_point_claim(uuid,double precision,double precision,integer,text) to authenticated;
grant execute on function public.hg_point_redeem(text) to authenticated;
grant execute on function public.hg_point_gift(uuid,integer,uuid) to authenticated;
