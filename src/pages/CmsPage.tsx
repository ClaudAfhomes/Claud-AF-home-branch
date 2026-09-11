import { useParams } from "react-router-dom";
import { useAsync } from "@/hooks/useAsync";
import { loadPublishedPage } from "@/lib/pageBuilder";
import { LoadingState, ErrorState } from "@/components/ui/Feedback";
import { BlockRenderer } from "@/components/pageBuilder/BlockRenderer";
import { Seo } from "@/lib/seo";
import NotFound from "@/pages/NotFound";

export default function CmsPage() {
  const { slug = "" } = useParams();
  const { data, loading, error, retry } = useAsync(() => loadPublishedPage(slug), [slug]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={retry} />;
  if (!data) return <NotFound />;
  return <><Seo title={data.seo_title || data.title} description={data.seo_description} path={`/${data.slug}`} />{data.sections.map((section) => <BlockRenderer key={section.id} section={section} />)}</>;
}
