// Google sign-in through Supabase Auth.
//
// Flow: "Continue with Google" → Google → Supabase callback
// (https://<project>.supabase.co/auth/v1/callback) → back to this page with a
// ?code=... which supabase-js exchanges for a session automatically.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const isConfigured =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_PUBLISHABLE_KEY) && !SUPABASE_PUBLISHABLE_KEY.startsWith("PASTE_");

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
    })
  : null;

/** Where Google/Supabase should send the user back: this page, without query/hash. */
function returnUrl() {
  return window.location.origin + window.location.pathname;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: returnUrl(),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Friendly profile fields from a Supabase user signed in with Google. */
export function profileOf(user) {
  const meta = user?.user_metadata ?? {};
  const fullName = meta.full_name || meta.name || user?.email || "Player";
  return {
    id: user.id,
    fullName,
    firstName: fullName.split(/\s+/)[0],
    email: user.email ?? "",
    avatarUrl: meta.avatar_url || meta.picture || "",
  };
}

/**
 * Calls onChange(user | null) with the current user, then again whenever the
 * user signs in or out.
 */
export function watchAuth(onChange) {
  supabase.auth.onAuthStateChange((_event, session) => {
    // Defer so the callback never runs inside Supabase's internal auth lock.
    setTimeout(() => onChange(session?.user ?? null), 0);
  });
}

/** Remove ?code=... / #access_token=... left in the address bar after sign-in. */
export function cleanAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  const hadParams = url.searchParams.has("code") || url.hash.includes("access_token");
  if (!hadParams) return;
  url.searchParams.delete("code");
  url.hash = "";
  window.history.replaceState({}, "", url.pathname + url.search);
}
