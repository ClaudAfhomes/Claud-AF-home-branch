begin;

alter table public.cms_history
  add column if not exists change_summary text not null default '' check (length(change_summary) <= 1000);

create or replace function public.save_cms_documents(changes jsonb, expected jsonb, change_summaries jsonb default '{}'::jsonb)
returns setof public.cms_documents language plpgsql security definer set search_path = '' as $$
declare entry record; current_version bigint; previous public.cms_documents;
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
      insert into public.cms_history(key,value,revision,saved_by,change_summary)
      values(previous.key,previous.value,previous.revision,auth.uid(),left(coalesce(change_summaries->>entry.key, 'Content updated.'), 1000));
    end if;
    insert into public.cms_documents(key,value,revision,updated_at) values(entry.key,entry.value,current_version+1,now())
      on conflict(key) do update set value=excluded.value, revision=excluded.revision, updated_at=excluded.updated_at;
  end loop;
  return query select * from public.cms_documents where key in (select jsonb_object_keys(changes));
end;
$$;
revoke all on function public.save_cms_documents(jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_cms_documents(jsonb,jsonb,jsonb) to authenticated;

commit;