import { resolveMemberAccess, type MemberAccess } from "../lib/states";
import { isUuid } from "../lib/types";

export function selectElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T | null {
  return root.querySelector<T>(selector);
}

export function setStatus(element: HTMLElement | null, message = ""): void {
  if (element) element.textContent = message;
}

export function clearChildren(element: Element | null): void {
  element?.replaceChildren();
}

export function setControlBusy(
  control: HTMLButtonElement | null,
  busy: boolean,
  busyLabel?: string,
): void {
  if (!control) return;
  if (!control.dataset.idleLabel) control.dataset.idleLabel = control.textContent ?? "";
  control.disabled = busy;
  control.setAttribute("aria-busy", busy ? "true" : "false");
  control.textContent = busy && busyLabel ? busyLabel : control.dataset.idleLabel;
}

export function memberRoute(
  route: string,
  parameters: Record<string, string> = {},
): string {
  const configuredBase = import.meta.env.BASE_URL || "/";
  const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
  const normalizedRoute = route.replace(/^\/+|\/+$/g, "");
  const query = new URLSearchParams(parameters).toString();
  return `${base}${normalizedRoute}/${query ? `?${query}` : ""}`;
}

export function stateIdFromLocation(): string | null {
  const value = new URLSearchParams(window.location.search).get("id");
  return isUuid(value) ? value : null;
}

export function showStaffNavigation(show: boolean): void {
  document
    .querySelectorAll<HTMLElement>("[data-staff-navigation]")
    .forEach((element) => {
      element.hidden = !show;
    });
}

export function revealAuthorizedWorkspace(
  root: HTMLElement,
  access: MemberAccess,
  options: { allowStaff?: boolean } = {},
): access is Extract<MemberAccess, { kind: "authenticated" }> {
  const gate = selectElement<HTMLElement>(root, "[data-member-access-gate]");
  const status = selectElement<HTMLElement>(root, "[data-member-access-status]");
  const signIn = selectElement<HTMLElement>(root, "[data-member-access-signin]");
  const workspace = selectElement<HTMLElement>(root, "[data-member-workspace]");
  const authorized =
    access.kind === "authenticated" &&
    (access.isActiveMember || (Boolean(options.allowStaff) && access.isStaff));

  if (workspace) workspace.hidden = !authorized;
  if (signIn) signIn.hidden = access.kind !== "signed-out";
  showStaffNavigation(access.kind === "authenticated" && access.isStaff);

  if (authorized) {
    if (gate) gate.hidden = true;
    setStatus(status);
    return true;
  }

  if (gate) gate.hidden = false;
  if (access.kind === "signed-out") {
    setStatus(status, "Sign in to use member tools.");
  } else if (access.kind === "authenticated") {
    setStatus(status, "Member access is not active.");
  } else {
    setStatus(status, "Member tools are unavailable.");
  }
  return false;
}

export function listenForMemberRevocation(
  root: HTMLElement,
  clearPrivateDom: () => void,
  options: { allowStaff?: boolean } = {},
): void {
  let pendingCheck: number | null = null;

  document.addEventListener("applied-state:member-state", (event) => {
    const state = (event as CustomEvent<{ state?: unknown }>).detail?.state;
    if (state === "member") return;

    if (state === "signed-in") {
      if (pendingCheck !== null) window.clearTimeout(pendingCheck);
      pendingCheck = window.setTimeout(() => {
        pendingCheck = null;
        void resolveMemberAccess().then((access) => {
          if (!revealAuthorizedWorkspace(root, access, options)) clearPrivateDom();
        });
      }, 0);
      return;
    }

    const workspace = selectElement<HTMLElement>(root, "[data-member-workspace]");
    const gate = selectElement<HTMLElement>(root, "[data-member-access-gate]");
    const status = selectElement<HTMLElement>(root, "[data-member-access-status]");
    const signIn = selectElement<HTMLElement>(root, "[data-member-access-signin]");
    if (workspace) workspace.hidden = true;
    if (gate) gate.hidden = false;
    if (signIn) signIn.hidden = false;
    setStatus(status, "Sign in to use member tools.");
    clearPrivateDom();
  });
}

export function makeTextAction(
  label: string,
  action: (button: HTMLButtonElement) => void | Promise<void>,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "text-action";
  button.textContent = label;
  button.addEventListener("click", () => void action(button));
  return button;
}

export function makeInternalLink(label: string, href: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  return link;
}

export function appendParagraph(
  parent: HTMLElement,
  text: string | null,
  className?: string,
): HTMLParagraphElement | null {
  if (!text) return null;
  const paragraph = document.createElement("p");
  if (className) paragraph.className = className;
  paragraph.textContent = text;
  parent.append(paragraph);
  return paragraph;
}
