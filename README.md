# Applied State

Applied State is an independent, distributed art and research institution. The website at https://appliedstate.xyz is a sparse public institutional record: its numbered publications and research instances, currently AS01, AS02 and AS03, and a short institutional description.

## Architecture

Astro + MDX produces static HTML for GitHub Pages. `src/content/instances/` is the version-controlled editorial record; `src/pages/[instance].astro` publishes ASxx pages. Optional, publicly readable Are.na channels can contribute curated research blocks through the anonymous Are.na V3 API. No account, paid membership, private workspace, member Index or member-specific resource is offered through this site.

The independent [Base](https://github.com/PARC-Labs/Base) project operates the research-Space platform, identity, collaboration and separate invitation/early-access process. Applied State can use Base as external research infrastructure without making its institutional participants Base members by default. Programme applicants, invited researchers and fellows are institutional relationships distinct from Base accounts.

For the product boundary and migration record, see [docs/INSTITUTION_BASE_BOUNDARY.md](docs/INSTITUTION_BASE_BOUNDARY.md). For Are.na publication, see [docs/ARENA_AUTHORING.md](docs/ARENA_AUTHORING.md).

## Development and verification

Node.js 22.12–25 and npm are required.

```sh
npm ci
npm run dev
npm run verify
```

The site builds without Supabase credentials. `SITE_URL` and `BASE_PATH` support local and Pages builds. Do not configure `PUBLIC_SUPABASE_*` variables in the static build: those belong to the retired member site. `npm run verify` performs Astro/TypeScript checks, unit tests, a production build and a public-artifact leakage check.

## Publication

Each non-draft entry in `src/content/instances/` becomes an ASxx route. The MDX body controls the intentional editorial sequence. An optional `arenaChannel` frontmatter URL identifies a **Public** or **Closed** Are.na channel, never a Private one. Content is rendered as plain text, safe image/link previews and citations; embedded HTML is not executed. Public pages remain legible when Are.na is unavailable.

Current public routes: `/`, `/as01/`, `/as02/`, `/as03/`, `/about/`, and a static 404. No general membership or login routes remain.

## Deployment

CI runs application verification and the preserved legacy database migration/RLS tests. A successful main-branch CI run triggers the GitHub Pages workflow and repeats the verification before deployment. Set Pages' custom domain to `appliedstate.xyz` and require HTTPS. Production member-service variables are not needed or injected by Pages.

## Legacy infrastructure retention

The repository still contains historical Supabase migration history, RLS tests and an Edge Function from the original member architecture. They are **not used by the published site**. Keep them intact until a production-data inventory, access review, export/retention decision and backend decommission have been completed. Removing a browser login route does not revoke credentials or automatically disable an existing Supabase API.

The retired engineering and admission documents are preserved under `docs/archive/` as historical specifications, not instructions to recreate the old product. See [docs/OPERATIONS.md](docs/OPERATIONS.md) for the release and retirement gates.
