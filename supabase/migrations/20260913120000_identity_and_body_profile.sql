-- ALTERNATE: shopper identity, consent (Kenya Data Protection Act 2019), body photos and sizes

create type public.app_role as enum ('admin', 'moderator');
create type public.garment_category as enum ('dress', 'top', 'bottom', 'skirt', 'jumpsuit', 'outerwear', 'set', 'other');
create type public.photo_angle as enum ('front', 'back', 'side');
create type public.consent_type as enum ('terms', 'privacy_policy', 'body_photo_processing', 'cross_border_transfer', 'marketing');

-- Shared trigger: keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles (one per auth user, created by trigger in a later migration)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  phone text,
  date_of_birth date,
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 25 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Staff roles live in their own table, never on profiles
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Consent log: every grant is a row, withdrawal is timestamped (audit trail)
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type public.consent_type not null,
  policy_version text not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create index consents_user_type_idx on public.consents (user_id, consent_type);

-- Full-body photos (files live in the private body-photos bucket)
create table public.body_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  angle public.photo_angle not null,
  storage_path text not null unique,
  width integer,
  height integer,
  is_active boolean not null default true,
  confirmed_self boolean not null default false,
  created_at timestamptz not null default now()
);

create index body_photos_user_idx on public.body_photos (user_id);

-- The shopper's usual size per garment type, stored as a UK size (e.g. dress = 12)
create table public.user_sizes (
  user_id uuid not null references auth.users (id) on delete cascade,
  category public.garment_category not null,
  uk_size smallint not null check (uk_size between 2 and 32),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create trigger user_sizes_updated_at before update on public.user_sizes
  for each row execute function public.set_updated_at();

-- "Delete my data" requests, kept for the audit trail
create table public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Helpers used by row-level security
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

create or replace function public.has_consent(_user_id uuid, _type public.consent_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consents
    where user_id = _user_id and consent_type = _type and withdrawn_at is null
  );
$$;

create or replace function public.is_adult(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select date_of_birth <= (current_date - interval '18 years')::date
     from public.profiles where id = _user_id),
    false
  );
$$;

-- Row-level security
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.consents enable row level security;
alter table public.body_photos enable row level security;
alter table public.user_sizes enable row level security;
alter table public.data_deletion_requests enable row level security;

create policy "Users read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Users update their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Users read their own roles" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Users read their own consents" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users give consent" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()) and withdrawn_at is null);
create policy "Users withdraw consent" on public.consents
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.consents from anon, authenticated;
grant update (withdrawn_at) on public.consents to authenticated;

create policy "Users read their own body photos" on public.body_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Adults with photo consent add body photos" on public.body_photos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public.is_adult((select auth.uid()))
    and public.has_consent((select auth.uid()), 'body_photo_processing')
  );
create policy "Users update their own body photos" on public.body_photos
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users delete their own body photos" on public.body_photos
  for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.body_photos from anon, authenticated;
grant update (is_active, confirmed_self) on public.body_photos to authenticated;

create policy "Users manage their own sizes" on public.user_sizes
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users read their own deletion requests" on public.data_deletion_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users request data deletion" on public.data_deletion_requests
  for insert to authenticated with check (user_id = (select auth.uid()) and completed_at is null);
