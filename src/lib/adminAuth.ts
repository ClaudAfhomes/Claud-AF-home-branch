import type { EmailOtpType } from "@supabase/supabase-js";
import { seedRemoteDocumentsIfEmpty } from "@/lib/cms";
import { supabase } from "@/lib/supabase";

const RECOVERY_PENDING_KEY = "afhomes.admin.password-recovery";
const AUTH_FLOW_PENDING_KEY = "afhomes.admin.auth-flow";
const ADMIN_EMAIL = "claudmarsjimenez.afhomes@gmail.com";
const MIN_PASSWORD_LENGTH = 12;
const ADMIN_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function resolveAdminEmail(usernameOrEmail: string) {
  const value = usernameOrEmail.trim();
  if (!value) return "";

  const normalized = value.toLowerCase();
  if (normalized === "admin") return ADMIN_EMAIL;
  if (ADMIN_EMAIL_PATTERN.test(value)) return normalized;
  return "";
}

export async function getAdminEmails(): Promise<string[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("list_admin_emails");
  if (error) return [];

  return Array.isArray(data) ? data.filter((value): value is string => typeof value === "string") : [];
}

export async function addAdminEmail(email: string): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase) return { ok: false, reason: "unavailable" };

  const normalized = resolveAdminEmail(email);
  if (!normalized) return { ok: false, reason: "invalid-email" };

  const { error } = await supabase.rpc("grant_admin_access", { email_input: normalized });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("administrator access required")) {
      return { ok: false, reason: "not-admin" };
    }
    return { ok: false, reason: "unknown" };
  }

  return { ok: true };
}

export async function removeAdminEmail(email: string): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase) return { ok: false, reason: "unavailable" };

  const normalized = resolveAdminEmail(email);
  if (!normalized) return { ok: false, reason: "invalid-email" };

  const { error } = await supabase.rpc("revoke_admin_access", { email_input: normalized });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("administrator access required")) {
      return { ok: false, reason: "not-admin" };
    }
    return { ok: false, reason: "unknown" };
  }

  return { ok: true };
}

export function isAdminInputValue(value: string) {
  return resolveAdminEmail(value).length > 0;
}

export function isPasswordRecoveryPending() {
  try { return sessionStorage.getItem(RECOVERY_PENDING_KEY) === "1"; }
  catch { return false; }
}

function setPasswordRecoveryPending(pending: boolean) {
  try {
    if (pending) sessionStorage.setItem(RECOVERY_PENDING_KEY, "1");
    else sessionStorage.removeItem(RECOVERY_PENDING_KEY);
  } catch {
    // sessionStorage can be unavailable in locked-down browsers
  }
}

type PendingAuthFlow = "login" | "recovery";

function setPendingAuthFlow(flow: PendingAuthFlow | null) {
  try {
    if (flow) sessionStorage.setItem(AUTH_FLOW_PENDING_KEY, flow);
    else sessionStorage.removeItem(AUTH_FLOW_PENDING_KEY);
  } catch {
    // sessionStorage can be unavailable in locked-down browsers
  }
}

function getPendingAuthFlow(): PendingAuthFlow | null {
  try {
    const flow = sessionStorage.getItem(AUTH_FLOW_PENDING_KEY);
    return flow === "login" || flow === "recovery" ? flow : null;
  } catch {
    return null;
  }
}

// Supabase falls back to the configured Site URL when a requested redirect is
// missing from its allow list. Preserve admin auth in that case instead of
// leaving an OAuth code or error on the public homepage.
export function normalizeAdminAuthEntryUrl() {
  if (window.location.pathname !== "/") return;

  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const hasAuthResult =
    url.searchParams.has("code") ||
    url.searchParams.has("token_hash") ||
    url.searchParams.has("error") ||
    hash.has("access_token") ||
    hash.has("error");

  if (!hasAuthResult) return;

  const target = getPendingAuthFlow() === "recovery"
    ? "/admin/reset-password"
    : "/admin/auth/callback";
  window.history.replaceState({}, document.title, `${target}${url.search}${url.hash}`);
}

function adminRedirectUrl(path: string) {
  return new URL(path, window.location.origin).href;
}

function normalizeOtp(code: string) {
  return code.trim().replace(/\s+/g, "");
}

function clearAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  ["code", "token_hash", "type", "next", "error", "error_code", "error_description"].forEach((key) => {
    url.searchParams.delete(key);
  });
  url.hash = "";
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

async function isSupabaseAdmin(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return false;

    const { data, error: adminError } = await supabase.rpc("is_admin");
    return !adminError && data === true;
  } catch {
    return false;
  }
}

async function finishAdminSession() {
  if (!supabase) return false;

  const allowed = await isSupabaseAdmin();
  if (!allowed) {
    await supabase.auth.signOut();
    return false;
  }

  try {
    await seedRemoteDocumentsIfEmpty();
  } catch {
    // Login still succeeds; content can be published from Backups after the database is reachable.
  }

  window.dispatchEvent(new Event("afhomes-admin-auth-changed"));
  return true;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (isPasswordRecoveryPending()) return false;
  if (!supabase) return false;

  const admin = await isSupabaseAdmin();
  return admin;
}

export async function loginAdmin(username: string, password: string) {
  if (!supabase) return false;

  const email = resolveAdminEmail(username);
  if (!email) return false;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return false;

  return finishAdminSession();
}

export async function loginAdminWithGoogle(): Promise<{ ok: boolean; reason?: "not-enabled" | "unknown" }> {
  if (!supabase) return { ok: false, reason: "unknown" };

  setPendingAuthFlow("login");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: adminRedirectUrl("/admin/auth/callback"),
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) {
    setPendingAuthFlow(null);
    const message = error.message.toLowerCase();
    if (message.includes("provider") && message.includes("not enabled")) {
      return { ok: false, reason: "not-enabled" };
    }

    return { ok: false, reason: "unknown" };
  }

  return { ok: true };
}

export async function requestAdminLoginCode(username: string) {
  if (!supabase) return false;

  const email = resolveAdminEmail(username);
  if (!email) return false;

  setPendingAuthFlow("login");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: adminRedirectUrl("/admin/auth/callback"),
    },
  });

  if (error) setPendingAuthFlow(null);
  return !error;
}

async function verifyAdminOtp(username: string, code: string, type: EmailOtpType) {
  if (!supabase) return false;

  const email = resolveAdminEmail(username);
  const token = normalizeOtp(code);
  if (!email || !token) return false;

  const { data, error } = token.length > 12
    ? await supabase.auth.verifyOtp({ token_hash: token, type })
    : await supabase.auth.verifyOtp({ email, token, type });

  return !error && Boolean(data.user);
}

export async function verifyAdminLoginCode(username: string, code: string) {
  if (!(await verifyAdminOtp(username, code, "email"))) return false;
  return finishAdminSession();
}

export async function requestAdminPasswordReset(username: string) {
  if (!supabase) return { ok: false, reason: "unavailable" } as const;

  const email = resolveAdminEmail(username);
  if (!email) return { ok: false, reason: "invalid-admin" } as const;

  setPendingAuthFlow("recovery");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: adminRedirectUrl("/admin/reset-password"),
  });

  if (!error) return { ok: true } as const;

  setPendingAuthFlow(null);

  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return { ok: false, reason: "rate-limit" } as const;
  }

  return { ok: false, reason: "unknown" } as const;
}

export async function verifyAdminRecoveryCode(username: string, code: string) {
  if (!(await verifyAdminOtp(username, code, "recovery"))) return false;

  const allowed = await isSupabaseAdmin();
  if (!allowed && supabase) {
    await supabase.auth.signOut();
    return false;
  }

  setPasswordRecoveryPending(true);
  return true;
}

async function ensureRecoverySession() {
  if (!supabase) return false;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (!sessionError && sessionData.session) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    return !userError && Boolean(userData.user);
  }

  const callbackResult = await consumeAdminAuthCallback({ treatAsRecovery: true });
  if (!callbackResult) return false;

  const { data: refreshedSessionData, error: refreshedSessionError } = await supabase.auth.getSession();
  if (refreshedSessionError || !refreshedSessionData.session) return false;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  return !userError && Boolean(userData.user);
}

export async function updateAdminPassword(password: string): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: "weak-password" };
  }

  const sessionReady = await ensureRecoverySession();
  if (!sessionReady) {
    return { ok: false, reason: "missing-session" };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("same") || message.includes("different") || message.includes("previous") || message.includes("duplicate")) {
      return { ok: false, reason: "same-password" };
    }

    if (message.includes("session") || message.includes("require") || message.includes("not authenticated") || message.includes("expired")) {
      return { ok: false, reason: "missing-session" };
    }

    return { ok: false, reason: "unknown" };
  }

  setPasswordRecoveryPending(false);
  const finished = await finishAdminSession();
  return finished ? { ok: true } : { ok: false, reason: "session-invalid" };
}

const authCallbackInFlight = new Map<string, Promise<"recovery" | "signed-in" | null>>();
let lastAuthCallback: { at: number; result: "recovery" | "signed-in" | null } | null = null;

function authCallbackKey() {
  const url = new URL(window.location.href);
  return url.searchParams.get("code")
    ?? url.searchParams.get("token_hash")
    ?? (url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
}

export async function consumeAdminAuthCallback(options: { treatAsRecovery?: boolean } = {}) {
  if (!supabase) return null;

  const key = authCallbackKey();
  if (!key) {
    if (!lastAuthCallback || Date.now() - lastAuthCallback.at > 5000) return null;
    if (lastAuthCallback.result === "signed-in" && options.treatAsRecovery) {
      setPasswordRecoveryPending(true);
      return "recovery";
    }
    return lastAuthCallback.result;
  }

  const existing = authCallbackInFlight.get(key);
  const pending = existing ?? completeAdminAuthCallback(options);
  if (!existing) authCallbackInFlight.set(key, pending);

  const result = await pending;
  lastAuthCallback = { at: Date.now(), result };

  if (result === "signed-in" && options.treatAsRecovery) {
    setPasswordRecoveryPending(true);
    return "recovery";
  }
  return result;
}

async function completeAdminAuthCallback(options: { treatAsRecovery?: boolean }) {
  if (!supabase) return null;

  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? hash.get("type") ?? "") as EmailOtpType | "";
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  let consumed = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    consumed = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    consumed = !error;
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    consumed = !error;
  }

  if (!consumed) return null;
  setPendingAuthFlow(null);
  clearAuthParamsFromUrl();

  const allowed = await isSupabaseAdmin();
  if (!allowed) {
    await supabase.auth.signOut();
    return null;
  }

  const recovery = options.treatAsRecovery === true || type === "recovery";
  if (recovery) {
    setPasswordRecoveryPending(true);
    return "recovery";
  }

  await finishAdminSession();
  return "signed-in";
}

export async function logoutAdmin() {
  setPasswordRecoveryPending(false);

  if (!supabase) {
    window.dispatchEvent(new Event("afhomes-admin-auth-changed"));
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.dispatchEvent(new Event("afhomes-admin-auth-changed"));
}

export { MIN_PASSWORD_LENGTH };
