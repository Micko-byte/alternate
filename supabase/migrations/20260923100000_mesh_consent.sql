-- VAA ALTERNATE: asking before a body goes to the 3D engine
--
-- The photo consent names OpenAI, because that is who draws a try-on. A 3D spin sends the finished
-- picture somewhere else again, so it gets its own consent, asked at the moment someone buys their
-- first spin rather than bolted onto sign-up. No consent, no spin: request_mesh refuses.

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

  -- The 3D engine is a different company in a different country: nobody's body goes there unasked
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
