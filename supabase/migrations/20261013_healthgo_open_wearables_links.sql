-- HealthGo 5.2: per-account mapping for optional self-hosted Open Wearables.
-- No device credentials, provider tokens or health data stored in this table.
create table if not exists public.hg_open_wearables_links (
 user_id uuid primary key references auth.users(id) on delete cascade,
 ow_user_id uuid not null unique,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.hg_open_wearables_links enable row level security;
revoke all on public.hg_open_wearables_links from anon,authenticated;
-- Mappings are managed exclusively by authenticated Edge Functions with service role.
comment on table public.hg_open_wearables_links is 'Private Supabase-user to Open Wearables-user mapping. Service-only access; no device credentials.';
