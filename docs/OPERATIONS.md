# Applied State — Operations

This runbook covers the production handoff for the Astro + GitHub Pages +
Supabase architecture. It does not replace the engineering plan. Production is
ready only when the release gates below pass against the exact commit being
deployed.

## Environment boundaries

Keep local development and production in separate Supabase projects. Never run
local fixtures or authorization tests against production.

GitHub Pages receives only these browser-safe repository variables:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SITE_URL` and `BASE_PATH`, as defined by the Pages workflow

Never create a `PUBLIC_*` variable containing a Supabase secret/service key,
database password, access token, SMTP credential, or private file URL. Supabase
Edge Functions receive their server credentials from the project environment;
they are not copied into GitHub Actions or the static application.

## First production setup

1. Create the production Supabase project and record its project reference in
   the private operations vault.
2. Link the Supabase CLI to that project.
3. Review pending migrations with `supabase db push --dry-run`.
4. Apply the versioned migrations with `supabase db push`.
5. Deploy `invite-state-collaborator` with `supabase functions deploy`.
   If the public site moves away from its GitHub Pages origin, set the
   function's comma-separated `ALLOWED_ORIGINS` secret to the exact production
   origin and any explicitly approved development origins.
6. In Supabase Auth, keep public sign-up disabled and configure the production
   site URL plus the exact `/signin/` callback URL. Do not use wildcard callback
   hosts in production.
7. Configure a custom SMTP provider and conservative Auth rate limits.
   Keep Auth CAPTCHA disabled for this version: the sign-in form does not yet
   obtain or submit a CAPTCHA token. Enable it only after implementing and testing
   that token flow. The browser deliberately returns
   a generic magic-link response, but the upstream Auth endpoint can still be
   probed directly.
8. Add only the public Supabase URL and publishable key to GitHub repository
   variables.
9. In GitHub repository settings, set Pages → Build and deployment → Source to
   **GitHub Actions**.
10. Run the release gates, then deploy the verified commit from `main`.

Reference: [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations),
[Edge Function deployment](https://supabase.com/docs/guides/functions/deploy),
[Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits), and
[CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha).

## Release gates

Run locally where possible:

```text
npm ci
npm run verify
supabase db start
supabase db lint --local --level warning --fail-on warning
supabase test db
supabase stop --no-backup
```

The database commands require Docker. If they cannot run on the release
workstation, the GitHub checks must run them successfully before deployment.
Do not waive the database/RLS job: its allow and deny matrix is the security
boundary for private States.

Before promoting production, confirm:

- the exact commit passed type, unit, build, leakage, migration, and RLS checks;
- anonymous and authenticated non-members see no member data;
- two active test members cannot discover one another's private State UUIDs;
- pending and revoked collaborators have no access;
- an accepted collaborator can edit only the invited State and cannot change
  owner or Index workflow fields;
- only staff can approve, reject, or close an Index submission;
- inactive and expired memberships fail closed;
- the public homepage and AS pages still work with Supabase unavailable;
- the built `dist/` contains no member fixture, private path, email, or privileged
  credential.

## Provisioning and removal

Create or invite the Auth user through a trusted administrative path, then call
the service-only `provision_membership` database function. Grant staff roles
only through the service-only `provision_staff_role` function. Never edit a JWT
claim or expose a browser control that can grant membership or staff authority.

To remove access, set the membership to `inactive` (or an elapsed
`access_until`) and revoke any collaborator rows. Authorization is evaluated by
RLS on every read/write, so a stale browser session does not preserve member
access. Review the audit log after entitlement or staff-role changes.

## Monitoring and incident response

Review Supabase Auth, API, Storage, Postgres, and Edge Function logs. Function
logs may include event names, State IDs, outcomes, and internal error codes; they
must not include bearer tokens, magic-link tokens, email addresses, service
keys, request authorization headers, or signed Storage URLs.

For a suspected privacy incident:

1. Disable the affected function or member surface and set relevant memberships
   inactive.
2. Revoke exposed keys and active sessions; rotate project credentials as
   required.
3. Preserve logs and note the affected commit, time window, actors, State IDs,
   and policy/function versions without copying private material into tickets.
4. Reproduce with the local RLS matrix and add a failing deny test.
5. Ship a forward migration or application fix; do not rewrite an already
   applied migration.
6. Re-run every release gate before restoring access.

## Backup and recovery

Confirm the project's backup retention and, if required, enable point-in-time
recovery. Supabase database backups cover database records and Storage metadata,
but not the actual Storage objects. Maintain a separate encrypted export process
for `member-assets`, with access limited to operators who already have production
data authority.

At least quarterly, restore the database and private Storage export into a
separate recovery project. Re-deploy Edge Functions and reapply Auth/redirect
configuration, then verify row counts, representative private objects, and the
authorization matrix. Never use the production project as the recovery drill
target.

Reference: [Supabase database backups](https://supabase.com/docs/guides/platform/backups).

## Rollback

The public site can be rolled back by reverting `main` to a previously verified
commit and letting the Pages workflow deploy it. Keep the preserved
`nextjs-prototype` tag for historical recovery, not as the normal production
rollback target.

Database migrations are forward-only. If a migration causes an incident, ship a
new corrective migration or restore into a separate project following the
recovery procedure. Do not delete migration-history rows or force-reset the
production database during an incident.
