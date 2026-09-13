-- ALTERNATE: garment-aware try-on
-- Body photos get one edit mask per garment zone, made in the browser by a clothes-parsing model:
--   mask_upper_path  tops & jackets can change; trousers, legs, shoes stay
--   mask_lower_path  trousers & skirts can change; top, arms, hands, what they hold stay
--   edit_mask_path   full outfit (dresses, jumpsuits, sets)
-- Inspiration photos get a cut-out of just the chosen garment.

alter table public.body_photos
  add column mask_upper_path text,
  add column mask_lower_path text;

alter table public.garment_uploads
  add column cutout_path text;

-- The mask used to generate (and to paste the untouched parts back when viewing)
alter table public.tryons
  add column edit_mask_path text;

create or replace function public.request_tryon(
  _body_photo_id uuid,
  _product_id uuid default null,
  _garment_upload_id uuid default null,
  _quality public.tryon_quality default 'standard',
  _fit public.fit_style default null
)
returns public.tryons
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _category public.garment_category;
  _system public.size_system;
  _base smallint;
  _target smallint;
  _label text;
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
  if not exists (select 1 from public.body_photos where id = _body_photo_id and user_id = _uid and is_active) then
    raise exception 'That photo was not found. Upload a full-body photo first.' using errcode = 'P0002';
  end if;

  if _fit is null then
    select preferred_fit into _fit from public.profiles where id = _uid;
    _fit := coalesce(_fit, 'regular');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(_uid::text, 0));

  if _product_id is not null then
    select p.category into _category
    from public.products p join public.stores s on s.id = p.store_id
    where p.id = _product_id and p.status = 'active' and s.status = 'active';
    if not found then
      raise exception 'This item is no longer available' using errcode = 'P0002';
    end if;

    -- Size rule, with sizing up for looser fits
    select v.size_system, us.size_value, v.size_label into _system, _base, _label
    from public.product_variants v
    left join public.user_sizes us on us.user_id = _uid and us.category = _category and us.size_system = v.size_system
    where v.product_id = _product_id
      and v.stock_qty > 0
      and (v.size_min is null
           or (us.size_value is not null and us.size_value + private.fit_offset(v.size_system, _fit) between v.size_min and v.size_max))
    order by (v.size_min is null), v.size_min
    limit 1;

    if not found then
      if not exists (select 1 from public.product_variants where product_id = _product_id and stock_qty > 0) then
        raise exception 'This item is sold out' using errcode = 'P0001';
      end if;
      if not exists (
        select 1 from public.product_variants v
        join public.user_sizes us on us.user_id = _uid and us.category = _category and us.size_system = v.size_system
        where v.product_id = _product_id
      ) then
        select v.size_system into _system from public.product_variants v where v.product_id = _product_id and v.size_system is not null limit 1;
        raise exception 'Add your % % to your profile to try this on', _category, private.size_system_label(_system) using errcode = 'P0001';
      end if;
      raise exception 'Not in stock in the size you need for a % fit. Try another fit, or ask to be told when it''s back.', _fit using errcode = 'P0001';
    end if;

    _target := case when _base is null then null else _base + private.fit_offset(_system, _fit) end;

    select * into _row from public.tryons
    where user_id = _uid and body_photo_id = _body_photo_id and product_id = _product_id
      and quality = _quality and fit = _fit and status in ('queued', 'processing', 'succeeded')
    order by created_at desc
    limit 1;
    if found then
      return _row;
    end if;
  else
    select category into _category from public.garment_uploads where id = _garment_upload_id and user_id = _uid;
    if not found then
      raise exception 'That inspiration photo was not found' using errcode = 'P0002';
    end if;
    if _category in ('dress', 'top', 'bottom', 'skirt', 'jumpsuit', 'outerwear') then
      -- Prefer the size system for what they shop for (menswear: letters / waist)
      select us.size_system, us.size_value into _system, _base
      from public.user_sizes us
      left join public.profiles pr on pr.id = us.user_id
      where us.user_id = _uid and us.category = _category
      order by case
        when pr.shops_for = 'men' and us.size_system in ('letter', 'waist_in') then 0
        when pr.shops_for = 'women' and us.size_system = 'uk_women' then 0
        else 1
      end, us.size_system
      limit 1;
      if not found then
        raise exception 'Add your % size to your profile so the try-on fits like your real size', _category using errcode = 'P0001';
      end if;
      _target := _base;
    end if;
  end if;

  select credits into _price from public.tryon_prices where quality = _quality;
  select coalesce(sum(amount), 0) into _balance from public.credit_ledger where user_id = _uid;
  if _balance < _price then
    raise exception 'Not enough credits: this try-on needs %, you have %', _price, _balance using errcode = 'P0001';
  end if;

  insert into public.tryons (user_id, body_photo_id, product_id, garment_upload_id, quality, credits_charged, fit, size_system, size_value, size_label)
  values (_uid, _body_photo_id, _product_id, _garment_upload_id, _quality, _price, _fit, _system, _target, _label)
  returning * into _row;

  insert into public.credit_ledger (user_id, amount, entry_type, tryon_id)
  values (_uid, -_price, 'tryon_charge', _row.id);

  return _row;
end;
$$;
