import type { BrowserSupabaseClient } from "./supabase";
import { getBrowserSupabaseClient } from "./supabase";
import {
  isInstanceCode,
  isMemberResourceKind,
  isMembershipStatus,
  type MembershipSource,
  type MemberResourceRow,
  type MembershipRow,
} from "./types";

export const MEMBER_ASSET_BUCKET = "member-assets";
export const MEMBER_ASSET_URL_TTL_SECONDS = 300;

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isMembershipRow(value: unknown): value is MembershipRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.user_id === "string" &&
    isMembershipStatus(row.status) &&
    typeof row.source === "string" &&
    (["manual", "billing", "complimentary", "invite"] as MembershipSource[]).includes(
      row.source as MembershipSource,
    ) &&
    (row.provider === null || typeof row.provider === "string") &&
    (row.provider_customer_id === null || typeof row.provider_customer_id === "string") &&
    (row.provider_subscription_id === null ||
      typeof row.provider_subscription_id === "string") &&
    typeof row.starts_at === "string" &&
    (row.access_until === null || typeof row.access_until === "string") &&
    typeof row.created_at === "string" &&
    typeof row.updated_at === "string"
  );
}

function isMemberResourceRow(value: unknown): value is MemberResourceRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    isInstanceCode(row.as_id) &&
    typeof row.slot_key === "string" &&
    row.slot_key.length > 0 &&
    isMemberResourceKind(row.resource_type) &&
    (row.title === null || typeof row.title === "string") &&
    (row.body === null || typeof row.body === "string") &&
    (row.url === null || typeof row.url === "string") &&
    (row.storage_path === null || typeof row.storage_path === "string") &&
    typeof row.sort_order === "number" &&
    row.active === true &&
    typeof row.created_at === "string" &&
    typeof row.updated_at === "string"
  );
}

export function isActiveMembership(
  membership: MembershipRow | null,
  now = Date.now(),
): membership is MembershipRow {
  if (!membership || !["active", "grace"].includes(membership.status)) return false;

  const startsAt = Date.parse(membership.starts_at);
  if (!Number.isFinite(startsAt) || startsAt > now) return false;
  if (!membership.access_until) return true;

  const validUntil = Date.parse(membership.access_until);
  return Number.isFinite(validUntil) && validUntil > now;
}

export async function getCurrentMembership(
  client: BrowserSupabaseClient | null = getBrowserSupabaseClient(),
  userId?: string,
): Promise<MembershipRow | null> {
  if (!client) return null;

  try {
    const subjectId =
      userId ?? (await client.auth.getSession()).data.session?.user.id ?? null;
    if (!subjectId) return null;

    const { data, error } = await client
      .from("memberships")
      .select(
        "user_id,status,source,provider,provider_customer_id,provider_subscription_id,starts_at,access_until,created_at,updated_at",
      )
      .eq("user_id", subjectId)
      .maybeSingle();

    return error || !isMembershipRow(data) ? null : data;
  } catch {
    return null;
  }
}

export async function getMemberResources(
  instanceCode: string,
  client: BrowserSupabaseClient | null = getBrowserSupabaseClient(),
): Promise<MemberResourceRow[]> {
  if (!client || !isInstanceCode(instanceCode)) return [];

  try {
    const { data, error } = await client
      .from("as_member_resources")
      .select(
        "id,as_id,slot_key,resource_type,title,body,url,storage_path,sort_order,active,created_at,updated_at",
      )
      .eq("as_id", instanceCode)
      .eq("active", true)
      .order("slot_key", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error || !Array.isArray(data)) return [];
    return data.filter(isMemberResourceRow);
  } catch {
    return [];
  }
}

export function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeStoragePath(value: string | null): string | null {
  if (
    !value ||
    value.length > 1024 ||
    value !== value.trim() ||
    value.startsWith("/") ||
    value.includes("://")
  ) {
    return null;
  }
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return null;

  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }

  return value;
}

function safeSignedStorageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const loopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]" ||
      url.hostname === "::1";
    const protocolAllowed =
      url.protocol === "https:" || (url.protocol === "http:" && loopback);

    if (!protocolAllowed || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function createMemberAssetSignedUrl(
  storagePath: string,
  options: {
    client?: BrowserSupabaseClient | null;
    download?: boolean;
    expiresIn?: number;
  } = {},
): Promise<string | null> {
  const client = options.client ?? getBrowserSupabaseClient();
  const path = safeStoragePath(storagePath);
  if (!client || !path) return null;

  const requestedExpiry = options.expiresIn ?? MEMBER_ASSET_URL_TTL_SECONDS;
  const expiresIn = Math.min(600, Math.max(60, Math.trunc(requestedExpiry)));

  try {
    const signed = await client.storage
      .from(MEMBER_ASSET_BUCKET)
      .createSignedUrl(path, expiresIn, options.download ? { download: true } : undefined);

    if (signed.error || !signed.data?.signedUrl) return null;
    return safeSignedStorageUrl(signed.data.signedUrl);
  } catch {
    return null;
  }
}

export async function createSignedResourceUrl(
  resource: MemberResourceRow,
  options: {
    client?: BrowserSupabaseClient | null;
    download?: boolean;
  } = {},
): Promise<string | null> {
  const path = safeStoragePath(resource.storage_path);
  if (!path) return null;

  return createMemberAssetSignedUrl(path, options);
}

// Narrow database strings again at the DOM boundary, even though query results
// are typed, so malformed data cannot become executable markup or a URL.
export function resourceText(value: unknown): string | null {
  return stringOrNull(value);
}
