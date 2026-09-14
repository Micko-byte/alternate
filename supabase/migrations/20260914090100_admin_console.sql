-- ALTERNATE: admin console
-- Owner manages admins; admins see statistics, users, generations, feedback and reports.
-- Every admin action is written to admin_audit_log.

-- ---------------------------------------------------------------- settings & limits
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.app_settings (key, value) values ('tryon_limit_per_user', '4');

alter table public.app_settings enable row level security;
create policy "Signed-in users read settings" on public.app_settings
  for select to authenticated using (true);

-- Per-person override of the try-on cap (null = use the default)
alter table public.profiles add column tryon_limit smallint check (tryon_limit >= 0);

-- Shoppers may edit their own profile, but never their own limit
revoke update on public.profiles from anon, authenticated;
grant update (display_name, phone, date_of_birth, height_cm, weight_kg, shops_for, preferred_fit)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------- feedback
create type public.feedback_category as enum ('tryon_quality', 'idea', 'bug', 'stores', 'payments', 'other');
create type public.feedback_status as enum ('new', 'read', 'planned', 'done');

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  category public.feedback_category not null default 'other',
  rating smallint check (rating between 1 and 5),
  message text not null check (char_length(message) between 3 and 2000),
  page text check (char_length(page) <= 200),
  tryon_id uuid references public.tryons (id) on delete set null,
  status public.feedback_status not null default 'new',
  admin_note text check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feedback_status_idx on public.feedback (status, created_at desc);
create trigger feedback_updated_at before update on public.feedback
  for each row execute function public.set_updated_at();

alter table public.feedback enable row level security;
create policy "Users send feedback" on public.feedback
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'new' and admin_note is null);
create policy "Users see their feedback, admins see all" on public.feedback
  for select to authenticated using (user_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin'));
create policy "Admins triage feedback" on public.feedback
  for update to authenticated
  using (private.has_role((select auth.uid()), 'admin'))
  with check (private.has_role((select auth.uid()), 'admin'));
revoke update on public.feedback from anon, authenticated;
grant update (status, admin_note) on public.feedback to authenticated;

-- ---------------------------------------------------------------- audit log
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_user_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
create policy "Admins read the audit log" on public.admin_audit_log
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));

create or replace function private.audit(_action text, _target uuid, _details jsonb default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, action, target_user_id, details)
  values ((select auth.uid()), _action, _target, coalesce(_details, '{}'));
$$;

-- ---------------------------------------------------------------- admin read access
create policy "Admins read all profiles" on public.profiles
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));
create policy "Admins read all try-ons" on public.tryons
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));
create policy "Admins read all inspirations" on public.garment_uploads
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));
create policy "Admins read all payments" on public.payments
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));
create policy "Admins read all credit history" on public.credit_ledger
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));
create policy "Admins read deletion requests" on public.data_deletion_requests
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));
create policy "Admins read all roles" on public.user_roles
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));

create policy "Admins view try-on results and inspirations" on storage.objects
  for select to authenticated using (
    bucket_id in ('tryon-results', 'garment-uploads') and private.has_role((select auth.uid()), 'admin')
  );

-- ---------------------------------------------------------------- functions
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role((select auth.uid()), 'owner');
$$;

create or replace function public.my_tryon_allowance()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  lim as (
    select coalesce(
      (select tryon_limit from public.profiles p, me where p.id = me.id),
      (select (value #>> '{}')::integer from public.app_settings where key = 'tryon_limit_per_user')
    ) as value
  ),
  used as (
    select count(*)::integer as value from public.tryons t, me
    where t.user_id = me.id and t.status in ('queued', 'processing', 'succeeded')
  )
  select json_build_object(
    'limit', lim.value,
    'used', used.value,
    'remaining', case when lim.value is null then null else greatest(lim.value - used.value, 0) end,
    'exempt', private.has_role(me.id, 'admin')
  )
  from me, lim, used;
$$;

create or replace function public.admin_overview(_days integer default 30)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(_days, 1) - 1);
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return json_build_object(
    'since', _since,
    'users_total', (select count(*) from auth.users),
    'users_new', (select count(*) from auth.users where created_at >= _since),
    'users_active', (select count(distinct user_id) from public.tryons where created_at >= _since),
    'tryons', (select count(*) from public.tryons where created_at >= _since),
    'tryons_succeeded', (select count(*) from public.tryons where created_at >= _since and status = 'succeeded'),
    'tryons_failed', (select count(*) from public.tryons where created_at >= _since and status = 'failed'),
    'tryon_cost_usd', (select coalesce(sum(cost_usd), 0) from public.tryons where created_at >= _since),
    'draft_cost_usd', (select coalesce(sum(ai_cost_usd), 0) from public.products where created_at >= _since),
    'drafts', (select count(*) from public.products where created_at >= _since and ai_draft is not null),
    'revenue_kes', (select coalesce(sum(amount_kes), 0) from public.payments where status = 'success' and paid_at >= _since),
    'credits_sold', (select coalesce(sum(amount), 0) from public.credit_ledger where entry_type = 'purchase' and created_at >= _since),
    'credits_granted', (select coalesce(sum(amount), 0) from public.credit_ledger where entry_type = 'adjustment' and amount > 0 and created_at >= _since),
    'credits_used', (select coalesce(-sum(amount), 0) from public.credit_ledger where entry_type in ('tryon_charge', 'tryon_refund') and created_at >= _since),
    'ratings_up', (select count(*) from public.tryons where created_at >= _since and rating = 1),
    'ratings_down', (select count(*) from public.tryons where created_at >= _since and rating = -1),
    'stores_active', (select count(*) from public.stores where status = 'active'),
    'stores_pending', (select count(*) from public.stores where status = 'pending'),
    'products_active', (select count(*) from public.products where status = 'active'),
    'feedback_new', (select count(*) from public.feedback where status = 'new'),
    'reports_open', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'deletions_open', (select count(*) from public.data_deletion_requests where completed_at is null),
    'tryon_limit', (select value #>> '{}' from public.app_settings where key = 'tryon_limit_per_user'),
    'by_quality', (
      select coalesce(json_agg(q order by q.quality), '[]'::json) from (
        select quality, count(*) as tryons, count(*) filter (where status = 'succeeded') as succeeded,
               coalesce(sum(cost_usd), 0) as cost_usd, avg(cost_usd) filter (where status = 'succeeded') as avg_cost_usd
        from public.tryons where created_at >= _since group by quality
      ) q
    ),
    'daily', (
      select json_agg(d order by d.day) from (
        select gs::date as day,
          (select count(*) from auth.users u where u.created_at >= gs and u.created_at < gs + interval '1 day') as signups,
          (select count(*) from public.tryons t where t.created_at >= gs and t.created_at < gs + interval '1 day') as tryons,
          (select coalesce(sum(t.cost_usd), 0) from public.tryons t where t.created_at >= gs and t.created_at < gs + interval '1 day')
            + (select coalesce(sum(p.ai_cost_usd), 0) from public.products p where p.created_at >= gs and p.created_at < gs + interval '1 day') as cost_usd,
          (select coalesce(sum(pm.amount_kes), 0) from public.payments pm where pm.status = 'success' and pm.paid_at >= gs and pm.paid_at < gs + interval '1 day') as revenue_kes
        from generate_series(_since, date_trunc('day', now()), interval '1 day') gs
      ) d
    ),
    'top_users', (
      select coalesce(json_agg(t), '[]'::json) from (
        select u.email, count(*) as tryons, coalesce(sum(tr.cost_usd), 0) as cost_usd
        from public.tryons tr join auth.users u on u.id = tr.user_id
        where tr.created_at >= _since
        group by u.email order by coalesce(sum(tr.cost_usd), 0) desc limit 5
      ) t
    )
  );
end;
$$;

create or replace function public.admin_users(_search text default null)
returns table (
  id uuid, email text, display_name text, created_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz,
  roles text[], shops_for text, credits integer, tryons bigint, tryons_succeeded bigint, cost_usd numeric,
  tryon_limit smallint, store_name text, feedback_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, p.display_name, u.created_at, u.last_sign_in_at, u.banned_until,
    coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = u.id), '{}'),
    p.shops_for::text,
    (select coalesce(sum(l.amount), 0)::integer from public.credit_ledger l where l.user_id = u.id),
    (select count(*) from public.tryons t where t.user_id = u.id),
    (select count(*) from public.tryons t where t.user_id = u.id and t.status = 'succeeded'),
    (select coalesce(sum(t.cost_usd), 0) from public.tryons t where t.user_id = u.id),
    p.tryon_limit,
    (select s.name from public.store_members m join public.stores s on s.id = m.store_id where m.user_id = u.id limit 1),
    (select count(*) from public.feedback f where f.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where _search is null or _search = ''
     or u.email ilike '%' || _search || '%'
     or p.display_name ilike '%' || _search || '%'
  order by u.created_at desc
  limit 500;
end;
$$;

create or replace function public.admin_tryons(_status public.tryon_status default null, _limit integer default 60, _offset integer default 0)
returns table (
  id uuid, created_at timestamptz, status text, quality text, fit text, credits_charged integer, cost_usd numeric,
  rating smallint, engine text, error_message text, result_path text, garment_path text,
  product_name text, store_name text, user_id uuid, user_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select t.id, t.created_at, t.status::text, t.quality::text, t.fit::text, t.credits_charged, t.cost_usd,
    t.rating, t.engine, t.error_message, t.result_path, coalesce(g.cutout_path, g.storage_path),
    pr.name, s.name, t.user_id, u.email::text
  from public.tryons t
  join auth.users u on u.id = t.user_id
  left join public.garment_uploads g on g.id = t.garment_upload_id
  left join public.products pr on pr.id = t.product_id
  left join public.stores s on s.id = pr.store_id
  where _status is null or t.status = _status
  order by t.created_at desc
  limit least(greatest(_limit, 1), 200) offset greatest(_offset, 0);
end;
$$;

create or replace function public.admin_feedback()
returns table (
  id uuid, created_at timestamptz, category text, rating smallint, message text, page text,
  status text, admin_note text, tryon_id uuid, user_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select f.id, f.created_at, f.category::text, f.rating, f.message, f.page, f.status::text, f.admin_note, f.tryon_id, u.email::text
  from public.feedback f left join auth.users u on u.id = f.user_id
  order by (f.status = 'new') desc, f.created_at desc
  limit 500;
end;
$$;

create or replace function public.admin_reports()
returns table (
  id uuid, created_at timestamptz, reason text, details text, status text,
  tryon_id uuid, product_id uuid, store_id uuid, reporter_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select r.id, r.created_at, r.reason::text, r.details, r.status::text, r.tryon_id, r.product_id, r.store_id, u.email::text
  from public.reports r left join auth.users u on u.id = r.reporter_id
  order by (r.status in ('open', 'reviewing')) desc, r.created_at desc
  limit 500;
end;
$$;

create or replace function public.admin_set_tryon_limit(_user_id uuid, _limit integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if _limit is not null and _limit < 0 then
    raise exception 'The limit must be 0 or more' using errcode = '22023';
  end if;
  update public.profiles set tryon_limit = _limit where id = _user_id;
  perform private.audit('set_tryon_limit', _user_id, json_build_object('limit', _limit)::jsonb);
end;
$$;

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
  if _key not in ('tryon_limit_per_user') then
    raise exception 'Unknown setting %', _key using errcode = '22023';
  end if;
  if _key = 'tryon_limit_per_user' and _value <> 'null'::jsonb and ((_value #>> '{}') !~ '^[0-9]{1,4}$') then
    raise exception 'Enter a whole number of try-ons' using errcode = '22023';
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values (_key, _value, now(), (select auth.uid()))
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  perform private.audit('set_setting', null, json_build_object('key', _key, 'value', _value)::jsonb);
end;
$$;

create or replace function public.owner_set_admin(_email text, _grant boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid;
begin
  if not private.has_role((select auth.uid()), 'owner') then
    raise exception 'Only the owner can add or remove admins' using errcode = '42501';
  end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email));
  if _uid is null then
    raise exception 'No account uses %. Ask them to sign up first.', _email using errcode = 'P0002';
  end if;
  if _uid = (select auth.uid()) and not _grant then
    raise exception 'You can''t remove your own admin access' using errcode = '42501';
  end if;
  if _grant then
    insert into public.user_roles (user_id, role) values (_uid, 'admin') on conflict do nothing;
  else
    delete from public.user_roles where user_id = _uid and role = 'admin';
  end if;
  perform private.audit(case when _grant then 'grant_admin' else 'revoke_admin' end, _uid, json_build_object('email', _email)::jsonb);
end;
$$;

create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, roles text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, array_agg(r.role::text order by r.role)
  from public.user_roles r join auth.users u on u.id = r.user_id
  group by u.id, u.email
  order by bool_or(r.role = 'owner') desc, u.email;
end;
$$;

-- Credits granted by admins are now audited too
create or replace function public.admin_grant_credits(_email text, _credits integer, _note text default 'Test credits')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid;
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Only ALTERNATE admins can grant credits' using errcode = '42501';
  end if;
  if _credits = 0 then
    raise exception 'Enter a number of credits other than 0' using errcode = '22023';
  end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email));
  if _uid is null then
    raise exception 'No account uses %', _email using errcode = 'P0002';
  end if;
  insert into public.credit_ledger (user_id, amount, entry_type, note)
  values (_uid, _credits, 'adjustment', _note);
  perform private.audit('grant_credits', _uid, json_build_object('credits', _credits, 'note', _note)::jsonb);
  return (select coalesce(sum(amount), 0)::integer from public.credit_ledger where user_id = _uid);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.is_owner()', 'public.my_tryon_allowance()', 'public.admin_overview(integer)', 'public.admin_users(text)',
    'public.admin_tryons(public.tryon_status, integer, integer)', 'public.admin_feedback()', 'public.admin_reports()',
    'public.admin_set_tryon_limit(uuid, integer)', 'public.admin_set_setting(text, jsonb)',
    'public.owner_set_admin(text, boolean)', 'public.admin_list_admins()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- try-on cap
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
  _limit integer;
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
