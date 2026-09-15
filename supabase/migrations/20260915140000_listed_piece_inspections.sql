-- Shoppers see what the photo check read from a listed piece (type, length, stretch, designed room),
-- so the product page can estimate how each size fits when the store didn't type measurements.
create policy "Anyone sees checks on listed pieces" on public.garment_inspections
  for select to anon, authenticated using (
    exists (
      select 1 from public.products p join public.stores s on s.id = p.store_id
      where p.id = product_id and p.status in ('active', 'sold_out') and s.status = 'active'
    )
  );
