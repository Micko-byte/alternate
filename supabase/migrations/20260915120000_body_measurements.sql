-- ALTERNATE: body measurements (bust or chest, waist, hips)
-- Estimated in the shopper's browser from their front and side photos, scaled by their height,
-- and/or typed in from a tape measure. Tape values win over photo estimates.
-- Private to the shopper: no admin read policy.

create table public.body_measurements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bust_cm numeric(5, 1) check (bust_cm between 50 and 200),
  waist_cm numeric(5, 1) check (waist_cm between 40 and 200),
  hips_cm numeric(5, 1) check (hips_cm between 50 and 220),
  -- per field: 'tape' or 'photo'
  sources jsonb not null default '{}',
  -- ± cm for photo estimates (null when everything is tape-measured)
  accuracy_cm numeric(3, 1) check (accuracy_cm between 0 and 20),
  -- last photo estimate: { bust, waist, hips, accuracy, front_photo_id, side_photo_id, height_cm, notes[], measured_at }
  photo_estimate jsonb,
  -- tape measurements: { bust, waist, hips, measured_at }
  tape jsonb,
  updated_at timestamptz not null default now()
);

create trigger body_measurements_updated_at before update on public.body_measurements
  for each row execute function public.set_updated_at();

alter table public.body_measurements enable row level security;

create policy "Shoppers see their measurements" on public.body_measurements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Shoppers add their measurements" on public.body_measurements
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Shoppers change their measurements" on public.body_measurements
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Shoppers delete their measurements" on public.body_measurements
  for delete to authenticated using (user_id = (select auth.uid()));
