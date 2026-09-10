import {
  fetchArenaContents,
  safeHttpsUrl,
  type ArenaImage,
  type ArenaItem,
} from "../lib/arena";

const initializedChannels = new WeakSet<HTMLElement>();

function externalLink(href: string, label?: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = href;
  link.rel = "noopener noreferrer";
  if (label) link.textContent = label;
  return link;
}

function editorialObject(
  tag: "div" | "figure" | "p",
  width: "narrow" | "medium" = "narrow",
  className = "",
): HTMLElement {
  const element = document.createElement(tag);
  element.className = [
    "editorial-object",
    `editorial-object--${width}`,
    "arena-object",
    className,
  ].filter(Boolean).join(" ");
  return element;
}

function appendPlainText(parent: HTMLElement, value: string | null): void {
  if (!value) return;
  const paragraphs = value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  for (const value of paragraphs) {
    const paragraph = document.createElement("p");
    paragraph.textContent = value;
    parent.append(paragraph);
  }
}

function createImage(image: ArenaImage): HTMLImageElement {
  const element = document.createElement("img");
  element.src = image.src;
  if (image.src2x) element.srcset = `${image.src} 1x, ${image.src2x} 2x`;
  element.alt = image.alt;
  if (image.width) element.width = image.width;
  if (image.height) element.height = image.height;
  element.loading = "lazy";
  element.decoding = "async";
  element.referrerPolicy = "no-referrer";
  return element;
}

function appendCaption(
  figure: HTMLElement,
  item: ArenaItem,
  link?: { href: string; prefix: string },
): void {
  if (!item.title && !item.description && !link) return;
  const caption = document.createElement("figcaption");
  caption.className = "arena-caption";

  if (link) {
    const label = item.title ? `${link.prefix} — ${item.title} ↗` : `${link.prefix} ↗`;
    caption.append(externalLink(link.href, label));
  } else if (item.title) {
    const title = document.createElement("p");
    title.textContent = item.title;
    caption.append(title);
  }

  appendPlainText(caption, item.description);
  figure.append(caption);
}

function renderText(item: ArenaItem): HTMLElement | null {
  const text = item.text ?? item.description ?? item.title;
  if (!text) return null;
  const object = editorialObject("div", "narrow", "editorial-text--body arena-object--text");
  appendPlainText(object, text);
  return object;
}

function renderImage(item: ArenaItem): HTMLElement {
  if (!item.image) return renderReference(item, "IMAGE", item.sourceUrl ?? item.webUrl);
  const figure = editorialObject("figure", "medium", "arena-object--image");
  figure.append(createImage(item.image));
  appendCaption(figure, item, item.sourceUrl ? { href: item.sourceUrl, prefix: "SOURCE" } : undefined);
  return figure;
}

function renderVisualLink(item: ArenaItem, prefix: string, href: string): HTMLElement {
  if (!item.image) return renderReference(item, prefix, href);
  const figure = editorialObject("figure", "medium", "arena-object--reference");
  const link = externalLink(href);
  link.className = "arena-image-link";
  link.append(createImage(item.image));
  figure.append(link);
  appendCaption(figure, item, { href, prefix });
  return figure;
}

function renderReference(item: ArenaItem, prefix: string, href: string): HTMLElement {
  const object = editorialObject("div", "narrow", "arena-object--reference reference");
  const label = item.title ? `${prefix} — ${item.title} ↗` : `${prefix} ↗`;
  object.append(externalLink(href, label));
  if (item.description) {
    const description = document.createElement("div");
    description.className = "arena-reference-description";
    appendPlainText(description, item.description);
    object.append(description);
  }
  return object;
}

function renderItem(item: ArenaItem): HTMLElement | null {
  if (item.type === "Text") return renderText(item);
  if (item.type === "Image") return renderImage(item);
  if (item.type === "Link") {
    return renderVisualLink(item, "LINK", item.sourceUrl ?? item.webUrl);
  }
  if (item.type === "Embed") {
    return renderVisualLink(item, "MEDIA", item.sourceUrl ?? item.webUrl);
  }
  if (item.type === "Attachment") {
    return renderVisualLink(item, "FILE", item.attachmentUrl ?? item.webUrl);
  }
  if (item.type === "Channel") return renderReference(item, "CHANNEL", item.webUrl);
  return null;
}

function appendChannelLink(
  contents: HTMLElement,
  channelUrl: string,
  truncated: boolean,
): void {
  const source = editorialObject("p", "narrow", "arena-channel-source reference");
  source.append(externalLink(
    channelUrl,
    truncated ? "CONTINUE ON ARE.NA ↗" : "ARE.NA — CHANNEL ↗",
  ));
  contents.append(source);
}

async function hydrateArenaChannel(root: HTMLElement): Promise<void> {
  const slug = root.dataset.arenaChannel;
  const channelUrl = safeHttpsUrl(root.dataset.arenaChannelUrl);
  const contents = root.querySelector<HTMLElement>("[data-arena-contents]");
  const status = root.querySelector<HTMLElement>("[data-arena-status]");
  if (!slug || !channelUrl || !contents || !status) return;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const result = await fetchArenaContents(slug, { signal: controller.signal });
    const fragment = document.createDocumentFragment();
    let renderedCount = 0;
    for (const item of result.items) {
      const rendered = renderItem(item);
      if (rendered) {
        fragment.append(rendered);
        renderedCount += 1;
      }
    }
    contents.replaceChildren(fragment);
    appendChannelLink(contents, channelUrl, result.truncated);
    status.hidden = renderedCount > 0;
    status.textContent = renderedCount ? "" : "No material has been added yet.";
  } catch {
    status.replaceChildren(
      document.createTextNode("Material is temporarily unavailable. "),
      externalLink(channelUrl, "View the channel on Are.na ↗"),
    );
  } finally {
    window.clearTimeout(timeout);
    root.setAttribute("aria-busy", "false");
  }
}

export function initArenaChannels(): Promise<void[]> {
  const tasks: Promise<void>[] = [];
  document.querySelectorAll<HTMLElement>("[data-arena-channel]").forEach((root) => {
    if (initializedChannels.has(root)) return;
    initializedChannels.add(root);
    tasks.push(hydrateArenaChannel(root));
  });
  return Promise.all(tasks);
}
