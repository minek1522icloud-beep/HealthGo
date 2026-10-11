-- Six real achievement showcase slots. Never expose private health data.
alter table public.healthgo_profile_cards
  drop constraint if exists healthgo_profile_cards_featured_check;
alter table public.healthgo_profile_cards
  add constraint healthgo_profile_cards_featured_check check (cardinality(featured) <= 6);
do $$
declare original_function text;
begin
 select pg_get_functiondef('public.healthgo_profile_save(text,text,text,text,text,text,text[])'::regprocedure)
 into original_function;
 if position('limit 3' in lower(original_function))=0 then
   raise exception 'Unsupported existing profile-save implementation';
 end if;
 execute replace(original_function,'limit 3','limit 6');
end $$;