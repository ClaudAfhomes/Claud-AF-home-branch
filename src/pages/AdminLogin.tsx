import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { LoadingState } from "@/components/ui/Feedback";
import {
  consumeAdminAuthCallback,
  isAdminAuthenticated,
  loginAdmin,
  loginAdminWithGoogle,
} from "@/lib/adminAuth";
import { hasSupabaseConfig } from "@/lib/supabase";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const from = (location.state as { from?: string } | null)?.from;
  const afterLogin =
    (from === "/admin" || from?.startsWith("/admin?") || from?.startsWith("/admin/"))
    && !from?.startsWith("/admin/login")
    && !from?.startsWith("/admin/auth/")
    && !from?.startsWith("/admin/reset-password")
    && !from?.startsWith("/admin/forgot-password")
      ? from
      : "/admin";

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!hasSupabaseConfig) {
        if (active) setCheckingAccess(false);
        return;
      }

      const authed = await isAdminAuthenticated();
      if (!active) return;
      if (authed) {
        navigate(afterLogin || "/admin", { replace: true });
        return;
      }

      const result = await consumeAdminAuthCallback();
      if (!active) return;
      if (result === "recovery") {
        navigate("/admin/reset-password", { replace: true });
        return;
      }
      if (result === "signed-in") navigate(afterLogin, { replace: true });
      setCheckingAccess(false);
    };
    void run();
    return () => { active = false; };
  }, [afterLogin, navigate]);

  const finishLogin = async () => {
    navigate(afterLogin, { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      if (!hasSupabaseConfig) {
        setError("Connect the AFhomes Supabase project to enable admin sign-in.");
        return;
      }

      if (!(await loginAdmin(username, password))) {
        setError("Unable to sign in. Check your credentials and administrator access.");
        return;
      }

      await finishLogin();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (submitting) return;

    if (!hasSupabaseConfig) {
      setError("Connect the AFhomes Supabase project to enable Google admin sign-in.");
      return;
    }

    setSubmitting(true);
    setError("");

    const result = await loginAdminWithGoogle();
    if (!result.ok) {
      if (result.reason === "not-enabled") {
        setError("Google sign-in is not enabled for this Supabase project. Turn on Google in Supabase Authentication > Providers, then try again.");
      } else {
        setError("Unable to start Google sign-in. Please choose a Google account from the sign-in prompt or enable Google in Supabase Authentication.");
      }
      setSubmitting(false);
    }
  };

  if (checkingAccess) {
    return <LoadingState label="Checking admin access..." />;
  }

  return (
    <main className="flex min-h-screen items-center bg-cream-100 py-12">
      <Container size="narrow">
        <div className="mx-auto max-w-md border border-line bg-cream-50 p-7 shadow-soft sm:p-10">
          <p className="label-caps text-coral-600">AFhomes content studio</p>
          <h1 className="font-display mt-2 text-4xl font-medium text-navy-900">Admin sign in</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            {hasSupabaseConfig
              ? "Use a trusted admin email that is listed in the AFhomes admin database to sign in."
              : "Connect the AFhomes Supabase project to enable admin sign-in."}
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="label-caps text-ink-500">Admin email</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="cms-input"
                placeholder="admin@afhomes.com"
              />
            </label>

            <label className="block">
              <span className="label-caps text-ink-500">Password</span>
              <span className="relative mt-1 block">
                <input
                  required
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="cms-input pr-16"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-pine-800 hover:text-leaf-700"
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                >
                  {passwordVisible ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            {error && <p className="text-sm font-medium text-coral-700" role="alert">{error}</p>}

            <Button disabled={submitting || !hasSupabaseConfig} type="submit" variant="accent" size="lg" className="w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="label-caps text-ink-400">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Button
            disabled={submitting || !hasSupabaseConfig}
            type="button"
            variant="outline"
            size="lg"
            className="w-full rounded-lg border border-[#dadce0] bg-white text-[#1f1f1f] shadow-sm hover:border-[#c6c9ce] hover:bg-[#f8f9fa] focus-visible:outline-[#1a73e8]"
            onClick={handleGoogleLogin}
          >
            <span className="flex items-center justify-center gap-3">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
                <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.7 3.3 14.6 2.5 12 2.5 6.9 2.5 2.7 6.7 2.7 12s4.2 9.5 9.3 9.5c5.4 0 9-3.8 9-9.1 0-.6-.1-1.2-.2-1.7H12z"/>
                <path fill="#34A853" d="M3.9 7.3l3.5 2.6c1-1.9 3.1-3.2 5.6-3.2 1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.7 3.3 14.6 2.5 12 2.5c-3.7 0-6.9 2.3-8.1 5.8z"/>
                <path fill="#FBBC05" d="M3.9 16.8A9.4 9.4 0 0 1 3.5 12c0-1.1.2-2.1.6-3.1l3.6 2.7c-.1.4-.2.8-.2 1.4 0 1.6.8 3 2.3 3.9l2.7-2.7c-.4-.3-.9-.7-1.6-.7-1.3 0-2.3 1-2.4 2.3l-3.6 2.7z"/>
                <path fill="#4285F4" d="M12 21.5c2.6 0 4.9-.9 6.6-2.3l-3.1-2.7c-.9.6-2.1 1-3.5 1-2.9 0-5.3-2-6.2-4.6l-3.1 2.4A9.5 9.5 0 0 0 12 21.5z"/>
              </svg>
              <span>Continue with Google</span>
            </span>
          </Button>

          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Only Google accounts registered as administrators in the AFhomes database can continue.
          </p>

          <div className="mt-6 text-sm">
            <Link to="/admin/forgot-password" className="font-medium text-pine-800 hover:text-pine-700">
              Forgot password?
            </Link>
          </div>

          <p className="mt-7 border-t border-line pt-5 text-xs leading-relaxed text-ink-400">
            {hasSupabaseConfig
              ? "Content, media, and inquiries are stored in the connected AFhomes database."
              : "Local demo mode. Content and requests are saved in this browser only."}
          </p>
        </div>
      </Container>
    </main>
  );
}

