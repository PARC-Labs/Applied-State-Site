# Applied State — Engineering Build Plan

**Status:** Authoritative engineering execution plan  
**Version:** 1.0  
**Date:** 4 September 2026  
**Repository:** `PARC-Labs/Applied-State-Site`  
**Primary reader:** Codex / implementation engineer  
**Companion specification:** `docs/APPLIED_STATE_SITE_IMPLEMENTATION_SPEC.md`

---

## 0. Purpose

This document defines how to build Applied State as a sparse public art/science institution with a secure member research layer.

It is not a product brainstorm. It is an implementation contract.

The public identity must remain institutional: `AS01`, `AS02`, `AS03`, programmes, research, films, commissions, residences. The member system exists underneath that public surface as institutional research infrastructure. It must never become the primary visual or conceptual identity of Applied State.

Where this plan conflicts with the current prototype, this plan wins. Where this plan conflicts with the visual/editorial specification, the visual/editorial specification wins unless this plan is explicitly more recent about system behavior, permissions, data, or security.

Normative language in this document uses **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** deliberately.

---

# 1. Product invariants

These are non-negotiable.

1. **Applied State is an institution, not a social network.** The software exists to support research, access, collaboration, and editorial selection.
2. **The public surface remains sparse.** The homepage is primarily an `ASxx` index.
3. **ASxx is authoritative institutional output.** Member-created States do not automatically become Applied State editorial output.
4. **Membership buys access and research utility, not prestige or publishing rights.**
5. **Every active member can create private States.**
6. **Private means private.** A private State MUST NOT be discoverable, searchable, enumerable, or inferable by any member other than its owner and explicitly accepted collaborators.
7. **Collaboration is explicit and scoped per State.** Collaborators gain access only to the State(s) to which they were invited.
8. **Applied State alone controls the shared Index.** A member can submit a State for consideration; only authorized Applied State staff can open it into the Index.
9. **Opening a State changes visibility, not ownership or edit rights.** Index visibility does not grant other members write access.
10. **No likes, reactions, follower counts, popularity scores, leaderboards, engagement ranking, or algorithmic feed.**
11. **No general member chat in v1.**
12. **No comments in v1.**
13. **No member dashboard aesthetic.** Member functionality should read as an extension of the institution, not a SaaS control panel.
14. **Authorization MUST be enforced by Supabase/Postgres RLS and Storage policies, never by client-side hiding.**
15. **No private content may be included in the GitHub Pages static build.**

---

# 2. User and role model

The system distinguishes identity, entitlement, editorial authority, and collaboration.

## 2.1 Actor types

### Anonymous visitor

Can:
- read public Applied State pages;
- read public portions of ASxx;
- read About / Membership;
- request sign-in.

Cannot:
- query member profiles;
- query States;
- query member resources;
- discover private or Index data.

### Authenticated non-member

An authenticated Supabase user with no active membership entitlement.

Can:
- do everything an anonymous visitor can;
- sign out.

Cannot:
- access member AS resources;
- create States;
- query Index States;
- collaborate;
- query member profiles.

**Important:** authentication alone MUST NOT grant membership access.

### Active member

Can:
- access complete member-enriched ASxx material;
- create, edit, and delete own private States;
- connect materials into own States;
- view Index States;
- submit one of their States for editorial review;
- accept collaboration invitations;
- collaborate on States where invitation has been accepted;
- connect visible materials from ASxx or Index States into their own States.

Cannot:
- see another member's private State unless explicitly accepted as a collaborator;
- open their own State into the Index;
- edit an Index State they do not own/collaborate on;
- administer memberships;
- grant themselves editorial/staff status.

### State collaborator

Not a separate account class. An active member with an accepted collaborator record for one State.

Can:
- view that State regardless of private/index visibility;
- add/remove/reorder material in that State according to collaborator role;
- edit State metadata only if collaborator role allows it.

Cannot:
- access owner's other private States;
- invite additional collaborators unless explicitly permitted by role;
- change editorial review status or Index visibility.

### Applied State staff / curator

A protected administrative role.

Can:
- review submitted States;
- approve/open or reject a submitted State;
- close/remove an Index State from the Index without destroying the underlying private State;
- manage member entitlements if authorized;
- manage ASxx member resources;
- perform moderation and security actions.

Staff status MUST NOT be stored in user-editable profile metadata.

### Complimentary/invited member

Same application permissions as an active paid member. Entitlement source differs only administratively.

---

# 3. System architecture

## 3.1 Public application

**Target framework:** Astro static site.  
**Target hosting:** GitHub Pages.  
**Deployment:** GitHub Actions using the official Astro/GitHub Pages deployment path.

The public application MUST be statically generated wherever possible.

Reasons:
- public Applied State content is editorial and version-controlled;
- GitHub Pages is sufficient for the institutional surface;
- the site should have minimal runtime complexity;
- member behavior can be progressively enhanced in the browser against Supabase;
- static public rendering isolates public publishing from member-service outages.

The current Next.js server architecture is transitional and SHOULD be replaced rather than preserved for compatibility.

## 3.2 Backend

Use Supabase for:
- Auth;
- Postgres;
- Row Level Security;
- private Storage;
- optional Edge Functions for privileged/server-only operations.

The browser MAY use the Supabase publishable key. It MUST NEVER receive:
- service-role keys;
- database passwords;
- billing secrets;
- webhook secrets;
- staff-only administrative credentials.

## 3.3 Privileged operations

Direct browser-to-Supabase CRUD is preferred when RLS can express the authorization safely.

Use an Edge Function only where privileged server behavior is required, including:
- collaboration invite by exact email address;
- external billing webhooks;
- provider-side membership synchronization;
- administrative operations that require service-role access;
- future mail delivery or invitation email;
- operations that must resolve `auth.users` data not exposed to clients.

External webhooks MUST verify the provider's signature themselves before using privileged credentials.

## 3.4 Billing

Billing MUST be abstracted from authorization.

Do not write application checks such as `if stripeCustomerActive`.

The application source of truth is an entitlement row in `memberships`.

A future billing provider webhook maps provider state to this entitlement. Manual memberships and complimentary memberships use the same entitlement model.

This lets Applied State choose a payment provider separately from the product/security implementation.

---

# 4. Repository target structure

Codex SHOULD migrate toward:

```text
/
├─ AGENTS.md
├─ astro.config.mjs
├─ package.json
├─ src/
│  ├─ components/
│  │  ├─ as/
│  │  ├─ states/
│  │  └─ member/
│  ├─ content/
│  │  └─ as/
│  │     ├─ as01/
│  │     ├─ as02/
│  │     └─ ...
│  ├─ layouts/
│  ├─ lib/
│  │  ├─ supabase.ts
│  │  ├─ auth.ts
│  │  ├─ states.ts
│  │  └─ types.ts
│  ├─ pages/
│  │  ├─ index.astro
│  │  ├─ as01.astro
│  │  ├─ as02.astro
│  │  ├─ about.astro
│  │  ├─ membership.astro
│  │  ├─ signin.astro
│  │  ├─ index/
│  │  │  └─ index.astro
│  │  └─ states/
│  │     ├─ index.astro
│  │     └─ [id].astro
│  └─ styles/
│     └─ global.css
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/
│  ├─ functions/
│  ├─ seed.sql
│  └─ tests/
│     └─ database/
├─ docs/
│  ├─ APPLIED_STATE_SITE_IMPLEMENTATION_SPEC.md
│  └─ APPLIED_STATE_ENGINEERING_BUILD_PLAN.md
└─ .github/
   └─ workflows/
      ├─ ci.yml
      └─ deploy-pages.yml
```

Exact naming may vary, but the public/editorial/static layer and the Supabase/member layer MUST remain cleanly separated.

---

# 5. Data model

Migrations are the source of truth. Do not configure production schema only through a dashboard.

Use UUID primary keys. Use `timestamptz` for timestamps. Add explicit foreign keys and delete semantics.

## 5.1 `profiles`

Purpose: minimal bibliographic member identity.

Suggested columns:

```text
id uuid PK references auth.users(id) on delete cascade
handle text nullable unique
name text not null
location text nullable
practice text nullable
website_url text nullable
created_at timestamptz not null
updated_at timestamptz not null
```

Rules:
- profile records exist only for members or institutional participants;
- profiles are visible only to active members in v1;
- private email is never exposed through this table;
- no follower counts, avatars, social metrics, badges, or engagement fields.

## 5.2 `memberships`

Purpose: provider-agnostic member entitlement.

Suggested columns:

```text
user_id uuid PK references auth.users(id) on delete cascade
status enum('active','grace','inactive')
source enum('manual','billing','complimentary','invite')
provider text nullable
provider_customer_id text nullable
provider_subscription_id text nullable
starts_at timestamptz not null
access_until timestamptz nullable
created_at timestamptz not null
updated_at timestamptz not null
```

Authorization function `is_active_member()` SHOULD evaluate membership centrally.

Do not duplicate membership checks across every client query.

## 5.3 `staff_roles`

Purpose: protected editorial/admin authority.

```text
user_id uuid
role enum('editor','admin')
created_at timestamptz
created_by uuid
PRIMARY KEY(user_id, role)
```

Rules:
- no client-side insert/update/delete grant;
- only protected administrative paths can modify;
- do not infer staff from profile fields.

## 5.4 `states`

Purpose: member-created research spaces.

Suggested columns:

```text
id uuid PK
owner_id uuid not null references auth.users(id)
title text not null
description text nullable
visibility enum('private','index') not null default 'private'
review_status enum('none','submitted','approved','rejected','withdrawn') not null default 'none'
created_at timestamptz not null
updated_at timestamptz not null
opened_at timestamptz nullable
opened_by uuid nullable references auth.users(id)
```

Important:
- `visibility` and `review_status` are separate concerns;
- a rejected State remains private and editable;
- approval sets visibility to `index` through a privileged editorial action;
- an owner MUST NOT be able to set `visibility='index'` directly;
- closing an Index State SHOULD set visibility back to `private` without deleting it.

## 5.5 `state_collaborators`

Purpose: explicit per-State collaboration.

Suggested columns:

```text
state_id uuid references states(id) on delete cascade
user_id uuid references auth.users(id) on delete cascade
role enum('editor') not null default 'editor'
status enum('pending','accepted','declined','revoked') not null
invited_by uuid not null references auth.users(id)
created_at timestamptz not null
responded_at timestamptz nullable
PRIMARY KEY(state_id, user_id)
```

Rules:
- pending invitation MUST NOT grant State read access;
- accepted invitation grants access only to that State;
- revocation takes effect immediately at the RLS layer;
- only owner can invite/revoke in v1;
- collaborator cannot make the State visible to the Index.

## 5.6 `materials`

Purpose: reusable research object.

Suggested columns:

```text
id uuid PK
created_by uuid not null references auth.users(id)
type enum('url','text','image','file','as_reference') not null
title text nullable
body text nullable
url text nullable
storage_path text nullable
metadata jsonb not null default '{}'
created_at timestamptz not null
updated_at timestamptz not null
```

Rules:
- material is not globally visible merely because its row exists;
- access to material MUST be derived from a visible association, owner access, collaborator access, or AS member-resource authorization;
- do not expose a global material search in v1;
- do not enforce global URL deduplication in v1 because uniqueness errors can leak existence across private research spaces;
- when a user connects an already-visible material from an Index State, reuse the existing `material_id`;
- when users independently add the same URL privately, duplicates are acceptable.

## 5.7 `state_materials`

Purpose: connection between a State and a material.

Suggested columns:

```text
state_id uuid references states(id) on delete cascade
material_id uuid references materials(id) on delete cascade
added_by uuid references auth.users(id)
position numeric or bigint
annotation text nullable
created_at timestamptz not null
PRIMARY KEY(state_id, material_id)
```

`annotation` belongs to the State context and MUST inherit State visibility, not global material visibility.

This table is the primary Are.na-like connection primitive.

## 5.8 `state_links`

Purpose: connect one State into another State.

Suggested columns:

```text
parent_state_id uuid references states(id) on delete cascade
child_state_id uuid references states(id) on delete cascade
added_by uuid references auth.users(id)
position numeric or bigint
created_at timestamptz not null
PRIMARY KEY(parent_state_id, child_state_id)
```

Rules:
- child State must already be visible to the actor at time of connection;
- connecting a private child State into an Index State MUST NOT implicitly publish the child State;
- if the child later becomes inaccessible, the connection must not leak its title or metadata;
- prevent self-links and ideally cyclic pathological nesting in UI; DB can tolerate graph cycles unless they break queries.

## 5.9 `as_member_resources`

Purpose: member-only resources attached to public ASxx pages.

Suggested columns:

```text
id uuid PK
as_id text not null
slot_key text not null
resource_type enum('text','url','file','film','code','reference')
title text nullable
body text nullable
url text nullable
storage_path text nullable
sort_order integer not null
created_at timestamptz not null
updated_at timestamptz not null
UNIQUE(as_id, slot_key, sort_order)
```

Rules:
- only active members can select;
- the public static build contains only the `slot_key`, never private payloads;
- staff controls insert/update/delete.

## 5.10 Optional `audit_log`

Recommended for staff actions and entitlement changes.

Log:
- membership activation/deactivation;
- State approval/rejection/closure;
- collaborator revocation by staff;
- resource deletion/moderation.

Client users MUST NOT be able to forge audit entries.

---

# 6. Authorization model

RLS is a release blocker, not an implementation detail.

Every exposed table MUST have RLS enabled and explicit grants.

Supabase's current guidance is to configure both grants and policies and to test allow/deny cases. Follow that practice.

## 6.1 Helper functions

Create narrow database helper functions such as:

```text
is_active_member(user_id := auth.uid()) -> boolean
is_staff(user_id := auth.uid()) -> boolean
is_state_owner(state_id, user_id := auth.uid()) -> boolean
is_state_collaborator(state_id, user_id := auth.uid()) -> boolean
can_view_state(state_id, user_id := auth.uid()) -> boolean
can_edit_state(state_id, user_id := auth.uid()) -> boolean
can_view_material(material_id, user_id := auth.uid()) -> boolean
```

Security-definer functions, if used, MUST:
- live in a non-exposed schema where appropriate;
- set a safe `search_path` explicitly;
- expose only the minimum boolean/operation required;
- never return hidden row data.

Avoid recursive RLS policies that query the same protected table in a way that causes recursion.

## 6.2 `states` SELECT

Allow only when:

```text
active member AND (
  owner_id = auth.uid()
  OR accepted collaborator exists
  OR visibility = 'index'
)
```

Staff may have separate access.

Anonymous and authenticated non-members get zero rows.

## 6.3 `states` INSERT

Active members can create only rows where:
- `owner_id = auth.uid()`;
- `visibility = 'private'`;
- `review_status = 'none'`.

## 6.4 `states` UPDATE

Owner and accepted collaborators may edit permitted editorial fields.

Client update MUST NOT permit:
- changing `owner_id`;
- changing `opened_by`;
- setting `visibility='index'`;
- setting `review_status='approved'`;
- assigning staff-only data.

If field-level protection cannot be made sufficiently clear with grants/policies, move sensitive transitions to RPC/Edge Function and revoke direct update to those columns.

## 6.5 `state_collaborators`

Read:
- State owner can see collaborator records for that State;
- invitee can see their own invitation;
- accepted collaborators may see accepted collaborator list if product requires it.

Insert:
- only owner, or privileged invite function acting on owner's authenticated request.

Update:
- invitee can accept/decline their own pending invitation;
- owner can revoke.

## 6.6 `materials` and `state_materials`

A user can read material only when at least one authorized path exists:
- they created the material and still have an authorized State association;
- the material is attached to a State they can view;
- it is explicitly exposed as an AS member resource they are entitled to access.

Never implement `authenticated users can select all materials`.

## 6.7 Index behavior

Index visibility means **all active members may read**.

It does NOT mean:
- public-web visibility;
- edit rights;
- ability to enumerate owner's private States;
- ability to enumerate collaborators' private data.

## 6.8 Membership expiry

When a membership becomes inactive:
- member immediately loses Index and member-AS access;
- member loses access to States they collaborated on;
- their own private State data remains retained but inaccessible through normal client policy;
- data deletion/retention policy can be decided later;
- any already-issued signed Storage URL can remain valid until its short expiry, so use short TTLs.

Reactivation restores entitlement subject to normal ownership/collaboration records.

---

# 7. Authentication and onboarding

## 7.1 Authentication

Use passwordless email authentication.

Requirements:
- no passwords in v1;
- no social login;
- no public identity directory;
- sign-in response must not reveal whether an email is a member;
- callback URLs must be allowlisted explicitly;
- use PKCE/current Supabase recommended browser flow where applicable.

## 7.2 Membership provisioning

Do not equate Supabase account creation with membership.

A user may exist in Auth with no entitlement and still receive no member data.

Phase 1 MAY provision members manually.

Future paid flow:
1. visitor chooses membership;
2. billing provider handles payment;
3. verified webhook updates/creates entitlement;
4. member signs in by email;
5. RLS recognizes active entitlement.

Complimentary route:
1. staff creates/activates entitlement with source `complimentary`;
2. user signs in normally.

## 7.3 Member profile creation

On first active-member session, create or request minimal profile data.

Do not force a large onboarding wizard.

Required initially:
- name.

Optional:
- location;
- practice;
- website.

---

# 8. Collaboration invitation flow

This must not leak the member roster.

## 8.1 Invite by known member

If inviting from an already-visible profile, the client can send the target member UUID to the invite endpoint.

## 8.2 Invite by email

Use an authenticated Edge Function:

```text
POST /invite-state-collaborator
{
  state_id,
  email
}
```

Function behavior:
1. validate caller JWT;
2. verify caller owns `state_id`;
3. normalize email;
4. resolve matching eligible member with privileged server access;
5. create pending invite if valid;
6. optionally send transactional email;
7. return generic success regardless of whether the email resolved, unless the caller is using a known visible member identity.

This prevents member-directory enumeration.

## 8.3 Acceptance

Invitee sees pending invitation only after authenticating as the target account.

Accepting writes `status='accepted'`.

RLS access begins only after acceptance.

---

# 9. State lifecycle

Use explicit transitions.

```text
PRIVATE / none
  |
  | owner submits
  v
PRIVATE / submitted
  |              \
  | approve       \ reject
  v                v
INDEX / approved   PRIVATE / rejected
  |
  | staff closes
  v
PRIVATE / approved-or-withdrawn
```

Behavior:
- owner may withdraw a submission before approval;
- owner cannot approve;
- staff approval should be atomic: set review status + visibility + opened metadata in one transaction/RPC;
- staff rejection keeps State private;
- Index closure must not destroy member work;
- owner may continue editing an opened Index State unless Applied State later introduces editorial locking/versioning.

For v1, no public-web State publication.

---

# 10. Material model and interaction grammar

The interaction vocabulary should remain extremely small.

Primary actions:
- `NEW STATE`
- `ADD`
- `CONNECT`
- `INVITE`
- `SUBMIT`
- `REMOVE`

Avoid generic social/product verbs such as Post, Share, Like, Follow, Boost, React.

## 10.1 Adding material

V1 supports:
- URL;
- plain text note;
- image upload;
- file upload only if Storage implementation is complete and secure;
- AS reference.

Consider deferring arbitrary uploads until URL/text workflows are stable.

## 10.2 Connect

`CONNECT` associates an existing visible material with one of the member's editable States.

This is the core network primitive.

Do not copy the object when connecting; create a `state_materials` association.

## 10.3 Nested States

Allow connecting a visible State into another State through `state_links` only after normal material connections are stable.

This is lower priority than material connections and can be Phase 6 if complexity grows.

---

# 11. Index design and behavior

The Index is a curated shared research surface, not a social feed.

V1 should render a simple list of opened States.

Possible default ordering:
- editorially controlled `opened_at DESC`, or
- title alphabetical.

Do not implement engagement ranking.

Index list may show:
- State title;
- owner name;
- one short description if present.

Avoid:
- avatar cards;
- follower counts;
- connection counts as popularity badges;
- timestamps like social media;
- trending/recommended sections.

State detail should foreground material and connections, not profile chrome.

---

# 12. ASxx member enrichment

Public ASxx content remains static in Git/MDX.

Member-only resources are inserted through opaque slots.

Example editorial MDX concept:

```text
<PublicBlock ... />
<MemberSlot key="arena-film-full" />
<PublicBlock ... />
<MemberSlot key="arena-source-index" />
```

At build time, `MemberSlot` contains no private payload.

At runtime:
1. browser determines auth session;
2. query member entitlement;
3. request `as_member_resources` for current `as_id`;
4. RLS returns rows only for active members;
5. render resource in the authored position.

Signed-out user should see either nothing or one restrained generic member marker depending on the editorial design.

Do not disclose private resource titles or filenames to signed-out visitors.

---

# 13. Storage security

Use private buckets for member-only files.

Suggested buckets:

```text
member-resources
state-uploads
```

Rules:
- no public bucket for private material;
- Storage path structure should include owner/state identifiers where helpful;
- RLS policies on `storage.objects` must mirror application authorization;
- active member alone is insufficient for private State uploads: user must be owner/collaborator of the State association;
- short-lived signed URLs may be used for browser media where required;
- use short expiry, e.g. ~5 minutes unless media playback requirements justify longer;
- do not treat signed URLs as revocable access tokens.

V1 upload restrictions SHOULD include:
- file-size cap;
- MIME allowlist;
- no executable content;
- no raw SVG uploads unless sanitized;
- normalize filenames and ignore user filename as authorization input.

---

# 14. Input security and rendering

Member-generated text is untrusted.

Requirements:
- render plain text or sanitized Markdown only;
- no unsanitized raw HTML;
- escape titles/descriptions/annotations;
- external links permit only expected schemes (`https`, optionally `http`);
- use `rel="noopener noreferrer"` for new-tab external links;
- reject `javascript:`, `data:` and other unsafe URL schemes where not explicitly required;
- avoid automatic arbitrary embed HTML from user-provided URLs;
- iframe embeds require an explicit domain allowlist if introduced.

---

# 15. Threat model

Codex MUST design and test against these failures.

## T1 — Static bundle leakage

Threat: private titles, IDs, URLs, filenames, service credentials, or member data become part of GitHub Pages output.

Mitigation:
- private content never enters static source content;
- build artifact leakage test;
- no service-role key in repository/env exposed to Astro client.

## T2 — IDOR / guessed UUID

Threat: member guesses another State/material UUID and reads it.

Mitigation:
- RLS on every read path;
- E2E and pgTAP deny tests.

## T3 — Private State enumeration

Threat: list/search/count endpoint reveals another member has a private State.

Mitigation:
- no global private State query;
- RLS returns zero rows;
- no cross-user uniqueness side channel in v1;
- generic invite responses.

## T4 — Collaborator privilege escalation

Threat: collaborator changes ownership, visibility, editorial status, or invites others.

Mitigation:
- column restrictions / RPC boundaries;
- RLS + grants;
- tests for forbidden updates.

## T5 — Member self-promotes to Index

Threat: client directly updates `visibility` or review approval.

Mitigation:
- client cannot write approval/open fields;
- privileged editorial RPC/function only.

## T6 — Membership bypass

Threat: authenticated but unpaid/inactive account queries Index.

Mitigation:
- central `is_active_member()` used in policy;
- test active, grace, inactive, missing entitlement.

## T7 — Storage URL leakage

Threat: private file becomes accessible indefinitely.

Mitigation:
- private buckets;
- short signed URL TTL;
- authorization required to mint/fetch.

## T8 — XSS / hostile embed

Threat: member note or external link executes script.

Mitigation:
- sanitize/escape;
- no arbitrary HTML;
- restrictive embed handling.

## T9 — Staff role forgery

Threat: member modifies profile metadata to become admin/editor.

Mitigation:
- staff role in protected DB table or server-set app metadata only;
- no client write grant.

## T10 — Webhook forgery

Threat: attacker activates membership by calling webhook endpoint.

Mitigation:
- verify billing provider signature before privileged DB change;
- idempotency/event ID handling;
- log entitlement transitions.

---

# 16. Test strategy

Security tests are mandatory.

## 16.1 Database/RLS tests

Use Supabase local development and pgTAP / `supabase test db`.

Minimum actor fixtures:
- anonymous;
- authenticated non-member;
- active member A;
- active member B;
- active member C;
- owner;
- pending collaborator;
- accepted collaborator;
- inactive former member;
- staff editor.

Minimum test matrix:

| Operation | Anonymous | Non-member | Owner | Other member | Accepted collaborator | Staff |
|---|---:|---:|---:|---:|---:|---:|
| read private State | deny | deny | allow | deny | allow | policy-defined |
| read Index State | deny | deny | allow | allow | allow | allow |
| create private State | deny | deny | allow | allow-own | allow-own | allow-own |
| set State to Index | deny | deny | deny | deny | deny | allow |
| edit private State | deny | deny | allow | deny | allow-limited | policy-defined |
| read private material | deny | deny | allow-path | deny | allow-path | policy-defined |
| invite collaborator | deny | deny | allow | deny | deny | policy-defined |

Also test:
- pending collaborator cannot view;
- revoked collaborator immediately cannot view;
- inactive owner cannot query data through normal client role;
- Index State does not expose owner's other States;
- connected private child State remains hidden;
- changing `owner_id` fails;
- changing `visibility` to Index fails for owner;
- material with same URL in unrelated private State is not discoverable.

## 16.2 Application tests

Use unit tests for pure logic and Playwright for critical flows.

Critical E2E:
1. public homepage loads without Supabase available;
2. public AS01 loads without auth;
3. inactive signed-in user receives no member enrichment;
4. active member sees AS member resource;
5. member creates private State;
6. member B cannot open member A private State URL directly;
7. owner invites member B;
8. B cannot access before accepting;
9. B can access after accepting;
10. B still cannot see owner's other private State;
11. owner submits State;
12. owner cannot self-approve via client;
13. editor approves;
14. all active members can now read State;
15. unrelated members still cannot edit State;
16. membership deactivation removes Index access.

## 16.3 Build leakage test

After Astro build, CI MUST scan `dist/` for:
- known private fixture titles;
- known private fixture URLs;
- service-role key patterns;
- test member emails;
- private storage paths.

Build fails on match.

---

# 17. CI/CD

`ci.yml` SHOULD run on pull request and push to main:

1. install from committed lockfile;
2. format check;
3. lint;
4. TypeScript check;
5. unit tests;
6. Astro production build;
7. static leakage scan;
8. Supabase migration validation;
9. database/RLS tests using local Supabase where CI resources permit;
10. E2E smoke tests for critical public and auth-gated flows.

Production Pages deployment MUST run only after CI succeeds on `main`.

Commit the package lockfile.

Do not deploy from a developer's local machine as the normal workflow.

---

# 18. Environments

Use separate environments.

Minimum:
- local development;
- production.

Preferred:
- local;
- shared development/staging Supabase project;
- production Supabase project.

Rules:
- local tests MUST NOT point at production database;
- production service secrets live only in Supabase/GitHub secret stores where needed;
- public Supabase URL/publishable key are environment-specific;
- production migrations are applied from version-controlled migration files;
- use seed fixtures only in local/dev.

---

# 19. Observability and auditability

At minimum:
- structured logs in Edge Functions;
- log webhook event IDs and outcomes;
- log privileged State review transitions;
- log membership entitlement changes;
- never log auth tokens, magic-link tokens, service keys, or full private file URLs unnecessarily.

Add error boundaries/fallback UI so public AS pages remain usable when Supabase is unavailable.

The public institution MUST degrade gracefully; member enhancements may fail closed.

---

# 20. Performance constraints

Public site:
- static HTML first;
- minimal JavaScript;
- no app-wide SPA hydration;
- hydrate member controls only where required;
- avoid large client frameworks for static AS pages;
- no third-party analytics in v1 unless explicitly approved.

Member pages:
- paginate materials if States become large;
- avoid N+1 queries;
- fetch State + connections using bounded queries/RPC when necessary;
- indexes on foreign keys used by RLS joins are required (`owner_id`, collaborator state/user, state_materials keys, membership user/status).

RLS performance should be tested with representative data before large scale, but correctness wins over premature optimization.

---

# 21. Accessibility

Minimum release standard:
- semantic headings;
- keyboard-operable controls;
- visible focus treatment;
- sufficient black/white contrast;
- form labels even if visually minimal;
- status messages announced appropriately;
- images require editorial alt text or deliberate empty alt for decorative images;
- no interaction depends on hover only.

Minimalism does not justify poor accessibility.

---

# 22. Implementation phases

Codex MUST implement in phases and keep each phase shippable/testable.

## Phase 0 — Preserve and prepare

Tasks:
- inspect current repository;
- tag or branch current Next prototype for recovery;
- replace architecture only after preserving history;
- install Astro;
- commit lockfile;
- establish CI baseline;
- keep existing engineering/spec docs.

Exit criteria:
- clean Astro build on CI;
- no member functionality yet;
- public shell deployable.

## Phase 1 — Public institutional surface

Tasks:
- implement sparse homepage index;
- implement ASxx route/content system;
- implement AS01 capability with authored vertical sequence;
- About / Membership / Sign In routes;
- responsive typography and spacing per design spec;
- GitHub Pages deployment.

Exit criteria:
- public site visually matches institutional specification;
- no member data bundled;
- Pages deployment works.

## Phase 2 — Supabase foundation and membership entitlement

Tasks:
- initialize Supabase directory;
- migrations for profiles, memberships, staff roles;
- RLS/grants;
- passwordless auth;
- session handling in static/browser architecture;
- active-member helper;
- manual membership provisioning for development;
- RLS tests.

Exit criteria:
- authenticated non-member cannot read member data;
- active member can read own minimal profile/member state;
- security tests pass.

## Phase 3 — AS member enrichment

Tasks:
- `as_member_resources` schema;
- Storage policies for member resources;
- member-slot runtime;
- signed/authenticated private file delivery;
- staff resource management method (manual DB/admin path acceptable initially);
- leakage tests.

Exit criteria:
- public AS01 contains no private payload in HTML/JS;
- active member sees resource in authored slot;
- inactive user does not.

## Phase 4 — Private States MVP

Tasks:
- states/materials/state_materials migrations;
- full RLS/grants;
- My States index;
- State create/edit/delete;
- add URL and text material;
- CONNECT existing visible material into own State;
- minimal profile attribution;
- RLS + E2E tests.

Exit criteria:
- two active members cannot access one another's private States;
- owner CRUD works;
- materials do not leak globally.

## Phase 5 — Collaboration

Tasks:
- collaborator table;
- invite/accept/revoke flows;
- email invite Edge Function if needed;
- exact permission enforcement;
- invitation enumeration protections;
- tests.

Exit criteria:
- pending invite grants no access;
- accepted invite grants access only to that State;
- revoked invite removes access immediately;
- collaborator cannot change owner/Index status.

## Phase 6 — Curated Index

Tasks:
- submission transition;
- staff review operation/RPC;
- Index route;
- opened State display;
- editorial close/reject flow;
- optional State-to-State links if stable;
- staff audit entries.

Exit criteria:
- owner cannot self-open State;
- editor can approve atomically;
- every active member can read approved State;
- no unrelated member can edit;
- private States remain invisible.

## Phase 7 — Billing automation

Only after payment provider is chosen.

Tasks:
- checkout/subscription flow;
- signed webhook Edge Function;
- idempotent entitlement synchronization;
- cancellation/grace logic;
- complimentary/manual paths preserved;
- tests with provider sandbox.

Exit criteria:
- billing state maps cleanly to membership entitlement;
- forged webhook cannot activate membership;
- cancellation removes access according to documented grace policy.

## Phase 8 — Hardening and release

Tasks:
- full threat-model review;
- RLS policy audit;
- dependency audit;
- accessibility pass;
- performance pass;
- backup/restore documentation;
- production Supabase configuration review;
- production domain/auth redirect review;
- incident/rollback notes.

Exit criteria:
- all security and leakage tests green;
- no service secrets in repository or static artifact;
- public site remains usable if Supabase is unavailable;
- operational handoff complete.

---

# 23. Explicit non-goals for v1

Do NOT implement unless user explicitly changes scope:
- comments;
- chat;
- direct messages;
- follower/following system;
- likes/reactions;
- algorithmic recommendations;
- popularity metrics;
- public member directory;
- social activity feed;
- badges/gamification;
- tiered member plans;
- public State publication;
- mobile apps;
- browser extension;
- full Are.na feature parity;
- arbitrary HTML embeds;
- complex moderation automation;
- CMS for public ASxx content.

---

# 24. Engineering decisions / ADR summary

| Decision | Status | Reason |
|---|---|---|
| Astro static public site | Accepted | Fits GitHub Pages and sparse editorial surface |
| GitHub Pages hosting | Accepted | Public site is static; low operational burden |
| Supabase Auth/Postgres/Storage | Accepted | Browser-capable auth + RLS + private assets |
| RLS as authorization source | Accepted | Static host has no trusted application server |
| Active membership separate from Auth | Accepted | Prevents account creation from granting access |
| All active members may create private States | Accepted | Creates persistent research utility |
| Private by default | Accepted | Research trust / non-social character |
| Explicit collaborator invitation | Accepted | Scoped access only |
| Curated Index controlled by staff | Accepted | Preserves institutional authority |
| No social metrics/feed/chat | Accepted | Avoid platform/social-network drift |
| Billing provider abstracted | Accepted | Authorization should not depend on processor |
| Public State publishing | Deferred | Not required for v1 |
| State-to-State nesting | Deferred/Phase 6 | Useful but not needed for private States MVP |
| File uploads | Deferred until Storage hardening | URL/text gives lower-risk MVP |

---

# 25. Codex execution protocol

Codex must follow these rules when implementing:

1. Read `AGENTS.md`, this document, and `APPLIED_STATE_SITE_IMPLEMENTATION_SPEC.md` before editing.
2. Do not silently reinterpret product permissions.
3. Work phase-by-phase. Do not implement later-phase social/product ideas opportunistically.
4. Prefer migrations and tests before UI for security-sensitive features.
5. Every RLS policy change requires allow + deny tests.
6. Never solve an authorization problem only in client code.
7. Never place member-only content in Astro content files or public assets.
8. Do not use service-role credentials in client/runtime bundle.
9. Keep the interface visually subordinate to the institutional material.
10. If a design decision is ambiguous, choose less UI.
11. If a security decision is ambiguous, fail closed.
12. If a requested feature conflicts with institutional invariants, stop and flag the conflict rather than quietly implementing a social-platform pattern.
13. Keep commits focused and descriptive.
14. Run required CI/test commands before handoff.
15. Update this plan or add an ADR when architecture/permission decisions materially change.

---

# 26. Definition of done for the first complete product

Applied State v1 is complete when:

- the public GitHub Pages site presents the sparse AS index and AS01 correctly;
- member authentication works without public roster leakage;
- membership entitlement is independent from Auth identity;
- active members receive member-only AS resources securely;
- active members can create private States;
- no member can discover another member's private State without explicit collaboration;
- owners can explicitly invite collaborators;
- collaborators gain access only after accepting;
- Applied State staff can approve a submitted State into the Index;
- Index States are readable by active members but writable only by owner/collaborators;
- no likes, follower counts, social feed, comments, or chat exist;
- all exposed tables/storage paths are protected by tested RLS/policies;
- private fixture data is absent from the static build;
- production deployment is CI-driven;
- public content remains readable if member backend fails;
- the software feels like institutional research equipment, not a social platform.

---

# 27. Reference implementation guidance

Current external implementation guidance that should inform, not override, this plan:

- Astro supports prerendered static deployment to GitHub Pages through GitHub Actions.
- Supabase requires RLS plus correct Postgres grants for exposed tables; policies should be tested with allow/deny cases.
- Supabase Auth supports one-time passwordless Magic Links and can disable automatic user creation where appropriate.
- Supabase private Storage can be served through authenticated requests or short-lived signed URLs; signed URLs remain valid until their expiry, so use short TTLs for revocable membership contexts.
- Supabase Edge Functions are appropriate for signed external webhooks and privileged operations; webhook signature verification remains the function's responsibility when JWT verification is disabled for external providers.

This document is the normative Applied State interpretation of those platform capabilities.
