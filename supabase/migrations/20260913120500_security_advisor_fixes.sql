-- ALTERNATE: security advisor fixes
-- 1. Row-security helpers move to a private schema the API does not expose.
--    Policies keep working (they reference the functions directly, not by name).
-- 2. Trigger functions can no longer be called through the API.
-- 3. Split the store sizes policy so reads are checked by one policy only.

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

alter function public.has_role(uuid, public.app_role) set schema private;
alter function public.has_consent(uuid, public.consent_type) set schema private;
alter function public.is_adult(uuid) set schema private;
alter function public.is_store_member(uuid, uuid) set schema private;
alter function public.is_store_owner(uuid, uuid) set schema private;
alter function public.product_is_public(uuid) set schema private;
alter function public.product_store_member(uuid, uuid) set schema private;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_store() from public, anon, authenticated;

-- Functions that call the helpers by name must point at the new schema
create or replace function public.store_size_demand(_store_id uuid)
returns table (product_id uuid, product_name text, uk_size smallint, waiting bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, a.uk_size, count(*)
  from public.size_alerts a
  join public.products p on p.id = a.product_id
  where p.store_id = _store_id
    and a.notified_at is null
    and private.is_store_member(_store_id, (select auth.uid()))
  group by p.id, p.name, a.uk_size
  order by count(*) desc;
$$;

create or replace function public.request_tryon(
  _body_photo_id uuid,
  _product_id uuid default null,
  _garment_upload_id uuid default null,
  _quality public.tryon_quality default 'standard'
)
returns public.tryons
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _category public.garment_category;
  _size smallint;
  _price integer;
  _balance integer;
  _row public.tryons;
begin
  if _uid is null then
    raise exception 'Sign in to try on clothes' using errcode = '28000';
  end if;
  if num_nonnulls(_product_id, _garment_upload_id) <> 1 then
    raise exception 'Choose one item to try on' using errcode = '22023';
  end if;
  if not private.is_adult(_uid) then
    raise exception 'Try-on is for people aged 18 and over. Add your date of birth to your profile.' using errcode = '42501';
  end if;
  if not (private.has_consent(_uid, 'body_photo_processing') and private.has_consent(_uid, 'cross_border_transfer')) then
    raise exception 'Accept photo processing in your privacy settings to use try-on' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.body_photos where id = _body_photo_id and user_id = _uid and is_active
  ) then
    raise exception 'That photo was not found. Upload a full-body photo first.' using errcode = 'P0002';
  end if;

  -- Serialise requests per shopper so two taps can't double-charge
  perform pg_advisory_xact_lock(hashtextextended(_uid::text, 0));

  if _product_id is not null then
    select p.category into _category
    from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = _product_id and p.status = 'active' and s.status = 'active';
    if not found then
      raise exception 'This item is no longer available' using errcode = 'P0002';
    end if;

    select uk_size into _size from public.user_sizes where user_id = _uid and category = _category;

    if not exists (
      select 1 from public.product_variants v
      where v.product_id = _product_id
        and v.stock_qty > 0
        and (v.uk_size_min is null or _size between v.uk_size_min and v.uk_size_max)
    ) then
      if _size is null then
        raise exception 'Add your % size to your profile to try this on', _category using errcode = 'P0001';
      end if;
      raise exception 'This item is not in stock in your size (UK %)', _size using errcode = 'P0001';
    end if;

    -- Same photo, same item, same quality: return the saved or in-progress try-on, no charge
    select * into _row from public.tryons
    where user_id = _uid and body_photo_id = _body_photo_id and product_id = _product_id
      and quality = _quality and status in ('queued', 'processing', 'succeeded')
    order by created_at desc
    limit 1;
    if found then
      return _row;
    end if;
  else
    if not exists (
      select 1 from public.garment_uploads where id = _garment_upload_id and user_id = _uid
    ) then
      raise exception 'That screenshot was not found' using errcode = 'P0002';
    end if;
  end if;

  select credits into _price from public.tryon_prices where quality = _quality;

  select coalesce(sum(amount), 0) into _balance from public.credit_ledger where user_id = _uid;
  if _balance < _price then
    raise exception 'Not enough credits: this try-on needs %, you have %', _price, _balance using errcode = 'P0001';
  end if;

  insert into public.tryons (user_id, body_photo_id, product_id, garment_upload_id, quality, credits_charged)
  values (_uid, _body_photo_id, _product_id, _garment_upload_id, _quality, _price)
  returning * into _row;

  insert into public.credit_ledger (user_id, amount, entry_type, tryon_id)
  values (_uid, -_price, 'tryon_charge', _row.id);

  return _row;
end;
$$;

drop policy "Store team manages sizes" on public.product_variants;
create policy "Store team adds sizes" on public.product_variants
  for insert to authenticated with check (private.product_store_member(product_id, (select auth.uid())));
create policy "Store team edits sizes" on public.product_variants
  for update to authenticated
  using (private.product_store_member(product_id, (select auth.uid())))
  with check (private.product_store_member(product_id, (select auth.uid())));
create policy "Store team deletes sizes" on public.product_variants
  for delete to authenticated using (private.product_store_member(product_id, (select auth.uid())));
