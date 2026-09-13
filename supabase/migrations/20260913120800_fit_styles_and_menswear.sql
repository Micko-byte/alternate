-- ALTERNATE: fit styles (fitted → baggy) and menswear
-- Size systems: women's UK numbers, letter sizes (XS–3XL) and waist in inches.
-- A looser fit on a store piece means sizing up: relaxed = 1 step, oversized / baggy = 2 steps.

create type public.size_system as enum ('uk_women', 'letter', 'waist_in');
create type public.department as enum ('women', 'men', 'unisex');
create type public.fit_style as enum ('fitted', 'regular', 'relaxed', 'oversized', 'baggy');
create type public.shops_for as enum ('women', 'men', 'both');

create or replace function private.size_in_range(_system public.size_system, _value integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case _system
    when 'uk_women' then _value between 2 and 32
    when 'letter' then _value between 1 and 8     -- 1 XS, 2 S, 3 M, 4 L, 5 XL, 6 XXL, 7 3XL, 8 4XL
    when 'waist_in' then _value between 22 and 56
  end;
$$;

create or replace function private.fit_offset(_system public.size_system, _fit public.fit_style)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (case _fit when 'relaxed' then 1 when 'oversized' then 2 when 'baggy' then 2 else 0 end)
       * (case _system when 'letter' then 1 else 2 end);
$$;

create or replace function private.size_system_label(_system public.size_system)
returns text
language sql
immutable
set search_path = ''
as $$
  select case _system when 'uk_women' then 'UK size' when 'letter' then 'S/M/L size' when 'waist_in' then 'waist in inches' end;
$$;

-- Profiles
alter table public.profiles
  add column shops_for public.shops_for,
  add column preferred_fit public.fit_style not null default 'regular';

-- Shopper sizes: one per garment type per size system
alter table public.user_sizes drop constraint user_sizes_uk_size_check;
alter table public.user_sizes drop constraint user_sizes_pkey;
alter table public.user_sizes rename column uk_size to size_value;
alter table public.user_sizes add column size_system public.size_system not null default 'uk_women';
alter table public.user_sizes add primary key (user_id, category, size_system);
alter table public.user_sizes add constraint user_sizes_value_range check (private.size_in_range(size_system, size_value));

-- Store sizes
alter table public.products add column department public.department not null default 'women';
create index products_department_idx on public.products (department, status);

alter table public.product_variants drop constraint product_variants_uk_range;
alter table public.product_variants drop constraint product_variants_uk_size_min_check;
alter table public.product_variants drop constraint product_variants_uk_size_max_check;
alter table public.product_variants rename column uk_size_min to size_min;
alter table public.product_variants rename column uk_size_max to size_max;
alter table public.product_variants add column size_system public.size_system not null default 'uk_women';
alter table public.product_variants add constraint product_variants_size_range check (
  (size_min is null and size_max is null)
  or (size_min is not null and size_max is not null and size_min <= size_max
      and private.size_in_range(size_system, size_min) and private.size_in_range(size_system, size_max))
);

-- "Tell me when my size is back"
alter table public.size_alerts drop constraint size_alerts_uk_size_check;
alter table public.size_alerts drop constraint size_alerts_user_id_product_id_uk_size_key;
alter table public.size_alerts rename column uk_size to size_value;
alter table public.size_alerts add column size_system public.size_system not null default 'uk_women';
alter table public.size_alerts add constraint size_alerts_value_range check (private.size_in_range(size_system, size_value));
alter table public.size_alerts add constraint size_alerts_once unique (user_id, product_id, size_system, size_value);

-- What each try-on was drawn as
alter table public.tryons
  add column fit public.fit_style not null default 'regular',
  add column size_system public.size_system,
  add column size_value smallint,
  add column size_label text;

-- New account: profile, what they shop for, fit, sizes, store link
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _meta jsonb := new.raw_user_meta_data;
  _code text := upper(nullif(trim(_meta ->> 'referral_code'), ''));
  _sizes jsonb := _meta -> 'sizes';
begin
  insert into public.profiles (id, display_name, phone, shops_for, preferred_fit)
  values (
    new.id,
    _meta ->> 'display_name',
    new.phone,
    case when _meta ->> 'shops_for' in ('women', 'men', 'both') then (_meta ->> 'shops_for')::public.shops_for end,
    case when _meta ->> 'preferred_fit' in ('fitted', 'regular', 'relaxed', 'oversized', 'baggy') then (_meta ->> 'preferred_fit')::public.fit_style else 'regular' end
  );

  if jsonb_typeof(_sizes) = 'array' then
    insert into public.user_sizes (user_id, category, size_system, size_value)
    select new.id, (s ->> 'category')::public.garment_category, (s ->> 'system')::public.size_system, (s ->> 'value')::smallint
    from jsonb_array_elements(_sizes) s
    where s ->> 'category' in ('dress', 'top', 'bottom', 'skirt', 'jumpsuit', 'outerwear')
      and s ->> 'system' in ('uk_women', 'letter', 'waist_in')
      and (s ->> 'value') ~ '^[0-9]{1,2}$'
      and private.size_in_range((s ->> 'system')::public.size_system, (s ->> 'value')::integer)
    on conflict do nothing;
  end if;

  if _code is not null then
    insert into public.referrals (referred_user_id, store_id)
    select new.id, s.id from public.stores s
    where s.referral_code = _code and s.status = 'active'
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop function public.store_size_demand(uuid);
create function public.store_size_demand(_store_id uuid)
returns table (product_id uuid, product_name text, size_system public.size_system, size_value smallint, waiting bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, a.size_system, a.size_value, count(*)
  from public.size_alerts a
  join public.products p on p.id = a.product_id
  where p.store_id = _store_id
    and a.notified_at is null
    and private.is_store_member(_store_id, (select auth.uid()))
  group by p.id, p.name, a.size_system, a.size_value
  order by count(*) desc;
$$;
revoke execute on function public.store_size_demand(uuid) from public, anon;
grant execute on function public.store_size_demand(uuid) to authenticated;

drop function public.request_tryon(uuid, uuid, uuid, public.tryon_quality);
create function public.request_tryon(
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
      select us.size_system, us.size_value into _system, _base
      from public.user_sizes us
      where us.user_id = _uid and us.category = _category
      order by us.size_system
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
revoke execute on function public.request_tryon(uuid, uuid, uuid, public.tryon_quality, public.fit_style) from public, anon;
grant execute on function public.request_tryon(uuid, uuid, uuid, public.tryon_quality, public.fit_style) to authenticated;
