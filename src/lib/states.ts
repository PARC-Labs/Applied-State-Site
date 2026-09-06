import type { User } from "@supabase/supabase-js";

import {
  getBrowserSupabaseClient,
  type BrowserSupabaseClient,
} from "./supabase";
import {
  getCurrentMembership,
  isActiveMembership,
  safeHttpsUrl,
} from "./member-resources";
import {
  COLLABORATOR_STATUSES,
  MATERIAL_TYPES,
  STATE_REVIEW_STATUSES,
  STATE_VISIBILITIES,
  isUuid,
  type CollaboratorStatus,
  type MaterialRow,
  type MaterialType,
  type ProfileRow,
  type ReviewAction,
  type StaffRole,
  type StateCollaboratorRow,
  type StateMaterialRow,
  type StateReviewStatus,
  type StateRow,
  type StateVisibility,
} from "./types";

const STATE_COLUMNS =
  "id,owner_id,title,description,visibility,review_status,created_at,updated_at,opened_at,opened_by";
const PROFILE_COLUMNS =
  "id,handle,name,location,practice,website_url,created_at,updated_at";
const MATERIAL_COLUMNS =
  "id,created_by,type,title,body,url,storage_path,metadata,created_at,updated_at";
const STATE_MATERIAL_COLUMNS =
  "state_id,material_id,added_by,position,annotation,created_at";
const COLLABORATOR_COLUMNS =
  "state_id,user_id,role,status,invited_by,invited_via_email,created_at,responded_at,updated_at";

export type MemberAccess =
  | { kind: "unavailable" }
  | { kind: "signed-out"; client: BrowserSupabaseClient }
  | {
      kind: "authenticated";
      client: BrowserSupabaseClient;
      user: User;
      isActiveMember: boolean;
      staffRoles: StaffRole[];
      isStaff: boolean;
    };

export interface StateSummary extends StateRow {
  ownerName: string | null;
}

export interface StateMaterialDocument extends StateMaterialRow {
  material: MaterialRow;
}

export interface StateDocument {
  state: StateRow;
  owner: ProfileRow | null;
  collaborators: StateCollaboratorRow[];
  materials: StateMaterialDocument[];
}

export interface ProfileInput {
  name: string;
  location?: string | null;
  practice?: string | null;
  websiteUrl?: string | null;
}

export interface StateInput {
  title: string;
  description?: string | null;
}

export interface NewMaterialInput {
  type: "url" | "text";
  title?: string | null;
  body?: string | null;
  url?: string | null;
  annotation?: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isOneOf<T extends string>(
  value: unknown,
  choices: readonly T[],
): value is T {
  return typeof value === "string" && choices.includes(value as T);
}

function isProfileRow(value: unknown): value is ProfileRow {
  const row = record(value);
  return Boolean(
    row &&
      isUuid(row.id) &&
      nullableString(row.handle) &&
      typeof row.name === "string" &&
      nullableString(row.location) &&
      nullableString(row.practice) &&
      nullableString(row.website_url) &&
      typeof row.created_at === "string" &&
      typeof row.updated_at === "string",
  );
}

function isStateRow(value: unknown): value is StateRow {
  const row = record(value);
  return Boolean(
    row &&
      isUuid(row.id) &&
      isUuid(row.owner_id) &&
      typeof row.title === "string" &&
      nullableString(row.description) &&
      isOneOf(row.visibility, STATE_VISIBILITIES) &&
      isOneOf(row.review_status, STATE_REVIEW_STATUSES) &&
      typeof row.created_at === "string" &&
      typeof row.updated_at === "string" &&
      nullableString(row.opened_at) &&
      nullableString(row.opened_by),
  );
}

function isMaterialRow(value: unknown): value is MaterialRow {
  const row = record(value);
  return Boolean(
    row &&
      isUuid(row.id) &&
      isUuid(row.created_by) &&
      isOneOf(row.type, MATERIAL_TYPES) &&
      nullableString(row.title) &&
      nullableString(row.body) &&
      nullableString(row.url) &&
      nullableString(row.storage_path) &&
      row.metadata !== null &&
      typeof row.metadata === "object" &&
      typeof row.created_at === "string" &&
      typeof row.updated_at === "string",
  );
}

function isStateMaterialRow(value: unknown): value is StateMaterialRow {
  const row = record(value);
  return Boolean(
    row &&
      isUuid(row.state_id) &&
      isUuid(row.material_id) &&
      (row.added_by === null || isUuid(row.added_by)) &&
      typeof row.position === "number" &&
      nullableString(row.annotation) &&
      typeof row.created_at === "string",
  );
}

function isCollaboratorRow(value: unknown): value is StateCollaboratorRow {
  const row = record(value);
  return Boolean(
    row &&
      isUuid(row.state_id) &&
      isUuid(row.user_id) &&
      row.role === "editor" &&
      isOneOf(row.status, COLLABORATOR_STATUSES) &&
      isUuid(row.invited_by) &&
      typeof row.invited_via_email === "boolean" &&
      typeof row.created_at === "string" &&
      nullableString(row.responded_at) &&
      typeof row.updated_at === "string",
  );
}

function operationFailed(): never {
  throw new Error("The requested member operation is unavailable.");
}

function cleanRequiredText(value: string, maximum: number): string | null {
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maximum ? cleaned : null;
}

function cleanOptionalText(value: string | null | undefined, maximum: number): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maximum ? cleaned : null;
}

function uniqueUuids(values: readonly string[]): string[] {
  return [...new Set(values.filter(isUuid))];
}

export async function ownStaffRoles(
  client: BrowserSupabaseClient,
  userId: string,
): Promise<StaffRole[]> {
  const { data, error } = await client
    .from("staff_roles")
    .select("role")
    .eq("user_id", userId);

  if (error || !Array.isArray(data)) return [];
  return [...new Set(data.map((row) => row.role).filter((role): role is StaffRole =>
    role === "editor" || role === "admin",
  ))];
}

export async function resolveMemberAccess(): Promise<MemberAccess> {
  const client = getBrowserSupabaseClient();
  if (!client) return { kind: "unavailable" };

  try {
    const { data, error } = await client.auth.getSession();
    if (error) return { kind: "unavailable" };
    if (!data.session) return { kind: "signed-out", client };

    const user = data.session.user;
    const [membership, staffRoles] = await Promise.all([
      getCurrentMembership(client, user.id),
      ownStaffRoles(client, user.id),
    ]);

    return {
      kind: "authenticated",
      client,
      user,
      isActiveMember: isActiveMembership(membership),
      staffRoles,
      isStaff: staffRoles.length > 0,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function getProfile(
  client: BrowserSupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  if (!isUuid(userId)) return null;
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  return error || !isProfileRow(data) ? null : data;
}

export async function getProfilesByIds(
  client: BrowserSupabaseClient,
  userIds: readonly string[],
): Promise<Map<string, ProfileRow>> {
  const ids = uniqueUuids(userIds);
  if (!ids.length) return new Map();

  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", ids);
  if (error || !Array.isArray(data)) operationFailed();

  return new Map(data.filter(isProfileRow).map((profile) => [profile.id, profile]));
}

export async function saveProfile(
  client: BrowserSupabaseClient,
  userId: string,
  input: ProfileInput,
): Promise<ProfileRow> {
  const name = cleanRequiredText(input.name, 160);
  if (!isUuid(userId) || !name) operationFailed();

  const websiteInput = cleanOptionalText(input.websiteUrl, 2048);
  const websiteUrl = websiteInput ? safeHttpsUrl(websiteInput) : null;
  if (websiteInput && !websiteUrl) operationFailed();

  const { data, error } = await client
    .from("profiles")
    .upsert(
      {
        id: userId,
        name,
        location: cleanOptionalText(input.location, 240),
        practice: cleanOptionalText(input.practice, 1000),
        website_url: websiteUrl,
      },
      { onConflict: "id" },
    )
    .select(PROFILE_COLUMNS)
    .single();

  if (error || !isProfileRow(data)) operationFailed();
  return data;
}

async function attachOwnerNames(
  client: BrowserSupabaseClient,
  states: StateRow[],
): Promise<StateSummary[]> {
  const profiles = await getProfilesByIds(
    client,
    states.map((state) => state.owner_id),
  );
  return states.map((state) => ({
    ...state,
    ownerName: profiles.get(state.owner_id)?.name ?? null,
  }));
}

export async function getOwnedStates(
  client: BrowserSupabaseClient,
  userId: string,
): Promise<StateSummary[]> {
  if (!isUuid(userId)) return [];
  const { data, error } = await client
    .from("states")
    .select(STATE_COLUMNS)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !Array.isArray(data)) operationFailed();
  return attachOwnerNames(client, data.filter(isStateRow));
}

export async function getCollaborativeStates(
  client: BrowserSupabaseClient,
  userId: string,
): Promise<StateSummary[]> {
  if (!isUuid(userId)) return [];
  const { data: collaborations, error: collaborationError } = await client
    .from("state_collaborators")
    .select(COLLABORATOR_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "accepted");
  if (collaborationError || !Array.isArray(collaborations)) operationFailed();

  const stateIds = uniqueUuids(
    collaborations.filter(isCollaboratorRow).map((entry) => entry.state_id),
  );
  if (!stateIds.length) return [];

  const { data, error } = await client
    .from("states")
    .select(STATE_COLUMNS)
    .in("id", stateIds)
    .order("updated_at", { ascending: false });
  if (error || !Array.isArray(data)) operationFailed();
  return attachOwnerNames(client, data.filter(isStateRow));
}

export async function getEditableStates(
  client: BrowserSupabaseClient,
  userId: string,
): Promise<StateSummary[]> {
  const [owned, collaborative] = await Promise.all([
    getOwnedStates(client, userId),
    getCollaborativeStates(client, userId),
  ]);
  const byId = new Map([...owned, ...collaborative].map((state) => [state.id, state]));
  return [...byId.values()].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
}

export async function getPendingInvitations(
  client: BrowserSupabaseClient,
  userId: string,
): Promise<StateCollaboratorRow[]> {
  if (!isUuid(userId)) return [];
  const { data, error } = await client
    .from("state_collaborators")
    .select(COLLABORATOR_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(data)) operationFailed();
  return data.filter(isCollaboratorRow);
}

export async function createState(
  client: BrowserSupabaseClient,
  userId: string,
  input: StateInput,
): Promise<StateRow> {
  const title = cleanRequiredText(input.title, 180);
  if (!isUuid(userId) || !title) operationFailed();

  const { data, error } = await client
    .from("states")
    .insert({
      owner_id: userId,
      title,
      description: cleanOptionalText(input.description, 4000),
    })
    .select(STATE_COLUMNS)
    .single();
  if (error || !isStateRow(data)) operationFailed();
  return data;
}

export async function updateState(
  client: BrowserSupabaseClient,
  stateId: string,
  input: StateInput,
): Promise<StateRow> {
  const title = cleanRequiredText(input.title, 180);
  if (!isUuid(stateId) || !title) operationFailed();

  const { data, error } = await client
    .from("states")
    .update({
      title,
      description: cleanOptionalText(input.description, 4000),
    })
    .eq("id", stateId)
    .select(STATE_COLUMNS)
    .maybeSingle();
  if (error || !isStateRow(data)) operationFailed();
  return data;
}

export async function deleteState(
  client: BrowserSupabaseClient,
  stateId: string,
): Promise<void> {
  if (!isUuid(stateId)) operationFailed();
  const { data, error } = await client
    .from("states")
    .delete()
    .eq("id", stateId)
    .select("id")
    .maybeSingle();
  if (error || !data || !isUuid(data.id)) operationFailed();
}

export async function getStateDocument(
  client: BrowserSupabaseClient,
  stateId: string,
): Promise<StateDocument | null> {
  if (!isUuid(stateId)) return null;
  const { data: rawState, error: stateError } = await client
    .from("states")
    .select(STATE_COLUMNS)
    .eq("id", stateId)
    .maybeSingle();
  if (stateError || !isStateRow(rawState)) return null;

  const [owner, associationsResult, collaboratorsResult] = await Promise.all([
    getProfile(client, rawState.owner_id),
    client
      .from("state_materials")
      .select(STATE_MATERIAL_COLUMNS)
      .eq("state_id", stateId)
      .order("position", { ascending: true }),
    client
      .from("state_collaborators")
      .select(COLLABORATOR_COLUMNS)
      .eq("state_id", stateId)
      .order("created_at", { ascending: true }),
  ]);

  if (associationsResult.error || collaboratorsResult.error) operationFailed();
  const associations = Array.isArray(associationsResult.data)
    ? associationsResult.data.filter(isStateMaterialRow)
    : [];
  const collaborators = Array.isArray(collaboratorsResult.data)
    ? collaboratorsResult.data.filter(isCollaboratorRow)
    : [];

  let materials = new Map<string, MaterialRow>();
  const materialIds = uniqueUuids(associations.map((entry) => entry.material_id));
  if (materialIds.length) {
    const { data, error } = await client
      .from("materials")
      .select(MATERIAL_COLUMNS)
      .in("id", materialIds);
    if (error || !Array.isArray(data)) operationFailed();
    materials = new Map(data.filter(isMaterialRow).map((material) => [material.id, material]));
  }

  return {
    state: rawState,
    owner,
    collaborators,
    materials: associations.flatMap((association) => {
      const material = materials.get(association.material_id);
      return material ? [{ ...association, material }] : [];
    }),
  };
}

export async function getIndexStates(
  client: BrowserSupabaseClient,
): Promise<StateSummary[]> {
  const { data, error } = await client
    .from("states")
    .select(STATE_COLUMNS)
    .eq("visibility", "index")
    .eq("review_status", "approved")
    .order("opened_at", { ascending: false });
  if (error || !Array.isArray(data)) operationFailed();
  return attachOwnerNames(client, data.filter(isStateRow));
}

export async function getReviewStates(
  client: BrowserSupabaseClient,
): Promise<{ submitted: StateSummary[]; opened: StateSummary[] }> {
  const [submittedResult, openedResult] = await Promise.all([
    client
      .from("states")
      .select(STATE_COLUMNS)
      .eq("review_status", "submitted")
      .order("updated_at", { ascending: true }),
    client
      .from("states")
      .select(STATE_COLUMNS)
      .eq("visibility", "index")
      .eq("review_status", "approved")
      .order("opened_at", { ascending: false }),
  ]);
  if (
    submittedResult.error ||
    openedResult.error ||
    !Array.isArray(submittedResult.data) ||
    !Array.isArray(openedResult.data)
  ) {
    operationFailed();
  }

  const [submitted, opened] = await Promise.all([
    attachOwnerNames(client, submittedResult.data.filter(isStateRow)),
    attachOwnerNames(client, openedResult.data.filter(isStateRow)),
  ]);
  return { submitted, opened };
}

export async function addStateMaterial(
  client: BrowserSupabaseClient,
  stateId: string,
  input: NewMaterialInput,
): Promise<string> {
  if (!isUuid(stateId) || !["url", "text"].includes(input.type)) operationFailed();
  const title = cleanOptionalText(input.title, 180);
  const body = cleanOptionalText(input.body, 20_000);
  const annotation = cleanOptionalText(input.annotation, 2000);
  const urlInput = cleanOptionalText(input.url, 2048);
  const url = urlInput ? safeHttpsUrl(urlInput) : null;

  if ((input.type === "url" && !url) || (input.type === "text" && !body)) {
    operationFailed();
  }

  const { data, error } = await client.rpc("add_state_material", {
    target_state_id: stateId,
    material_kind: input.type,
    material_title: title,
    material_body: input.type === "text" ? body : null,
    material_url: input.type === "url" ? url : null,
    material_annotation: annotation,
  });
  if (error || !isUuid(data)) operationFailed();
  return data;
}

export async function connectStateMaterial(
  client: BrowserSupabaseClient,
  stateId: string,
  materialId: string,
  annotation?: string | null,
): Promise<void> {
  if (!isUuid(stateId) || !isUuid(materialId)) operationFailed();
  const { error } = await client.rpc("connect_state_material", {
    target_state_id: stateId,
    target_material_id: materialId,
    material_annotation: cleanOptionalText(annotation, 2000),
  });
  if (error) operationFailed();
}

export async function removeStateMaterial(
  client: BrowserSupabaseClient,
  stateId: string,
  materialId: string,
): Promise<void> {
  if (!isUuid(stateId) || !isUuid(materialId)) operationFailed();
  const { error } = await client.rpc("remove_state_material", {
    target_state_id: stateId,
    target_material_id: materialId,
  });
  if (error) operationFailed();
}

export async function reorderStateMaterials(
  client: BrowserSupabaseClient,
  stateId: string,
  orderedMaterialIds: readonly string[],
): Promise<void> {
  const ids = orderedMaterialIds.filter(isUuid);
  if (!isUuid(stateId) || ids.length !== orderedMaterialIds.length) operationFailed();
  const { error } = await client.rpc("reorder_state_materials", {
    target_state_id: stateId,
    ordered_material_ids: ids,
  });
  if (error) operationFailed();
}

export async function respondToInvitation(
  client: BrowserSupabaseClient,
  stateId: string,
  accept: boolean,
): Promise<void> {
  if (!isUuid(stateId)) operationFailed();
  const { error } = await client.rpc("respond_to_state_invitation", {
    target_state_id: stateId,
    accept,
  });
  if (error) operationFailed();
}

export async function inviteCollaboratorByEmail(
  client: BrowserSupabaseClient,
  stateId: string,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (
    !isUuid(stateId) ||
    !normalized ||
    normalized.length > 254 ||
    /[\u0000-\u0020\u007f]/.test(normalized) ||
    !/^[^@]+@[^@]+\.[^@]+$/.test(normalized)
  ) {
    operationFailed();
  }

  const { error } = await client.functions.invoke("invite-state-collaborator", {
    body: { state_id: stateId, email: normalized },
  });
  if (error) operationFailed();
}

export async function revokeCollaborator(
  client: BrowserSupabaseClient,
  stateId: string,
  userId: string,
): Promise<void> {
  if (!isUuid(stateId) || !isUuid(userId)) operationFailed();
  const { error } = await client.rpc("revoke_state_collaborator", {
    target_state_id: stateId,
    target_user_id: userId,
  });
  if (error) operationFailed();
}

export async function submitState(
  client: BrowserSupabaseClient,
  stateId: string,
): Promise<void> {
  if (!isUuid(stateId)) operationFailed();
  const { error } = await client.rpc("submit_state", { target_state_id: stateId });
  if (error) operationFailed();
}

export async function withdrawState(
  client: BrowserSupabaseClient,
  stateId: string,
): Promise<void> {
  if (!isUuid(stateId)) operationFailed();
  const { error } = await client.rpc("withdraw_state", { target_state_id: stateId });
  if (error) operationFailed();
}

export async function reviewState(
  client: BrowserSupabaseClient,
  stateId: string,
  action: ReviewAction,
): Promise<void> {
  if (!isUuid(stateId) || !["approve", "reject", "close"].includes(action)) {
    operationFailed();
  }
  const { error } = await client.rpc("review_state", {
    target_state_id: stateId,
    action,
  });
  if (error) operationFailed();
}

export function isEditableBy(
  document: StateDocument,
  userId: string,
): boolean {
  return (
    document.state.owner_id === userId ||
    document.collaborators.some(
      (entry) =>
        entry.user_id === userId &&
        entry.status === "accepted" &&
        entry.role === "editor",
    )
  );
}

export function stateLifecycleLabel(
  visibility: StateVisibility,
  reviewStatus: StateReviewStatus,
): string {
  if (visibility === "index" && reviewStatus === "approved") return "OPEN IN INDEX";
  if (reviewStatus === "submitted") return "SUBMITTED";
  if (reviewStatus === "rejected") return "REJECTED · PRIVATE";
  if (reviewStatus === "withdrawn") return "WITHDRAWN · PRIVATE";
  return "PRIVATE";
}

export function materialTypeLabel(type: MaterialType): string {
  if (type === "as_reference") return "APPLIED STATE REFERENCE";
  return type.toUpperCase();
}

export function collaboratorStatusLabel(status: CollaboratorStatus): string {
  return status.toUpperCase();
}
