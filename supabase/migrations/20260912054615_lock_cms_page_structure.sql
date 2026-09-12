begin;

-- Page routes and identity are application structure, not editable CMS content.
-- Admins retain read access and may update only metadata used by the content editor.
revoke insert, delete, update on table public.cms_pages from authenticated;
grant select on table public.cms_pages to authenticated;
grant update (
  seo_title,
  seo_description,
  open_graph_title,
  open_graph_description,
  open_graph_image,
  updated_at
) on table public.cms_pages to authenticated;

-- Unpublishing a route is intentionally unavailable to CMS administrators.
revoke execute on function public.unpublish_cms_page(uuid) from authenticated;

commit;
