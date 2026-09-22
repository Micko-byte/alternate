-- VAA ALTERNATE: spin a finished try-on in 3D
--
-- A mesh is made FROM a succeeded try-on, so it inherits the body, the stance and the real length the
-- engine already got right, and adds the one thing a photo cannot show: the back. It costs more than a
-- try-on sells for, so it is a separate purchase, priced in credits and refunded if it fails.
--
-- Engine is a setting, not a rewrite: 'meshy' calls the hosted API, 'selfhost' will call our own GPU
-- when the monthly bill justifies running one, 'off' hides the feature.

alter type public.credit_entry_type add value if not exists 'mesh_charge';
alter type public.credit_entry_type add value if not exists 'mesh_refund';

insert into public.app_settings (key, value) values ('mesh_mode', '"off"'), ('mesh_credits', '2')
on conflict (key) do nothing;

create table public.tryon_meshes (
  id uuid primary key default gen_random_uuid(),
  tryon_id uuid not null references public.tryons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed')),
  engine text not null default 'meshy',
  provider_task_id text,
  storage_path text,
  credits_charged integer not null default 0 check (credits_charged >= 0),
  cost_usd numeric(10, 5),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One live mesh per try-on: a failed one may be retried, a good one is reused
create unique index tryon_meshes_one_live on public.tryon_meshes (tryon_id) where status <> 'failed';
create index tryon_meshes_user_idx on public.tryon_meshes (user_id, created_at desc);

alter table public.tryon_meshes enable row level security;

create policy "Shoppers see their own meshes" on public.tryon_meshes
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Admins see every mesh" on public.tryon_meshes
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));

-- Private bucket: a mesh is the shopper's body, treated exactly like a try-on result
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tryon-meshes', 'tryon-meshes', false, 52428800, array['model/gltf-binary', 'application/octet-stream'])
on conflict (id) do nothing;

create policy "Shoppers read their own meshes" on storage.objects
  for select to authenticated
  using (bucket_id = 'tryon-meshes' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Buy a spin for a try-on that already succeeded
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

  select * into _tryon from public.tryons where id = _tryon_id and user_id = _uid;
  if not found then
    raise exception 'Try-on not found' using errcode = 'P0002';
  end if;
  if _tryon.status <> 'succeeded' or _tryon.result_path is null then
    raise exception 'Only a finished try-on can be spun' using errcode = 'P0001';
  end if;

  -- A whole-body mesh is generous with a dress and cruel to an earring
  select coalesce(p.category::text, g.category::text) into _category
  from public.tryons t
  left join public.products p on p.id = t.product_id
  left join public.garment_uploads g on g.id = t.garment_upload_id
  where t.id = _tryon_id;

  if coalesce(_category, 'other') not in ('dress', 'top', 'bottom', 'skirt', 'jumpsuit', 'outerwear', 'set') then
    raise exception 'A 3D spin only works for clothing, not for %', coalesce(_category, 'this') using errcode = 'P0001';
  end if;

  -- An existing live mesh is reused rather than charged for twice
  select * into _row from public.tryon_meshes where tryon_id = _tryon_id and status <> 'failed';
  if found then
    return _row;
  end if;

  select coalesce((value #>> '{}')::integer, 2) into _price from public.app_settings where key = 'mesh_credits';

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

-- Server only: give the credits back when a spin cannot be made
create or replace function public.refund_mesh(_mesh_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _mesh public.tryon_meshes;
begin
  update public.tryon_meshes
  set status = 'failed', error_message = _reason, completed_at = now()
  where id = _mesh_id and status <> 'succeeded'
  returning * into _mesh;

  if not found or _mesh.credits_charged = 0 then
    return;
  end if;

  insert into public.credit_ledger (user_id, amount, entry_type, tryon_id, note)
  values (_mesh.user_id, _mesh.credits_charged, 'mesh_refund', _mesh.tryon_id, coalesce(_reason, '3D spin failed'))
  on conflict do nothing;
end;
$$;

revoke execute on function public.refund_mesh(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_mesh(uuid, text) to service_role;

-- Admin: is anyone actually buying the spin?
create or replace function public.admin_mesh_stats()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return json_build_object(
    'made', (select count(*) from public.tryon_meshes where status = 'succeeded'),
    'failed', (select count(*) from public.tryon_meshes where status = 'failed'),
    'avg_usd', (select round(avg(cost_usd)::numeric, 4) from public.tryon_meshes where status = 'succeeded'),
    'paid_tryons', (select count(*) from public.tryons where status = 'succeeded' and credits_charged > 0),
    'share', (
      select case when count(*) filter (where t.status = 'succeeded') = 0 then 0
        else round(100.0 * count(*) filter (where m.status = 'succeeded') / count(*) filter (where t.status = 'succeeded'), 1) end
      from public.tryons t left join public.tryon_meshes m on m.tryon_id = t.id
    )
  );
end;
$$;

revoke execute on function public.admin_mesh_stats() from public, anon;
grant execute on function public.admin_mesh_stats() to authenticated;

-- The 3D spin is a setting like the AI mode
create or replace function public.admin_set_setting(_key text, _value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if _key not in ('tryon_limit_per_user', 'ai_mode', 'mesh_mode', 'mesh_credits') then
    raise exception 'Unknown setting %', _key using errcode = '22023';
  end if;
  if _key = 'tryon_limit_per_user' and _value <> 'null'::jsonb and ((_value #>> '{}') !~ '^[0-9]{1,4}$') then
    raise exception 'Enter a whole number of try-ons' using errcode = '22023';
  end if;
  if _key = 'ai_mode' and (_value #>> '{}') not in ('saver', 'premium') then
    raise exception 'AI mode is saver or premium' using errcode = '22023';
  end if;
  if _key = 'mesh_mode' and (_value #>> '{}') not in ('off', 'meshy', 'selfhost') then
    raise exception '3D mode is off, meshy or selfhost' using errcode = '22023';
  end if;
  if _key = 'mesh_credits' and ((_value #>> '{}') !~ '^[1-9][0-9]?$') then
    raise exception 'A spin costs between 1 and 99 credits' using errcode = '22023';
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values (_key, _value, now(), (select auth.uid()))
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  perform private.audit('set_setting', null, json_build_object('key', _key, 'value', _value)::jsonb);
end;
$$;
