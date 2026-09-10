# Applied State — Are.na authoring

Are.na is an optional authoring surface for the public `ASxx` sequence. It is
not the identity, membership system, private-State database, or permanent
authorization layer for Applied State.

## Editorial model

Use two channels when an instance has an active research process:

1. `AS01 — WORKING` — a **Private** Are.na channel for collection, comparison,
   drafts, and unfinished research.
2. `AS01 — PUBLISHED` — a **Closed** Are.na channel containing only the public
   sequence that should appear on `/as01/`.

Are.na allows one block to be connected to multiple channels, so publication is
the deliberate act of connecting a selected block to the Published channel and
placing it in the intended order. The Working channel is never configured in
the public site.

This preserves the editorial boundary established in the Applied State project
history: Are.na can remain the research backroom, while the public channel is a
small, intentional publication surface rather than an unfiltered feed.

## Connect an instance

Copy the full URL of the Published channel and add it to the corresponding MDX
frontmatter:

```yaml
---
code: AS01
title: ARENA
status: published
arenaChannel: https://www.are.na/your-account/as01-published
---
```

The channel must be Public or Closed. Prefer Closed so visitors can read it but
only its owner and invited collaborators can change the public sequence. A
private channel cannot be fetched by an anonymous visitor and must not be
connected to a public AS page.

Once connected, adding, removing, or reordering blocks in the Published channel
is reflected on the AS page without a repository edit. Are.na currently caches
public API responses briefly, so changes may take several minutes to appear.

## Rendering contract

The site renders Are.na contents in the order returned by the channel API and
supports:

- Text as plain editorial text;
- Image as an image with restrained captioning;
- Link and Embed as an image preview or textual external reference;
- Attachment as a file preview or link;
- connected Channel as a reference.

Are.na profile data, avatars, followers, comments, connection counts, and other
social metadata are not rendered. Supplied HTML and embed code are never
injected. External destinations and media must use HTTPS. Unknown block types
are omitted. The anonymous reader is limited to the first 300 channel items per
page view, followed by a link to continue on Are.na.

If the Are.na request fails, the institutional page, title, repository-authored
material, and private member enhancement boundary remain intact. The page shows
a quiet link to the original channel instead of failing.

## Boundary with member States

This live publication behavior applies only to explicitly configured public
`ASxx` pages. It does not make a member's private Applied State State equal to an
Are.na channel.

The future member feature remains an import bridge:

```text
Are.na channel → selected import → Applied State materials and connections
```

Imported member material must be stored in Supabase and governed by Applied
State membership, collaboration, RLS, Storage, and Index rules. It must not be
queried directly from Are.na whenever somebody opens a private State.
