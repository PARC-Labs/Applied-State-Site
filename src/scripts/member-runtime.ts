import {
  createSignedResourceUrl,
  getCurrentMembership,
  getMemberResources,
  isActiveMembership,
  resourceText,
  safeHttpsUrl,
} from "../lib/member-resources";
import {
  getBrowserSupabaseClient,
  requestMagicLink,
  signOutBrowserSession,
  type BrowserSupabaseClient,
} from "../lib/supabase";
import { isInstanceCode, type MemberResourceRow } from "../lib/types";
import { ownStaffRoles } from "../lib/states";

type MemberUiState = "public" | "signed-in" | "member";

const boundSigninForms = new WeakSet<HTMLFormElement>();
const boundSignoutControls = new WeakSet<HTMLElement>();

let authListenerStarted = false;
let refreshVersion = 0;

function setHidden(selector: string, hidden: boolean): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.hidden = hidden;
  });
}

function setMemberUiState(state: MemberUiState, isStaff = false): void {
  document.documentElement.dataset.memberState = state;
  const signedIn = state !== "public";

  setHidden("[data-member-signin-link]", signedIn);
  setHidden("[data-member-signout]", !signedIn);
  setHidden("[data-member-visible='signed-out']", signedIn);
  setHidden("[data-member-visible='signed-in']", !signedIn);
  setHidden("[data-member-visible='active']", state !== "member");
  setHidden("[data-member-visible='non-member']", state !== "signed-in" || isStaff);
  setHidden("[data-member-visible='index']", state !== "member" && !isStaff);
  setHidden("[data-member-visible='staff']", !isStaff);
  setHidden("[data-member-note]", state === "member");

  document.dispatchEvent(
    new CustomEvent("applied-state:member-state", { detail: { state } }),
  );
}

function removeRenderedMemberResources(): void {
  document.querySelectorAll<HTMLElement>("[data-member-rendered]").forEach((node) => {
    node.querySelectorAll<HTMLVideoElement>("video").forEach((video) => {
      video.pause();
      video.removeAttribute("src");
      video.querySelectorAll("source").forEach((source) => source.remove());
      video.load();
    });
    node.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      image.removeAttribute("src");
    });
    node.remove();
  });
  document
    .querySelectorAll<HTMLElement>("[data-member-slot], [data-member-slot-key]")
    .forEach((slot) => {
      slot.hidden = true;
    });
}

function clearRenderedMemberResources(): void {
  refreshVersion += 1;
  removeRenderedMemberResources();
}

function instanceCodeFromPage(): string | null {
  const host = document.querySelector<HTMLElement>(
    "[data-member-instance], [data-instance-code]",
  );
  const value =
    host?.dataset.memberInstance ??
    host?.dataset.instanceCode ??
    document.body.dataset.memberInstance ??
    document.body.dataset.instanceCode;

  return isInstanceCode(value) ? value : null;
}

function memberSlots(): Map<string, HTMLElement> {
  const slots = new Map<string, HTMLElement>();
  document
    .querySelectorAll<HTMLElement>("[data-member-slot], [data-member-slot-key]")
    .forEach((element) => {
      const key = element.dataset.memberSlot ?? element.dataset.memberSlotKey;
      if (key && !slots.has(key)) slots.set(key, element);
    });
  return slots;
}

function appendText(
  parent: HTMLElement,
  tagName: "p" | "figcaption",
  value: string | null,
  className?: string,
): HTMLElement | null {
  const text = resourceText(value);
  if (!text) return null;

  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function resourcePrefix(resource: MemberResourceRow): string {
  return resource.resource_type.toUpperCase();
}

function resourceLinkText(resource: MemberResourceRow): string {
  const prefix = resourcePrefix(resource);
  return resource.title ? `${prefix} — ${resource.title} ↗` : `${prefix} ↗`;
}

function createExternalLink(resource: MemberResourceRow): HTMLAnchorElement | null {
  const href = safeHttpsUrl(resource.url);
  if (!href) return null;

  const link = document.createElement("a");
  link.className = "reference";
  link.href = href;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
  link.textContent = resourceLinkText(resource);
  return link;
}

function appendUnavailable(parent: HTMLElement): void {
  if (parent.querySelector("[data-member-resource-status]")) return;
  const status = document.createElement("p");
  status.dataset.memberResourceStatus = "";
  status.setAttribute("role", "status");
  status.textContent = "Resource unavailable.";
  parent.append(status);
}

function createDeferredStorageControl(
  resource: MemberResourceRow,
  client: BrowserSupabaseClient,
  version: number,
  mode: "download" | "film",
): HTMLButtonElement {
  const control = document.createElement("button");
  control.type = "button";
  control.className = "text-action reference";
  control.textContent = resource.title
    ? `${resourcePrefix(resource)} — ${resource.title}`
    : resourcePrefix(resource);

  control.addEventListener("click", async () => {
    control.disabled = true;
    const signedUrl = await createSignedResourceUrl(resource, {
      client,
      download: mode === "download",
    });

    if (version !== refreshVersion || !control.isConnected) return;
    if (!signedUrl) {
      control.disabled = false;
      appendUnavailable(control.parentElement ?? control);
      return;
    }

    if (mode === "download") {
      window.location.assign(signedUrl);
      control.disabled = false;
      return;
    }

    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = signedUrl;
    if (resource.title) video.setAttribute("aria-label", resource.title);
    control.replaceWith(video);
  });

  return control;
}

async function createResourceContent(
  resource: MemberResourceRow,
  client: BrowserSupabaseClient,
  version: number,
): Promise<HTMLElement | null> {
  if (resource.resource_type === "text") {
    const note = document.createElement("div");
    appendText(note, "p", resource.title, "member-label");
    appendText(note, "p", resource.body, "member-caption");
    return note.childNodes.length ? note : null;
  }

  if (resource.resource_type === "film" && resource.storage_path) {
    const film = document.createElement("div");
    film.append(createDeferredStorageControl(resource, client, version, "film"));
    appendText(film, "p", resource.body, "member-caption");
    return film;
  }

  if (
    (resource.resource_type === "file" ||
      resource.resource_type === "code" ||
      resource.resource_type === "reference") &&
    resource.storage_path
  ) {
    const file = document.createElement("div");
    file.append(createDeferredStorageControl(resource, client, version, "download"));
    appendText(file, "p", resource.body, "member-caption");
    return file;
  }

  const link = createExternalLink(resource);
  if (link) {
    const reference = document.createElement("div");
    reference.append(link);
    appendText(reference, "p", resource.body, "member-caption");
    return reference;
  }

  if (resource.body) {
    const fallback = document.createElement("div");
    appendText(fallback, "p", resource.title, "member-label");
    appendText(fallback, "p", resource.body, "member-caption");
    return fallback;
  }

  return null;
}

async function renderMemberResource(
  resource: MemberResourceRow,
  client: BrowserSupabaseClient,
  version: number,
): Promise<HTMLElement | null> {
  const content = await createResourceContent(resource, client, version);
  if (!content || version !== refreshVersion) return null;

  const wrapper = document.createElement("section");
  wrapper.className =
    `editorial-object member-object member-object--${resource.resource_type} ` +
    `member-resource member-resource--${resource.resource_type}`;
  wrapper.dataset.memberRendered = "";
  wrapper.dataset.memberResourceKind = resource.resource_type;

  const marker = document.createElement("p");
  marker.className = "member-label member-resource__marker";
  marker.textContent = "MEMBER";
  wrapper.append(marker, content);
  return wrapper;
}

async function refreshMemberState(
  client: BrowserSupabaseClient,
): Promise<void> {
  const version = ++refreshVersion;
  removeRenderedMemberResources();

  try {
    const { data, error } = await client.auth.getSession();
    if (version !== refreshVersion) return;

    if (error || !data.session) {
      clearRenderedMemberResources();
      setMemberUiState("public");
      return;
    }

    const [membership, staffRoles] = await Promise.all([
      getCurrentMembership(client, data.session.user.id),
      ownStaffRoles(client, data.session.user.id),
    ]);
    if (version !== refreshVersion) return;
    const isStaff = staffRoles.length > 0;
    if (!isActiveMembership(membership)) {
      setMemberUiState("signed-in", isStaff);
      return;
    }

    setMemberUiState("member", isStaff);
    const instanceCode = instanceCodeFromPage();
    if (!instanceCode) return;

    const resources = await getMemberResources(instanceCode, client);
    if (version !== refreshVersion) return;

    const slots = memberSlots();
    for (const resource of resources) {
      const slot = slots.get(resource.slot_key);
      if (!slot) continue;

      const rendered = await renderMemberResource(resource, client, version);
      if (version !== refreshVersion) return;
      if (!rendered) continue;
      slot.append(rendered);
      slot.hidden = false;
    }
  } catch {
    if (version === refreshVersion) {
      clearRenderedMemberResources();
      setMemberUiState("public");
    }
  }
}

function statusElement(form: HTMLFormElement): HTMLElement {
  const existing =
    form.querySelector<HTMLElement>(
      "[data-member-status], [data-member-signin-status], [role='status']",
    ) ??
    form.parentElement?.querySelector<HTMLElement>(
      "[data-member-status], [data-member-signin-status], [role='status']",
    ) ??
    null;
  if (existing) return existing;

  const status = document.createElement("p");
  status.dataset.memberSigninStatus = "";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  form.append(status);
  return status;
}

function bindSigninForms(): void {
  document
    .querySelectorAll<HTMLFormElement>(
      "form[data-member-signin-form], form[data-member-signin]",
    )
    .forEach((form) => {
    if (boundSigninForms.has(form)) return;
    boundSigninForms.add(form);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const emailInput = form.querySelector<HTMLInputElement>(
        "[data-member-email], input[type='email']",
      );
      const submit = form.querySelector<HTMLButtonElement>("button[type='submit']");
      const status = statusElement(form);

      if (!emailInput || !emailInput.checkValidity()) {
        emailInput?.reportValidity();
        status.textContent = "Enter a valid email address.";
        return;
      }

      if (submit) submit.disabled = true;
      status.textContent = "";
      const result = await requestMagicLink(emailInput.value);

      if (result === "invalid") {
        status.textContent = "Enter a valid email address.";
      } else if (result === "unavailable") {
        status.textContent = "Sign-in unavailable. Try again.";
      } else {
        status.textContent =
          "If access is available for this email, a sign-in link has been sent.";
      }

      if (submit) submit.disabled = false;
    });
    });
}

function bindSignoutControls(): void {
  document.querySelectorAll<HTMLElement>("[data-member-signout]").forEach((control) => {
    if (boundSignoutControls.has(control)) return;
    boundSignoutControls.add(control);

    control.addEventListener("click", async (event) => {
      event.preventDefault();
      if (control instanceof HTMLButtonElement) control.disabled = true;

      const signedOut = await signOutBrowserSession();
      if (signedOut) {
        clearRenderedMemberResources();
        setMemberUiState("public");
      }

      if (control instanceof HTMLButtonElement) control.disabled = false;
    });
  });
}

export async function initMemberRuntime(): Promise<void> {
  bindSigninForms();
  bindSignoutControls();

  const client = getBrowserSupabaseClient();
  if (!client) {
    setMemberUiState("public");
    return;
  }

  await refreshMemberState(client);

  if (!authListenerStarted) {
    authListenerStarted = true;
    client.auth.onAuthStateChange(() => {
      // Run outside the auth callback to avoid competing with Supabase's own lock.
      window.setTimeout(() => void refreshMemberState(client), 0);
    });
  }
}
