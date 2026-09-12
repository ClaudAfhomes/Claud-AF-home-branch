begin;

alter table public.cms_media_assets add column if not exists category text not null default 'general';
alter table public.cms_pages add column if not exists open_graph_title text not null default '';
alter table public.cms_pages add column if not exists open_graph_description text not null default '';
alter table public.cms_pages add column if not exists open_graph_image text not null default '';
alter table public.cms_published_pages add column if not exists open_graph_title text not null default '';
alter table public.cms_published_pages add column if not exists open_graph_description text not null default '';
alter table public.cms_published_pages add column if not exists open_graph_image text not null default '';
alter table public.cms_page_versions add column if not exists open_graph_title text not null default '';
alter table public.cms_page_versions add column if not exists open_graph_description text not null default '';
alter table public.cms_page_versions add column if not exists open_graph_image text not null default '';
alter table public.cms_page_versions add column if not exists action_type text not null default 'published';
alter table public.cms_page_versions add column if not exists change_summary text not null default 'Published page version saved.';
alter table public.cms_page_versions add column if not exists created_by_email text;

alter table public.cms_history add column if not exists saved_by_email text;
alter table public.cms_history add column if not exists action_type text not null default 'updated';
alter table public.cms_history add column if not exists after_value jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cms_media_assets_category_length' and conrelid = 'public.cms_media_assets'::regclass) then
    alter table public.cms_media_assets add constraint cms_media_assets_category_length check (length(category) between 1 and 60) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cms_history_action_type' and conrelid = 'public.cms_history'::regclass) then
    alter table public.cms_history add constraint cms_history_action_type check (action_type in ('created','updated','deleted','restored','published','unpublished')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cms_page_versions_action_type' and conrelid = 'public.cms_page_versions'::regclass) then
    alter table public.cms_page_versions add constraint cms_page_versions_action_type check (action_type in ('created','updated','deleted','restored','published','unpublished')) not valid;
  end if;
end $$;

alter table public.cms_media_assets validate constraint cms_media_assets_category_length;
alter table public.cms_history validate constraint cms_history_action_type;
alter table public.cms_page_versions validate constraint cms_page_versions_action_type;

create index if not exists cms_history_key_saved_at on public.cms_history(key, saved_at desc);
create index if not exists cms_history_action_saved_at on public.cms_history(action_type, saved_at desc);

-- Explicit Data API privileges are required for projects using the current
-- "do not automatically expose new tables" default. RLS remains authoritative.
grant select, insert, update, delete on public.cms_pages, public.cms_page_sections, public.cms_media_assets, public.cms_navigation_items, public.cms_site_settings to authenticated;
grant select on public.cms_page_versions, public.cms_history to authenticated;
grant select on public.cms_published_pages, public.cms_published_sections to anon, authenticated;
grant select on public.cms_media_assets, public.cms_navigation_items, public.cms_site_settings to anon;

drop function if exists public.save_cms_documents(jsonb,jsonb,jsonb);
create function public.save_cms_documents(
  changes jsonb,
  expected jsonb,
  change_summaries jsonb default '{}'::jsonb,
  change_actions jsonb default '{}'::jsonb
)
returns setof public.cms_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry record;
  current_version bigint;
  previous public.cms_documents;
  requested_action text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) <> 'object' or changes = '{}'::jsonb or pg_column_size(changes) > 10485760 then
    raise exception 'Invalid content payload';
  end if;

  perform pg_advisory_xact_lock(784521);
  for entry in select * from jsonb_each(changes) loop
    if not public.validate_cms_document(entry.key, entry.value) then
      raise exception 'Invalid content in %', entry.key;
    end if;
    if jsonb_typeof(entry.value) = 'array' then
      if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(entry.value)) then
        raise exception 'Duplicate content IDs';
      end if;
      if entry.key in ('stories', 'experiences') and (select count(*) <> count(distinct value->>'slug') from jsonb_array_elements(entry.value)) then
        raise exception 'Duplicate URL slugs';
      end if;
    end if;

    select * into previous from public.cms_documents where key = entry.key;
    current_version := coalesce(previous.revision, 0);
    if expected->>entry.key is null or current_version <> (expected->>entry.key)::bigint then
      raise exception 'Content conflict: reload before saving';
    end if;
    requested_action := coalesce(change_actions->>entry.key, case when previous.key is null then 'created' else 'updated' end);
    if requested_action not in ('created','updated','deleted','restored','published','unpublished') then requested_action := 'updated'; end if;

    if previous.key is not null then
      insert into public.cms_history(key,value,after_value,revision,saved_by,saved_by_email,action_type,change_summary)
      values(
        previous.key,
        previous.value,
        entry.value,
        previous.revision,
        auth.uid(),
        (select email from auth.users where id = auth.uid()),
        requested_action,
        left(coalesce(change_summaries->>entry.key, 'Content updated.'), 1000)
      );
    end if;

    insert into public.cms_documents(key,value,revision,updated_at)
    values(entry.key,entry.value,current_version+1,now())
    on conflict(key) do update set value=excluded.value, revision=excluded.revision, updated_at=excluded.updated_at;
  end loop;
  return query select * from public.cms_documents where key in (select jsonb_object_keys(changes));
end;
$$;
revoke all on function public.save_cms_documents(jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_cms_documents(jsonb,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.publish_cms_page(target_page_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if not exists (select 1 from public.cms_pages where id=target_page_id) then raise exception 'Page not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.cms_published_pages where id=target_page_id) then
    insert into public.cms_page_versions(page_id,title,seo_title,seo_description,open_graph_title,open_graph_description,open_graph_image,sections,created_by,created_by_email,action_type,change_summary)
    select p.id,p.title,p.seo_title,p.seo_description,p.open_graph_title,p.open_graph_description,p.open_graph_image,
      coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'block_type',s.block_type,'content',s.content,'sort_order',s.sort_order,'is_visible',s.is_visible) order by s.sort_order) from public.cms_published_sections s where s.page_id=p.id),'[]'::jsonb),
      auth.uid(),(select email from auth.users where id=auth.uid()),'published','Saved the previous published version before updating the page.'
    from public.cms_published_pages p where p.id=target_page_id;
  end if;
  update public.cms_pages set status='published', published_at=now(), updated_at=now() where id=target_page_id;
  insert into public.cms_published_pages(id,slug,title,seo_title,seo_description,open_graph_title,open_graph_description,open_graph_image,published_at)
    select id,slug,title,seo_title,seo_description,open_graph_title,open_graph_description,open_graph_image,now() from public.cms_pages where id=target_page_id
    on conflict(id) do update set slug=excluded.slug,title=excluded.title,seo_title=excluded.seo_title,seo_description=excluded.seo_description,open_graph_title=excluded.open_graph_title,open_graph_description=excluded.open_graph_description,open_graph_image=excluded.open_graph_image,published_at=excluded.published_at;
  delete from public.cms_published_sections where page_id=target_page_id;
  insert into public.cms_published_sections(id,page_id,block_type,content,sort_order,is_visible)
    select id,page_id,block_type,content,sort_order,is_visible from public.cms_page_sections where page_id=target_page_id;
end;
$$;
revoke all on function public.publish_cms_page(uuid) from public, anon, authenticated;
grant execute on function public.publish_cms_page(uuid) to authenticated;

create or replace function public.restore_cms_page_version(target_version_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare selected public.cms_page_versions; current_page public.cms_pages; section jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into selected from public.cms_page_versions where id=target_version_id;
  if selected.id is null then raise exception 'Version not found' using errcode = 'P0002'; end if;
  select * into current_page from public.cms_pages where id=selected.page_id;
  insert into public.cms_page_versions(page_id,title,seo_title,seo_description,open_graph_title,open_graph_description,open_graph_image,sections,created_by,created_by_email,action_type,change_summary)
  values(current_page.id,current_page.title,current_page.seo_title,current_page.seo_description,current_page.open_graph_title,current_page.open_graph_description,current_page.open_graph_image,
    coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'block_type',s.block_type,'content',s.content,'sort_order',s.sort_order,'is_visible',s.is_visible) order by s.sort_order) from public.cms_page_sections s where s.page_id=current_page.id),'[]'::jsonb),
    auth.uid(),(select email from auth.users where id=auth.uid()),'restored',format('Saved current draft before restoring version %s.', target_version_id));
  update public.cms_pages set title=selected.title,seo_title=selected.seo_title,seo_description=selected.seo_description,open_graph_title=selected.open_graph_title,open_graph_description=selected.open_graph_description,open_graph_image=selected.open_graph_image,updated_at=now() where id=selected.page_id;
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
