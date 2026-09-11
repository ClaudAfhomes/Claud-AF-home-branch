import type { ReactNode } from "react";
import { useAsync } from "@/hooks/useAsync";
import { loadPublishedPage } from "@/lib/pageBuilder";
import { BlockRenderer } from "@/components/pageBuilder/BlockRenderer";
import { Seo } from "@/lib/seo";

export function CmsPageOverride({ slug, fallback, path }: { slug: string; fallback: ReactNode; path: string }) {
  const { data } = useAsync(() => loadPublishedPage(slug), [slug]);
  if (!data) return fallback;
  return <><Seo title={data.seo_title || data.title} description={data.seo_description} path={path} />{data.sections.map((section) => <BlockRenderer key={section.id} section={section} />)}</>;
}
