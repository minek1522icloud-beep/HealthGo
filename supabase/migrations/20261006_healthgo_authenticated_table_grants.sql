begin;

grant usage on schema public to authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.xp_events to authenticated;
grant select on table public.notifications to authenticated;
grant select on table public.location_settings to authenticated;
grant select on table public.devices to authenticated;

grant select, insert, update on table public.account_state to authenticated;
grant select, insert, update on table public.activity_daily to authenticated;

commit;
