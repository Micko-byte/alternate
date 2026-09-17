-- ALTERNATE: privacy choices from the shopper survey
-- blur_face_on_save:        saved try-on images have the face blurred automatically
-- delete_photos_after_tryon: body photos are deleted from our servers as soon as a try-on is made
--                            (the result keeps the untouched parts of the photo baked in)
alter table public.profiles
  add column blur_face_on_save boolean not null default false,
  add column delete_photos_after_tryon boolean not null default false;

grant update (blur_face_on_save, delete_photos_after_tryon) on public.profiles to authenticated;
