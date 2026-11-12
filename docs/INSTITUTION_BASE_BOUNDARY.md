# Institutional boundary — Applied State and Base

Decision: 12 November 2026.

## Applied State

An independent art/research institution. It commissions, develops and publishes numbered ASxx studies, organizes research programmes, experiments and potential residencies, and selects collaborators or fellows for specific work. Its website is a public institutional record, not an account portal. Any future residency application requires a specific programme, scope, selection policy and privacy workflow.

## Base

A separate research-Space platform in [PARC-Labs/Base](https://github.com/PARC-Labs/Base). Base owns workspace accounts, private and published Spaces, materials, connected Spaces, collaboration, releases and its own early-access/admission process. Base participation does not confer standing in Applied State; Applied State participation does not automatically confer Base membership.

Applied State may use Base for selected project work, but any integration should be an explicit project-level link with independent access and consent. Do not duplicate Base authentication, workspaces or generalized paid membership in Applied State.

## What was removed from the public website

- Paid/curated membership page and applications;
- Sign-in and session UI;
- Private States, collaboration and member Index routes;
- Staff review interfaces for member applications and private States;
- AS01 member-only slots and access note;
- Public-build configuration of the former Supabase browser client.

AS01–AS03 content, the public Are.na channel integration, and the minimal institutional identity remain.

## Data safety and decommission gate

The former Supabase database is not a migration source for Base. Never automatically copy member emails, profiles, private States, research assets, application statements or staff notes into Base. A lawful and authorized transfer requires a separate migration plan and appropriate user notices/consent.

No production rows, Auth identities, Storage objects, Edge Functions or database schemas are deleted by this website refactor. Before retiring backend resources, an authorized operator must:

1. Identify the production project, all active users, application records, private States, collaborations, member assets and integration credentials.
2. Confirm the legal and operational retention requirements, including outstanding access or deletion requests.
3. Export and verify backups of records and private Storage objects under appropriate access controls.
4. Plan how any existing users are notified and how open sessions, service keys, Edge Functions and direct API access will be revoked.
5. Decommission only after an explicit review of verified production inventory; use forward-only database migrations where needed, never edit applied migration history.

The site retirement is complete when the public pages and build checks are live; backend decommission is a distinct operation and is not implied by removing the UI.
