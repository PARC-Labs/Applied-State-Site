import {
  addStateMaterial,
  collaboratorStatusLabel,
  connectStateMaterial,
  deleteState,
  getEditableStates,
  getProfilesByIds,
  getStateDocument,
  inviteCollaboratorByEmail,
  isEditableBy,
  materialTypeLabel,
  removeStateMaterial,
  reorderStateMaterials,
  resolveMemberAccess,
  revokeCollaborator,
  stateLifecycleLabel,
  submitState,
  updateState,
  withdrawState,
  type StateDocument,
  type StateMaterialDocument,
  type StateSummary,
} from "../lib/states";
import type { BrowserSupabaseClient } from "../lib/supabase";
import type { ProfileRow } from "../lib/types";
import { safeHttpsUrl } from "../lib/member-resources";
import {
  appendParagraph,
  clearChildren,
  listenForMemberRevocation,
  makeTextAction,
  memberRoute,
  revealAuthorizedWorkspace,
  selectElement,
  setControlBusy,
  setStatus,
  stateIdFromLocation,
} from "./states-dom";

function materialTitle(entry: StateMaterialDocument): string {
  return entry.material.title || materialTypeLabel(entry.material.type);
}

function appendMaterialText(
  item: HTMLElement,
  entry: StateMaterialDocument,
): void {
  const material = entry.material;
  const href = safeHttpsUrl(material.url);
  if (href) {
    const link = document.createElement("a");
    link.className = "material-entry__title";
    link.href = href;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    link.textContent = `${materialTitle(entry)} ↗`;
    item.append(link);
  } else {
    const heading = document.createElement("h3");
    heading.className = "material-entry__title";
    heading.textContent = materialTitle(entry);
    item.append(heading);
  }

  appendParagraph(item, material.body, "material-entry__body");
  appendParagraph(
    item,
    entry.annotation ? `ANNOTATION — ${entry.annotation}` : null,
    "material-entry__body",
  );
  appendParagraph(item, materialTypeLabel(material.type), "material-entry__meta");
}

function appendConnectControls(
  item: HTMLElement,
  entry: StateMaterialDocument,
  targets: StateSummary[],
  client: BrowserSupabaseClient,
): void {
  if (!targets.length) return;

  const controls = document.createElement("div");
  controls.className = "connect-controls";
  const select = document.createElement("select");
  select.setAttribute("aria-label", `State to connect ${materialTitle(entry)} to`);
  const prompt = document.createElement("option");
  prompt.value = "";
  prompt.textContent = "CONNECT TO STATE";
  select.append(prompt);
  for (const target of targets) {
    const option = document.createElement("option");
    option.value = target.id;
    option.textContent = target.title;
    select.append(option);
  }

  const status = document.createElement("p");
  status.className = "states-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const connect = makeTextAction("CONNECT", async (button) => {
    if (!select.value) {
      setStatus(status, "Choose a State.");
      select.focus();
      return;
    }
    setControlBusy(button, true, "CONNECTING");
    setStatus(status);
    try {
      await connectStateMaterial(client, select.value, entry.material_id);
      setStatus(status, "Material connected.");
      select.value = "";
    } catch {
      setStatus(status, "Material could not be connected.");
    } finally {
      setControlBusy(button, false);
    }
  });
  controls.append(select, connect);
  item.append(controls, status);
}

function renderMaterials(
  container: HTMLOListElement,
  empty: HTMLElement,
  documentState: StateDocument,
  targets: StateSummary[],
  client: BrowserSupabaseClient,
  canEdit: boolean,
  editingSurface: boolean,
  refresh: () => Promise<void>,
): void {
  clearChildren(container);
  empty.hidden = documentState.materials.length > 0;
  const orderedIds = documentState.materials.map((entry) => entry.material_id);

  documentState.materials.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "material-entry";
    appendMaterialText(item, entry);

    if (canEdit && editingSurface) {
      const actions = document.createElement("div");
      actions.className = "material-entry__actions";
      const status = document.createElement("p");
      status.className = "states-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");

      if (index > 0) {
        actions.append(
          makeTextAction("MOVE UP", async (button) => {
            const nextOrder = [...orderedIds];
            [nextOrder[index - 1], nextOrder[index]] = [
              nextOrder[index],
              nextOrder[index - 1],
            ];
            setControlBusy(button, true, "MOVING");
            try {
              await reorderStateMaterials(client, documentState.state.id, nextOrder);
              await refresh();
            } catch {
              setStatus(status, "Material order could not be changed.");
              setControlBusy(button, false);
            }
          }),
        );
      }
      if (index < documentState.materials.length - 1) {
        actions.append(
          makeTextAction("MOVE DOWN", async (button) => {
            const nextOrder = [...orderedIds];
            [nextOrder[index], nextOrder[index + 1]] = [
              nextOrder[index + 1],
              nextOrder[index],
            ];
            setControlBusy(button, true, "MOVING");
            try {
              await reorderStateMaterials(client, documentState.state.id, nextOrder);
              await refresh();
            } catch {
              setStatus(status, "Material order could not be changed.");
              setControlBusy(button, false);
            }
          }),
        );
      }
      actions.append(
        makeTextAction("REMOVE", async (button) => {
          setControlBusy(button, true, "REMOVING");
          try {
            await removeStateMaterial(client, documentState.state.id, entry.material_id);
            await refresh();
          } catch {
            setStatus(status, "Material could not be removed.");
            setControlBusy(button, false);
          }
        }),
      );
      item.append(actions, status);
    }

    appendConnectControls(item, entry, targets, client);
    container.append(item);
  });
}

async function renderCollaborators(
  container: HTMLOListElement,
  documentState: StateDocument,
  client: BrowserSupabaseClient,
  refresh: () => Promise<void>,
): Promise<void> {
  clearChildren(container);
  const current = documentState.collaborators.filter(
    (entry) => entry.status === "pending" || entry.status === "accepted",
  );
  let profiles = new Map<string, ProfileRow>();
  try {
    profiles = await getProfilesByIds(
      client,
      current.map((entry) => entry.user_id),
    );
  } catch {
    // Profile attribution is optional; never substitute private identifiers.
  }

  for (const collaborator of current) {
    const item = document.createElement("li");
    item.className = "collaborator-entry";
    appendParagraph(item, profiles.get(collaborator.user_id)?.name ?? "MEMBER");
    appendParagraph(
      item,
      collaboratorStatusLabel(collaborator.status),
      "collaborator-entry__meta",
    );
    const actions = document.createElement("div");
    actions.className = "collaborator-entry__actions";
    const status = document.createElement("p");
    status.className = "states-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    actions.append(
      makeTextAction("REVOKE", async (button) => {
        setControlBusy(button, true, "REVOKING");
        try {
          await revokeCollaborator(
            client,
            documentState.state.id,
            collaborator.user_id,
          );
          await refresh();
        } catch {
          setStatus(status, "Collaboration could not be revoked.");
          setControlBusy(button, false);
        }
      }),
    );
    item.append(actions, status);
    container.append(item);
  }
}

export async function initStateViewPage(): Promise<void> {
  const root = selectElement<HTMLElement>(document, "[data-state-view]");
  if (!root) return;

  const title = selectElement<HTMLElement>(root, "[data-state-title]");
  const owner = selectElement<HTMLElement>(root, "[data-state-owner]");
  const lifecycle = selectElement<HTMLElement>(root, "[data-state-lifecycle]");
  const description = selectElement<HTMLElement>(root, "[data-state-description]");
  const pageStatus = selectElement<HTMLElement>(root, "[data-state-status]");
  const materials = selectElement<HTMLOListElement>(root, "[data-state-materials]");
  const materialsEmpty = selectElement<HTMLElement>(root, "[data-state-materials-empty]");
  if (!title || !owner || !lifecycle || !description || !materials || !materialsEmpty) {
    return;
  }

  let current: StateDocument | null = null;
  let connectTargets: StateSummary[] = [];
  let confirmDelete = false;

  const clearPrivateDom = () => {
    current = null;
    connectTargets = [];
    confirmDelete = false;
    title.textContent = "STATE";
    owner.textContent = "";
    lifecycle.textContent = "";
    description.textContent = "";
    description.hidden = true;
    clearChildren(materials);
    clearChildren(root.querySelector("[data-state-collaborators]"));
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
      .forEach((control) => {
        control.value = "";
      });
  };
  listenForMemberRevocation(root, clearPrivateDom, { allowStaff: true });

  const access = await resolveMemberAccess();
  if (!revealAuthorizedWorkspace(root, access, { allowStaff: true })) return;
  const { client, user } = access;
  const stateId = stateIdFromLocation();
  const editingSurface = root.dataset.stateViewMode !== "index";
  if (!stateId) {
    setStatus(pageStatus, "State unavailable.");
    return;
  }

  const editSection = selectElement<HTMLElement>(root, "[data-state-edit-section]");
  const editForm = selectElement<HTMLFormElement>(root, "[data-state-edit-form]");
  const editTitle = selectElement<HTMLInputElement>(root, "#state-title");
  const editDescription = selectElement<HTMLTextAreaElement>(root, "#state-description");
  const editStatus = selectElement<HTMLElement>(root, "[data-state-edit-status]");
  const lifecycleSection = selectElement<HTMLElement>(root, "[data-state-lifecycle-section]");
  const submitControl = selectElement<HTMLButtonElement>(root, "[data-state-submit]");
  const withdrawControl = selectElement<HTMLButtonElement>(root, "[data-state-withdraw]");
  const lifecycleStatus = selectElement<HTMLElement>(root, "[data-state-lifecycle-status]");
  const collaborationSection = selectElement<HTMLElement>(root, "[data-collaboration-section]");
  const collaborators = selectElement<HTMLOListElement>(root, "[data-state-collaborators]");
  const inviteForm = selectElement<HTMLFormElement>(root, "[data-invite-form]");
  const inviteEmail = selectElement<HTMLInputElement>(root, "#invite-email");
  const inviteStatus = selectElement<HTMLElement>(root, "[data-invite-status]");
  const addSection = selectElement<HTMLElement>(root, "[data-add-material-section]");
  const addForm = selectElement<HTMLFormElement>(root, "[data-add-material-form]");
  const materialKind = selectElement<HTMLSelectElement>(root, "#material-kind");
  const materialTitleControl = selectElement<HTMLInputElement>(root, "#material-title");
  const materialUrl = selectElement<HTMLInputElement>(root, "#material-url");
  const materialBody = selectElement<HTMLTextAreaElement>(root, "#material-body");
  const materialAnnotation = selectElement<HTMLTextAreaElement>(root, "#material-annotation");
  const materialUrlField = selectElement<HTMLElement>(root, "[data-material-url-field]");
  const materialBodyField = selectElement<HTMLElement>(root, "[data-material-body-field]");
  const addStatus = selectElement<HTMLElement>(root, "[data-add-material-status]");
  const deleteSection = selectElement<HTMLElement>(root, "[data-delete-state-section]");
  const deleteControl = selectElement<HTMLButtonElement>(root, "[data-delete-state]");
  const deleteStatus = selectElement<HTMLElement>(root, "[data-delete-state-status]");

  const refresh: () => Promise<void> = async () => {
    setStatus(pageStatus);
    const [documentState, editableStates] = await Promise.all([
      getStateDocument(client, stateId),
      access.isActiveMember ? getEditableStates(client, user.id) : Promise.resolve([]),
    ]);

    if (
      !documentState ||
      (!editingSurface &&
        (documentState.state.visibility !== "index" ||
          documentState.state.review_status !== "approved"))
    ) {
      current = null;
      clearPrivateDom();
      setStatus(pageStatus, "State unavailable.");
      return;
    }

    current = documentState;
    connectTargets = editableStates.filter((state) => state.id !== stateId);
    const canEdit = access.isActiveMember && isEditableBy(documentState, user.id);
    const isOwner = access.isActiveMember && documentState.state.owner_id === user.id;

    title.textContent = documentState.state.title;
    owner.textContent = documentState.owner?.name
      ? `BY ${documentState.owner.name}`
      : "";
    lifecycle.textContent = stateLifecycleLabel(
      documentState.state.visibility,
      documentState.state.review_status,
    );
    description.textContent = documentState.state.description ?? "";
    description.hidden = !documentState.state.description;

    if (editTitle) editTitle.value = documentState.state.title;
    if (editDescription) editDescription.value = documentState.state.description ?? "";
    if (editSection) editSection.hidden = !editingSurface || !canEdit;
    if (addSection) addSection.hidden = !editingSurface || !canEdit;

    const canManageLifecycle =
      editingSurface &&
      isOwner &&
      documentState.state.visibility === "private" &&
      ["none", "rejected", "withdrawn", "submitted"].includes(
        documentState.state.review_status,
      );
    if (lifecycleSection) lifecycleSection.hidden = !canManageLifecycle;
    if (submitControl) {
      setControlBusy(submitControl, false);
      submitControl.hidden = ![
        "none",
        "rejected",
        "withdrawn",
      ].includes(documentState.state.review_status) || documentState.state.visibility !== "private";
    }
    if (withdrawControl) {
      setControlBusy(withdrawControl, false);
      withdrawControl.hidden = documentState.state.review_status !== "submitted";
    }

    if (collaborationSection) collaborationSection.hidden = !editingSurface || !isOwner;
    if (collaborators && editingSurface && isOwner) {
      await renderCollaborators(collaborators, documentState, client, refresh);
    } else {
      clearChildren(collaborators);
    }

    const canDelete =
      editingSurface &&
      isOwner &&
      documentState.state.visibility === "private" &&
      documentState.state.review_status !== "submitted";
    if (deleteSection) deleteSection.hidden = !canDelete;
    confirmDelete = false;
    if (deleteControl) deleteControl.textContent = "DELETE";
    setStatus(deleteStatus);

    renderMaterials(
      materials,
      materialsEmpty,
      documentState,
      connectTargets,
      client,
      canEdit,
      editingSurface,
      refresh,
    );
  };

  try {
    await refresh();
  } catch {
    clearPrivateDom();
    setStatus(pageStatus, "State unavailable.");
  }

  editForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!current || !editTitle || !editForm.checkValidity()) {
      editForm.reportValidity();
      return;
    }
    const submit = selectElement<HTMLButtonElement>(editForm, "button[type='submit']");
    setControlBusy(submit, true, "SAVING");
    setStatus(editStatus);
    try {
      await updateState(client, current.state.id, {
        title: editTitle.value,
        description: editDescription?.value,
      });
      await refresh();
      setStatus(editStatus, "State saved.");
    } catch {
      setStatus(editStatus, "State could not be saved.");
    } finally {
      setControlBusy(submit, false);
    }
  });

  const updateMaterialFields = () => {
    const text = materialKind?.value === "text";
    if (materialUrlField) materialUrlField.hidden = text;
    if (materialBodyField) materialBodyField.hidden = !text;
    if (materialUrl) materialUrl.required = !text;
    if (materialBody) materialBody.required = text;
  };
  materialKind?.addEventListener("change", updateMaterialFields);
  updateMaterialFields();

  addForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!current || !materialKind || !addForm.checkValidity()) {
      addForm.reportValidity();
      return;
    }
    const kind = materialKind.value === "text" ? "text" : "url";
    const submit = selectElement<HTMLButtonElement>(addForm, "button[type='submit']");
    setControlBusy(submit, true, "ADDING");
    setStatus(addStatus);
    try {
      await addStateMaterial(client, current.state.id, {
        type: kind,
        title: materialTitleControl?.value,
        body: materialBody?.value,
        url: materialUrl?.value,
        annotation: materialAnnotation?.value,
      });
      addForm.reset();
      updateMaterialFields();
      await refresh();
      setStatus(addStatus, "Material added.");
    } catch {
      setStatus(addStatus, "Material could not be added. Check the fields and try again.");
    } finally {
      setControlBusy(submit, false);
    }
  });

  inviteForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!current || !inviteEmail || !inviteForm.checkValidity()) {
      inviteForm.reportValidity();
      return;
    }
    const submit = selectElement<HTMLButtonElement>(inviteForm, "button[type='submit']");
    setControlBusy(submit, true, "INVITING");
    setStatus(inviteStatus);
    try {
      await inviteCollaboratorByEmail(client, current.state.id, inviteEmail.value);
      inviteEmail.value = "";
      setStatus(inviteStatus, "Invitation request accepted.");
      await refresh();
    } catch {
      setStatus(inviteStatus, "Invitation service unavailable. Try again.");
    } finally {
      setControlBusy(submit, false);
    }
  });

  submitControl?.addEventListener("click", async () => {
    if (!current) return;
    setControlBusy(submitControl, true, "SUBMITTING");
    setStatus(lifecycleStatus);
    try {
      await submitState(client, current.state.id);
      await refresh();
      setStatus(lifecycleStatus, "State submitted for review.");
    } catch {
      setStatus(lifecycleStatus, "State could not be submitted.");
      setControlBusy(submitControl, false);
    }
  });

  withdrawControl?.addEventListener("click", async () => {
    if (!current) return;
    setControlBusy(withdrawControl, true, "WITHDRAWING");
    setStatus(lifecycleStatus);
    try {
      await withdrawState(client, current.state.id);
      await refresh();
      setStatus(lifecycleStatus, "Submission withdrawn.");
    } catch {
      setStatus(lifecycleStatus, "Submission could not be withdrawn.");
      setControlBusy(withdrawControl, false);
    }
  });

  deleteControl?.addEventListener("click", async () => {
    if (!current) return;
    if (!confirmDelete) {
      confirmDelete = true;
      deleteControl.textContent = "CONFIRM DELETE";
      setStatus(deleteStatus, "Select confirm delete to remove this State.");
      return;
    }

    setControlBusy(deleteControl, true, "DELETING");
    try {
      await deleteState(client, current.state.id);
      window.location.assign(memberRoute("states"));
    } catch {
      confirmDelete = false;
      setStatus(deleteStatus, "State could not be deleted.");
      deleteControl.disabled = false;
      deleteControl.setAttribute("aria-busy", "false");
      deleteControl.removeAttribute("data-idle-label");
      deleteControl.textContent = "DELETE";
    }
  });
}
