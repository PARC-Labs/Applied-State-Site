import {
  getReviewStates,
  resolveMemberAccess,
  reviewState,
  type StateSummary,
} from "../lib/states";
import type { BrowserSupabaseClient } from "../lib/supabase";
import type { ReviewAction } from "../lib/types";
import {
  appendParagraph,
  clearChildren,
  listenForMemberRevocation,
  makeInternalLink,
  makeTextAction,
  memberRoute,
  revealAuthorizedWorkspace,
  selectElement,
  setControlBusy,
  setStatus,
} from "./states-dom";

function renderReviewList(
  container: HTMLOListElement,
  empty: HTMLElement,
  states: StateSummary[],
  kind: "submitted" | "opened",
  client: BrowserSupabaseClient,
  refresh: () => Promise<void>,
): void {
  clearChildren(container);
  empty.hidden = states.length > 0;

  for (const state of states) {
    const item = document.createElement("li");
    item.className = "review-entry";
    const link = makeInternalLink(
      state.title,
      memberRoute(kind === "opened" ? "index/view" : "states/view", { id: state.id }),
    );
    link.className = "review-entry__title";
    item.append(link);
    appendParagraph(item, state.description, "state-list-entry__description");
    appendParagraph(item, state.ownerName, "state-list-entry__meta");

    const actions = document.createElement("div");
    actions.className = "review-entry__actions";
    const status = document.createElement("p");
    status.className = "states-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const act = async (button: HTMLButtonElement, action: ReviewAction) => {
      const busyLabel =
        action === "approve" ? "APPROVING" : action === "reject" ? "REJECTING" : "CLOSING";
      setControlBusy(button, true, busyLabel);
      setStatus(status);
      try {
        await reviewState(client, state.id, action);
        await refresh();
      } catch {
        setStatus(status, "Editorial action unavailable. Try again.");
        setControlBusy(button, false);
      }
    };

    if (kind === "submitted") {
      actions.append(
        makeTextAction("APPROVE", (button) => act(button, "approve")),
        makeTextAction("REJECT", (button) => act(button, "reject")),
      );
    } else {
      actions.append(makeTextAction("CLOSE", (button) => act(button, "close")));
    }
    item.append(actions, status);
    container.append(item);
  }
}

export async function initIndexReviewPage(): Promise<void> {
  const root = selectElement<HTMLElement>(document, "[data-index-review]");
  if (!root) return;
  const accessStatus = selectElement<HTMLElement>(root, "[data-review-access-status]");
  const reviewSurfaces = root.querySelectorAll<HTMLElement>("[data-review-surface]");
  const submittedList = selectElement<HTMLOListElement>(root, "[data-submitted-states]");
  const submittedEmpty = selectElement<HTMLElement>(root, "[data-submitted-states-empty]");
  const openedList = selectElement<HTMLOListElement>(root, "[data-open-index-states]");
  const openedEmpty = selectElement<HTMLElement>(root, "[data-open-index-states-empty]");
  if (!submittedList || !submittedEmpty || !openedList || !openedEmpty) return;

  const clearPrivateDom = () => {
    clearChildren(submittedList);
    clearChildren(openedList);
    reviewSurfaces.forEach((surface) => {
      surface.hidden = true;
    });
  };
  listenForMemberRevocation(root, clearPrivateDom, { allowStaff: true });

  const access = await resolveMemberAccess();
  if (!revealAuthorizedWorkspace(root, access, { allowStaff: true })) return;
  if (!access.isStaff) {
    clearPrivateDom();
    setStatus(accessStatus, "Editorial access is not available.");
    return;
  }

  reviewSurfaces.forEach((surface) => {
    surface.hidden = false;
  });
  setStatus(accessStatus);

  const refresh: () => Promise<void> = async () => {
    const states = await getReviewStates(access.client);
    renderReviewList(
      submittedList,
      submittedEmpty,
      states.submitted,
      "submitted",
      access.client,
      refresh,
    );
    renderReviewList(
      openedList,
      openedEmpty,
      states.opened,
      "opened",
      access.client,
      refresh,
    );
  };

  try {
    await refresh();
  } catch {
    clearPrivateDom();
    setStatus(accessStatus, "Index review is unavailable.");
  }
}
