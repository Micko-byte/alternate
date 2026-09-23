-- VAA ALTERNATE — the two migrations the CLI could not push, safe to paste into the Supabase SQL editor.
--
-- Dashboard -> SQL Editor -> New query -> paste all of this -> Run.
-- Everything here is idempotent: running it twice changes nothing the second time, and the last block
-- tells the CLI these migrations are already applied so a future `db push` does not repeat them.

-- ── 20260923090000_spin_price ────────────────────────────────────────────────
-- Meshy charges 30 credits for a textured model: about KES 52 a spin on their Premium plan. A spin
-- therefore sells for 4 credits, not 2 - at 2 every spin loses money on every plan.

update public.app_settings set value = '4', updated_at = now() where key = 'mesh_credits';

insert into public.credit_packs (name, credits, price_kes, sort_order, store_share, first_purchase_only)
select 'Try it and spin it', 5, 110, 2, 0.100, false
where not exists (select 1 from public.credit_packs where name = 'Try it and spin it');

update public.credit_packs set sort_order = 3 where name = 'Bundle of 5';
update public.credit_packs set sort_order = 4 where name = 'Bundle of 12';

-- ── 20260923100000_mesh_consent ──────────────────────────────────────────────
-- A spin sends the finished picture to another company in another country, so it gets its own consent,
-- asked the first time someone buys a spin. No consent, no spin.

alter type public.consent_type add value if not exists 'mesh_processing';

create or replace function public.request_mesh(_tryon_id uuid)
returns public.tryon_meshes
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _tryon public.tryons;
  _category text;
  _mode text;
  _price integer;
  _balance integer;
  _row public.tryon_meshes;
begin
  if _uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;

  select (value #>> '{}') into _mode from public.app_settings where key = 'mesh_mode';
  if coalesce(_mode, 'off') = 'off' then
    raise exception 'The 3D spin is not switched on yet' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.consents
    where user_id = _uid and consent_type = 'mesh_processing' and withdrawn_at is null
  ) then
    raise exception 'Agree to the 3D step first' using errcode = 'P0003';
  end if;

  select * into _tryon from public.tryons where id = _tryon_id and user_id = _uid;
  if not found then
    raise exception 'Try-on not found' using errcode = 'P0002';
  end if;
  if _tryon.status <> 'succeeded' or _tryon.result_path is null then
    raise exception 'Only a finished try-on can be spun' using errcode = 'P0001';
  end if;

  select coalesce(p.category::text, g.category::text) into _category
  from public.tryons t
  left join public.products p on p.id = t.product_id
  left join public.garment_uploads g on g.id = t.garment_upload_id
  where t.id = _tryon_id;

  if coalesce(_category, 'other') not in ('dress', 'top', 'bottom', 'skirt', 'jumpsuit', 'outerwear', 'set') then
    raise exception 'A 3D spin only works for clothing, not for %', coalesce(_category, 'this') using errcode = 'P0001';
  end if;

  select * into _row from public.tryon_meshes where tryon_id = _tryon_id and status <> 'failed';
  if found then
    return _row;
  end if;

  select coalesce((value #>> '{}')::integer, 4) into _price from public.app_settings where key = 'mesh_credits';

  perform pg_advisory_xact_lock(hashtextextended(_uid::text, 0));
  select coalesce(sum(amount), 0) into _balance from public.credit_ledger where user_id = _uid;
  if _balance < _price then
    raise exception 'A 3D spin needs % credits, you have %', _price, _balance using errcode = 'P0001';
  end if;

  insert into public.tryon_meshes (tryon_id, user_id, engine, credits_charged)
  values (_tryon_id, _uid, coalesce(_mode, 'meshy'), _price)
  returning * into _row;

  insert into public.credit_ledger (user_id, amount, entry_type, tryon_id, note)
  values (_uid, -_price, 'mesh_charge', _tryon_id, '3D spin');

  return _row;
end;
$$;

revoke execute on function public.request_mesh(uuid) from public, anon;
grant execute on function public.request_mesh(uuid) to authenticated;

-- ── keep the CLI in step ─────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name)
values ('20260923090000', 'spin_price'), ('20260923100000', 'mesh_consent')
on conflict (version) do nothing;

-- ── check it worked ──────────────────────────────────────────────────────────
select key, value from public.app_settings where key in ('mesh_mode', 'mesh_credits');
select name, credits, price_kes, sort_order from public.credit_packs where is_active order by sort_order;
