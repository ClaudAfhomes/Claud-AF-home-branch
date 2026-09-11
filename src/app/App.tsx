import { MotionConfig } from "motion/react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/routes";
import { useAsync } from "@/hooks/useAsync";
import { cmsRepository } from "@/lib/cms";
import { ErrorState, LoadingState } from "@/components/ui/Feedback";

export function App() {
  const { loading, error, retry } = useAsync(() => cmsRepository.hydrate(), []);
  if (loading) return <LoadingState label="Loading website content..." />;
  if (error) return <ErrorState message={error.message} onRetry={retry} />;
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  );
}
