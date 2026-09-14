-- ALTERNATE: an owner role (only the owner can add or remove admins).
-- Separate migration: a new enum value can't be used in the transaction that adds it.
alter type public.app_role add value if not exists 'owner';
