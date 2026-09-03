# Applied State — Codex instructions

Before modifying this repository, read and follow:

`docs/APPLIED_STATE_SITE_IMPLEMENTATION_SPEC.md`

That document is the authoritative product, editorial, visual, security, architecture, and implementation specification for the site.

Priority rules:

1. Do not preserve the current Next.js architecture merely because it exists. The target architecture in the specification is intentional.
2. Choose restraint over additional UI. Do not add cards, dashboards, gradients, rounded components, decorative icons, marketing sections, or animation unless explicitly requested.
3. Do not invent Applied State editorial content.
4. Public content may be static; member authorization must be enforced by Supabase RLS/private Storage, never by client-side hiding.
5. No secret/service-role credentials or private member metadata may enter the public repository build.
6. The public site must remain usable if authentication/member services fail.
7. Before handoff, run the build/type checks and complete the security/leakage verification described in the specification.

If an implementation choice conflicts with the specification, the specification wins unless the user explicitly changes the brief.