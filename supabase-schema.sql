create table if not exists public.cms_documents (
  key text primary key check (key in ('site', 'pageContent', 'experiences', 'vip', 'faq', 'stories', 'mediaBlocks')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Membership is managed only through trusted database administration.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.list_admin_emails()
returns table(email text)
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)::text as email
  from public.admin_users au
  join auth.users u on u.id = au.user_id
  where public.is_admin()
  order by lower(u.email);
$$;
revoke all on function public.list_admin_emails() from public, anon, authenticated;
grant execute on function public.list_admin_emails() to authenticated;

create or replace function public.grant_admin_access(email_input text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if trim(email_input) = '' then
    raise exception 'Email is required' using errcode = '22023';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(trim(email_input));

  if target_user_id is null then
    return false;
  end if;

  insert into public.admin_users (user_id)
  values (target_user_id)
  on conflict do nothing;

  return true;
end;
$$;
revoke all on function public.grant_admin_access(text) from public, anon, authenticated;
grant execute on function public.grant_admin_access(text) to authenticated;

create or replace function public.revoke_admin_access(email_input text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if trim(email_input) = '' then
    raise exception 'Email is required' using errcode = '22023';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(trim(email_input));

  if target_user_id is null then
    return false;
  end if;

  if target_user_id = (select auth.uid())
     and (select count(*) from public.admin_users) = 1 then
    raise exception 'The final administrator cannot remove their own access' using errcode = '23514';
  end if;

  delete from public.admin_users
  where user_id = target_user_id;

  return true;
end;
$$;
revoke all on function public.revoke_admin_access(text) from public, anon, authenticated;
grant execute on function public.revoke_admin_access(text) to authenticated;

alter table public.cms_documents enable row level security;

-- Existing installations created before page editing was added need the key
-- constraint refreshed. The statements are safe to run more than once.
alter table public.cms_documents drop constraint if exists cms_documents_key_check;
alter table public.cms_documents add constraint cms_documents_key_check
  check (key in ('site', 'pageContent', 'experiences', 'vip', 'faq', 'stories', 'mediaBlocks'));
drop policy if exists "Public can read published CMS documents" on public.cms_documents;
create policy "Public can read published CMS documents"
  on public.cms_documents for select
  to anon, authenticated
  using (true);

-- Writes are performed only through save_cms_documents, which validates the
-- administrator and the full payload atomically.
drop policy if exists "Authenticated admins can write CMS documents" on public.cms_documents;
