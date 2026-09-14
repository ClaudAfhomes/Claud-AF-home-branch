begin;

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

revoke execute on function public.unpublish_cms_page(uuid) from authenticated;

commit;;
