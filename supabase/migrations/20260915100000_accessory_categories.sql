-- ALTERNATE: try on more than clothes. Enum values must be committed before they are used.
alter type public.garment_category add value if not exists 'shoes';
alter type public.garment_category add value if not exists 'eyewear';
alter type public.garment_category add value if not exists 'headwear';
alter type public.garment_category add value if not exists 'jewellery';
