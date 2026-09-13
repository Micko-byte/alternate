-- ALTERNATE: try-ons, credits, M-Pesa payments, store referrals and payouts, orders, abuse reports

create type public.tryon_quality as enum ('standard', 'hd', 'studio');
create type public.tryon_status as enum ('queued', 'processing', 'succeeded', 'failed', 'rejected');
create type public.credit_entry_type as enum ('purchase', 'tryon_charge', 'tryon_refund', 'adjustment');
create type public.payment_status as enum ('pending', 'success', 'failed', 'refunded');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed');
create type public.order_status as enum ('pending_payment', 'paid', 'fulfilled', 'cancelled', 'refunded');
create type public.report_reason as enum ('not_me', 'inappropriate', 'offensive', 'copyright', 'other');
create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

-- Pricing is data, so it can change without a code release
create table public.credit_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits integer not null check (credits > 0),
  price_kes integer not null check (price_kes > 0),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.tryon_prices (
  quality public.tryon_quality primary key,
  credits integer not null check (credits > 0)
);

insert into public.credit_packs (name, credits, price_kes, sort_order) values
  ('Starter', 4, 50, 1);

insert into public.tryon_prices (quality, credits) values
  ('standard', 1),
  ('hd', 3),
  ('studio', 5);

-- Screenshots shoppers upload (e.g. a dress from Instagram)
create table public.garment_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  category public.garment_category,
  source_note text check (char_length(source_note) <= 200),
  created_at timestamptz not null default now()
);

create index garment_uploads_user_idx on public.garment_uploads (user_id);

create table public.tryons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  body_photo_id uuid not null references public.body_photos (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  garment_upload_id uuid references public.garment_uploads (id) on delete set null,
  quality public.tryon_quality not null default 'standard',
  status public.tryon_status not null default 'queued',
  credits_charged integer not null default 0 check (credits_charged >= 0),
  engine text,
  garment_instruction text,
  result_path text,
  identity_score numeric(4, 3),
  attempts smallint not null default 0,
  cost_usd numeric(10, 5),
  error_message text,
  rating smallint check (rating in (-1, 1)),
  feedback text check (char_length(feedback) <= 500),
  shared_path text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint tryons_single_garment check (num_nonnulls(product_id, garment_upload_id) <= 1)
);

create index tryons_user_idx on public.tryons (user_id, created_at desc);
create index tryons_product_idx on public.tryons (product_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credit_pack_id uuid references public.credit_packs (id) on delete set null,
  credits integer not null check (credits > 0),
  amount_kes integer not null check (amount_kes > 0),
  provider text not null default 'paystack',
  provider_reference text not null unique,
  status public.payment_status not null default 'pending',
  referral_store_id uuid references public.stores (id) on delete set null,
  metadata jsonb not null default '{}',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_user_idx on public.payments (user_id, created_at desc);

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Append-only credit ledger. Balance = sum(amount).
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),
  entry_type public.credit_entry_type not null,
  tryon_id uuid references public.tryons (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index credit_ledger_user_idx on public.credit_ledger (user_id);
-- A try-on can be charged once and refunded once; a payment credits once
create unique index credit_ledger_tryon_once on public.credit_ledger (tryon_id, entry_type) where tryon_id is not null;
create unique index credit_ledger_payment_once on public.credit_ledger (payment_id) where payment_id is not null;

-- Which store brought each shopper (first store link wins)
create table public.referrals (
  referred_user_id uuid primary key references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index referrals_store_idx on public.referrals (store_id);

create table public.store_payouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  amount_kes numeric(10, 2) not null check (amount_kes > 0),
  status public.payout_status not null default 'pending',
  provider_reference text unique,
  failure_reason text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz
);

create index store_payouts_store_idx on public.store_payouts (store_id);

create table public.referral_earnings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  payment_id uuid not null unique references public.payments (id) on delete cascade,
  rate numeric(4, 3) not null,
  amount_kes numeric(10, 2) not null check (amount_kes >= 0),
  payout_id uuid references public.store_payouts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index referral_earnings_store_idx on public.referral_earnings (store_id);

create table public.store_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  plan public.store_plan not null,
  amount_kes integer not null check (amount_kes > 0),
  period_start timestamptz not null,
  period_end timestamptz not null check (period_end > period_start),
  provider_reference text not null unique,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index store_subscription_payments_store_idx on public.store_subscription_payments (store_id);

-- In-app purchases of clothing (commission split through Paystack)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  tryon_id uuid references public.tryons (id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_kes integer not null check (unit_price_kes >= 0),
  total_kes integer not null check (total_kes >= 0),
  commission_rate numeric(4, 3) not null,
  commission_kes numeric(10, 2) not null check (commission_kes >= 0),
  status public.order_status not null default 'pending_payment',
  provider_reference text unique,
  delivery_phone text,
  delivery_notes text check (char_length(delivery_notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_store_idx on public.orders (store_id, created_at desc);
create index orders_user_idx on public.orders (user_id, created_at desc);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null default auth.uid(),
  tryon_id uuid references public.tryons (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  store_id uuid references public.stores (id) on delete set null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at);

-- New account: create profile and record the store link they signed up through
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _code text := upper(nullif(trim(new.raw_user_meta_data ->> 'referral_code'), ''));
begin
  insert into public.profiles (id, display_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'display_name', new.phone);

  if _code is not null then
    insert into public.referrals (referred_user_id, store_id)
    select new.id, s.id from public.stores s
    where s.referral_code = _code and s.status = 'active'
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.credit_balance()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer
  from public.credit_ledger
  where user_id = (select auth.uid());
$$;

-- The only way to start a try-on. Enforces: 18+, consent, own photo,
-- item listed and in stock in the shopper's size, reuse of past results, enough credits.
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

    -- Same photo, same item, same quality: return the saved result, no charge
    select * into _row from public.tryons
    where user_id = _uid and body_photo_id = _body_photo_id and product_id = _product_id
      and quality = _quality and status = 'succeeded'
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

  -- Serialise charges per shopper so two taps can't spend the same credits
  perform pg_advisory_xact_lock(hashtextextended(_uid::text, 0));
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

-- Server only: give credits back when generation fails
create or replace function public.refund_tryon(_tryon_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid;
  _credits integer;
begin
  update public.tryons
  set status = 'failed', error_message = _reason, completed_at = now()
  where id = _tryon_id and status in ('queued', 'processing')
  returning user_id, credits_charged into _uid, _credits;

  if not found then
    return;
  end if;

  if _credits > 0 then
    insert into public.credit_ledger (user_id, amount, entry_type, tryon_id, note)
    values (_uid, _credits, 'tryon_refund', _tryon_id, _reason)
    on conflict do nothing;
  end if;
end;
$$;

-- Server only: called by the Paystack webhook once payment is confirmed
create or replace function public.complete_payment(_provider_reference text)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  _payment public.payments;
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

  insert into public.credit_ledger (user_id, amount, entry_type, payment_id)
  values (_payment.user_id, _payment.credits, 'purchase', _payment.id);

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

revoke execute on function public.request_tryon(uuid, uuid, uuid, public.tryon_quality) from public, anon;
grant execute on function public.request_tryon(uuid, uuid, uuid, public.tryon_quality) to authenticated;
revoke execute on function public.credit_balance() from public, anon;
grant execute on function public.credit_balance() to authenticated;
revoke execute on function public.refund_tryon(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_tryon(uuid, text) to service_role;
revoke execute on function public.complete_payment(text) from public, anon, authenticated;
grant execute on function public.complete_payment(text) to service_role;

-- Row-level security
alter table public.credit_packs enable row level security;
alter table public.tryon_prices enable row level security;
alter table public.garment_uploads enable row level security;
alter table public.tryons enable row level security;
alter table public.payments enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.referrals enable row level security;
alter table public.store_payouts enable row level security;
alter table public.referral_earnings enable row level security;
alter table public.store_subscription_payments enable row level security;
alter table public.orders enable row level security;
alter table public.reports enable row level security;

create policy "Anyone sees active credit packs" on public.credit_packs
  for select to anon, authenticated using (is_active);
create policy "Anyone sees try-on prices" on public.tryon_prices
  for select to anon, authenticated using (true);

create policy "Users manage their screenshots" on public.garment_uploads
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Try-ons are created only through request_tryon(); shoppers can rate and delete theirs
create policy "Users see their try-ons" on public.tryons
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users rate their try-ons" on public.tryons
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users delete their try-ons" on public.tryons
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.tryons from anon, authenticated;
grant update (rating, feedback) on public.tryons to authenticated;

create policy "Users see their payments" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Users see their credit history" on public.credit_ledger
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Shoppers and stores see referrals" on public.referrals
  for select to authenticated using (
    referred_user_id = (select auth.uid()) or public.is_store_owner(store_id, (select auth.uid()))
  );

create policy "Store owners see payouts" on public.store_payouts
  for select to authenticated using (public.is_store_owner(store_id, (select auth.uid())));

create policy "Store owners see referral earnings" on public.referral_earnings
  for select to authenticated using (public.is_store_owner(store_id, (select auth.uid())));

create policy "Store owners see subscription payments" on public.store_subscription_payments
  for select to authenticated using (public.is_store_owner(store_id, (select auth.uid())));

create policy "Buyers and stores see orders" on public.orders
  for select to authenticated using (
    user_id = (select auth.uid()) or public.is_store_member(store_id, (select auth.uid()))
  );
create policy "Store team updates order status" on public.orders
  for update to authenticated
  using (public.is_store_member(store_id, (select auth.uid())))
  with check (public.is_store_member(store_id, (select auth.uid())));
revoke insert, update, delete on public.orders from anon, authenticated;
grant update (status) on public.orders to authenticated;

create policy "Users report content" on public.reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and num_nonnulls(tryon_id, product_id, store_id) >= 1
  );
create policy "Users see their reports, moderators see all" on public.reports
  for select to authenticated using (
    reporter_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'moderator')
    or public.has_role((select auth.uid()), 'admin')
  );
create policy "Moderators review reports" on public.reports
  for update to authenticated
  using (public.has_role((select auth.uid()), 'moderator') or public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'moderator') or public.has_role((select auth.uid()), 'admin'));
revoke update on public.reports from anon, authenticated;
grant update (status, reviewed_by, reviewed_at) on public.reports to authenticated;

-- Live status updates for the "your try-on is ready" screen
alter publication supabase_realtime add table public.tryons;
