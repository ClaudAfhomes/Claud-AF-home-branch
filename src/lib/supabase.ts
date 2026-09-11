import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "";

// Browser-local admin auth is intentionally disabled. Access to the admin area
// must be granted only by the real Supabase admin session, not by a saved
// browser-only password or a guest-mode session.
export const localAdminEnabled = false;

export function verifyLocalAdminPassword(password: string) {
  void password;
  return false;
}

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseUrlValue = supabaseUrl;
export const supabaseAnonKeyValue = supabaseAnonKey;

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Only admin auth routes consume email-link tokens. Public pages must
        // not auto-exchange codes from the URL.
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : null;
