import { createClient } from "@supabase/supabase-js";

// The site TypeScript check also scans this Deno Edge Function. Keep its small
// host surface typed locally without adding browser-visible runtime code or a
// second TypeScript dependency tree.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
};

const GENERIC_MESSAGE =
  "If that address belongs to an eligible member, the invitation has been recorded.";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://appliedstate.xyz",
  "http://localhost:4321",
  "http://127.0.0.1:4321",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function configuredOrigins(): string[] {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function keyFromDictionary(name: string): string | undefined {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;

  try {
    const values = JSON.parse(raw) as Record<string, unknown>;
    const key = values.default;
    return typeof key === "string" && key ? key : undefined;
  } catch {
    return undefined;
  }
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const allowedOrigins = configuredOrigins();
  const allowedOrigin =
    origin && allowedOrigins.includes(origin) ? origin : "null";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function originIsAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  const allowedOrigins = configuredOrigins();
  return !origin || allowedOrigins.includes(origin);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed." }, 405);
  }

  if (!originIsAllowed(request)) {
    return jsonResponse(request, { error: "Request origin is not allowed." }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    keyFromDictionary("SUPABASE_PUBLISHABLE_KEYS") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey =
    keyFromDictionary("SUPABASE_SECRET_KEYS") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error(JSON.stringify({
      event: "invite_state_collaborator.misconfigured",
    }));
    return jsonResponse(request, { error: "Invitation service unavailable." }, 503);
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!authorization || !token) {
    return jsonResponse(request, { error: "Authentication required." }, 401);
  }

  const callerClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser(token);

  if (userError || !userData.user) {
    return jsonResponse(request, { error: "Authentication required." }, 401);
  }

  let payload: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 4096) {
      return jsonResponse(request, { error: "Invalid request." }, 400);
    }
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(request, { error: "Invalid request." }, 400);
  }

  const stateId =
    typeof payload === "object" && payload !== null && "state_id" in payload
      ? (payload as { state_id?: unknown }).state_id
      : null;
  const rawEmail =
    typeof payload === "object" && payload !== null && "email" in payload
      ? (payload as { email?: unknown }).email
      : null;

  if (
    typeof stateId !== "string" ||
    !UUID_PATTERN.test(stateId) ||
    typeof rawEmail !== "string"
  ) {
    return jsonResponse(request, { error: "Invalid request." }, 400);
  }

  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (
    normalizedEmail.length === 0 ||
    normalizedEmail.length > 254 ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    // Email syntax and member eligibility intentionally share the same response.
    return jsonResponse(request, { ok: true, message: GENERIC_MESSAGE }, 202);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: inviteError } = await serviceClient.rpc(
    "invite_state_collaborator_by_email",
    {
      requesting_user_id: userData.user.id,
      target_state_id: stateId,
      target_email: normalizedEmail,
    },
  );

  if (inviteError) {
    // Keep client output generic. The log contains no token, email, State title,
    // or private URL; the database error code is enough for operations triage.
    console.error(JSON.stringify({
      event: "invite_state_collaborator.failed",
      code: inviteError.code ?? "unknown",
    }));
  } else {
    console.info(JSON.stringify({
      event: "invite_state_collaborator.recorded",
    }));
  }

  return jsonResponse(request, { ok: true, message: GENERIC_MESSAGE }, 202);
});
