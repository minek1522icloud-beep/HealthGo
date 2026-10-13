-- Terra staging integration (opt-in). Do not modify activity_daily or XP.
-- No public write policies: signed webhooks and authenticated Edge Functions
-- use server-side credentials; authenticated end users may only view their rows.
create table if not exists public.hg_terra_link_requests (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz
);
create index if not exists hg_terra_link_requests_owner_idx
 on public.hg_terra_link_requests(user_id, expires_at desc);
alter table public.hg_terra_link_requests enable row level security;
revoke all on public.hg_terra_link_requests from anon, authenticated;

create table if not exists public.hg_terra_connections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 terra_user_id text not null unique,
 provider text not null,
 status text not null default 'connected' check (status in ('connected','revoked','disconnected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_sync_at timestamptz,
 constraint hg_terra_connections_provider_limited check(length(provider) between 1 and 80),
 constraint hg_terra_connections_terra_id_limited check(length(terra_user_id) between 1 and 128)
);
create index if not exists hg_terra_connections_owner_idx on public.hg_terra_connections(user_id,updated_at desc);
alter table public.hg_terra_connections enable row level security;
grant select on public.hg_terra_connections to authenticated;
drop policy if exists "read own Terra connections" on public.hg_terra_connections;
create policy "read own Terra connections" on public.hg_terra_connections
 for select to authenticated using(user_id=(select auth.uid()));

create table if not exists public.hg_terra_daily_metrics (
 connection_id uuid not null references public.hg_terra_connections(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 activity_date date not null,
 steps integer check(steps between 0 and 200000),
 distance_meters double precision check(distance_meters between 0 and 1000000),
 active_minutes integer check(active_minutes between 0 and 1440),
 updated_at timestamptz not null default now(),
 primary key (connection_id,activity_date)
);
create index if not exists hg_terra_daily_metrics_owner_idx
 on public.hg_terra_daily_metrics(user_id,activity_date desc);
alter table public.hg_terra_daily_metrics enable row level security;
grant select on public.hg_terra_daily_metrics to authenticated;
drop policy if exists "read own Terra metrics" on public.hg_terra_daily_metrics;
create policy "read own Terra metrics" on public.hg_terra_daily_metrics
 for select to authenticated using(user_id=(select auth.uid()));

-- Never accept direct writes from browser users.
revoke insert,update,delete on public.hg_terra_connections from anon,authenticated;
revoke insert,update,delete on public.hg_terra_daily_metrics from anon,authenticated;
