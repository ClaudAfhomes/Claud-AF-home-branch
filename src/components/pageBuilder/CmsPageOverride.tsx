import type { ReactNode } from "react";
import { useAsync } from "@/hooks/useAsync";
import { loadPublishedPage } from "@/lib/pageBuilder";
import { BlockRenderer } from "@/components/pageBuilder/BlockRenderer";
import { Seo } from "@/lib/seo";

export function CmsPageOverride({ slug, fallback, path }: { slug: string; fallback: ReactNode; path: string }) {
  const { data } = useAsync(() => loadPublishedPage(slug), [slug]);
  const visibleSections = data?.sections.filter((section) => section.is_visible) ?? [];
  if (!data || visibleSections.length === 0) return fallback;
  return <><Seo title={data.seo_title || data.title} description={data.seo_description} path={path} openGraphTitle={data.open_graph_title} openGraphDescription={data.open_graph_description} openGraphImage={data.open_graph_image} />{visibleSections.map((section) => <BlockRenderer key={section.id} section={section} />)}</>;
}
