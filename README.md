# Applied State Site

Minimal institutional website for Applied State, built with Next.js App Router.

## Structure

- `/` — sparse index of Applied State research periods
- `/as01` — AS01 / ARENA
- `/as02`, `/as03` — reserved research periods
- `/programmes` — residencies, field programmes and related calls
- `/membership` — membership information
- `/signin` — member sign in
- `/members` — server-protected member research area

## Authentication

Member authentication uses Supabase Auth with server-side cookies through `@supabase/ssr` plus a server-only Applied State email allowlist.

The public site does not provide sign-up. `signInWithOtp` is called with `shouldCreateUser: false`, and the sign-in route only sends a link to emails present in `APPLIED_STATE_MEMBER_EMAILS`. The members page validates the JWT server-side with `getClaims()`, fetches the current user from Supabase, and checks the email against the allowlist again before rendering.

Set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://your-domain.example
APPLIED_STATE_MEMBER_EMAILS=member@example.com,second@example.com
```

In Supabase, set the Site URL to the production domain. For SSR magic links, update the **Magic Link** email template to use:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a>
```

Add approved members to Supabase Auth and to `APPLIED_STATE_MEMBER_EMAILS`. Disable public user sign-up in Supabase as an additional control. The application still denies member access to authenticated emails that are not on the server allowlist.

No secret or service-role key belongs in the repository. The publishable Supabase key is expected to be public; authorization is enforced server-side.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```
