import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Container } from "@/components/ui/Container";
import { consumeAdminAuthCallback } from "@/lib/adminAuth";
import { hasSupabaseConfig } from "@/lib/supabase";
import { LoadingState } from "@/components/ui/Feedback";

export default function AdminAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!hasSupabaseConfig) {
        if (active) setError("This sign-in link only works when the site is connected to the AFhomes database.");
        return;
      }

      const result = await consumeAdminAuthCallback();
      if (!active) return;

      if (result === "recovery") {
        navigate("/admin/reset-password", { replace: true });
        return;
      }

      if (result === "signed-in") {
        navigate("/admin", { replace: true });
        return;
      }

      const isGoogleUnauthorized =
        window.location.search.includes("code=") ||
        window.location.hash.includes("access_token") ||
        window.location.search.includes("error=") ||
        window.location.hash.includes("error=");

      if (isGoogleUnauthorized) {
        setError("This Google email is invalid for AFhomes admin access. You will be redirected to the login page.");
        const timeout = window.setTimeout(() => {
          navigate("/afhomes-admin", { replace: true });
        }, 2500);
        return () => window.clearTimeout(timeout);
      }

      setError("This email is invalid for AFhomes admin access. You will be redirected to the login page.");
      const timeout = window.setTimeout(() => {
        navigate("/afhomes-admin", { replace: true });
      }, 2500);
      return () => window.clearTimeout(timeout);
    };

    void run();
    return () => { active = false; };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center bg-cream-100 py-12">
      <Container size="narrow">
        <div className="mx-auto max-w-md border border-line bg-cream-50 p-7 shadow-soft sm:p-10">
          <p className="label-caps text-coral-600">AFhomes content studio</p>
          <h1 className="font-display mt-2 text-4xl font-medium text-navy-900">Verifying sign-in</h1>
          {error ? (
            <>
              <p className="mt-4 text-sm font-medium text-coral-700" role="alert">{error}</p>
              <Link to="/afhomes-admin" className="mt-6 inline-block font-medium text-pine-800 hover:text-pine-700">
                Back to sign in
              </Link>
            </>
          ) : (
            <div className="mt-6">
              <LoadingState label="Completing secure sign-in..." />
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
