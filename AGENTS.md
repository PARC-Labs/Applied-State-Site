# Applied State — Codex instructions

Before modifying this repository, read and follow, in order:

1. `docs/APPLIED_STATE_ENGINEERING_BUILD_PLAN.md`
2. `docs/APPLIED_STATE_SITE_IMPLEMENTATION_SPEC.md`

The engineering build plan is authoritative for system behavior, data model, permissions, security boundaries, architecture, implementation phases, and test requirements.

The site implementation specification is authoritative for institutional identity, editorial behavior, visual language, information architecture, and interface restraint.

If the documents overlap, use the more recent engineering plan for membership/States/security behavior and the site specification for visual/editorial behavior. If a real contradiction remains, do not invent a resolution: flag it.

Priority rules:

1. Applied State is an art/science institution. Do not turn it into a social network, creator platform, SaaS dashboard, or generic membership community.
2. Do not preserve the current Next.js architecture merely because it exists. The target Astro + GitHub Pages + Supabase architecture is intentional.
3. Choose restraint over additional UI. Do not add cards, dashboards, gradients, rounded components, decorative icons, marketing sections, social feeds, engagement mechanics, or animation unless explicitly requested.
4. Do not invent Applied State editorial content.
5. Every active member may create private States. Private States must be genuinely invisible to other members except explicitly accepted collaborators.
6. Collaboration is explicit and scoped per State. Pending invitations grant no access.
7. Only authorized Applied State staff may open a submitted State into the shared Index. Members cannot self-publish into the Index.
8. Public content may be static; all member authorization must be enforced by Supabase RLS/private Storage, never by client-side hiding.
9. No secret/service-role credentials, private State content, member-only resource payloads, or private member metadata may enter the GitHub Pages static build.
10. Public AS pages must remain usable if authentication/member services fail; member enhancements fail closed.
11. Every RLS or permission change requires allow and deny tests. Treat the security test matrix in the engineering plan as release-blocking.
12. Build phase-by-phase. Do not opportunistically implement deferred features such as comments, chat, feeds, followers, likes, public member directories, or public States.
13. Before handoff, run the build/type/lint/tests and complete the security/leakage verification described in the engineering plan.

If a requested implementation choice conflicts with these invariants, stop and surface the conflict rather than silently changing the product model.
