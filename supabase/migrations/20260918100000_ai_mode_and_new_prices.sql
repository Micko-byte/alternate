-- ALTERNATE: AI cost mode switch and new prices
--
-- 1. app_settings.ai_mode: 'saver' (checks and body profiles on a small cheap model, redo only when the item
--    itself came out wrong) or 'premium' (GPT-6 Astra for everything, redo on any failed check).
--    One switch for the whole system, set from Admin.
-- 2. Prices: KES 50 for 2 try-ons is the everyday offer; KES 50 for 3 is a launch offer for a shopper's
--    first purchase only (optionally until a date). Bundles repriced so each try-on still costs less than
--    in the KES 50 pack.
-- 3. Store share per pack: small packs give referring stores 10% instead of their usual 20%; bundles and
--    plans keep the store's own rate.

-- 1 ------------------------------------------------------------------ AI mode
insert into public.app_settings (key, value) values ('ai_mode', '"saver"')
on conflict (key) do nothing;

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
  if _key not in ('tryon_limit_per_user', 'ai_mode') then
    raise exception 'Unknown setting %', _key using errcode = '22023';
  end if;
  if _key = 'tryon_limit_per_user' and _value <> 'null'::jsonb and ((_value #>> '{}') !~ '^[0-9]{1,4}$') then
    raise exception 'Enter a whole number of try-ons' using errcode = '22023';
  end if;
  if _key = 'ai_mode' and (_value #>> '{}') not in ('saver', 'premium') then
    raise exception 'AI mode is saver or premium' using errcode = '22023';
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values (_key, _value, now(), (select auth.uid()))
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  perform private.audit('set_setting', null, json_build_object('key', _key, 'value', _value)::jsonb);
end;
$$;

-- What the AI actually costs, for the admin switch: averages from real try-ons, photo checks and body profiles
create or replace function public.admin_ai_costs()
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
    'tryons', (
      select coalesce(json_agg(r), '[]') from (
        select coalesce(qa ->> 'ai_mode', 'premium') as mode, quality, count(*) as n,
               round(avg(cost_usd)::numeric, 5) as avg_usd, round(max(cost_usd)::numeric, 5) as max_usd
        from public.tryons
        where status = 'succeeded' and cost_usd is not null and created_at > now() - interval '60 days'
        group by 1, 2
      ) r
    ),
    'inspections', (
      select json_build_object('n', count(*), 'avg_usd', round(avg(cost_usd)::numeric, 5))
      from public.garment_inspections where created_at > now() - interval '60 days'
    ),
    'body_profiles', (
      select json_build_object('n', count(*), 'avg_usd', round(avg(cost_usd)::numeric, 5))
      from public.body_profiles where updated_at > now() - interval '60 days'
    )
  );
end;
$$;

revoke execute on function public.admin_ai_costs() from public, anon;
grant execute on function public.admin_ai_costs() to authenticated;

-- 2 + 3 ------------------------------------------------------------------ packs
alter table public.credit_packs
  add column store_share numeric(4, 3) check (store_share between 0 and 0.5),
  add column first_purchase_only boolean not null default false,
  add column available_until timestamptz;

comment on column public.credit_packs.store_share is 'Share of the price paid to a referring store; null = the store''s own rate';

update public.credit_packs set is_active = false where name = 'Single';

insert into public.credit_packs (name, credits, price_kes, sort_order, store_share, first_purchase_only) values
  ('Launch offer', 3, 50, 0, 0.100, true),
  ('Two try-ons', 2, 50, 1, 0.100, false);

update public.credit_packs set price_kes = 120 where name = 'Bundle of 5';
update public.credit_packs set price_kes = 270 where name = 'Bundle of 12';

-- Referring stores earn the pack's share when it has one
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
  _pack_share numeric(4, 3);
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

  if _payment.credit_pack_id is not null then
    select store_share into _pack_share from public.credit_packs where id = _payment.credit_pack_id;
    _rate := coalesce(_pack_share, _rate);
  end if;

  if _store_id is not null and _rate > 0 then
    update public.payments set referral_store_id = _store_id where id = _payment.id
    returning * into _payment;
    insert into public.referral_earnings (store_id, payment_id, rate, amount_kes)
    values (_store_id, _payment.id, _rate, round(_payment.amount_kes * _rate, 2));
  end if;

  return _payment;
end;
$$;

revoke execute on function public.complete_payment(text) from public, anon, authenticated;
grant execute on function public.complete_payment(text) to service_role;
