-- ALTERNATE: "Find this in Nairobi stores"
-- The top survey frustration was finding local vendors who have the outfit. Every inspiration photo and
-- every listed piece already gets a photo check (type, category, colours, silhouette, length). This
-- matches an inspiration against listed, in-stock pieces with those words: no extra AI call per search.

create or replace function private.words(_text text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct w), '{}')
  from unnest(regexp_split_to_array(lower(coalesce(_text, '')), '[^a-z]+')) w
  where char_length(w) > 2
    and w not in ('and', 'with', 'the', 'for', 'base', 'details', 'detail', 'print', 'printed', 'small', 'large', 'light', 'dark', 'tone', 'accents', 'accent', 'throughout', 'women', 'womens', 'men', 'mens',
        -- what kind of item it is is matched by category, so these don't count as a shared style
        'dress', 'skirt', 'top', 'trousers', 'trouser', 'pants', 'jacket', 'coat', 'shoes', 'set', 'piece', 'outfit');
$$;

create or replace function public.similar_pieces(_garment_upload_id uuid, _limit integer default 8)
returns table (
  product_id uuid,
  name text,
  price_kes integer,
  store_name text,
  store_slug text,
  image_path text,
  score integer,
  reasons text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _item jsonb;
  _category text;
  _type_words text[];
  _colour_words text[];
  _order text[] := array['cropped', 'waist', 'high_hip', 'hip', 'upper_thigh', 'mid_thigh', 'above_knee', 'knee', 'below_knee', 'mid_calf', 'ankle', 'floor'];
begin
  if _uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  -- The shopper's own inspiration and the main item its photo check found
  select coalesce(
           (select i from jsonb_array_elements(gi.items) i where i ->> 'category' = g.category::text and (i ->> 'main')::boolean limit 1),
           (select i from jsonb_array_elements(gi.items) i where i ->> 'category' = g.category::text limit 1),
           (select i from jsonb_array_elements(gi.items) i where (i ->> 'main')::boolean limit 1)
         ),
         g.category::text
    into _item, _category
  from public.garment_uploads g
  join public.garment_inspections gi on gi.garment_upload_id = g.id
  where g.id = _garment_upload_id and g.user_id = _uid;

  if _item is null then
    return;
  end if;

  _category := coalesce(_category, _item ->> 'category');
  _type_words := private.words(_item ->> 'type');
  _colour_words := private.words(_item ->> 'colour');

  return query
  with candidates as (
    select
      p.id, p.name, p.price_kes, s.name as store_name, s.slug as store_slug,
      (select m.storage_path from public.product_media m where m.product_id = p.id and m.kind = 'image'
        order by m.is_tryon_source desc, m.position limit 1) as image_path,
      coalesce(
        (select i from jsonb_array_elements(pi.items) i where (i ->> 'main')::boolean limit 1),
        pi.items -> 0
      ) as item,
      p.category::text as category,
      p.garment_type
    from public.products p
    join public.stores s on s.id = p.store_id and s.status = 'active'
    join public.garment_inspections pi on pi.product_id = p.id
    where p.status = 'active'
      and exists (select 1 from public.product_variants v where v.product_id = p.id and v.stock_qty > 0)
  ),
  scored as (
    select c.*,
      case
        when c.category = _category then 40
        when c.category in ('top', 'outerwear') and _category in ('top', 'outerwear') then 20
        else 0
      end as category_points,
      least(30, 15 * cardinality(array(select unnest(_type_words) intersect select unnest(private.words(concat_ws(' ', c.item ->> 'type', c.garment_type, c.name)))))) as type_points,
      least(32, 8 * cardinality(array(select unnest(_colour_words) intersect select unnest(private.words(c.item ->> 'colour'))))) as colour_points,
      case when c.item ->> 'silhouette' is not null and c.item ->> 'silhouette' = _item ->> 'silhouette' then 10 else 0 end as silhouette_points,
      case
        when array_position(_order, c.item ->> 'length') is not null and array_position(_order, _item ->> 'length') is not null
          and abs(array_position(_order, c.item ->> 'length') - array_position(_order, _item ->> 'length')) <= 1 then 10
        else 0
      end as length_points
    from candidates c
  )
  select sc.id, sc.name, sc.price_kes, sc.store_name, sc.store_slug, sc.image_path,
    (sc.category_points + sc.type_points + sc.colour_points + sc.silhouette_points + sc.length_points)::integer,
    array_remove(array[
      case when sc.type_points > 0 then 'same style' end,
      case when sc.colour_points > 0 then 'similar colours' end,
      case when sc.silhouette_points > 0 then 'same shape' end,
      case when sc.length_points > 0 then 'same length' end
    ], null)
  from scored sc
  where sc.category_points > 0
    and sc.category_points + sc.type_points + sc.colour_points + sc.silhouette_points + sc.length_points >= 50
  order by 7 desc, sc.price_kes
  limit least(greatest(_limit, 1), 20);
end;
$$;

revoke execute on function public.similar_pieces(uuid, integer) from public, anon;
grant execute on function public.similar_pieces(uuid, integer) to authenticated;
