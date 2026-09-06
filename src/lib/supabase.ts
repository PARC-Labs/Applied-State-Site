import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

export type BrowserSupabaseClient = SupabaseClient<Database>;

export type MagicLinkRequestResult = "accepted" | "invalid" | "unavailable";

let browserClient: BrowserSupabaseClient | null | undefined;

function envString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

function parseLegacyJwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3 || typeof globalThis.atob !== "function") return null;

  try {
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(padded)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function browserSafeKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  if (key.startsWith("sb_secret_")) return false;

  // Legacy Supabase anon keys are JWTs. Explicitly reject service-role JWTs and
  // fail closed for unknown key formats so a secret cannot be shipped by mistake.
  return parseLegacyJwtRole(key) === "anon";
}

function browserSafeProjectUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const allowedProtocol =
      url.protocol === "https:" ||
      (url.protocol === "http:" && isLoopbackHostname(url.hostname));

    if (!allowedProtocol || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function browserConfiguration(): { url: string; key: string } | null {
  // Static property references keep unrelated PUBLIC_* values out of this bundle.
  const rawUrl = envString(import.meta.env.PUBLIC_SUPABASE_URL);
  const key = envString(import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (rawUrl === "https://YOUR_PROJECT.supabase.co" || key === "sb_publishable_YOUR_KEY") return null;
  const url = rawUrl ? browserSafeProjectUrl(rawUrl) : null;

  if (!url || !key || !browserSafeKey(key)) return null;
  return { url, key };
}

export function getBrowserSupabaseClient(): BrowserSupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  if (typeof window === "undefined") return null;

  const configuration = browserConfiguration();
  if (!configuration) {
    browserClient = null;
    return browserClient;
  }

  browserClient = createClient<Database>(configuration.url, configuration.key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true,
    },
  });

  return browserClient;
}

function validEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    !/[\u0000-\u0020\u007f]/.test(value) &&
    /^[^@]+@[^@]+\.[^@]+$/.test(value)
  );
}

function magicLinkRedirectUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const current = new URL(window.location.href);
  const safeOrigin =
    current.protocol === "https:" ||
    (current.protocol === "http:" && isLoopbackHostname(current.hostname));
  if (!safeOrigin || current.username || current.password) return undefined;

  const configuredBase = envString(import.meta.env.BASE_URL) ?? "/";
  const basePath = configuredBase.startsWith("/") ? configuredBase : "/";
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return new URL(`${normalizedBase}signin/`, current.origin).toString();
}

/**
 * Request an invite-only magic link without exposing whether an email exists.
 * Provider errors deliberately map to the same accepted state as successful
 * requests; the UI must not become an account-enumeration oracle.
 */
export async function requestMagicLink(
  email: string,
): Promise<MagicLinkRequestResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!validEmail(normalizedEmail)) return "invalid";

  const client = getBrowserSupabaseClient();
  if (!client) return "unavailable";

  try {
    await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: magicLinkRedirectUrl(),
      },
    });

    return "accepted";
  } catch {
    // A transport failure is unrelated to whether the address was provisioned.
    return "unavailable";
  }
}

export async function signOutBrowserSession(): Promise<boolean> {
  const client = getBrowserSupabaseClient();
  if (!client) return true;

  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    return error === null;
  } catch {
    return false;
  }
}
