-- ALTERNATE: bulk import with AI-written drafts, and automatic sold-out

alter table public.products
  add column needs_review boolean not null default false,
  add column import_source text check (import_source in ('bulk', 'whatsapp', 'instagram', 'tiktok', 'website')),
  add column source_caption text check (char_length(source_caption) <= 2200),
  add column ai_draft jsonb,
  add column ai_cost_usd numeric(10, 5);

create index products_review_idx on public.products (store_id) where needs_review;

-- Stock drives status: all sizes at 0 → sold out; stock back → listed again.
-- Drafts and archived pieces are never switched on automatically.
create or replace function public.sync_product_stock_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _product uuid := coalesce(new.product_id, old.product_id);
  _in_stock boolean;
begin
  select exists (select 1 from public.product_variants where product_id = _product and stock_qty > 0) into _in_stock;
  update public.products
  set status = case
    when status = 'active' and not _in_stock then 'sold_out'::public.product_status
    when status = 'sold_out' and _in_stock then 'active'::public.product_status
    else status
  end
  where id = _product
    and status in ('active', 'sold_out')
    and exists (select 1 from public.product_variants where product_id = _product);
  return null;
end;
$$;

revoke execute on function public.sync_product_stock_status() from public, anon, authenticated;

create trigger product_variants_sync_status
  after insert or update of stock_qty or delete on public.product_variants
  for each row execute function public.sync_product_stock_status();
