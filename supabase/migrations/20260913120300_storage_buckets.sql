-- ALTERNATE: storage buckets for shoppers and stores
--
-- Shoppers (private, folder = user id)
--   body-photos      {user_id}/{photo_id}.jpg        full-body photos
--   garment-uploads  {user_id}/{upload_id}.jpg       Instagram/TikTok screenshots
--   tryon-results    {user_id}/{tryon_id}.webp      finished try-ons (written by the server)
-- Sharing (public, written by the server with the ALTERNATE watermark)
--   shared-looks     {user_id}/{tryon_id}.webp
-- Stores (public catalogue, folder = store id)
--   store-media      {store_id}/branding/logo.webp
--                    {store_id}/products/{product_id}/{file}   photos, videos, extracted frames
-- Server only (masks, intermediate images)
--   tryon-work       {tryon_id}/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('body-photos', 'body-photos', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('garment-uploads', 'garment-uploads', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('tryon-results', 'tryon-results', false, 20971520,
    array['image/png', 'image/jpeg', 'image/webp', 'video/mp4']),
  ('shared-looks', 'shared-looks', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('store-media', 'store-media', true, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('tryon-work', 'tryon-work', false, 20971520, null)
on conflict (id) do nothing;

-- body-photos: only the owner, and only after giving photo consent
create policy "Owners read their body photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'body-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Consenting owners upload body photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_consent((select auth.uid()), 'body_photo_processing')
  );
create policy "Owners delete their body photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'body-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- garment-uploads: only the owner
create policy "Owners read their screenshots" on storage.objects
  for select to authenticated using (
    bucket_id = 'garment-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Owners upload screenshots" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'garment-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Owners delete their screenshots" on storage.objects
  for delete to authenticated using (
    bucket_id = 'garment-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- tryon-results: owner reads and deletes; only the server writes
create policy "Owners read their try-on results" on storage.objects
  for select to authenticated using (
    bucket_id = 'tryon-results' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Owners delete their try-on results" on storage.objects
  for delete to authenticated using (
    bucket_id = 'tryon-results' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- shared-looks: public links; owner can unshare
create policy "Owners unshare their looks" on storage.objects
  for delete to authenticated using (
    bucket_id = 'shared-looks' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- store-media: public to view; the store team uploads, replaces and deletes
create policy "Store team uploads media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] in (
      select store_id::text from public.store_members where user_id = (select auth.uid())
    )
  );
create policy "Store team replaces media" on storage.objects
  for update to authenticated using (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] in (
      select store_id::text from public.store_members where user_id = (select auth.uid())
    )
  );
create policy "Store team deletes media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'store-media'
    and (storage.foldername(name))[1] in (
      select store_id::text from public.store_members where user_id = (select auth.uid())
    )
  );

-- tryon-work: no policies, so only the server (service role) can touch it
