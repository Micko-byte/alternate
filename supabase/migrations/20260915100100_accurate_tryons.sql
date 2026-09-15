-- ALTERNATE: accurate try-ons
-- 1. Garment types (hoodie, blazer, quarter-zip, sunglasses…) on store pieces and inspirations
-- 2. Garment inspections, written only by the server: what is really in a photo, so a photo of
--    trousers can't be tried on as a shirt
-- 3. Body profiles: what all of a shopper's photos show about their build, limbs and posture
-- 4. Edit masks for shoes, glasses, hats and jewellery
-- 5. The automatic quality check on each try-on

-- 1 ------------------------------------------------------------------ garment types
alter table public.products add column garment_type text check (char_length(garment_type) <= 40);
alter table public.garment_uploads add column garment_type text check (char_length(garment_type) <= 40);

-- 2 ------------------------------------------------------------------ inspections
create table public.garment_inspections (
  id uuid primary key default gen_random_uuid(),
  product_id uuid unique references public.products (id) on delete cascade,
  garment_upload_id uuid unique references public.garment_uploads (id) on delete cascade,
  source_path text not null,
  categories public.garment_category[] not null default '{}',
  -- [{ "type": "hoodie", "category": "top", "colour": "grey", "main": true, "description": "…" }]
  items jsonb not null default '[]',
  is_wearable boolean not null default true,
  cost_usd numeric(10, 5),
  created_at timestamptz not null default now(),
  constraint garment_inspections_one_source check (num_nonnulls(product_id, garment_upload_id) = 1)
);

alter table public.garment_inspections enable row level security;

create policy "Shoppers see checks on their inspirations" on public.garment_inspections
  for select to authenticated using (
    exists (select 1 from public.garment_uploads g where g.id = garment_upload_id and g.user_id = (select auth.uid()))
  );
create policy "Store teams see checks on their pieces" on public.garment_inspections
  for select to authenticated using (
    exists (select 1 from public.products p where p.id = product_id and private.is_store_member(p.store_id, (select auth.uid())))
  );
create policy "Admins read garment checks" on public.garment_inspections
  for select to authenticated using (private.has_role((select auth.uid()), 'admin'));
revoke insert, update, delete on public.garment_inspections from anon, authenticated;

-- Friendly names for messages
create or replace function private.category_name(_category public.garment_category)
returns text
language sql
immutable
set search_path = ''
as $$
  select case _category::text
    when 'dress' then 'a dress'
    when 'top' then 'a top'
    when 'bottom' then 'trousers'
    when 'skirt' then 'a skirt'
    when 'jumpsuit' then 'a jumpsuit'
    when 'outerwear' then 'a jacket or coat'
    when 'set' then 'a matching set'
    when 'shoes' then 'shoes'
    when 'eyewear' then 'glasses'
    when 'headwear' then 'a hat'
    when 'jewellery' then 'jewellery'
    else 'clothing'
  end;
$$;

-- Does the photo contain what the shopper asked to try on? Close relatives count
-- (a blazer can be picked as a top, a co-ord as a set).
create or replace function private.category_matches(_requested public.garment_category, _detected public.garment_category[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    _detected is null
    or cardinality(_detected) = 0
    or _requested::text = 'other'
    or _requested = any(_detected)
    or (_requested::text in ('top', 'outerwear') and _detected && array['top', 'outerwear']::public.garment_category[])
    or (_requested::text = 'set' and _detected && array['top', 'bottom', 'skirt', 'outerwear']::public.garment_category[]);
$$;

-- 3 ------------------------------------------------------------------ body profiles
create table public.body_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  photo_ids uuid[] not null default '{}',
  summary text,
  body jsonb not null default '{}',
  -- [{ "id": "…", "angle": "side", "arms_visible": true, "legs_visible": false, "clothing_fit": "fitted", "usable": true, "issues": [] }]
  photos jsonb not null default '[]',
  tips text[] not null default '{}',
  cost_usd numeric(10, 5),
  updated_at timestamptz not null default now()
);

alter table public.body_profiles enable row level security;
create policy "Shoppers see their body profile" on public.body_profiles
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.body_profiles from anon, authenticated;

-- 4 ------------------------------------------------------------------ more masks
alter table public.body_photos
  add column mask_feet_path text,
  add column mask_eyes_path text,
  add column mask_head_path text,
  add column mask_jewellery_path text;

-- Masks can be added later for photos uploaded before these existed, but only inside the owner's folder
alter table public.body_photos
  add constraint body_photos_masks_in_own_folder check (
    (mask_feet_path is null or mask_feet_path like user_id::text || '/%')
    and (mask_eyes_path is null or mask_eyes_path like user_id::text || '/%')
    and (mask_head_path is null or mask_head_path like user_id::text || '/%')
    and (mask_jewellery_path is null or mask_jewellery_path like user_id::text || '/%')
  ),
  add constraint body_photos_paths_in_own_folder check (
    storage_path like user_id::text || '/%'
    and (edit_mask_path is null or edit_mask_path like user_id::text || '/%')
    and (mask_upper_path is null or mask_upper_path like user_id::text || '/%')
    and (mask_lower_path is null or mask_lower_path like user_id::text || '/%')
    and (face_mask_path is null or face_mask_path like user_id::text || '/%')
  ) not valid;

grant update (mask_feet_path, mask_eyes_path, mask_head_path, mask_jewellery_path) on public.body_photos to authenticated;

-- 5 ------------------------------------------------------------------ quality check
alter table public.tryons
  add column qa jsonb,
  add column reference_photo_ids uuid[] not null default '{}',
  add column garment_type text check (char_length(garment_type) <= 40);
