export const MEMBERSHIP_STATUSES = ["active", "grace", "inactive"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MEMBERSHIP_SOURCES = [
  "manual",
  "billing",
  "complimentary",
  "invite",
] as const;
export type MembershipSource = (typeof MEMBERSHIP_SOURCES)[number];

export const MEMBER_RESOURCE_KINDS = [
  "text",
  "url",
  "file",
  "film",
  "code",
  "reference",
] as const;
export type MemberResourceKind = (typeof MEMBER_RESOURCE_KINDS)[number];

export const STATE_VISIBILITIES = ["private", "index"] as const;
export type StateVisibility = (typeof STATE_VISIBILITIES)[number];

export const STATE_REVIEW_STATUSES = [
  "none",
  "submitted",
  "approved",
  "rejected",
  "withdrawn",
] as const;
export type StateReviewStatus = (typeof STATE_REVIEW_STATUSES)[number];

export const MATERIAL_TYPES = [
  "url",
  "text",
  "image",
  "file",
  "as_reference",
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const COLLABORATOR_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "revoked",
] as const;
export type CollaboratorStatus = (typeof COLLABORATOR_STATUSES)[number];
export type CollaboratorRole = "editor";
export type StaffRole = "editor" | "admin";
export type ReviewAction = "approve" | "reject" | "close";

export interface MembershipRow {
  user_id: string;
  status: MembershipStatus;
  source: MembershipSource;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  starts_at: string;
  access_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberResourceRow {
  id: string;
  as_id: string;
  slot_key: string;
  resource_type: MemberResourceKind;
  title: string | null;
  body: string | null;
  url: string | null;
  storage_path: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  handle: string | null;
  name: string;
  location: string | null;
  practice: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffRoleRow {
  user_id: string;
  role: StaffRole;
  created_at: string;
  created_by: string | null;
}

export interface StateRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  visibility: StateVisibility;
  review_status: StateReviewStatus;
  created_at: string;
  updated_at: string;
  opened_at: string | null;
  opened_by: string | null;
}

export interface MaterialRow {
  id: string;
  created_by: string;
  type: MaterialType;
  title: string | null;
  body: string | null;
  url: string | null;
  storage_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StateMaterialRow {
  state_id: string;
  material_id: string;
  added_by: string | null;
  position: number;
  annotation: string | null;
  created_at: string;
}

export interface StateCollaboratorRow {
  state_id: string;
  user_id: string;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  invited_by: string;
  invited_via_email: boolean;
  created_at: string;
  responded_at: string | null;
  updated_at: string;
}

type TableDefinition<Row, Insert, Update> = {
  Row: Row & Record<string, unknown>;
  Insert: Insert & Record<string, unknown>;
  Update: Update & Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      memberships: TableDefinition<
        MembershipRow,
        Partial<MembershipRow> & { user_id: string },
        Partial<MembershipRow>
      >;
      as_member_resources: TableDefinition<
        MemberResourceRow,
        Partial<MemberResourceRow> & {
          as_id: string;
          slot_key: string;
          resource_type: MemberResourceKind;
        },
        Partial<MemberResourceRow>
      >;
      profiles: TableDefinition<
        ProfileRow,
        Partial<ProfileRow> & { id: string; name: string },
        Partial<ProfileRow>
      >;
      staff_roles: TableDefinition<
        StaffRoleRow,
        { user_id: string; role: StaffRole; created_by?: string | null },
        Partial<StaffRoleRow>
      >;
      states: TableDefinition<
        StateRow,
        Partial<StateRow> & { owner_id: string; title: string },
        Partial<StateRow>
      >;
      materials: TableDefinition<
        MaterialRow,
        Partial<MaterialRow> & { created_by: string; type: MaterialType },
        Partial<MaterialRow>
      >;
      state_materials: TableDefinition<
        StateMaterialRow,
        Partial<StateMaterialRow> & {
          state_id: string;
          material_id: string;
          position: number;
        },
        Partial<StateMaterialRow>
      >;
      state_collaborators: TableDefinition<
        StateCollaboratorRow,
        Partial<StateCollaboratorRow> & {
          state_id: string;
          user_id: string;
          invited_by: string;
          invited_via_email?: boolean;
        },
        Partial<StateCollaboratorRow>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      submit_state: {
        Args: { target_state_id: string };
        Returns: undefined;
      };
      withdraw_state: {
        Args: { target_state_id: string };
        Returns: undefined;
      };
      review_state: {
        Args: { target_state_id: string; action: ReviewAction };
        Returns: undefined;
      };
      invite_state_collaborator: {
        Args: { target_state_id: string; target_user_id: string };
        Returns: undefined;
      };
      respond_to_state_invitation: {
        Args: { target_state_id: string; accept: boolean };
        Returns: undefined;
      };
      revoke_state_collaborator: {
        Args: { target_state_id: string; target_user_id: string };
        Returns: undefined;
      };
      add_state_material: {
        Args: {
          target_state_id: string;
          material_kind: "url" | "text";
          material_title?: string | null;
          material_body?: string | null;
          material_url?: string | null;
          material_annotation?: string | null;
        };
        Returns: string;
      };
      connect_state_material: {
        Args: {
          target_state_id: string;
          target_material_id: string;
          material_annotation?: string | null;
        };
        Returns: undefined;
      };
      remove_state_material: {
        Args: { target_state_id: string; target_material_id: string };
        Returns: undefined;
      };
      reorder_state_materials: {
        Args: { target_state_id: string; ordered_material_ids: string[] };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export function isMembershipStatus(value: unknown): value is MembershipStatus {
  return (
    typeof value === "string" &&
    (MEMBERSHIP_STATUSES as readonly string[]).includes(value)
  );
}

export function isMemberResourceKind(value: unknown): value is MemberResourceKind {
  return (
    typeof value === "string" &&
    (MEMBER_RESOURCE_KINDS as readonly string[]).includes(value)
  );
}

export function isInstanceCode(value: unknown): value is string {
  return typeof value === "string" && /^AS\d{2,}$/.test(value);
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
