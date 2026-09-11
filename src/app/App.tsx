import { useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/routes";
import { cmsRepository } from "@/lib/cms";

export function App() {
  const [syncError, setSyncError] = useState("");
  const sync = () => cmsRepository.hydrate().then(() => setSyncError("")).catch((cause: unknown) => setSyncError(cause instanceof Error ? cause.message : "Content sync failed."));
  useEffect(() => { void sync(); }, []);
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
      {syncError && <button type="button" onClick={() => void sync()} className="fixed right-4 bottom-4 z-100 rounded-lg bg-coral-700 px-4 py-3 text-sm font-semibold text-white shadow-lg">Content sync failed — retry</button>}
    </MotionConfig>
  );
}
