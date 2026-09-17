-- ALTERNATE: deleting a body photo keeps the try-ons made from it
-- Before, deleting a photo deleted every try-on made with it (on delete cascade). Now the try-on stays:
-- the delete-my-data function first bakes the untouched parts of the photo into the result, then removes
-- the photo. The face mask path is kept on the try-on so the face can still be blurred when viewing.

alter table public.tryons alter column body_photo_id drop not null;
alter table public.tryons drop constraint tryons_body_photo_id_fkey;
alter table public.tryons
  add constraint tryons_body_photo_id_fkey foreign key (body_photo_id) references public.body_photos (id) on delete set null;

alter table public.tryons add column face_mask_path text;

update public.tryons t
set face_mask_path = b.face_mask_path
from public.body_photos b
where b.id = t.body_photo_id and t.face_mask_path is null;
