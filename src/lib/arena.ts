const ARENA_API_ORIGIN = "https://api.are.na";
const ARENA_WEB_ORIGIN = "https://www.are.na";

export const ARENA_PAGE_SIZE = 100;
export const ARENA_MAX_PAGES = 3;

type UnknownRecord = Record<string, unknown>;

export type ArenaItemType =
  | "Image"
  | "Text"
  | "Link"
  | "Embed"
  | "Attachment"
  | "Channel"
  | "Unknown";

export interface ArenaChannelReference {
  slug: string;
  webUrl: string;
}

export interface ArenaImage {
  src: string;
  src2x: string | null;
  width: number | null;
  height: number | null;
  alt: string;
}

export interface ArenaItem {
  id: string;
  type: ArenaItemType;
  title: string | null;
  text: string | null;
  description: string | null;
  sourceUrl: string | null;
  attachmentUrl: string | null;
  image: ArenaImage | null;
  webUrl: string;
}

export interface ArenaContentsPage {
  items: ArenaItem[];
  nextPage: number | null;
  totalCount: number | null;
}

export interface ArenaContentsResult {
  items: ArenaItem[];
  truncated: boolean;
  totalCount: number | null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  return normalized || null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function structuredText(value: unknown): string | null {
  if (typeof value === "string") return textValue(value);
  if (!isRecord(value)) return null;
  return textValue(value.plain) ?? textValue(value.markdown);
}

export function safeHttpsUrl(value: unknown): string | null {
  const text = textValue(value);
  if (!text) return null;

  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function validArenaSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function parseArenaChannelReference(
  value: string,
): ArenaChannelReference | null {
  const input = value.trim();
  if (validArenaSlug(input)) {
    return { slug: input, webUrl: `${ARENA_WEB_ORIGIN}/${input}` };
  }

  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      (url.hostname !== "www.are.na" && url.hostname !== "are.na")
    ) return null;

    const segments = url.pathname.split("/").filter(Boolean);
    const slug = segments.at(-1)?.toLowerCase() ?? "";
    if (segments.length < 2 || !validArenaSlug(slug)) return null;
    if (["block", "developers", "search"].includes(segments[0].toLowerCase())) {
      return null;
    }

    return {
      slug,
      webUrl: `${ARENA_WEB_ORIGIN}/${segments.map(encodeURIComponent).join("/")}`,
    };
  } catch {
    return null;
  }
}

export function arenaContentsApiUrl(
  slug: string,
  page: number,
  per = ARENA_PAGE_SIZE,
): string {
  if (!validArenaSlug(slug)) throw new Error("Invalid Are.na channel slug.");
  if (!Number.isInteger(page) || page < 1) throw new Error("Invalid Are.na page.");
  if (!Number.isInteger(per) || per < 1 || per > ARENA_PAGE_SIZE) {
    throw new Error("Invalid Are.na page size.");
  }

  const url = new URL(`/v3/channels/${slug}/contents`, ARENA_API_ORIGIN);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per", String(per));
  return url.href;
}

function arenaWebUrl(raw: UnknownRecord, type: ArenaItemType, id: string): string {
  if (type === "Channel") {
    const slug = textValue(raw.slug);
    const owner = isRecord(raw.owner) ? textValue(raw.owner.slug) : null;
    if (slug && validArenaSlug(slug) && owner && validArenaSlug(owner)) {
      return `${ARENA_WEB_ORIGIN}/${owner}/${slug}`;
    }
    if (slug && validArenaSlug(slug)) return `${ARENA_WEB_ORIGIN}/${slug}`;
  }

  return /^\d+$/.test(id)
    ? `${ARENA_WEB_ORIGIN}/block/${id}`
    : ARENA_WEB_ORIGIN;
}

function normalizeImage(raw: UnknownRecord, title: string | null): ArenaImage | null {
  if (!isRecord(raw.image)) return null;
  const image = raw.image;
  const large = isRecord(image.large) ? image.large : null;
  const medium = isRecord(image.medium) ? image.medium : null;
  const small = isRecord(image.small) ? image.small : null;
  const rendition = large ?? medium ?? small;
  const src = safeHttpsUrl(rendition?.src) ?? safeHttpsUrl(image.src);
  if (!src) return null;

  return {
    src,
    src2x: safeHttpsUrl(rendition?.src_2x),
    width: positiveInteger(rendition?.width) ?? positiveInteger(image.width),
    height: positiveInteger(rendition?.height) ?? positiveInteger(image.height),
    alt: textValue(image.alt_text) ?? title ?? "",
  };
}

function normalizeType(value: unknown): ArenaItemType {
  return ["Image", "Text", "Link", "Embed", "Attachment", "Channel"].includes(
    String(value),
  )
    ? String(value) as ArenaItemType
    : "Unknown";
}

export function normalizeArenaItem(value: unknown): ArenaItem | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === "number" || typeof value.id === "string"
    ? String(value.id)
    : "";
  if (!rawId) return null;

  const type = normalizeType(value.type);
  const title = textValue(value.title);
  const source = isRecord(value.source) ? value.source : null;
  const attachment = isRecord(value.attachment) ? value.attachment : null;

  return {
    id: rawId,
    type,
    title,
    text: structuredText(value.content),
    description: structuredText(value.description),
    sourceUrl: safeHttpsUrl(source?.url),
    attachmentUrl: safeHttpsUrl(attachment?.url),
    image: normalizeImage(value, title),
    webUrl: arenaWebUrl(value, type, rawId),
  };
}

export function parseArenaContentsPage(value: unknown): ArenaContentsPage {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new Error("Are.na returned an invalid contents response.");
  }

  const meta = isRecord(value.meta) ? value.meta : {};
  const nextPage = positiveInteger(meta.next_page);
  const totalCount = typeof meta.total_count === "number" && meta.total_count >= 0
    ? meta.total_count
    : null;

  return {
    items: value.data.map(normalizeArenaItem).filter((item): item is ArenaItem => Boolean(item)),
    nextPage,
    totalCount,
  };
}

export async function fetchArenaContents(
  slug: string,
  options: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    maxPages?: number;
  } = {},
): Promise<ArenaContentsResult> {
  const fetcher = options.fetcher ?? fetch;
  const maxPages = options.maxPages ?? ARENA_MAX_PAGES;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > ARENA_MAX_PAGES) {
    throw new Error("Invalid Are.na page limit.");
  }

  const items: ArenaItem[] = [];
  let page = 1;
  let totalCount: number | null = null;
  let truncated = false;

  for (let request = 0; request < maxPages; request += 1) {
    const response = await fetcher(arenaContentsApiUrl(slug, page), {
      headers: { Accept: "application/json" },
      signal: options.signal,
    });
    if (!response.ok) throw new Error(`Are.na request failed (${response.status}).`);

    const parsed = parseArenaContentsPage(await response.json());
    items.push(...parsed.items);
    totalCount ??= parsed.totalCount;

    if (!parsed.nextPage) return { items, truncated: false, totalCount };
    page = parsed.nextPage;
    truncated = true;
  }

  return { items, truncated, totalCount };
}
