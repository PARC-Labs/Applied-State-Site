# Applied State — operations (institution-only)

The website is Astro + GitHub Pages static publication. No Supabase authentication, private State or membership functionality is served in the current public build.

## Release

Run `npm ci` and `npm run verify`. The site CI verifies Astro/TypeScript, unit tests, build and leakage checks. A successful main-branch site CI run triggers Pages, which repeats only the static-site checks. The old Supabase migrations, lint and pgTAP authorization suite run in a separate workflow when files under `supabase/` change or on explicit manual dispatch. This avoids coupling institutional publication to an unused member backend while maintaining migration security checks for backend source changes. The public domain is https://appliedstate.xyz with HTTPS required.

The production Pages workflow must not inject `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, or any other public client credentials. Build configuration is limited to `SITE_URL` and `BASE_PATH`. Do not place private materials, member identities, or unpublished drafts into public MDX, `public/`, or GitHub logs.

## Editorial operations

ASxx entries in `src/content/instances/` are editorially reviewed before publication. Public/Closed Are.na channels may supplement specific instances; private working channels must not be embedded. Check public instance pages, page metadata, the homepage, About and the 404 after deployment.

## Preserved backend retirement hold

Old Supabase migrations, functions, private Storage and test fixtures remain as historical source. The published website no longer calls them, but the production Supabase project may still have active Auth/API/function endpoints. Do not treat absence of a website sign-in form as access revocation.

Before any backend deletion or deactivation, inventory production users, entitlements, member resources, private States, application data, collaborator permissions and Storage, and verify protected backups. Establish an explicit retention and notification plan; rotate or revoke access credentials and deployed functions as appropriate. Never delete production records on assumption that none exist. Any migration should be separately reviewed and forward-only. See `docs/INSTITUTION_BASE_BOUNDARY.md`.

## Rollback

Rollback the site by reverting the affected main-branch commit and letting the verified Pages process redeploy. Database migrations and private Storage remain untouched by this website refactor; they require a separately reviewed recovery or decommission procedure.
