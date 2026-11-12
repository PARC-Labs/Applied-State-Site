# Applied State — Are.na authoring

Are.na is an optional source for **public editorial content** on an ASxx instance. It is not a membership, authentication or internal member-State service. The separate Base project handles generalized research Spaces.

## Editorial workflow

1. Keep an `AS01 — WORKING` Are.na channel **Private** for drafts and research collection.
2. Select material for an `AS01 — PUBLISHED` channel. Set this channel **Closed** (publicly readable, with restricted editing), order its blocks, and use its URL in the AS01 frontmatter.
3. Review the anonymous-facing channel contents before publication. Do not include confidential or unpublished material.

Example:

```yaml
---
code: AS01
title: ARENA
status: published
arenaChannel: https://www.are.na/your-account/as01-published
---
```

Only Public or Closed Are.na channels can power an anonymous AS page. Working/Private channels must never be configured for public consumption.

## Rendering and fallback

The site uses the public Are.na V3 contents endpoint. Supported types include text, images, links, embeds, attachments and connected channels. User HTML and embed code are not executed. Images and external references require safe HTTPS destinations. Social metadata is omitted. The number of blocks fetched per view is bounded to 300.

When Are.na is unavailable, the repository-authored public ASxx content remains visible and the site links to the original published channel. An Are.na channel is a publication source only; it creates no Base account and no Applied State member entitlement.
