# Curated Admission — operational release procedure

Applied State is an editorial institution with one member entitlement class. Applications and invitations are screened before anyone receives access. No applicant can self-create an Auth account, activate membership, access a private State, or open a State into the Index.

## Production release gate

The database migration 0006 also deliberately denies execution of the submission RPC to both `anon` and `authenticated`; only `service_role` can use it until a separately reviewed migration opens intake. Do not grant public RPC privileges merely because the web page exists.

The compiled website deliberately keeps the public application form closed with `ADMISSION_INTAKE_OPEN = false` in `src/lib/admission-release.ts`. This permits a safe code deployment before the database and abuse protections are ready. The website must not solicit applications until operators have validated the production Supabase migration, staff-only review, account invitation and tested sign-in, retention policy, and abuse controls.

After those conditions are met, introduce a separately reviewed SQL migration to grant submit RPC privileges to the intended public roles, then change the constant to `true` in the same coordinated release. When doing so, update the static-build leak/release guard in `scripts/check-public-build.mjs` to assert the newly expected published intake form and to reject any server-only applicant data. Do not simply remove the guard.

## Public intake

- When the public intake is enabled, `/apply/` will submit to `public.submit_membership_application` via the browser publishable key. In the closed state this RPC is not executable by visitors.
- A submission stores applicant name, contact email, location, practice, work URL and a short statement. It does not authenticate the applicant.
- The response is intentionally indistinguishable for repeat applicants. Treat it as acknowledgement of technical receipt, not a decision.
- All application data is confidential. Only Supabase administrators and staff permitted by database RLS may read the rows. Do not add application details to static pages, web analytics, public GitHub issues or logs.
- Public submissions are bounded and include a simple honeypot. These are not robust bot controls. Monitor submissions; before wider recruitment, add a verified challenge, edge-layer rate limiting and operational abuse controls. The public RPC cannot reliably verify an email belongs to the applicant.
- In case of abuse, revoke EXECUTE on `public.submit_membership_application(text,text,text,text,text,text,text)` from `anon` until a stronger intake gate is deployed.

## Curatorial review

- Staff with the `editor` or `admin` role can open `/applications/review/`. Database policies enforce this irrespective of client UI.
- The reviewer can accept, waitlist or decline. Review writes an audit event.
- Acceptance is a selection decision only. It does not grant an Auth account or entitlement, and does not itself initiate payment. Never represent accepted as “activated”.
- Applications are not automatically displayed in a public directory, the member Index or ASxx.
- The operator contacts accepted applicants individually and explains the membership contribution and terms. Pending the chosen payment processor, payment collection remains a deliberate manual step.

## Provisioning after acceptance and payment

1. Confirm the application decision and verify applicant contact details through email correspondence before issuing access. Confirm receipt of the agreed fee or record a documented complimentary exception.
2. Create or invite the person as a user through a privileged Supabase Auth administrative channel. Public sign-up must remain disabled.
3. Provision one membership entitlement through the existing service-role/admin-only provisioning procedure. Use `source='manual'` or `'complimentary'` as appropriate. Do not call this procedure using a browser publishable key.
4. Verify that the invited person receives the magic link, returns to `/signin/`, sees ASxx member material, and can create a private State.
5. Confirm that a different active member cannot view their private State, and that invitation and editorial Index permissions behave as specified.

## Rejection, privacy, and maintenance

- Do not place sensitive reasoning in reviewer notes. They are for internal editorial decisions, not public profiles.
- Respond to access/deletion requests through authenticated private correspondence and privileged database administration. Have an explicit retention and deletion policy before opening broad applications.
- Periodically review old declined and waitlisted records and prune them according to the adopted retention schedule.
- Check that neither application contents nor accepted email addresses are present in the published static `dist/` build.

## Release gates

- Apply migration `0006_curated_membership_applications.sql` through the reviewed Supabase deployment workflow **before** enabling the public application form.
- Run `npm run verify` and `supabase test db`, including `curated_admission.test.sql`. Never run transactional fixtures against production.
- Test production sign-in and a full manual application → review → invitation → entitlement path with an authorised test account. Check production Auth, SMTP, site URL, callbacks, RLS policies and the Supabase browser-safe publishable configuration.
- Do not mark admission live merely because the static page is reachable. The migration and staff-only workflow must work in the production environment.
