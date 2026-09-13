-- ALTERNATE: face-lock masks on body photos, admin tools for testing and store approval

-- Masks are made in the browser when the photo is uploaded (same size as the photo):
--   edit_mask_path  PNG, transparent where clothes may change (sent to the image model)
--   face_mask_path  PNG, white where face and hair are (pasted back from the original)
alter table public.body_photos
  add column edit_mask_path text,
  add column face_mask_path text;

create or replace function public.admin_set_store_status(_store_id uuid, _status public.store_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Only ALTERNATE admins can change a store''s status' using errcode = '42501';
  end if;
  update public.stores set status = _status where id = _store_id;
  if not found then
    raise exception 'Store not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_grant_credits(_email text, _credits integer, _note text default 'Test credits')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid;
begin
  if not private.has_role((select auth.uid()), 'admin') then
    raise exception 'Only ALTERNATE admins can grant credits' using errcode = '42501';
  end if;
  if _credits = 0 then
    raise exception 'Enter a number of credits other than 0' using errcode = '22023';
  end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email));
  if _uid is null then
    raise exception 'No account uses %', _email using errcode = 'P0002';
  end if;
  insert into public.credit_ledger (user_id, amount, entry_type, note)
  values (_uid, _credits, 'adjustment', _note);
  return (select coalesce(sum(amount), 0)::integer from public.credit_ledger where user_id = _uid);
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role((select auth.uid()), 'admin');
$$;

revoke execute on function public.admin_set_store_status(uuid, public.store_status) from public, anon;
grant execute on function public.admin_set_store_status(uuid, public.store_status) to authenticated;
revoke execute on function public.admin_grant_credits(text, integer, text) from public, anon;
grant execute on function public.admin_grant_credits(text, integer, text) to authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
