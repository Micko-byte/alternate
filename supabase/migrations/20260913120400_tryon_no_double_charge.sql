-- ALTERNATE: never charge twice when a shopper taps "Try on" again while the first try-on is still running

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
  if not public.is_adult(_uid) then
    raise exception 'Try-on is for people aged 18 and over. Add your date of birth to your profile.' using errcode = '42501';
  end if;
  if not (public.has_consent(_uid, 'body_photo_processing') and public.has_consent(_uid, 'cross_border_transfer')) then
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
