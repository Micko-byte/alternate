-- VAA ALTERNATE: what a 3D spin costs, and a pack shaped for it
--
-- Meshy charges 30 credits for a textured model. On their Premium plan that is about KES 52 a spin,
-- so a spin has to sell for 4 credits: KES 100 on its own, KES 90 to someone buying the deepest
-- bundle, which still clears cost. At 2 credits every spin loses money on every plan.

update public.app_settings set value = '4', updated_at = now() where key = 'mesh_credits';

-- One try-on and one spin, slightly cheaper than buying them apart: the journey we want people to take
insert into public.credit_packs (name, credits, price_kes, sort_order, store_share, first_purchase_only)
values ('Try it and spin it', 5, 110, 2, 0.100, false)
on conflict do nothing;

update public.credit_packs set sort_order = 3 where name = 'Bundle of 5';
update public.credit_packs set sort_order = 4 where name = 'Bundle of 12';
