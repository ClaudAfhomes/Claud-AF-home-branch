begin;

alter table public.cms_history
  add column if not exists change_details jsonb not null default '[]'::jsonb,
  add column if not exists change_count integer not null default 0,
  add column if not exists content_revision bigint;

update public.cms_history
set content_revision = revision + 1
where content_revision is null;

alter table public.cms_history
  alter column content_revision set not null;

comment on column public.cms_history.value is 'Restore snapshot retained for backward-compatible recovery.';
comment on column public.cms_history.after_value is 'CMS document after the recorded save.';
comment on column public.cms_history.change_details is 'Up to 50 sanitized, human-labelled field changes for the save.';
comment on column public.cms_history.change_count is 'Total field changes detected before the 50-detail display limit.';
comment on column public.cms_history.content_revision is 'CMS document revision produced by the recorded save.';

alter table public.cms_history drop constraint if exists cms_history_action_type;
alter table public.cms_history drop constraint if exists cms_history_action_type_check;
alter table public.cms_page_versions drop constraint if exists cms_page_versions_action_type;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_history_action_type'
      and conrelid = 'public.cms_history'::regclass
  ) then
    alter table public.cms_history
      add constraint cms_history_action_type
      check (action_type in ('created','updated','deleted','archived','restored','published','unpublished')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_page_versions_action_type'
      and conrelid = 'public.cms_page_versions'::regclass
  ) then
    alter table public.cms_page_versions
      add constraint cms_page_versions_action_type
      check (action_type in ('created','updated','deleted','archived','restored','published','unpublished')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_history_change_details_array'
      and conrelid = 'public.cms_history'::regclass
  ) then
    alter table public.cms_history
      add constraint cms_history_change_details_array
      check (jsonb_typeof(change_details) = 'array') not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_history_change_count_valid'
      and conrelid = 'public.cms_history'::regclass
  ) then
    alter table public.cms_history
      add constraint cms_history_change_count_valid
      check (change_count >= jsonb_array_length(change_details)) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_history_content_revision_valid'
      and conrelid = 'public.cms_history'::regclass
  ) then
    alter table public.cms_history
      add constraint cms_history_content_revision_valid
      check (content_revision > 0) not valid;
  end if;
end $$;

alter table public.cms_history validate constraint cms_history_action_type;
alter table public.cms_history validate constraint cms_history_change_details_array;
alter table public.cms_history validate constraint cms_history_change_count_valid;
alter table public.cms_history validate constraint cms_history_content_revision_valid;
alter table public.cms_page_versions validate constraint cms_page_versions_action_type;

create or replace function public.sanitize_cms_audit_value(input_value jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  entry record;
  sanitized jsonb;
  text_value text;
begin
  if input_value is null or jsonb_typeof(input_value) = 'null' then
    return 'null'::jsonb;
  end if;

  if jsonb_typeof(input_value) = 'object' then
    sanitized := '{}'::jsonb;
    for entry in select * from jsonb_each(input_value) loop
      if entry.key !~* '(password|passcode|secret|token|credential|api.?key|private.?key|access.?key|authorization|cookie|session|jwt|otp|recovery)' then
        sanitized := sanitized || jsonb_build_object(entry.key, public.sanitize_cms_audit_value(entry.value));
      end if;
    end loop;
    return sanitized;
  end if;

  if jsonb_typeof(input_value) = 'array' then
    select coalesce(jsonb_agg(public.sanitize_cms_audit_value(item.value) order by item.ordinal), '[]'::jsonb)
      into sanitized
      from jsonb_array_elements(input_value) with ordinality as item(value, ordinal);
    return sanitized;
  end if;

  if jsonb_typeof(input_value) = 'string' then
    text_value := input_value #>> '{}';
    if text_value like 'data:%' then
      return to_jsonb('[embedded file]'::text);
    end if;
    if length(text_value) > 500 then
      return to_jsonb(left(text_value, 200) || '…');
    end if;
  end if;

  return input_value;
end;
$$;

revoke all on function public.sanitize_cms_audit_value(jsonb) from public, anon, authenticated;

-- Remove every legacy overload before installing the single defaulted RPC.
-- PostgREST cannot reliably resolve overloaded functions with the same JSON
-- argument names, and older clients remain compatible through the defaults.
drop function if exists public.save_cms_documents(jsonb,jsonb);
drop function if exists public.save_cms_documents(jsonb,jsonb,jsonb);
drop function if exists public.save_cms_documents(jsonb,jsonb,jsonb,jsonb);
create function public.save_cms_documents(
  changes jsonb,
  expected jsonb,
  change_summaries jsonb default '{}'::jsonb,
  change_actions jsonb default '{}'::jsonb,
  change_details jsonb default '{}'::jsonb,
  change_counts jsonb default '{}'::jsonb
)
returns setof public.cms_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry record;
  current_version bigint;
  content_revision bigint;
  previous public.cms_documents;
  requested_action text;
  requested_count integer;
  requested_details jsonb;
  safe_details jsonb;
  summary text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if coalesce(jsonb_typeof(changes), 'null') <> 'object'
    or changes = '{}'::jsonb
    or coalesce(pg_column_size(changes), 0) > 10485760
    or coalesce(jsonb_typeof(expected), 'null') <> 'object'
    or coalesce(jsonb_typeof(change_summaries), 'null') <> 'object'
    or coalesce(jsonb_typeof(change_actions), 'null') <> 'object'
    or coalesce(jsonb_typeof(change_details), 'null') <> 'object'
    or coalesce(jsonb_typeof(change_counts), 'null') <> 'object'
    or coalesce(pg_column_size(change_details), 0) > 4194304 then
    raise exception 'Invalid content or audit payload';
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
      if entry.key in ('stories', 'experiences')
        and (select count(*) <> count(distinct value->>'slug') from jsonb_array_elements(entry.value)) then
        raise exception 'Duplicate URL slugs';
      end if;
    end if;

    select * into previous from public.cms_documents where key = entry.key;
    current_version := coalesce(previous.revision, 0);
    content_revision := current_version + 1;
    if expected->>entry.key is null or current_version <> (expected->>entry.key)::bigint then
      raise exception 'Content conflict: reload before saving';
    end if;

    requested_action := coalesce(
      change_actions->>entry.key,
      case when previous.key is null then 'created' else 'updated' end
    );
    if requested_action not in ('created','updated','deleted','archived','restored','published','unpublished') then
      requested_action := 'updated';
    end if;

    requested_details := coalesce(change_details->entry.key, '[]'::jsonb);
    if jsonb_typeof(requested_details) <> 'array' then
      raise exception 'Invalid audit details in %', entry.key;
    end if;
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'path', left(item.detail->>'path', 500),
        'label', left(item.detail->>'label', 300),
        'operation', item.detail->>'operation',
        'before', public.sanitize_cms_audit_value(item.detail->'before'),
        'after', public.sanitize_cms_audit_value(item.detail->'after')
      )
      || case
        when item.detail->>'value_type' in ('image', 'url')
          then jsonb_build_object('value_type', item.detail->>'value_type')
        else '{}'::jsonb
      end
      || case
        when nullif(btrim(item.detail->>'item'), '') is not null
          then jsonb_build_object('item', left(item.detail->>'item', 300))
        else '{}'::jsonb
      end
      || case
        when nullif(btrim(item.detail->>'item_type'), '') is not null
          then jsonb_build_object('item_type', left(item.detail->>'item_type', 100))
        else '{}'::jsonb
      end
      order by item.ordinal
    ), '[]'::jsonb)
    into safe_details
    from (
      select raw.detail, raw.ordinal
      from jsonb_array_elements(requested_details) with ordinality as raw(detail, ordinal)
      where jsonb_typeof(raw.detail) = 'object'
        and nullif(btrim(raw.detail->>'path'), '') is not null
        and nullif(btrim(raw.detail->>'label'), '') is not null
        and coalesce(raw.detail->>'operation', '') in ('updated','created','deleted','reordered','enabled','disabled')
        and coalesce(raw.detail->>'path', '') !~* '(password|passcode|secret|token|credential|api.?key|private.?key|access.?key|authorization|cookie|session|jwt|otp|recovery)'
        and coalesce(raw.detail->>'label', '') !~* '(password|passcode|secret|token|credential|api.?key|private.?key|access.?key|authorization|cookie|session|jwt|otp|recovery)'
      order by raw.ordinal
      limit 50
    ) item;

    requested_count := case
      when coalesce(change_counts->>entry.key, '') ~ '^[0-9]{1,6}$'
        then (change_counts->>entry.key)::integer
      else jsonb_array_length(requested_details)
    end;
    requested_count := greatest(requested_count, jsonb_array_length(safe_details));

    summary := nullif(btrim(change_summaries->>entry.key), '');
    if summary is null or lower(summary) = 'content updated.' then
      summary := format(
        '%s %s%s',
        initcap(requested_action),
        coalesce(safe_details->0->>'label', entry.key),
        case when requested_count > 1 then format(' and %s more changes.', requested_count - 1) else '.' end
      );
    end if;

    insert into public.cms_history(
      key,
      value,
      after_value,
      revision,
      content_revision,
      saved_by,
      saved_by_email,
      action_type,
      change_summary,
      change_details,
      change_count
    ) values (
      entry.key,
      case when previous.key is null then entry.value else previous.value end,
      entry.value,
      case when previous.key is null then content_revision else previous.revision end,
      content_revision,
      auth.uid(),
      (select email from auth.users where id = auth.uid()),
      requested_action,
      left(summary, 1000),
      safe_details,
      requested_count
    );

    insert into public.cms_documents(key,value,revision,updated_at)
    values(entry.key,entry.value,content_revision,now())
    on conflict(key) do update
      set value=excluded.value,
          revision=excluded.revision,
          updated_at=excluded.updated_at;
  end loop;

  return query
    select * from public.cms_documents
    where key in (select jsonb_object_keys(changes));
end;
$$;

revoke all on function public.save_cms_documents(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_cms_documents(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

commit;

;
