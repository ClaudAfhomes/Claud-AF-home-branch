import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { requestAdminPasswordReset } from "@/lib/adminAuth";
import { hasSupabaseConfig } from "@/lib/supabase";

export default function AdminForgotPassword() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setInfo("");

    try {
      if (!hasSupabaseConfig) {
        setError("Password reset is only available when the site is connected to the AFhomes database.");
        return;
      }

      const result = await requestAdminPasswordReset(username);
      if (!result.ok) {
        if (result.reason === "rate-limit") {
          setError("Supabase's email limit has been reached. Wait about one hour before trying again, or configure custom SMTP in Supabase.");
          return;
        }

        setError("We could not send the reset link. Check the admin username and try again.");
        return;
      }

      setInfo("A password-reset link has been sent to the administrator email. Open that link to choose a new password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center bg-cream-100 py-12">
      <Container size="narrow">
        <div className="mx-auto max-w-md border border-line bg-cream-50 p-7 shadow-soft sm:p-10">
          <p className="label-caps text-coral-600">AFhomes content studio</p>
          <h1 className="font-display mt-2 text-4xl font-medium text-navy-900">Reset admin password</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            Enter the admin username or email below and we will send a password-reset link to the configured administrator Gmail account.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Open the link in the email in this browser, then choose a new password on the reset page.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="label-caps text-ink-500">Username or email</span>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="cms-input"
                placeholder="admin"
              />
            </label>

            {error && <p className="text-sm font-medium text-coral-700" role="alert">{error}</p>}
            {info && <p className="text-sm font-medium text-pine-700">{info}</p>}

            <Button disabled={submitting} type="submit" variant="accent" size="lg" className="w-full">
              {submitting ? "Sending reset link..." : "Send reset link"}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-4 text-sm">
            <Link to="/afhomes-admin" className="font-medium text-pine-800 hover:text-pine-700">
              Back to sign in
            </Link>
            <button
              type="button"
              onClick={() => navigate("/admin/reset-password")}
              className="font-medium text-ink-600 hover:text-ink-500"
            >
              I have the reset link
            </button>
          </div>
        </div>
      </Container>
    </main>
  );
}
