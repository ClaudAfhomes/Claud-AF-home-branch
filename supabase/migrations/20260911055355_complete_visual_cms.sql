begin;
create table public.cms_page_versions (
  id bigint generated always as identity primary key,
  page_id uuid not null references public.cms_pages(id) on delete cascade,
  title text not null,
  seo_title text not null,
  seo_description text not null,
  sections jsonb not null check (jsonb_typeof(sections) = 'array'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index cms_page_versions_page_created on public.cms_page_versions(page_id, created_at desc);
alter table public.cms_page_versions enable row level security;
create policy "Admins read CMS page versions" on public.cms_page_versions for select to authenticated using ((select public.is_admin()));
create or replace function public.publish_cms_page(target_page_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if not exists (select 1 from public.cms_pages where id=target_page_id) then raise exception 'Page not found' using errcode = 'P0002'; end if;

  if exists (select 1 from public.cms_published_pages where id=target_page_id) then
    insert into public.cms_page_versions(page_id,title,seo_title,seo_description,sections,created_by)
    select p.id,p.title,p.seo_title,p.seo_description,
      coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'block_type',s.block_type,'content',s.content,'sort_order',s.sort_order,'is_visible',s.is_visible) order by s.sort_order) from public.cms_published_sections s where s.page_id=p.id),'[]'::jsonb),auth.uid()
    from public.cms_published_pages p where p.id=target_page_id;
  end if;

  update public.cms_pages set status='published', published_at=now(), updated_at=now() where id=target_page_id;
  insert into public.cms_published_pages(id,slug,title,seo_title,seo_description,published_at)
    select id,slug,title,seo_title,seo_description,now() from public.cms_pages where id=target_page_id
    on conflict(id) do update set slug=excluded.slug,title=excluded.title,seo_title=excluded.seo_title,seo_description=excluded.seo_description,published_at=excluded.published_at;
  delete from public.cms_published_sections where page_id=target_page_id;
  insert into public.cms_published_sections(id,page_id,block_type,content,sort_order,is_visible)
    select id,page_id,block_type,content,sort_order,is_visible from public.cms_page_sections where page_id=target_page_id;
end;
$$;
create or replace function public.restore_cms_page_version(target_version_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare selected public.cms_page_versions; section jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into selected from public.cms_page_versions where id=target_version_id;
  if selected.id is null then raise exception 'Version not found' using errcode = 'P0002'; end if;
  update public.cms_pages set title=selected.title,seo_title=selected.seo_title,seo_description=selected.seo_description,updated_at=now() where id=selected.page_id;
  delete from public.cms_page_sections where page_id=selected.page_id;
  for section in select * from jsonb_array_elements(selected.sections) loop
    insert into public.cms_page_sections(id,page_id,block_type,content,sort_order,is_visible)
    values((section->>'id')::uuid,selected.page_id,section->>'block_type',section->'content',(section->>'sort_order')::integer,(section->>'is_visible')::boolean);
  end loop;
end;
$$;
revoke all on function public.restore_cms_page_version(bigint) from public, anon, authenticated;
grant execute on function public.restore_cms_page_version(bigint) to authenticated;
commit;
