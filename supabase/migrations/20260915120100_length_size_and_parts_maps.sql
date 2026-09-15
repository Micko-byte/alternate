-- ALTERNATE: length, size and skin-safe masks
-- 1. Length of the item (where the hem sits on the body), optional length in cm and the size on the label,
--    for shoppers' inspirations and store pieces. Empty means "as designed", read from the photo.
-- 2. A parts map per body photo (every pixel labelled face, hair, top, trousers, arms, legs…), made in the
--    browser. The try-on engine builds the exact mask for each item from it: arms and legs only open where
--    the new item covers them, so tattoos and skin that stay visible are kept.

alter table public.garment_uploads
  add column length text check (length in ('cropped', 'waist', 'high_hip', 'hip', 'upper_thigh', 'mid_thigh', 'above_knee', 'knee', 'below_knee', 'mid_calf', 'ankle', 'floor')),
  add column length_cm numeric(5, 1) check (length_cm between 5 and 250),
  add column size_label text check (char_length(size_label) <= 12);

alter table public.products
  add column length text check (length in ('cropped', 'waist', 'high_hip', 'hip', 'upper_thigh', 'mid_thigh', 'above_knee', 'knee', 'below_knee', 'mid_calf', 'ankle', 'floor')),
  add column length_cm numeric(5, 1) check (length_cm between 5 and 250);

alter table public.body_photos
  add column parts_map_path text,
  add constraint body_photos_parts_map_in_own_folder check (parts_map_path is null or parts_map_path like user_id::text || '/%');

grant update (parts_map_path) on public.body_photos to authenticated;
