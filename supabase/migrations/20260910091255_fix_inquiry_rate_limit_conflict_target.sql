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
  if attempts_now > 5 then raise exception 'Too many requests. Please try again later.'; end if;
  insert into public.inquiries(id,name,email,contact_number,inquiry_type,message,kind,visit_date,end_date,guests)
  values(request_id,payload->>'name',payload->>'email',payload->>'contactNumber',payload->>'inquiryType',payload->>'message',payload->>'kind',nullif(payload->>'visitDate','')::date,nullif(payload->>'endDate','')::date,(payload->>'guests')::integer);
  return request_id;
end;
$$;
revoke all on function public.submit_public_inquiry(jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_public_inquiry(jsonb,text,uuid) to service_role;;
