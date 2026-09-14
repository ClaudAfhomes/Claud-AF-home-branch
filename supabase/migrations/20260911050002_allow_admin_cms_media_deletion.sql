drop policy if exists "Admins delete CMS media" on storage.objects;
create policy "Admins delete CMS media" on storage.objects for delete to authenticated using (bucket_id = 'cms-media' and (select public.is_admin()));;
