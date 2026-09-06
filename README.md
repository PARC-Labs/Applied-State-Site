# Applied State Site

Applied State is a sparse public art/research institution with a private member research layer. Astro generates the public editorial record as static HTML for GitHub Pages. Supabase provides passwordless identity, membership entitlements, private resources, States, collaboration, and the staff-curated Index.

The system and permission contract is [`docs/APPLIED_STATE_ENGINEERING_BUILD_PLAN.md`](docs/APPLIED_STATE_ENGINEERING_BUILD_PLAN.md). The visual and editorial contract is [`docs/APPLIED_STATE_SITE_IMPLEMENTATION_SPEC.md`](docs/APPLIED_STATE_SITE_IMPLEMENTATION_SPEC.md). Production setup, release gates, recovery, and incident response live in [`docs/OPERATIONS.md`](docs/OPERATIONS.md). Phase status is tracked separately in [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md); the presence of code is not proof that a phase has passed its exit criteria.

## Architecture

- `src/content/instances/` is the public, version-controlled `ASxx` editorial record.
- `src/pages/` produces the public institutional pages and private member-page shells.
- `src/components/states/`, `src/components/MemberSlot.astro`, and `src/scripts/` progressively enrich only the pages that need member behavior.
- `supabase/migrations/` is the source of truth for database types, tables, grants, RLS policies, private Storage, and protected operations.
- `supabase/functions/` contains privileged server-side behavior such as collaborator invitation by email.
- `supabase/tests/` contains the pgTAP allow/deny matrix that protects private States.

The public routes are `/`, `/as01/`, `/as02/`, `/as03/`, `/about/`, `/membership/`, and `/signin/`. Member-only surfaces use static shells at `/states/`, `/states/view/?id=…`, `/index/`, `/index/view/?id=…`, and `/index/review/`. A URL is not an authorization boundary: Supabase RLS decides which rows the browser can retrieve.

## Local development

Requirements:

- Node.js 22.12–25 and npm;
- Supabase CLI plus Docker for local migrations and database security tests.

Install from the committed lockfile, copy the example environment, and start Astro:

```bash
npm ci
cp .env.example .env
npm run dev
```

`PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` are optional for public-only local work. Without both, the public site still renders and member features fail closed with plain unavailable states. With both, use only a Supabase publishable key (or legacy `anon` key). Never place a secret/service-role key, database password, private URL, or privileged token in a `PUBLIC_*` value.

Local Pages-equivalent paths can be checked with:

```bash
SITE_URL=https://parc-labs.github.io BASE_PATH=/Applied-State-Site npm run build
npm run test:leakage
```

On PowerShell, set those environment values using the normal PowerShell environment-variable syntax before running the same commands.

## Supabase setup

Start a disposable local database, apply every migration, lint the resulting schema, and run the pgTAP authorization suite:

```bash
supabase db start
supabase db lint --local --level warning --fail-on warning
supabase test db
supabase stop --no-backup
```

These checks require a working Docker engine. Supabase CLI and Docker are not available in the current local build environment, so a local application-only pass must not be treated as proof that RLS is correct. Both GitHub workflows start a clean local database and make the migration/lint/pgTAP job a release gate.

For production, use a separate Supabase project and apply the versioned migrations through the CLI after reviewing the pending change. Do not reproduce schema or policies manually in the dashboard. Then:

1. keep public Auth sign-up disabled;
2. allowlist only the production and approved local `/signin/` redirect URLs;
3. provision Auth users and membership entitlements through trusted administrative paths;
4. deploy the collaborator-invite Edge Function;
5. keep private member objects in the non-public `member-assets` bucket;
6. configure SMTP and conservative Auth rate limits. Keep Auth CAPTCHA disabled until a tested CAPTCHA token flow is added to the sign-in form; enabling it now prevents magic-link requests from succeeding.

The browser intentionally uses `shouldCreateUser: false`. Authentication alone never grants membership; the central membership entitlement and RLS policies grant or deny access.

## Editorial content and member resources

Each valid `ASxx` entry in `src/content/instances/` becomes an index item and a static route. Its MDX body owns the authored vertical sequence. Do not put private labels, titles, URLs, filenames, captions, identities, or payloads in MDX or `public/`.

A `MemberSlot` contains only an opaque key such as `as01-film-001`. Authorized resources are fetched from `as_member_resources` at runtime. Private Storage objects are fetched only after RLS authorization and, where needed, exposed with short-lived signed URLs. Signed URLs remain usable until expiry and are access control, not DRM.

Member-authored text is rendered as text, not arbitrary HTML. External links are restricted to safe schemes. States are private by default; pending invitations grant no access; only accepted collaborators gain access to the specific State; only protected staff operations can open a submitted State into the shared member Index. The Index is not public-web publication.

## Verification

Run the application checks with:

```bash
npm run verify
```

That command runs Astro/TypeScript checks, unit tests, the production build, and the public-artifact leakage scan. The leakage scan verifies:

- every required public and member-shell route exists;
- known private fixture values, private Storage paths, member emails, secret keys, privileged JWTs, and credentialed URLs are absent from `dist/`;
- the homepage contains one semantic `APPLIED STATE` heading and no client JavaScript;
- AS01 contains only the approved opaque member slots, while AS02 and AS03 ship no member runtime;
- sign-in and member forms contain no prepopulated or named controls that could serialize private values into a static GET URL;
- member workspaces fail closed, ship hidden, contain no record identifiers, and contain no pre-rendered database data.

Database security is a separate mandatory gate:

```bash
supabase db start
supabase db lint --local --level warning --fail-on warning
supabase test db
```

The test matrix must prove both allowed and denied behavior for anonymous visitors, authenticated non-members, active/inactive members, owners, unrelated members, pending/accepted/revoked collaborators, and staff. Do not waive the database job when Docker is unavailable locally; wait for its GitHub check.

## Deployment

Production deploys from `main` through GitHub Actions:

1. In repository settings, choose **Pages → Build and deployment → GitHub Actions**.
2. To activate member functions, add both repository variables named `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. They are browser-visible by design; never substitute a secret/service-role key. Omit both for a public-only deployment that fails closed; never configure only one.
3. Keep the workflow's `SITE_URL` and `BASE_PATH` aligned with the Pages address (`https://parc-labs.github.io/Applied-State-Site/`) until a verified custom domain replaces it.
4. Push or merge to `main`.

`.github/workflows/ci.yml` runs application and database gates. Only a successful `CI` run on `main` starts `.github/workflows/pages.yml`; the Pages workflow checks out that exact commit, repeats the application and database security gates, and deploys only when both pass. It warns and produces a public-only build when both Supabase variables are absent. The workflow rejects placeholder or partial repository values, and the prebuild validator rejects partial or unsafe configuration. Manual Pages runs are restricted to `main` and run the same gates.

The workflows validate local migrations but do not mutate the production Supabase project. Production migrations and Edge Function deployment remain deliberate operator actions documented in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Security notes

- A Supabase publishable key is expected in browser code. Security comes from explicit grants, RLS, private Storage policies, and tested protected operations.
- The sign-in interface uses generic responses, but a determined observer can inspect the direct Supabase Auth request and may still probe account existence through upstream behavior, timing, or rate-limit differences. Use rate limits, disabled public sign-up, monitoring, and custom SMTP. CAPTCHA requires a future client token integration before it can be enabled. Strict account-existence concealment would require routing magic-link requests through a rate-limited server/Edge Function that always returns an indistinguishable response.
- GitHub Pages makes every committed public asset and every `dist/` file public. Search-engine directives do not make member content private.
- GitHub Pages offers limited control over response security headers. Keep the public runtime small and free of untrusted HTML and third-party script dependencies; add a controlled edge layer or change hosting only if stricter headers become a demonstrated requirement.
- Public links to public GitHub repositories control discovery only. Put genuinely restricted source packages in private Storage or provision access to a private repository separately.
- Billing is deliberately deferred and must map into provider-agnostic membership entitlements. GitHub Pages must never handle payment credentials or webhooks.
