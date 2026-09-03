# Applied State Site — Product, Editorial, Design and Technical Implementation Specification

**Status:** Authoritative build brief for Codex  
**Version:** 1.0  
**Date:** 3 September 2026  
**Repository:** `PARC-Labs/Applied-State-Site`  
**Target hosting:** GitHub Pages  
**Target member backend:** Supabase Auth + Postgres + Storage

---

## 1. Purpose of this document

This document is the source of truth for rebuilding the Applied State website.

Applied State must not be treated as a conventional magazine website, a startup landing page, a portfolio template, a membership community, or a web application with an editorial skin. The site should feel like the digital index and working surface of a small, serious art/research institution.

The interface must be unusually restrained. The sophistication should come from typography, sequencing, editorial judgement, image treatment, information architecture, and the quality of the material—not from interface decoration.

When there is ambiguity during implementation, choose the simpler, quieter solution.

---

## 2. Product definition

Applied State is a distributed art/research institution. Its primary public units are numbered instances:

- `AS01`
- `AS02`
- `AS03`
- and so on.

An `ASxx` is not necessarily an “issue”, “journal”, “project”, or “exhibition”. It is simply an Applied State instance: a bounded body of work, research, media, references, commissions, field material, or other output.

The first instance is:

**AS01 — ARENA**

The format of future instances is allowed to vary. One instance may be dominated by text and photography; another may consist of film, code, diagrams, a field report, and a small amount of writing. The stable institutional structure is the `ASxx` sequence, not a fixed magazine template.

### Core product model

1. The homepage is an index of `ASxx` instances.
2. Clicking an instance opens a sparse, vertically sequenced feed/document.
3. Public visitors see the public body of that instance.
4. Active members see the same page with additional material inserted into the sequence.
5. Member-only material can include films, files, notes, source material, code packages, research resources, and selected links.
6. The member experience is not a separate dashboard. Membership enriches the same Applied State surface.

---

## 3. Desired institutional tone

The site must communicate:

- editorial seriousness;
- precision;
- selectivity;
- independence;
- contemporary art/research literacy;
- confidence without marketing language;
- institutional continuity despite a very small interface.

It must not communicate:

- “creator economy”;
- Substack;
- SaaS;
- online community;
- luxury branding;
- startup minimalism;
- generic portfolio design;
- tech-demo aesthetics;
- crypto/web3 aesthetics;
- lifestyle club;
- tourism or travel company.

Applied State should look as if the interface has been reduced until only the useful institutional structure remains.

---

## 4. Research-derived design principles

This specification does not ask Codex to copy another site. The following precedents are useful because of specific operating principles.

### The Serving Library

The Serving Library exposes a large body of material directly and uses extremely low interface chrome. Its current site places simple textual navigation—Introduction, Journal, Collection, Programs, Shop—over an extensive index of works. The useful principle is that an institution with dense intellectual content does not need a promotional homepage between the visitor and the work.

Reference: https://www.servinglibrary.org/

### Are.na / Are.na Editorial

Are.na’s broader cultural logic is useful because objects, references, channels, and research relationships are more important than personality-led posting. Are.na Editorial also presents itself plainly as a body of essays, interviews, and related writing rather than constructing a conventional magazine front page.

Reference: https://www.are.na/editorial

### Triple Canopy

Triple Canopy is relevant for treating publishing as a site of production rather than only a container for articles. Applied State should similarly allow text, film, code, images, documents, and commissions to coexist without forcing all material into “article” templates.

Reference: https://canopycanopycanopy.com/

### Real Review

Real Review is useful as a reminder that a broad intellectual territory becomes coherent through a strict editorial method and voice. Applied State should therefore maintain a highly consistent institutional shell even when the material inside each `ASxx` changes considerably.

Reference: https://real-review.org/

### Conclusion from the precedents

Applied State should borrow **restraint, indexing, sequencing, and editorial authority**, not superficial visual motifs. The resulting website should be even simpler than most of these references.

---

## 5. Information architecture

### Required public routes

```text
/
/as01/
/as02/
/as03/
...
/about/
/membership/
/signin/
```

`/as01/` is the canonical URL for AS01. Keep the route human-readable and permanent.

Do not create a `/journal`, `/issues`, `/research`, `/projects`, or `/archive` hierarchy unless a future requirement makes one genuinely necessary.

### Homepage

The homepage should contain almost nothing.

Conceptual structure:

```text
APPLIED STATE

AS01
AS02
AS03
AS04


ABOUT   MEMBERSHIP   SIGN IN
```

The exact spacing is important; the amount of text is not.

Rules:

- Do not show thumbnails.
- Do not show summaries.
- Do not show dates by default.
- Do not show the instance title (`ARENA`) on the homepage by default.
- Do not add cards or borders around instances.
- Do not add “current”, “forthcoming”, category tags, or status pills unless later requested.
- Do not make the homepage a marketing page.
- Do not add an introductory paragraph explaining Applied State.
- Do not add a hero.
- Do not add a newsletter field above the fold.

The homepage should create the impression of an accumulating institutional record.

### AS instance page

A public AS page is a vertically sequenced document/feed.

Conceptual structure:

```text
APPLIED STATE

AS01
ARENA

[short opening text]

[image / text / diagram / film / contribution]

[text]

[image]

[resource]

[member material appears here only for active members]

[more public work]

[credits / references]
```

The instance title is revealed inside the instance. This is where `ARENA` appears.

The page should feel authored rather than templated. The sequence itself is part of the editorial work.

### About

Keep this page short. No founder story, team theatre, mission-deck language, or inflated claims.

### Membership

Membership should be presented quietly. It should explain that membership supports Applied State and provides access to additional research/material and eligibility or priority for selected programmes when relevant.

Do not introduce tier tables in v1.

### Sign in

One email field, one action.

No password field. No public sign-up. No social login. No account dashboard.

---

## 6. Visual system

### 6.1 Global aesthetic

Use:

- pure white background;
- black or near-black text;
- one neutral muted grey for secondary metadata;
- typography as the primary visual system;
- generous but controlled white space;
- hard edges;
- natural document flow.

Do not use:

- accent colours;
- gradients;
- rounded cards;
- shadows;
- pills;
- badges other than an extremely restrained textual member marker if required;
- decorative icons;
- illustrations added only to fill space;
- fake grain or paper texture;
- parallax;
- scroll-triggered fade-ins;
- carousels;
- masonry grids;
- animated cursors;
- loading theatrics;
- splash screens.

### 6.2 Colour tokens

Start with:

```css
--paper: #ffffff;
--ink: #0a0a0a;
--muted: #6f6f6f;
--rule: #d9d9d9;
```

`--rule` should be used rarely. White space is preferred to separators.

### 6.3 Typography

Use a single neutral grotesk/system sans stack at launch. Do not introduce a webfont dependency merely to make the site look “designed”. A custom typeface can be introduced later when it is an intentional Applied State identity decision.

Recommended initial stack:

```css
font-family: Arial, Helvetica, sans-serif;
```

Use normal weight as the default. Avoid the startup pattern of very large bold sans-serif headlines.

Typography should be dry, precise, and highly legible.

Suggested starting scale—not immutable values:

```css
--text-xs: 11px;
--text-sm: 13px;
--text: 16px;
--text-lg: clamp(22px, 2.4vw, 34px);
--text-xl: clamp(38px, 7vw, 92px);
```

Use uppercase sparingly for institutional labels and codes. Do not uppercase long prose.

### 6.4 Layout and spacing

The website remains a single-column conceptual system even when media becomes wide.

Suggested gutters:

```css
--gutter-mobile: 18px;
--gutter-tablet: 28px;
--gutter-desktop: 36px;
```

Text should generally remain in a narrow readable measure of approximately 58–72 characters per line.

Media can use controlled widths:

- `narrow`: align with prose;
- `medium`: approximately 900–1100px maximum;
- `wide`: viewport width minus page gutters.

Do not center every object mechanically. A consistent left alignment is preferable. Different widths can create rhythm without introducing cards or grids.

Use vertical space deliberately. A feed item should be allowed to occupy significant empty space around itself when the material warrants it.

### 6.5 Homepage typography

The homepage should not use a giant logo or hero title.

`APPLIED STATE` functions as an institutional label.

The `AS01`, `AS02`, `AS03` list is the dominant content. It can be substantially larger than the utility text, but should not feel like advertising typography.

Hover/focus behaviour should be limited to a conventional underline or a small opacity change. Do not reveal thumbnails or animate titles on hover.

### 6.6 Motion

Default: no motion system.

Do not add page-transition effects simply because the framework supports them. Ordinary browser navigation is acceptable and consistent with the desired seriousness.

A transition may be introduced later only if it materially improves continuity and remains effectively invisible.

---

## 7. AS page content grammar

The website needs a small grammar of editorial objects, not a UI component library.

Recommended public primitives:

- `Text`
- `Figure`
- `ImageSequence`
- `Film`
- `Document`
- `ExternalReference`
- `CodeReference`
- `Quote` only when editorially justified
- `Rule` only when editorially justified
- `Spacer`
- `MemberSlot`

Each primitive should render as plain semantic HTML with minimal styling.

### Figures

Use `<figure>` and `<figcaption>`. Captions should be small, neutral, and optional. Preserve the intended aspect ratio to prevent layout shift.

### Film

No autoplay. No audio autoplay. Use native controls unless there is a compelling editorial reason not to. `preload="metadata"` or `preload="none"` by default.

### External links and GitHub

Render as text, not branded buttons.

Example visual language:

```text
GITHUB — source repository ↗
PDF — research dossier
LINK — institutional archive ↗
```

Do not use GitHub logos, large CTA buttons, or branded embed cards.

### Member slots

A `MemberSlot` is an intentionally positioned location in the public editorial sequence where a member-only object can appear.

The static source may contain an opaque slot key such as:

```text
as01-film-001
```

It must not contain the private resource URL, file path, title, description, or other sensitive metadata.

---

## 8. Member experience

### 8.1 Principle

Membership should change the density of the same Applied State page rather than move the visitor into a different product.

A member visiting `/as01/` sees public material plus additional resources inserted into the curated sequence.

### 8.2 Signed-out presentation

Do **not** render a lock card for every private item.

The preferred v1 behaviour is:

- private slots render nothing in the public feed;
- public composition remains clean;
- at the end of an instance, a single restrained line may state that members have access to additional material and provide a `Sign in` link.

This preserves the quality of the public page while still making membership legible.

### 8.3 Signed-in presentation

When an authenticated active member visits an AS page:

- fetch eligible member resources for that AS instance;
- insert them into their corresponding `MemberSlot` positions;
- render them using the same editorial grammar as public material;
- optionally use a very small `MEMBER` label above the object, but never a badge or coloured treatment.

A member object should look as if it belongs to the AS sequence. It should not look like a premium upsell.

### 8.4 No member dashboard in v1

Do not create `/members`, `/account`, or a dashboard unless operational requirements later demand it.

The sign-in state can be represented in the footer with a plain `MEMBER` / `SIGN OUT` action.

---

## 9. Technical architecture decision

### 9.1 Replace the current Next.js server implementation with a static-first Astro site

The repository currently contains a small Next.js App Router prototype with server-side Supabase logic. That architecture no longer matches the product decision to host on GitHub Pages.

The recommended target stack is:

- **Astro** for static generation;
- **Astro Content Collections / MDX** for public editorial material;
- **plain CSS** for the visual system;
- **minimal client-side TypeScript** for authentication and member resource enrichment;
- **Supabase Auth** for passwordless member identity;
- **Supabase Postgres with Row Level Security** for membership status and private resource metadata;
- **Supabase private Storage** for genuinely private files, images, and films;
- **GitHub Actions + GitHub Pages** for build and deployment.

### Why Astro

This project is fundamentally a static editorial document system with a small authenticated enhancement. Astro generates static HTML by default, ships no client JavaScript unless it is explicitly needed, and has first-party content collections for typed Markdown/MDX content. Its official deployment guidance supports GitHub Pages through GitHub Actions.

References:

- https://docs.astro.build/en/guides/content-collections/
- https://docs.astro.build/en/guides/deploy/github/

### Why not retain server-dependent Next.js

GitHub Pages serves static files. The current Next.js server routes, proxy, and server cookie auth cannot run there. Next can be configured for static export, but Astro is a cleaner match for a content-first site whose desired public pages should contain almost no JavaScript.

Do not preserve a framework merely because it already exists in the repository. The current prototype is small enough that migration cost is negligible.

---

## 10. Proposed repository structure

Target structure:

```text
/
├── AGENTS.md
├── README.md
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── pages.yml
├── docs/
│   └── APPLIED_STATE_SITE_IMPLEMENTATION_SPEC.md
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   └── media/                 # public static media only when appropriate
├── src/
│   ├── content.config.ts
│   ├── content/
│   │   └── instances/
│   │       ├── as01.mdx
│   │       ├── as02.mdx
│   │       └── as03.mdx
│   ├── components/
│   │   ├── SiteHeader.astro
│   │   ├── SiteFooter.astro
│   │   ├── Figure.astro
│   │   ├── Film.astro
│   │   ├── ExternalReference.astro
│   │   ├── Document.astro
│   │   └── MemberSlot.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── InstanceLayout.astro
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── member-resources.ts
│   │   └── types.ts
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── membership.astro
│   │   ├── signin.astro
│   │   └── [instance].astro
│   ├── scripts/
│   │   └── member-runtime.ts
│   └── styles/
│       └── global.css
└── supabase/
    └── migrations/
        └── 0001_member_access.sql
```

The route generator must only emit valid `ASxx` entries from the content collection. Explicit utility routes must remain unambiguous.

---

## 11. Public content model

Use an Astro content collection called `instances`.

A simplified frontmatter schema:

```yaml
code: AS01
title: ARENA
status: published
publishedAt: 2026-09-01
summary: optional metadata for SEO, not necessarily rendered
```

The MDX body controls the exact order and rhythm of the public feed.

Example conceptually:

```mdx
<OpeningText>
An arena is a bounded environment ...
</OpeningText>

<Figure src="..." width="wide" caption="..." />

<Text>
...
</Text>

<MemberSlot slot="as01-film-001" />

<Figure src="..." width="medium" />

<ExternalReference href="..." label="..." />
```

Do not create a complex CMS schema before editorial requirements require it. Git/MDX is appropriate for the first phase because each AS page is deliberately curated and changes infrequently.

---

## 12. Authentication architecture

### 12.1 Passwordless, invite-only

Use Supabase email magic-link/OTP authentication.

Requirements:

- no public sign-up;
- `shouldCreateUser: false` when requesting a sign-in link;
- members are provisioned administratively in Supabase;
- redirect URLs must be restricted to the production Applied State domain and approved local development URLs;
- use a generic success/error message so the UI does not reveal membership status.

Supabase’s current documentation explicitly supports disabling automatic account creation with `shouldCreateUser: false`.

Reference: https://supabase.com/docs/guides/auth/auth-email-passwordless

### 12.2 Static-site session model

On a static site, use the browser Supabase client. The publishable key is expected to be present in client code; it is not a secret. Security depends on correct grants and Row Level Security policies.

Never place a Supabase secret/service-role key in the browser, source repository, GitHub Pages build, or public GitHub Actions artifact.

Supabase documents publishable keys as browser-safe when RLS is correctly configured and warns that secret/service-role keys bypass RLS.

References:

- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/secure-data

### 12.3 Authorization is not a client-side boolean

Never authorize member content with:

- a localStorage `isMember=true` flag;
- a hidden route;
- CSS display rules;
- a client-only email allowlist;
- bundled JSON that is merely not rendered.

The browser may decide what interface to show, but Supabase RLS must make the actual data-access decision.

---

## 13. Supabase data model

### 13.1 `memberships`

Conceptual fields:

```text
user_id       uuid primary key references auth.users(id) on delete cascade
status        text: active | paused | cancelled
valid_until   timestamptz nullable
created_at    timestamptz
updated_at    timestamptz
```

Only an authenticated user may read their own membership row. Clients may not update membership status.

### 13.2 `member_resources`

Conceptual fields:

```text
id            uuid primary key
instance_code text        # AS01
slot_key      text unique # as01-film-001
kind          text        # film | image | file | github | link | note | code
label         text nullable
caption       text nullable
storage_path  text nullable
external_url  text nullable
mime_type     text nullable
active        boolean
created_at    timestamptz
```

Only active members may select rows from this table.

There should be no anonymous SELECT grant.

### 13.3 RLS principle

A resource SELECT policy should succeed only if an active membership exists for `auth.uid()` and, when `valid_until` is non-null, it is still in the future.

Every exposed table must have RLS enabled. Supabase’s current security guidance states that exposed tables without RLS may be accessible to API roles depending on grants.

Reference: https://supabase.com/docs/guides/database/postgres/row-level-security

### 13.4 Migration requirement

Codex should create a real SQL migration under `supabase/migrations/0001_member_access.sql` containing:

- table creation;
- constraints;
- indexes where useful;
- grants/revokes;
- RLS enablement;
- membership policies;
- member resource policies;
- Storage policy guidance or SQL where supported.

Do not leave security as dashboard-only undocumented configuration.

---

## 14. Private storage and media

### 14.1 Public assets

Anything committed to the Git repository or emitted into the GitHub Pages `dist` directory is public.

GitHub explicitly warns that a GitHub Pages website is publicly available and that sensitive data should not be stored in its source/publishing material.

Reference: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https

### 14.2 Member assets

Use a **private Supabase Storage bucket**, e.g.:

```text
member-assets
```

Apply a Storage RLS policy so only active members can read objects.

Supabase supports private object access either via authenticated requests or via time-limited signed URLs. Signed URLs require appropriate object SELECT permission.

References:

- https://supabase.com/docs/guides/storage/serving/downloads
- https://supabase.com/docs/reference/javascript/storage-from-createsignedurl

### 14.3 Signed URL rules

For films/images that must be used as normal browser media sources, create signed URLs only after member authorization.

Use short expiry windows, typically 1–10 minutes depending on the resource. Generate the signed URL as late as practical, ideally on user interaction for large films.

A signed URL can be copied and shared until it expires. It is access control, not DRM.

### 14.4 Video

For initial low-volume membership, private Supabase Storage is acceptable.

If Applied State later distributes substantial high-resolution films at scale, evaluate a signed-playback video service. Do not prematurely introduce one in v1.

---

## 15. GitHub resources: security distinction

A critical distinction:

### Public GitHub repository shown only to members

If a member-only resource links to a **public** GitHub repository, the membership layer controls discovery only. Once someone knows the URL, it is public.

Do not describe this as secure/private access.

### Truly private GitHub repository

Supabase membership does not automatically grant access to a private GitHub repository.

If an Applied State resource genuinely needs to be private source code, choose one of the following later:

1. manually provision members into the private GitHub repository/organization;
2. build a GitHub App-backed provisioning system;
3. package the relevant source as a private Supabase Storage download instead.

For v1, option 3 is simplest when true access control matters.

---

## 16. Member-resource runtime behaviour

The public AS page must render before Supabase responds. Authentication is progressive enhancement, not a dependency for the public site.

Suggested flow on an AS page:

1. Static HTML renders immediately.
2. A small client module initializes Supabase.
3. Check the current session.
4. If no session, do nothing; public page remains complete.
5. If a session exists, query member resources for the current `ASxx`.
6. RLS determines whether rows are returned.
7. If active member rows are returned, match `slot_key` values to `MemberSlot` containers.
8. Render safe typed components into those containers.
9. Do not use arbitrary HTML from the database.
10. If the session is invalid/expired, fail back to the public page.

Do not block first paint with member lookup.

Do not flash large locked-content placeholders while auth initializes.

---

## 17. Security requirements

These are build requirements, not optional recommendations.

### Secrets

- No service-role/secret key in client code.
- No private member URLs in Git.
- No private assets in `public/`.
- No secret environment values exposed through `PUBLIC_*` variables.

### Database

- RLS enabled on every exposed table.
- Explicit grants/revokes.
- Anonymous users cannot read memberships or member resources.
- Authenticated non-members cannot read member resources.
- Active members can read only the member data intended for them.

### Rendering

- Do not inject member database strings with `innerHTML`.
- Treat database content as text/typed data.
- Validate external URLs and allow only expected protocols (`https:`; optionally `mailto:` where deliberately supported).
- Trusted MDX is repository-authored only; no user-generated MDX.

### Authentication

- No automatic user creation.
- Generic sign-in response copy.
- Approved redirect URL list only.
- Sign-out must clear the local Supabase session.

### Hosting

- Enforce HTTPS in GitHub Pages.
- Verify the custom domain before launch.
- Avoid wildcard DNS records for the Pages domain.

GitHub supports HTTPS for Pages custom domains and recommends domain verification to reduce takeover risk.

References:

- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https

### Security-header limitation

GitHub Pages does not offer the same configurable response-header surface as a full application host. Keep the application attack surface correspondingly small: no third-party script zoo, no inline untrusted HTML, no password handling, no payment handling, and minimal JavaScript.

If stricter response-header control becomes necessary, place an appropriate edge/CDN layer in front or move the static site to a host that supports custom headers. Do not add this complexity in v1 without a concrete need.

---

## 18. GitHub Pages deployment

Use GitHub Actions as the Pages publishing source.

GitHub’s current Pages guidance supports custom workflows that:

1. check out the repository;
2. build the static site;
3. upload the Pages artifact;
4. deploy using the GitHub Pages deployment action.

Reference: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

Astro also provides an official GitHub Pages deployment workflow/action.

Reference: https://docs.astro.build/en/guides/deploy/github/

### Deployment rules

- `main` is production.
- Pull requests run CI but should not modify production Pages.
- Production Pages deploy only after a successful build.
- Commit a lockfile.
- Keep build output out of source control; let Actions produce the Pages artifact.
- Configure the custom domain in GitHub Pages settings rather than relying on repository hacks.

---

## 19. Performance and JavaScript budget

The minimal design should be reflected technically.

### Homepage

Target **zero client-side JavaScript** on `/` if practical.

The homepage does not need to know whether the visitor is signed in. `SIGN IN` may remain a static utility link.

### AS pages

Only load the member runtime required to enrich the page. Do not hydrate the entire page with React/Vue/Svelte.

### General targets

- Static HTML first.
- No component-library runtime.
- No analytics in v1.
- No tag manager.
- No externally hosted font in v1.
- Optimize public images at build time.
- Reserve image dimensions/aspect ratios to avoid CLS.
- Lazy-load below-the-fold images.
- Do not preload large film assets.

Performance should feel instantaneous because the site architecture is genuinely small, not because loading states are polished.

---

## 20. Accessibility

Minimalism does not override accessibility.

Requirements:

- Semantic heading hierarchy.
- `<main>`, `<article>`, `<figure>`, `<figcaption>` where appropriate.
- Keyboard-accessible links and forms.
- Clearly visible focus state.
- Do not remove outlines without a replacement.
- Minimum WCAG AA contrast for body text and controls.
- Alt text for meaningful images; empty alt for intentionally decorative images.
- Labels for form controls even if visually understated.
- No interaction available only on hover.
- Media controls usable by keyboard.
- Captions/transcripts for films where editorially possible.
- No autoplay audio.
- No animation dependency.

The layout must remain coherent at 320px wide and when browser text is enlarged.

---

## 21. Responsive behaviour

Do not create a separate “mobile design”. The same document system should compress naturally.

### Desktop

- generous margins;
- narrow text measure;
- media may become wide;
- issue index retains its plain vertical structure.

### Mobile

- reduce page gutters, not conceptual hierarchy;
- all text remains left aligned;
- wide media becomes full available width;
- utility navigation may wrap naturally;
- no hamburger menu is necessary for the v1 route count.

Test at minimum:

- 320px
- 390px
- 768px
- 1440px
- 1920px

---

## 22. SEO and metadata

Keep metadata accurate and quiet.

### Home

```text
<title>Applied State</title>
```

### Instance

```text
<title>AS01 — ARENA — Applied State</title>
```

Use canonical URLs after the production domain is known.

Public AS pages should be indexable.

`/signin/` should be `noindex`.

Private member material must never be present in static HTML or public structured data, so search-engine exclusion is achieved by actual non-publication rather than robots directives alone.

---

## 23. Error states

Error states should be plain text.

Examples:

```text
Sign-in link sent.
```

```text
Sign-in unavailable. Try again.
```

```text
This link has expired. Request another.
```

Do not add alert cards, toast systems, coloured banners, modal dialogs, or illustrations.

If Supabase is unavailable, public Applied State content must remain usable.

---

## 24. Membership operations in v1

Keep operations manual initially.

Initial member provisioning can be:

1. create/invite the Auth user in Supabase;
2. create an `active` membership row for the user;
3. add relevant private resources through Supabase data/storage administration.

This is sufficient while the member count is small and avoids prematurely building administrative software.

### Future paid recurring membership

When recurring payments are implemented, the recommended extension is:

- hosted checkout/payment provider handles payment details;
- webhook runs in a trusted backend/Edge Function;
- webhook updates `memberships.status` and `valid_until`;
- GitHub Pages never handles card data;
- the AS site architecture remains unchanged.

Do not build payment infrastructure as part of the current site rebuild unless explicitly requested.

---

## 25. Editorial behaviour for AS01

AS01 is the first proof of the system and should establish the grammar without overfilling it.

### AS01 identity

```text
AS01
ARENA
```

The exact editorial content will be developed separately. The implementation should support a sequence resembling:

1. short opening text;
2. large visual or project material;
3. substantial text/research contribution;
4. diagram/image sequence;
5. member-only film or extended material;
6. public reference/resource;
7. member-only source/code/research object;
8. closing references/credits.

This is a capability model, not mandatory content. Do not invent filler copy to populate missing sections.

When content is unavailable, leave the page sparse.

---

## 26. Content editing workflow

Public editorial material should remain easy to edit without a CMS.

### Public AS content

Edit the corresponding MDX file and commit through Git.

### Public images

Store optimized source material in an appropriate repository asset directory, subject to sensible Git size limits. Very large media should not be committed merely for convenience.

### Member resources

Create/update rows and private objects in Supabase. Do not place the source metadata in the public MDX file beyond the opaque `slot_key`.

This separation is intentional:

```text
Git = public editorial record
Supabase = identity + private member layer
```

---

## 27. Testing and verification

Codex should not consider the rebuild complete until the following checks pass.

### Build

- `npm install` succeeds.
- `astro check` / TypeScript check succeeds.
- production static build succeeds.
- GitHub Pages workflow succeeds.

### Public leakage test

After build, search the entire `dist/` directory for known private test values:

- private file path;
- private resource title;
- private external URL;
- test member email.

None may be present.

### Authorization matrix

Test these states explicitly:

| State | Public AS content | Membership row | Member resource metadata | Private Storage |
|---|---:|---:|---:|---:|
| Anonymous | yes | no | no | no |
| Authenticated non-member | yes | own row only if it exists | no | no |
| Active member | yes | own row | yes | yes |
| Cancelled/expired member | yes | own row | no | no |

### UI states

Test:

- homepage;
- AS01 signed out;
- valid magic-link flow;
- AS01 active member;
- session expiry;
- sign out;
- nonexistent AS route / 404;
- member resource failed load;
- Supabase unavailable.

### Browser and responsive

At minimum verify current:

- Chrome;
- Safari;
- Firefox;
- iOS Safari-sized viewport.

### Quality targets

Aim for:

- Lighthouse Performance: 95+ on public pages;
- Lighthouse Accessibility: 95+;
- no horizontal overflow;
- no console errors;
- no unexpected layout shift;
- keyboard navigation fully usable.

Do not compromise the interface to chase an arbitrary Lighthouse score, but a site this simple should naturally perform well.

---

## 28. Implementation sequence for Codex

Execute in this order.

### Phase 1 — replace framework shell

1. Preserve this specification.
2. Replace Next.js dependencies and structure with Astro.
3. Configure strict TypeScript.
4. Configure static output and GitHub Pages.
5. Create CI build verification.

### Phase 2 — build the visual shell

1. Global CSS tokens.
2. Base layout.
3. Homepage AS index.
4. Utility footer.
5. Dynamic AS route.
6. AS01 minimal placeholder structure using real known copy only.
7. About / Membership / Sign in.

At the end of Phase 2 the site should already look finished while containing very little material.

### Phase 3 — editorial primitives

1. Figure.
2. Film.
3. External reference.
4. Document/file reference.
5. Member slot.
6. Width/spacing controls required for deliberate sequencing.

Do not build more primitives than AS01 needs.

### Phase 4 — Supabase schema and auth

1. Create SQL migration.
2. Browser Supabase client.
3. Magic-link sign-in with `shouldCreateUser: false`.
4. Session handling.
5. Membership query.
6. Sign out.

### Phase 5 — member resource enrichment

1. Resource query behind RLS.
2. Slot matching.
3. Safe typed renderers.
4. Private Storage access.
5. Signed film/file access where required.
6. Graceful failure to public state.

### Phase 6 — verification

1. Authorization matrix tests.
2. Public leakage test.
3. Responsive screenshots.
4. Accessibility checks.
5. Production build.
6. Pages deployment.

---

## 29. Explicit non-goals for v1

Do not build any of the following unless the user explicitly changes the brief:

- member chat;
- comments;
- likes;
- profiles;
- member directory;
- social feed;
- notifications;
- Discord integration;
- member dashboard;
- complex CMS;
- admin panel;
- search;
- tags;
- topic taxonomy;
- public user registration;
- multiple membership tiers;
- payment checkout;
- application management;
- newsletter platform;
- analytics dashboard;
- recommendation algorithm;
- personalization beyond member resource access;
- conventional magazine issue cards;
- conventional blog article listing.

---

## 30. Design guardrails for Codex

These rules are intentionally redundant because they are the most likely failure modes of an automated implementation.

**Do not make it look like a startup.**

**Do not make it look like a Substack.**

**Do not make it look like an art-school portfolio template.**

**Do not create cards when whitespace will do.**

**Do not create buttons when a text link will do.**

**Do not add icons when text is clearer.**

**Do not add colour to create hierarchy. Use typography and space.**

**Do not add animation to make minimalism interesting. The material must make it interesting.**

**Do not explain the interface. Make the structure obvious.**

**Do not expose private metadata in the static bundle.**

**Do not treat client-side rendering logic as authorization. RLS is authorization.**

**Do not invent editorial copy, titles, projects, contributors, programmes, or resources.**

**Do not add visual elements because the page feels empty. Empty space is intentional.**

---

## 31. Definition of done

The first implementation is done when a visitor can open the production Applied State domain and see an extremely sparse white index containing `AS01`, `AS02`, `AS03`, etc.; click `AS01`; encounter a deliberately sequenced ARENA page; and, if they are an authenticated active member, see additional private material integrated naturally into that same page.

A signed-out or non-member visitor must be technically unable to retrieve the private resource metadata or files, even if they inspect source code, static build output, browser JavaScript, or Supabase API calls.

The final product should feel simpler than the implementation behind it.

That asymmetry is intentional.

---

## 32. Primary technical research sources

GitHub Pages:

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages

Astro:

- https://docs.astro.build/en/guides/deploy/github/
- https://docs.astro.build/en/guides/content-collections/

Supabase:

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/secure-data
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/storage/serving/downloads

Editorial precedents:

- https://www.servinglibrary.org/
- https://www.are.na/editorial
- https://canopycanopycanopy.com/
- https://real-review.org/
