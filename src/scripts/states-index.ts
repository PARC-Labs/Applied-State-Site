import {
  createState,
  getCollaborativeStates,
  getOwnedStates,
  getPendingInvitations,
  getProfile,
  resolveMemberAccess,
  respondToInvitation,
  saveProfile,
  stateLifecycleLabel,
  type StateSummary,
} from "../lib/states";
import type { BrowserSupabaseClient } from "../lib/supabase";
import type { StateCollaboratorRow } from "../lib/types";
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

function renderStates(
  container: HTMLOListElement,
  empty: HTMLElement,
  states: StateSummary[],
  showOwner: boolean,
): void {
  clearChildren(container);
  empty.hidden = states.length > 0;

  for (const state of states) {
    const item = document.createElement("li");
    item.className = "state-list-entry";

    const title = makeInternalLink(
      state.title,
      memberRoute("states/view", { id: state.id }),
    );
    title.className = "state-list-entry__title";
    item.append(title);
    appendParagraph(item, state.description, "state-list-entry__description");

    const details = [
      showOwner && state.ownerName ? state.ownerName : null,
      stateLifecycleLabel(state.visibility, state.review_status),
    ].filter(Boolean);
    appendParagraph(item, details.join(" · "), "state-list-entry__meta");
    container.append(item);
  }
}

function renderInvitations(
  container: HTMLOListElement,
  empty: HTMLElement,
  invitations: StateCollaboratorRow[],
  client: BrowserSupabaseClient,
  refresh: () => Promise<void>,
): void {
  clearChildren(container);
  empty.hidden = invitations.length > 0;

  for (const invitation of invitations) {
    const item = document.createElement("li");
    item.className = "collaborator-entry";
    appendParagraph(item, "A member has invited you to a private State.");

    const status = document.createElement("p");
    status.className = "states-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const actions = document.createElement("div");
    actions.className = "collaborator-entry__actions";
    const respond = async (button: HTMLButtonElement, accept: boolean) => {
      setControlBusy(button, true, accept ? "ACCEPTING" : "DECLINING");
      setStatus(status);
      try {
        await respondToInvitation(client, invitation.state_id, accept);
        await refresh();
      } catch {
        setStatus(status, "Invitation response unavailable. Try again.");
        setControlBusy(button, false);
      }
    };
    actions.append(
      makeTextAction("ACCEPT", (button) => respond(button, true)),
      makeTextAction("DECLINE", (button) => respond(button, false)),
    );
    item.append(actions, status);
    container.append(item);
  }
}

export async function initStatesIndexPage(): Promise<void> {
  const root = selectElement<HTMLElement>(document, "[data-states-index]");
  if (!root) return;

  const workspace = selectElement<HTMLElement>(root, "[data-member-workspace]");
  const ownedList = selectElement<HTMLOListElement>(root, "[data-owned-states]");
  const ownedEmpty = selectElement<HTMLElement>(root, "[data-owned-states-empty]");
  const collaborativeList = selectElement<HTMLOListElement>(
    root,
    "[data-collaborative-states]",
  );
  const collaborativeEmpty = selectElement<HTMLElement>(
    root,
    "[data-collaborative-states-empty]",
  );
  const invitationsList = selectElement<HTMLOListElement>(
    root,
    "[data-pending-invitations]",
  );
  const invitationsEmpty = selectElement<HTMLElement>(
    root,
    "[data-pending-invitations-empty]",
  );
  if (
    !workspace ||
    !ownedList ||
    !ownedEmpty ||
    !collaborativeList ||
    !collaborativeEmpty ||
    !invitationsList ||
    !invitationsEmpty
  ) {
    return;
  }

  const clearPrivateDom = () => {
    clearChildren(ownedList);
    clearChildren(collaborativeList);
    clearChildren(invitationsList);
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
      .forEach((control) => {
        control.value = "";
      });
  };
  listenForMemberRevocation(root, clearPrivateDom);

  const access = await resolveMemberAccess();
  if (!revealAuthorizedWorkspace(root, access) || !access.isActiveMember) return;
  const { client, user } = access;

  const profileName = selectElement<HTMLInputElement>(root, "#profile-name");
  const profileLocation = selectElement<HTMLInputElement>(root, "#profile-location");
  const profilePractice = selectElement<HTMLInputElement>(root, "#profile-practice");
  const profileWebsite = selectElement<HTMLInputElement>(root, "#profile-website");
  const profileForm = selectElement<HTMLFormElement>(root, "[data-profile-form]");
  const profileStatus = selectElement<HTMLElement>(root, "[data-profile-status]");
  const creationSection = selectElement<HTMLElement>(root, "[data-state-creation]");
  const createForm = selectElement<HTMLFormElement>(root, "[data-state-create-form]");
  const createTitle = selectElement<HTMLInputElement>(root, "#new-state-title");
  const createDescription = selectElement<HTMLTextAreaElement>(
    root,
    "#new-state-description",
  );
  const createStatus = selectElement<HTMLElement>(root, "[data-state-create-status]");
  if (creationSection) creationSection.hidden = false;

  const refreshLists: () => Promise<void> = async () => {
    const [owned, collaborative, invitations] = await Promise.all([
      getOwnedStates(client, user.id),
      getCollaborativeStates(client, user.id),
      getPendingInvitations(client, user.id),
    ]);
    renderStates(ownedList, ownedEmpty, owned, false);
    ownedEmpty.textContent = "No States yet.";
    renderStates(collaborativeList, collaborativeEmpty, collaborative, true);
    collaborativeEmpty.textContent = "No accepted collaborations.";
    renderInvitations(invitationsList, invitationsEmpty, invitations, client, refreshLists);
    invitationsEmpty.textContent = "No pending invitations.";
  };

  try {
    const profile = await getProfile(client, user.id);
    if (profileName) profileName.value = profile?.name ?? "";
    if (profileLocation) profileLocation.value = profile?.location ?? "";
    if (profilePractice) profilePractice.value = profile?.practice ?? "";
    if (profileWebsite) profileWebsite.value = profile?.website_url ?? "";
    await refreshLists();
  } catch {
    ownedEmpty.hidden = false;
    ownedEmpty.textContent = "States unavailable.";
  }

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!profileName || !profileForm.checkValidity()) {
      profileForm.reportValidity();
      return;
    }
    const submit = selectElement<HTMLButtonElement>(profileForm, "button[type='submit']");
    setControlBusy(submit, true, "SAVING");
    setStatus(profileStatus);
    try {
      await saveProfile(client, user.id, {
        name: profileName.value,
        location: profileLocation?.value,
        practice: profilePractice?.value,
        websiteUrl: profileWebsite?.value,
      });
      setStatus(profileStatus, "Profile saved.");
    } catch {
      setStatus(profileStatus, "Profile could not be saved. Check the fields and try again.");
    } finally {
      setControlBusy(submit, false);
    }
  });

  createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!createTitle || !createForm.checkValidity()) {
      createForm.reportValidity();
      return;
    }
    const submit = selectElement<HTMLButtonElement>(createForm, "button[type='submit']");
    setControlBusy(submit, true, "CREATING");
    setStatus(createStatus);
    try {
      const state = await createState(client, user.id, {
        title: createTitle.value,
        description: createDescription?.value,
      });
      window.location.assign(memberRoute("states/view", { id: state.id }));
    } catch {
      setStatus(createStatus, "State could not be created. Check the fields and try again.");
      setControlBusy(submit, false);
    }
  });
}
