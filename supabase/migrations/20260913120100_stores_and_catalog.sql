-- ALTERNATE: stores, team members, catalogue (photos, videos, sizes, stock), size alerts

create type public.store_status as enum ('pending', 'active', 'suspended');
create type public.store_member_role as enum ('owner', 'staff');
create type public.store_plan as enum ('free', 'pro');
create type public.product_status as enum ('draft', 'active', 'sold_out', 'archived');
create type public.media_kind as enum ('image', 'video');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  bio text check (char_length(bio) <= 500),
  logo_path text,
  cover_path text,
  instagram_handle text,
  tiktok_handle text,
  whatsapp_phone text,
  location text,
  status public.store_status not null default 'pending',
  plan public.store_plan not null default 'free',
  plan_renews_at timestamptz,
  referral_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

-- Money settings are private to the store team (not in the public stores row)
create table public.store_finance (
  store_id uuid primary key references public.stores (id) on delete cascade,
  referral_rate numeric(4, 3) not null default 0.200 check (referral_rate between 0 and 0.5),
  commission_rate numeric(4, 3) not null default 0.080 check (commission_rate between 0 and 0.3),
  paystack_subaccount_code text,
  payout_phone text,
  updated_at timestamptz not null default now()
);

create trigger store_finance_updated_at before update on public.store_finance
  for each row execute function public.set_updated_at();

create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.store_member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create index store_members_user_idx on public.store_members (user_id);

create or replace function public.is_store_member(_store_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.store_members where store_id = _store_id and user_id = _user_id
  );
$$;

create or replace function public.is_store_owner(_store_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.store_members
    where store_id = _store_id and user_id = _user_id and role = 'owner'
  );
$$;

-- Whoever creates a store becomes its owner and gets default finance settings
create or replace function public.handle_new_store()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.store_members (store_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  insert into public.store_finance (store_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_store_created after insert on public.stores
  for each row execute function public.handle_new_store();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 2000),
  category public.garment_category not null,
  price_kes integer not null check (price_kes >= 0),
  status public.product_status not null default 'draft',
  is_one_of_a_kind boolean not null default false,
  tags text[] not null default '{}',
  -- Exact garment description written by AI, used in try-on instructions
  garment_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_store_idx on public.products (store_id);
create index products_browse_idx on public.products (status, category, created_at desc);

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Photos and videos. Frames pulled from a video point back to it via extracted_from.
create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  kind public.media_kind not null,
  storage_path text not null unique,
  position smallint not null default 0,
  is_tryon_source boolean not null default false,
  extracted_from uuid references public.product_media (id) on delete set null,
  width integer,
  height integer,
  duration_seconds numeric(6, 2),
  created_at timestamptz not null default now()
);

create index product_media_product_idx on public.product_media (product_id, position);

-- store_id always comes from the product, never from the client
create or replace function public.product_media_set_store()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select p.store_id into new.store_id from public.products p where p.id = new.product_id;
  return new;
end;
$$;

create trigger product_media_set_store before insert or update of product_id on public.product_media
  for each row execute function public.product_media_set_store();

-- Sizes and stock. uk_size_min/max null = one size fits all.
-- A label like "M" can cover UK 10-12.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size_label text not null check (char_length(size_label) between 1 and 20),
  uk_size_min smallint check (uk_size_min between 2 and 32),
  uk_size_max smallint check (uk_size_max between 2 and 32),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size_label),
  constraint product_variants_uk_range check (
    (uk_size_min is null and uk_size_max is null)
    or (uk_size_min is not null and uk_size_max is not null and uk_size_min <= uk_size_max)
  )
);

create index product_variants_product_idx on public.product_variants (product_id);

create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- "Tell me when my size is back"
create table public.size_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  uk_size smallint not null check (uk_size between 2 and 32),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (user_id, product_id, uk_size)
);

create index size_alerts_product_idx on public.size_alerts (product_id);

create table public.saved_products (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create or replace function public.product_is_public(_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = _product_id and p.status in ('active', 'sold_out') and s.status = 'active'
  );
$$;

create or replace function public.product_store_member(_product_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.products p
    join public.store_members m on m.store_id = p.store_id
    where p.id = _product_id and m.user_id = _user_id
  );
$$;

-- Store insight: how many shoppers are waiting for each size
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
    and public.is_store_member(_store_id, (select auth.uid()))
  group by p.id, p.name, a.uk_size
  order by count(*) desc;
$$;

revoke execute on function public.store_size_demand(uuid) from public, anon;
grant execute on function public.store_size_demand(uuid) to authenticated;

-- Row-level security
alter table public.stores enable row level security;
alter table public.store_finance enable row level security;
alter table public.store_members enable row level security;
alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.product_variants enable row level security;
alter table public.size_alerts enable row level security;
alter table public.saved_products enable row level security;

-- Stores: public when active; the team and admins always see theirs
create policy "Anyone sees active stores" on public.stores
  for select to anon, authenticated using (
    status = 'active'
    or created_by = (select auth.uid())
    or public.is_store_member(id, (select auth.uid()))
    or public.has_role((select auth.uid()), 'admin')
  );
create policy "Signed-in users open a store" on public.stores
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Store team edits store profile" on public.stores
  for update to authenticated
  using (public.is_store_member(id, (select auth.uid())))
  with check (public.is_store_member(id, (select auth.uid())));
-- Status, plan and referral code are set by ALTERNATE, not by the store
revoke insert, update on public.stores from anon, authenticated;
grant insert (name, slug, bio, logo_path, cover_path, instagram_handle, tiktok_handle, whatsapp_phone, location)
  on public.stores to authenticated;
grant update (name, slug, bio, logo_path, cover_path, instagram_handle, tiktok_handle, whatsapp_phone, location)
  on public.stores to authenticated;

create policy "Store owners see finance settings" on public.store_finance
  for select to authenticated using (public.is_store_owner(store_id, (select auth.uid())));
create policy "Store owners set payout phone" on public.store_finance
  for update to authenticated
  using (public.is_store_owner(store_id, (select auth.uid())))
  with check (public.is_store_owner(store_id, (select auth.uid())));
revoke insert, update, delete on public.store_finance from anon, authenticated;
grant update (payout_phone) on public.store_finance to authenticated;

create policy "Team sees its members" on public.store_members
  for select to authenticated using (public.is_store_member(store_id, (select auth.uid())));
create policy "Owners add staff" on public.store_members
  for insert to authenticated with check (role = 'staff' and public.is_store_owner(store_id, (select auth.uid())));
create policy "Owners remove staff" on public.store_members
  for delete to authenticated using (role = 'staff' and public.is_store_owner(store_id, (select auth.uid())));

-- Catalogue: public when listed, fully editable by the store team
create policy "Anyone sees listed products" on public.products
  for select to anon, authenticated using (
    public.product_is_public(id) or public.is_store_member(store_id, (select auth.uid()))
  );
create policy "Store team adds products" on public.products
  for insert to authenticated with check (public.is_store_member(store_id, (select auth.uid())));
create policy "Store team edits products" on public.products
  for update to authenticated
  using (public.is_store_member(store_id, (select auth.uid())))
  with check (public.is_store_member(store_id, (select auth.uid())));
create policy "Store team deletes products" on public.products
  for delete to authenticated using (public.is_store_member(store_id, (select auth.uid())));

create policy "Anyone sees media of listed products" on public.product_media
  for select to anon, authenticated using (
    public.product_is_public(product_id) or public.is_store_member(store_id, (select auth.uid()))
  );
create policy "Store team adds media" on public.product_media
  for insert to authenticated with check (public.is_store_member(store_id, (select auth.uid())));
create policy "Store team edits media" on public.product_media
  for update to authenticated
  using (public.is_store_member(store_id, (select auth.uid())))
  with check (public.is_store_member(store_id, (select auth.uid())));
create policy "Store team deletes media" on public.product_media
  for delete to authenticated using (public.is_store_member(store_id, (select auth.uid())));

create policy "Anyone sees sizes of listed products" on public.product_variants
  for select to anon, authenticated using (
    public.product_is_public(product_id) or public.product_store_member(product_id, (select auth.uid()))
  );
create policy "Store team manages sizes" on public.product_variants
  for all to authenticated
  using (public.product_store_member(product_id, (select auth.uid())))
  with check (public.product_store_member(product_id, (select auth.uid())));

create policy "Users manage their size alerts" on public.size_alerts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users manage their saved products" on public.saved_products
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
