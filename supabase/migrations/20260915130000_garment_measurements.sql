-- ALTERNATE: garment measurements
-- Stores give each size its measurements (circumference in cm: bust, waist, hips, thigh; lengths in cm:
-- length, shoulder, sleeve, inseam) and say how much the fabric stretches. Shoppers can do the same for
-- an inspiration. The try-on engine compares them with the shopper's body measurements area by area,
-- so a size that is 4 cm smaller at the hips is drawn tight there. Shoppers can try on any size in stock.

create or replace function private.valid_measurements(_m jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select _m is null or (
    jsonb_typeof(_m) = 'object'
    and not exists (
      select 1 from jsonb_each(_m) e
      where e.key not in ('bust', 'waist', 'hips', 'thigh', 'length', 'shoulder', 'sleeve', 'inseam')
        or jsonb_typeof(e.value) <> 'number'
        or (e.value #>> '{}')::numeric not between 5 and 300
    )
  );
$$;

alter table public.product_variants
  add column measurements jsonb check (private.valid_measurements(measurements));

alter table public.products
  add column stretch text check (stretch in ('none', 'some', 'high'));

alter table public.garment_uploads
  add column measurements jsonb check (private.valid_measurements(measurements)),
  add column stretch text check (stretch in ('none', 'some', 'high'));

alter table public.tryons
  add column variant_id uuid references public.product_variants (id) on delete set null;

-- New signature (adds _variant_id): drop the old one so calls aren't ambiguous
drop function public.request_tryon(uuid, uuid, uuid, public.tryon_quality, public.fit_style);

create or replace function public.request_tryon(
  _body_photo_id uuid,
  _product_id uuid default null,
  _garment_upload_id uuid default null,
  _quality public.tryon_quality default 'standard',
  _fit public.fit_style default null,
  _variant_id uuid default null
)
returns public.tryons
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _category public.garment_category;
  _garment_type text;
  _detected public.garment_category[];
  _system public.size_system;
  _base smallint;
  _target smallint;
  _label text;
  _price integer;
  _balance integer;
  _limit integer;
  _subscription uuid;
  _daily_limit integer;
  _daily_hit boolean := false;
  _row public.tryons;
  _variant uuid;
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
  perform private.reap_stale_tryons(_uid);

  if _product_id is not null then
    select p.category, p.garment_type into _category, _garment_type
    from public.products p join public.stores s on s.id = p.store_id
    where p.id = _product_id and p.status = 'active' and s.status = 'active';
    if not found then
      raise exception 'This item is no longer available' using errcode = 'P0002';
    end if;

    if _variant_id is not null then
      -- The shopper picked a size to see how it fits them (any size in stock, even one that isn't theirs)
      select v.id, v.size_system, v.size_min, v.size_label into _variant, _system, _target, _label
      from public.product_variants v
      where v.id = _variant_id and v.product_id = _product_id and v.stock_qty > 0;
      if not found then
        raise exception 'That size is sold out' using errcode = 'P0001';
      end if;
    else
    -- Size rule, with sizing up for looser fits
    select v.id, v.size_system, us.size_value, v.size_label into _variant, _system, _base, _label
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
    end if;

    select * into _row from public.tryons
    where user_id = _uid and body_photo_id = _body_photo_id and product_id = _product_id
      and variant_id is not distinct from _variant
      and quality = _quality and fit = _fit and status in ('queued', 'processing', 'succeeded')
    order by created_at desc
    limit 1;
    if found then
      return _row;
    end if;
  else
    select category, garment_type into _category, _garment_type
    from public.garment_uploads where id = _garment_upload_id and user_id = _uid;
    if not found then
      raise exception 'That inspiration photo was not found' using errcode = 'P0002';
    end if;

    -- The server's check of the photo wins over what was picked in the browser
    select categories into _detected from public.garment_inspections where garment_upload_id = _garment_upload_id;
    if _category is not null and not private.category_matches(_category, _detected) then
      raise exception 'This photo shows %, not %. Choose what the photo actually shows.',
        (select string_agg(private.category_name(c), ' and ') from unnest(_detected) c),
        private.category_name(_category)
        using errcode = 'P0001';
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

  -- Test phase cap: each shopper gets a limited number of generations (admins are exempt)
  if not private.has_role(_uid, 'admin') then
    select coalesce(
      (select tryon_limit from public.profiles where id = _uid),
      (select (value #>> '{}')::integer from public.app_settings where key = 'tryon_limit_per_user')
    ) into _limit;
    if _limit is not null and (
      select count(*) from public.tryons where user_id = _uid and status in ('queued', 'processing', 'succeeded')
    ) >= _limit then
      raise exception 'You have used all % of your try-ons for now. Thanks for testing ALTERNATE!', _limit using errcode = 'P0001';
    end if;
  end if;

  select credits into _price from public.tryon_prices where quality = _quality;

  -- Monthly plan first (within its daily limit), then credit packs
  select s.id, s.daily_limit into _subscription, _daily_limit
  from public.user_subscriptions s
  where s.user_id = _uid and now() >= s.starts_at and now() < s.ends_at
    and s.credits_used + _price <= s.credits_total
  order by s.ends_at
  limit 1
  for update;

  if _subscription is not null and _daily_limit is not null and (
    select count(*) from public.tryons t
    where t.subscription_id = _subscription and t.status in ('queued', 'processing', 'succeeded')
      and t.created_at >= (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi')
  ) >= _daily_limit then
    _subscription := null;
    _daily_hit := true;
  end if;

  if _subscription is null then
    select coalesce(sum(amount), 0) into _balance from public.credit_ledger where user_id = _uid;
    if _balance < _price then
      if _daily_hit then
        raise exception 'You''ve reached your plan''s % try-ons for today. It resets at midnight, or use credits: this needs %, you have %.', _daily_limit, _price, _balance using errcode = 'P0001';
      end if;
      raise exception 'Not enough credits: this try-on needs %, you have %', _price, _balance using errcode = 'P0001';
    end if;
  end if;

  insert into public.tryons (user_id, body_photo_id, product_id, garment_upload_id, quality, credits_charged, fit, size_system, size_value, size_label, garment_type, subscription_id, variant_id)
  values (_uid, _body_photo_id, _product_id, _garment_upload_id, _quality, _price, _fit, _system, _target, _label, _garment_type, _subscription, _variant)
  returning * into _row;

  if _subscription is not null then
    update public.user_subscriptions set credits_used = credits_used + _price where id = _subscription;
  else
    insert into public.credit_ledger (user_id, amount, entry_type, tryon_id)
    values (_uid, -_price, 'tryon_charge', _row.id);
  end if;

  return _row;
end;
$$;

revoke execute on function public.request_tryon(uuid, uuid, uuid, public.tryon_quality, public.fit_style, uuid) from public, anon;
grant execute on function public.request_tryon(uuid, uuid, uuid, public.tryon_quality, public.fit_style, uuid) to authenticated;
