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

Member authentication uses Supabase Auth with server-side cookies through `@supabase/ssr`.

The public site does not provide sign-up. `signInWithOtp` is called with `shouldCreateUser: false`, so only users already created in Supabase Auth can obtain a magic link. The members page validates the JWT server-side with `getClaims()` before rendering.

Set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

In Supabase, set the Site URL to the production domain. For SSR magic links, update the **Magic Link** email template to use:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a>
```

Add members from the Supabase Auth dashboard or Admin API. Do not enable public sign-up for this application.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```
