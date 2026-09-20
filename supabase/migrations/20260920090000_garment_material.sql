-- VAA ALTERNATE: what the garment is made of
--
-- Stores type the fabric on each piece ("100% polyester", "cotton blend", "silk"), and shoppers can do
-- the same on an inspiration. Fabric is what decides how a piece falls: polyester and satin slide and
-- cling, cotton and denim hold their shape, chiffon floats. The try-on engine gets it alongside the
-- measurements and the stretch, so a silk slip is not drawn like a denim dress.

alter table public.products
  add column material text check (material is null or char_length(btrim(material)) between 2 and 80);

alter table public.garment_uploads
  add column material text check (material is null or char_length(btrim(material)) between 2 and 80);

comment on column public.products.material is 'Fabric in the store''s own words, e.g. 100% polyester, cotton blend, silk';
comment on column public.garment_uploads.material is 'Fabric a shopper typed for their own inspiration photo';
