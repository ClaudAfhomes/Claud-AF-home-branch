import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAdminAuthenticated, isPasswordRecoveryPending } from "@/lib/adminAuth";


import { LoadingState } from "@/components/ui/Feedback";

export function AdminGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const check = () => {
      const current = ++revision;
      // Keep the editor mounted during rechecks after focus or a dialog closes.
      // Only the initial check should display the loading screen.
      void isAdminAuthenticated().then((result) => {
        if (active && current === revision) setAllowed(result);
      });
    };
    check();
    window.addEventListener("afhomes-admin-auth-changed", check);
    window.addEventListener("focus", check);
    return () => {
      active = false;

      window.removeEventListener("afhomes-admin-auth-changed", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  if (allowed === null) return <LoadingState label="Checking admin access..." />;
  if (isPasswordRecoveryPending()) return <Navigate to="/admin/reset-password" replace />;
  if (!allowed) return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return children;
}


