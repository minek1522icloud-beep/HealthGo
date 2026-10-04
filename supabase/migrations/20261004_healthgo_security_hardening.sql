begin;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.get_family_locations() from public, anon;
revoke execute on function public.is_family_member(uuid) from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

revoke execute on function public.healthgo_configure_account(text,text) from public, anon;
revoke execute on function public.healthgo_create_family() from public, anon;
revoke execute on function public.healthgo_create_family_invite() from public, anon;
revoke execute on function public.healthgo_accept_family_invite(text) from public, anon;
revoke execute on function public.healthgo_update_family_permissions(uuid,uuid,jsonb) from public, anon;
revoke execute on function public.healthgo_update_location_settings(text) from public, anon;
revoke execute on function public.healthgo_publish_location(double precision,double precision,double precision,text) from public, anon;
revoke execute on function public.healthgo_mark_notification_read(uuid) from public, anon;
revoke execute on function public.healthgo_record_progress_event(text,text,jsonb) from public, anon;
revoke execute on function public.healthgo_get_family_state() from public, anon;

grant execute on function public.healthgo_configure_account(text,text) to authenticated;
grant execute on function public.healthgo_create_family() to authenticated;
grant execute on function public.healthgo_create_family_invite() to authenticated;
grant execute on function public.healthgo_accept_family_invite(text) to authenticated;
grant execute on function public.healthgo_update_family_permissions(uuid,uuid,jsonb) to authenticated;
grant execute on function public.healthgo_update_location_settings(text) to authenticated;
grant execute on function public.healthgo_publish_location(double precision,double precision,double precision,text) to authenticated;
grant execute on function public.healthgo_mark_notification_read(uuid) to authenticated;
grant execute on function public.healthgo_record_progress_event(text,text,jsonb) to authenticated;
grant execute on function public.healthgo_get_family_state() to authenticated;

commit;
