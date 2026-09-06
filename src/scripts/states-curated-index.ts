import {
  getIndexStates,
  resolveMemberAccess,
  type StateSummary,
} from "../lib/states";
import {
  appendParagraph,
  clearChildren,
  listenForMemberRevocation,
  makeInternalLink,
  memberRoute,
  revealAuthorizedWorkspace,
  selectElement,
} from "./states-dom";

function renderIndexStates(container: HTMLOListElement, states: StateSummary[]): void {
  clearChildren(container);
  for (const state of states) {
    const item = document.createElement("li");
    item.className = "state-list-entry";
    const link = makeInternalLink(
      state.title,
      memberRoute("index/view", { id: state.id }),
    );
    link.className = "state-list-entry__title";
    item.append(link);
    appendParagraph(item, state.description, "state-list-entry__description");
    appendParagraph(item, state.ownerName, "state-list-entry__meta");
    container.append(item);
  }
}

export async function initCuratedIndexPage(): Promise<void> {
  const root = selectElement<HTMLElement>(document, "[data-curated-index]");
  if (!root) return;
  const list = selectElement<HTMLOListElement>(root, "[data-index-states]");
  const empty = selectElement<HTMLElement>(root, "[data-index-states-empty]");
  if (!list || !empty) return;

  listenForMemberRevocation(root, () => clearChildren(list), { allowStaff: true });
  const access = await resolveMemberAccess();
  if (!revealAuthorizedWorkspace(root, access, { allowStaff: true })) return;

  try {
    const states = await getIndexStates(access.client);
    renderIndexStates(list, states);
    empty.hidden = states.length > 0;
  } catch {
    clearChildren(list);
    empty.textContent = "Index unavailable.";
    empty.hidden = false;
  }
}
