-- Run after supabase-schema.sql and supabase-validation.sql.
begin;
alter table public.cms_documents add column if not exists revision bigint not null default 1;
revoke insert, update, delete on public.cms_documents from anon, authenticated;
grant select on public.cms_documents to anon, authenticated;

create table if not exists public.cms_history (
  id bigint generated always as identity primary key,
  key text not null, value jsonb not null, revision bigint not null,
  saved_at timestamptz not null default now(), saved_by uuid references auth.users(id) on delete set null
);
alter table public.cms_history enable row level security;
revoke all on public.cms_history from anon, authenticated;
grant select on public.cms_history to authenticated;
drop policy if exists "Admins read revisions" on public.cms_history;
create policy "Admins read revisions" on public.cms_history for select to authenticated using ((select public.is_admin()));
create index if not exists cms_history_saved_at on public.cms_history(saved_at desc);
create index if not exists cms_history_saved_by on public.cms_history(saved_by);

create or replace function public.save_cms_documents(changes jsonb, expected jsonb)
returns setof public.cms_documents language plpgsql security definer set search_path = '' as $$
declare entry record; current_version bigint; previous public.cms_documents; item jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if jsonb_typeof(changes) <> 'object' or changes = '{}'::jsonb or pg_column_size(changes) > 10485760 then raise exception 'Invalid content payload'; end if;
  perform pg_advisory_xact_lock(784521);
  for entry in select * from jsonb_each(changes) loop
    if not public.validate_cms_document(entry.key, entry.value) then raise exception 'Invalid content in %', entry.key; end if;
    if jsonb_typeof(entry.value) = 'array' then
      if (select count(*) <> count(distinct v->>'id') from jsonb_array_elements(entry.value) v) then raise exception 'Duplicate content IDs'; end if;
      if entry.key in ('stories', 'experiences') and (select count(*) <> count(distinct v->>'slug') from jsonb_array_elements(entry.value) v) then raise exception 'Duplicate URL slugs'; end if;
    end if;
    select * into previous from public.cms_documents where key = entry.key;
    current_version := coalesce(previous.revision, 0);
    if expected->>entry.key is null or current_version <> (expected->>entry.key)::bigint then raise exception 'Content conflict: reload before saving'; end if;
    if previous.key is not null then
      insert into public.cms_history(key,value,revision,saved_by) values(previous.key,previous.value,previous.revision,auth.uid());
    end if;
    insert into public.cms_documents(key,value,revision,updated_at) values(entry.key,entry.value,current_version+1,now())
      on conflict(key) do update set value=excluded.value, revision=excluded.revision, updated_at=excluded.updated_at;
  end loop;
  return query select * from public.cms_documents where key in (select jsonb_object_keys(changes));
end;
$$;
revoke all on function public.save_cms_documents(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_cms_documents(jsonb,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cms-media','cms-media',true,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=true, file_size_limit=26214400, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Admins upload CMS media" on storage.objects;
create policy "Admins upload CMS media" on storage.objects for insert to authenticated with check (bucket_id='cms-media' and (select public.is_admin()));
drop policy if exists "Admins update CMS media" on storage.objects;
create policy "Admins update CMS media" on storage.objects for update to authenticated using (bucket_id='cms-media' and (select public.is_admin())) with check (bucket_id='cms-media' and (select public.is_admin()));
drop policy if exists "Admins delete CMS media" on storage.objects;
create policy "Admins delete CMS media" on storage.objects for delete to authenticated using (bucket_id='cms-media' and (select public.is_admin()));
drop policy if exists "Admins read CMS media" on storage.objects;
create policy "Admins read CMS media" on storage.objects for select to authenticated using (bucket_id='cms-media' and (select public.is_admin()));
drop policy if exists "Public read CMS media" on storage.objects;
create policy "Public read CMS media" on storage.objects for select to anon, authenticated using (bucket_id='cms-media');

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check(length(name) between 2 and 150),
  email text not null check(length(email) between 3 and 254),
  contact_number text not null check(length(contact_number) between 7 and 40),
  inquiry_type text not null,
  message text not null check(length(message) between 10 and 5000),
  kind text not null default 'inquiry' check(kind in ('inquiry','reservation')),
  visit_date date, end_date date, guests integer check(guests between 1 and 100),
  status text not null default 'new' check(status in ('new','contacted','confirmed','closed')),
  notes text not null default '' check(length(notes) <= 5000),
  check(kind <> 'reservation' or (visit_date is not null and guests is not null)),
  check(end_date is null or end_date >= visit_date)
);
alter table public.inquiries enable row level security;
revoke all on public.inquiries from anon, authenticated;
grant select on public.inquiries to authenticated;
grant update(status,notes) on public.inquiries to authenticated;
drop policy if exists "Admins read inquiries" on public.inquiries;
create policy "Admins read inquiries" on public.inquiries for select to authenticated using ((select public.is_admin()));
drop policy if exists "Admins manage inquiries" on public.inquiries;
create policy "Admins manage inquiries" on public.inquiries for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create index if not exists inquiries_created on public.inquiries(created_at desc);
create index if not exists inquiries_status_created on public.inquiries(status, created_at desc);
create index if not exists inquiries_status_created on public.inquiries(status, created_at desc);

-- Public form submission is accepted only by the Edge Function. The service
-- role RPC provides an atomic, persistent rate limit and duplicate protection.
create table if not exists public.inquiry_rate_limits (fingerprint text primary key, window_start timestamptz not null, attempts integer not null);
create index if not exists inquiry_rate_limits_window_start on public.inquiry_rate_limits(window_start);
create index if not exists inquiry_rate_limits_window_start on public.inquiry_rate_limits(window_start);
alter table public.inquiry_rate_limits enable row level security;
revoke all on public.inquiry_rate_limits from anon, authenticated;
create or replace function public.submit_public_inquiry(payload jsonb, fingerprint text, request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare attempts_now integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(fingerprint, 0));
  if exists(select 1 from public.inquiries where id=request_id) then return request_id; end if;
  delete from public.inquiry_rate_limits where window_start < now() - interval '1 day';
  insert into public.inquiry_rate_limits values(fingerprint,now(),1)
  on conflict on constraint inquiry_rate_limits_pkey do update set
    attempts = case when inquiry_rate_limits.window_start < now()-interval '1 hour' then 1 else inquiry_rate_limits.attempts+1 end,
    window_start = case when inquiry_rate_limits.window_start < now()-interval '1 hour' then now() else inquiry_rate_limits.window_start end
  returning attempts into attempts_now;
  -- Allow normal multi-message conversations while still limiting automated spam.
  if attempts_now > 30 then raise exception 'Too many requests. Please try again in one hour.'; end if;
  insert into public.inquiries(id,name,email,contact_number,inquiry_type,message,kind,visit_date,end_date,guests)
  values(request_id,payload->>'name',payload->>'email',payload->>'contactNumber',payload->>'inquiryType',payload->>'message',payload->>'kind',nullif(payload->>'visitDate','')::date,nullif(payload->>'endDate','')::date,(payload->>'guests')::integer);
  return request_id;
end;
$$;
revoke all on function public.submit_public_inquiry(jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_public_inquiry(jsonb,text,uuid) to service_role;
commit;
