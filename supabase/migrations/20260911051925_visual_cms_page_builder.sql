begin;

create table public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(title) between 1 and 200),
  seo_title text not null default '' check (length(seo_title) <= 200),
  seo_description text not null default '' check (length(seo_description) <= 500),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.cms_page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.cms_pages(id) on delete cascade,
  block_type text not null check (block_type in ('hero','rich-text','image','gallery','video','two-column','features','services','testimonials','faq','cta','contact','map','divider')),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 1048576),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cms_page_sections_page_order on public.cms_page_sections(page_id, sort_order);

create table public.cms_published_pages (
  id uuid primary key references public.cms_pages(id) on delete cascade,
  slug text not null unique,
  title text not null,
  seo_title text not null default '',
  seo_description text not null default '',
  published_at timestamptz not null default now()
);

create table public.cms_published_sections (
  id uuid primary key references public.cms_page_sections(id) on delete cascade,
  page_id uuid not null references public.cms_published_pages(id) on delete cascade,
  block_type text not null,
  content jsonb not null,
  sort_order integer not null,
  is_visible boolean not null
);
create index cms_published_sections_page_order on public.cms_published_sections(page_id, sort_order);

create table public.cms_media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  public_url text not null,
  name text not null,
  media_type text not null check (media_type in ('image','video')),
  alt_text text not null default '',
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cms_navigation_items (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 1 and 100),
  href text not null check (length(href) between 1 and 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cms_site_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cms_pages enable row level security;
alter table public.cms_page_sections enable row level security;
alter table public.cms_published_pages enable row level security;
alter table public.cms_published_sections enable row level security;
alter table public.cms_media_assets enable row level security;
alter table public.cms_navigation_items enable row level security;
alter table public.cms_site_settings enable row level security;

create policy "Admins manage CMS pages" on public.cms_pages for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins manage CMS page sections" on public.cms_page_sections for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Public reads published CMS pages" on public.cms_published_pages for select to anon, authenticated using (true);
create policy "Public reads published CMS sections" on public.cms_published_sections for select to anon, authenticated using (is_visible);
create policy "Admins manage CMS media assets" on public.cms_media_assets for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Public reads CMS media assets" on public.cms_media_assets for select to anon using (true);
create policy "Admins manage CMS navigation" on public.cms_navigation_items for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Public reads visible CMS navigation" on public.cms_navigation_items for select to anon using (is_visible);
create policy "Admins manage CMS site settings" on public.cms_site_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Public reads CMS site settings" on public.cms_site_settings for select to anon using (true);

create or replace function public.publish_cms_page(target_page_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  update public.cms_pages set status='published', published_at=now(), updated_at=now() where id=target_page_id;
  if not found then raise exception 'Page not found' using errcode = 'P0002'; end if;
  insert into public.cms_published_pages(id,slug,title,seo_title,seo_description,published_at)
    select id,slug,title,seo_title,seo_description,now() from public.cms_pages where id=target_page_id
    on conflict(id) do update set slug=excluded.slug,title=excluded.title,seo_title=excluded.seo_title,seo_description=excluded.seo_description,published_at=excluded.published_at;
  delete from public.cms_published_sections where page_id=target_page_id;
  insert into public.cms_published_sections(id,page_id,block_type,content,sort_order,is_visible)
    select id,page_id,block_type,content,sort_order,is_visible from public.cms_page_sections where page_id=target_page_id;
end;
$$;
revoke all on function public.publish_cms_page(uuid) from public, anon, authenticated;
grant execute on function public.publish_cms_page(uuid) to authenticated;

create or replace function public.unpublish_cms_page(target_page_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  update public.cms_pages set status='draft', published_at=null, updated_at=now() where id=target_page_id;
  if not found then raise exception 'Page not found' using errcode = 'P0002'; end if;
  delete from public.cms_published_pages where id=target_page_id;
end;
$$;
revoke all on function public.unpublish_cms_page(uuid) from public, anon, authenticated;
grant execute on function public.unpublish_cms_page(uuid) to authenticated;

commit;
