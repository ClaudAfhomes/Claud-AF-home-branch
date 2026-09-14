alter table public.inquiries add column if not exists archived_at timestamptz;
create index if not exists inquiries_archived_at on public.inquiries(archived_at) where archived_at is not null;
grant update(archived_at) on public.inquiries to authenticated;

create or replace function public.purge_archived_inquiries(retention_days integer default 365)
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  if retention_days < 30 or retention_days > 3650 then raise exception 'Retention must be between 30 and 3650 days'; end if;
  delete from public.inquiries where archived_at is not null and archived_at < now() - make_interval(days => retention_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.purge_archived_inquiries(integer) from public, anon, authenticated;
grant execute on function public.purge_archived_inquiries(integer) to service_role;
