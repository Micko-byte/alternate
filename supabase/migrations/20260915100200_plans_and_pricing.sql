-- ALTERNATE: monthly plans, pay-per-try-on, and prices that cover the 20% store share
--
-- Credits are the currency. 1 credit = one Standard try-on.
--   Standard 1 credit · HD 2 credits · Studio 4 credits
-- Credit packs never expire. Monthly plans give credits for 30 days with a daily limit,
-- paid up front by M-Pesa or card (M-Pesa can't be charged automatically, so plans renew by paying again).
-- Plan credits are used before pack credits. Every payment from a store-referred shopper
-- still earns that store its referral rate (20% by default) in complete_payment().

-- ------------------------------------------------------------------ plans
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,30}$'),
  name text not null check (char_length(name) between 2 and 40),
  price_kes integer not null check (price_kes > 0),
  monthly_credits integer not null check (monthly_credits > 0),
  daily_limit integer check (daily_limit > 0),
  period_days smallint not null default 30 check (period_days between 1 and 366),
  blurb text check (char_length(blurb) <= 160),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, price_kes, monthly_credits, daily_limit, blurb, sort_order) values
  ('lite', 'Lite', 499, 15, 5, 'For trying before the odd purchase', 1),
  ('plus', 'Plus', 999, 35, 10, 'For people who shop every week', 2),
  ('pro', 'Pro', 1999, 70, 20, 'For stylists and content creators', 3);

create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id) on delete restrict,
  payment_id uuid unique references public.payments (id) on delete set null,
  credits_total integer not null check (credits_total > 0),
  credits_used integer not null default 0 check (credits_used >= 0),
  daily_limit integer check (daily_limit > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint user_subscriptions_period check (ends_at > starts_at),
  constraint user_subscriptions_used check (credits_used <= credits_total)
);

create index user_subscriptions_user_idx on public.user_subscriptions (user_id, ends_at desc);

alter table public.payments
  add column subscription_plan_id uuid references public.subscription_plans (id) on delete set null,
  add constraint payments_one_product check (num_nonnulls(credit_pack_id, subscription_plan_id) <= 1);

alter table public.tryons
  add column subscription_id uuid references public.user_subscriptions (id) on delete set null;

alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;

create policy "Anyone sees active plans" on public.subscription_plans
  for select to anon, authenticated using (is_active);
create policy "Shoppers see their plans" on public.user_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Admins read all plans bought" on public.user_subscriptions
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));
revoke insert, update, delete on public.user_subscriptions from anon, authenticated;

-- Admins change prices from the dashboard
create policy "Admins manage plans" on public.subscription_plans
  for all to authenticated
  using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy "Admins manage credit packs" on public.credit_packs
  for all to authenticated
  using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));
create policy "Admins manage try-on prices" on public.tryon_prices
  for update to authenticated
  using (private.has_role((select auth.uid()), 'admin')) with check (private.has_role((select auth.uid()), 'admin'));

-- ------------------------------------------------------------------ new prices
update public.credit_packs set is_active = false where name = 'Starter';
insert into public.credit_packs (name, credits, price_kes, sort_order) values
  ('Single', 1, 50, 1),
  ('Bundle of 5', 5, 225, 2),
  ('Bundle of 12', 12, 480, 3);

update public.tryon_prices set credits = 2 where quality = 'hd';
update public.tryon_prices set credits = 4 where quality = 'studio';

-- ------------------------------------------------------------------ payments
create or replace function public.complete_payment(_provider_reference text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  _payment public.payments;
  _plan public.subscription_plans;
  _start timestamptz;
  _store_id uuid;
  _rate numeric(4, 3);
begin
  update public.payments
  set status = 'success', paid_at = now()
  where provider_reference = _provider_reference and status = 'pending'
  returning * into _payment;

  if not found then
    select * into _payment from public.payments where provider_reference = _provider_reference;
    return _payment;
  end if;

  if _payment.subscription_plan_id is not null then
    select * into _plan from public.subscription_plans where id = _payment.subscription_plan_id;
    -- Buying again while a plan is running queues the new month after it
    select greatest(now(), coalesce(max(ends_at), now())) into _start
    from public.user_subscriptions where user_id = _payment.user_id and ends_at > now();
    insert into public.user_subscriptions (user_id, plan_id, payment_id, credits_total, daily_limit, starts_at, ends_at)
    values (_payment.user_id, _plan.id, _payment.id, _payment.credits, _plan.daily_limit, _start, _start + make_interval(days => _plan.period_days));
  else
    insert into public.credit_ledger (user_id, amount, entry_type, payment_id)
    values (_payment.user_id, _payment.credits, 'purchase', _payment.id);
  end if;

  select r.store_id, f.referral_rate into _store_id, _rate
  from public.referrals r
  join public.stores s on s.id = r.store_id
  join public.store_finance f on f.store_id = r.store_id
  where r.referred_user_id = _payment.user_id and s.status = 'active';

  if _store_id is not null and _rate > 0 then
    update public.payments set referral_store_id = _store_id where id = _payment.id
    returning * into _payment;
    insert into public.referral_earnings (store_id, payment_id, rate, amount_kes)
    values (_store_id, _payment.id, _rate, round(_payment.amount_kes * _rate, 2));
  end if;

  return _payment;
end;
$$;

-- ------------------------------------------------------------------ refunds
create or replace function public.refund_tryon(_tryon_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid;
  _credits integer;
  _subscription uuid;
begin
  update public.tryons
  set status = 'failed', error_message = _reason, completed_at = now()
  where id = _tryon_id and status in ('queued', 'processing')
  returning user_id, credits_charged, subscription_id into _uid, _credits, _subscription;

  if not found or _credits <= 0 then
    return;
  end if;

  if _subscription is not null then
    update public.user_subscriptions set credits_used = greatest(credits_used - _credits, 0) where id = _subscription;
  else
    insert into public.credit_ledger (user_id, amount, entry_type, tryon_id, note)
    values (_uid, _credits, 'tryon_refund', _tryon_id, _reason)
    on conflict do nothing;
  end if;
end;
$$;

-- A try-on whose server run died (timeout, crash) is refunded instead of spinning forever
create or replace function private.reap_stale_tryons(_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _id uuid;
begin
  for _id in
    select id from public.tryons
    where user_id = _uid and status in ('queued', 'processing')
      and coalesce(started_at, created_at) < now() - interval '15 minutes'
  loop
    perform public.refund_tryon(_id, 'This try-on took too long, so your credits were returned.');
  end loop;
end;
$$;

-- ------------------------------------------------------------------ wallet
create or replace function public.my_wallet()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  credits as (
    select coalesce(sum(l.amount), 0)::integer as value from public.credit_ledger l, me where l.user_id = me.id
  ),
  current_plan as (
    select s.*, p.name as plan_name, p.code as plan_code
    from public.user_subscriptions s
    join public.subscription_plans p on p.id = s.plan_id, me
    where s.user_id = me.id and now() >= s.starts_at and now() < s.ends_at
    order by s.ends_at
    limit 1
  ),
  used_today as (
    select count(*)::integer as value from public.tryons t, current_plan c
    where t.subscription_id = c.id and t.status in ('queued', 'processing', 'succeeded')
      and t.created_at >= (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi')
  )
  select json_build_object(
    'credits', credits.value,
    'spendable', credits.value + coalesce((select credits_total - credits_used from current_plan), 0),
    'plan', (
      select json_build_object(
        'id', c.id, 'name', c.plan_name, 'code', c.plan_code,
        'credits_left', c.credits_total - c.credits_used, 'credits_total', c.credits_total,
        'daily_limit', c.daily_limit, 'used_today', (select value from used_today),
        'ends_at', c.ends_at
      ) from current_plan c
    ),
    'paid_until', (select max(s.ends_at) from public.user_subscriptions s, me where s.user_id = me.id and s.ends_at > now())
  )
  from credits;
$$;

-- ------------------------------------------------------------------ request_tryon
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

  insert into public.tryons (user_id, body_photo_id, product_id, garment_upload_id, quality, credits_charged, fit, size_system, size_value, size_label, garment_type, subscription_id)
  values (_uid, _body_photo_id, _product_id, _garment_upload_id, _quality, _price, _fit, _system, _target, _label, _garment_type, _subscription)
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

revoke execute on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;
revoke execute on function private.reap_stale_tryons(uuid) from public, anon, authenticated;
revoke execute on function public.refund_tryon(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_tryon(uuid, text) to service_role;
revoke execute on function public.complete_payment(text) from public, anon, authenticated;
grant execute on function public.complete_payment(text) to service_role;
