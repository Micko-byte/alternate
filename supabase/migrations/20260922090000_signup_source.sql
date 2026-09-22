-- VAA ALTERNATE: where each shopper came from
--
-- Links in ads and bios carry ?s=<tag>. The browser remembers the first one it saw and sends it with
-- the sign-up, so Admin can answer "how many accounts, and how many paid try-ons, did that ad bring?"
-- instead of guessing from reach. Nothing personal is stored: it is a short campaign label.

alter table public.profiles
  add column signup_source text check (signup_source is null or char_length(signup_source) <= 60);

comment on column public.profiles.signup_source is 'First-touch campaign tag from ?s= or ?utm_source= at sign-up';

-- The live trigger, unchanged except for the new column
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
  insert into public.profiles (id, display_name, phone, shops_for, preferred_fit, signup_source)
  values (
    new.id,
    _meta ->> 'display_name',
    new.phone,
    case when _meta ->> 'shops_for' in ('women', 'men', 'both') then (_meta ->> 'shops_for')::public.shops_for end,
    case when _meta ->> 'preferred_fit' in ('fitted', 'regular', 'relaxed', 'oversized', 'baggy') then (_meta ->> 'preferred_fit')::public.fit_style else 'regular' end,
    left(nullif(btrim(_meta ->> 'source'), ''), 60)
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

-- Admin: accounts, first try-ons and paying shoppers per campaign tag
create or replace function public.admin_sources()
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
  return coalesce((
    select json_agg(r order by r.accounts desc) from (
      select
        coalesce(p.signup_source, 'not tagged') as source,
        count(*) as accounts,
        count(*) filter (where exists (select 1 from public.tryons t where t.user_id = p.id)) as tried,
        count(*) filter (where exists (select 1 from public.payments pay where pay.user_id = p.id and pay.status = 'success')) as paid
      from public.profiles p
      where p.created_at > now() - interval '90 days'
      group by 1
    ) r
  ), '[]');
end;
$$;

revoke execute on function public.admin_sources() from public, anon;
grant execute on function public.admin_sources() to authenticated;
