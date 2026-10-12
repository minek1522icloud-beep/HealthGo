-- Retire launch-only mock cosmetics. Do not delete user inventory, wallets or history.
-- A real, independently approved product can be activated separately later.
update public.hg_point_catalog
set active=false
where id in (
 'explorer-sticker','forest-sticker','mint-banner','cosmic-badge','golden-compass'
) and active=true;
