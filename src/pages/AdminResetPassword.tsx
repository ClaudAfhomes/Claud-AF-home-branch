import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import {
  consumeAdminAuthCallback,
  isPasswordRecoveryPending,
  MIN_PASSWORD_LENGTH,
  updateAdminPassword,
} from "@/lib/adminAuth";
import { hasSupabaseConfig } from "@/lib/supabase";

export default function AdminResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [readyToSetPassword, setReadyToSetPassword] = useState(isPasswordRecoveryPending());
  const [checkingLink, setCheckingLink] = useState(hasSupabaseConfig);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!hasSupabaseConfig) {
        if (active) setCheckingLink(false);
        return;
      }

      const result = await consumeAdminAuthCallback({ treatAsRecovery: true });
      if (!active) return;

      if (result === "recovery" || isPasswordRecoveryPending()) {
        setReadyToSetPassword(true);
        setInfo("Choose a new administrator password to finish resetting access.");
      } else if (result === "signed-in") {
        navigate("/admin", { replace: true });
        return;
      }

      setCheckingLink(false);
    };

    void run();
    return () => { active = false; };
  }, [navigate]);

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setInfo("");

    try {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }

      if (password !== confirmPassword) {
        setError("The new password and confirmation do not match.");
        return;
      }

      const updated = await updateAdminPassword(password);
      if (!updated.ok) {
        if (updated.reason === "same-password") {
          setError("Choose a password that is different from your current one.");
          return;
        }

        if (updated.reason === "missing-session") {
          setError("This reset link has expired or the admin session is no longer active. Request a new reset link and try again.");
          return;
        }

        if (updated.reason === "weak-password") {
          setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
          return;
        }

        setError("Unable to update the password. Request a new reset email and try again.");
        return;
      }

      navigate("/admin", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center bg-cream-100 py-12">
      <Container size="narrow">
        <div className="mx-auto max-w-md border border-line bg-cream-50 p-7 shadow-soft sm:p-10">
          <p className="label-caps text-coral-600">AFhomes content studio</p>
          <h1 className="font-display mt-2 text-4xl font-medium text-navy-900">Set a new password</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            {readyToSetPassword
              ? "This reset session can only change the administrator password. After it is saved you will be signed in to the content studio."
              : "Use the reset link sent to the admin email, then choose a new password below."}
          </p>

          {checkingLink ? (
            <p className="mt-8 text-sm text-ink-600">Checking the reset link...</p>
          ) : readyToSetPassword ? (
            <form className="mt-8 space-y-5" onSubmit={handleUpdatePassword}>
              <label className="block">
                <span className="label-caps text-ink-500">New password</span>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="cms-input"
                />
              </label>
              <label className="block">
                <span className="label-caps text-ink-500">Confirm password</span>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="cms-input"
                />
              </label>
              {error && <p className="text-sm font-medium text-coral-700" role="alert">{error}</p>}
              {info && <p className="text-sm font-medium text-pine-700">{info}</p>}
              <Button disabled={submitting} type="submit" variant="accent" size="lg" className="w-full">
                {submitting ? "Saving password..." : "Save password and sign in"}
              </Button>
            </form>
          ) : (
            <div className="mt-8 rounded border border-line bg-cream-100 p-4 text-sm text-ink-600">
              Open the reset link from your email, then come back to this page to set your new password.
            </div>
          )}

          <div className="mt-6 text-sm">
            <Link to="/admin/forgot-password" className="font-medium text-pine-800 hover:text-pine-700">
              Request a new reset link
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
