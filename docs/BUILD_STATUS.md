# Applied State — Build Status

Source of truth: `docs/APPLIED_STATE_ENGINEERING_BUILD_PLAN.md`.

Codex should update this file only when a phase exit criterion is actually satisfied. Do not mark phases complete because code was started or UI exists.

- [ ] Phase 0 — Preserve and prepare
- [ ] Phase 1 — Public institutional surface
- [ ] Phase 2 — Supabase foundation and membership entitlement
- [ ] Phase 3 — AS member enrichment
- [ ] Phase 4 — Private States MVP
- [ ] Phase 5 — Collaboration
- [ ] Phase 6 — Curated Index
- [ ] Phase 7 — Billing automation
- [ ] Phase 8 — Hardening and release

## Current blocking decisions

- Billing provider: deferred until Phase 7. Authorization must remain provider-agnostic.
- Public publication of member States: explicitly out of v1 scope.
- State-to-State nesting: defer until normal material connections are stable.
- Arbitrary file uploads: defer until Storage policies and upload hardening are complete.

## Completion rule

A phase is complete only when:

1. its implementation tasks are complete;
2. its stated exit criteria in the engineering plan are met;
3. relevant allow/deny security tests pass;
4. CI is green;
5. no private fixture data appears in the static build.
