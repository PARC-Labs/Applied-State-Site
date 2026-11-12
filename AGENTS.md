# Applied State — repository instructions

Applied State is an independent art and research institution. This repository publishes its public institutional record and numbered ASxx instances; it is not a member workspace.

Read README.md, docs/OPERATIONS.md, docs/ARENA_AUTHORING.md, and docs/INSTITUTION_BASE_BOUNDARY.md before modifying the site. The older membership/States engineering specifications are preserved under docs/archive/ for historical reference only and must not be treated as current requirements.

Rules:

1. Keep the interface typographic, restrained and editorial; preserve the deliberate minimalism of the homepage and ASxx pages.
2. Preserve institutional authorship, citations, numbered publications and research material; do not invent editorial contents.
3. Do not reintroduce member States, an Index, account login, membership applications, subscriptions, member slots or generic social-network functions. The independent PARC-Labs/Base repository owns the research-Space platform.
4. Residency and programme participation belong to Applied State but require independent, purpose-specific applications, selection, privacy, consent and operational processes. Do not repurpose the retired membership-admission tables.
5. Are.na may be used as a **public editorial authoring source**. Working channels remain private and are never linked into the public rendering path.
6. Never place secret keys, private member objects, unpublished research, emails or privileged tokens in public assets, GitHub commits or the Pages build.
7. Preserve the historical Supabase database migrations, tests and Edge Function until inventory, retention/export and decommission decisions are completed. Do not delete production data as part of a website change.
8. Run npm run verify before publishing the website. Preserve the CI-gated GitHub Pages deployment sequence. Legacy database security checks are required when modifying the preserved Supabase source, not for public editorial site releases.
