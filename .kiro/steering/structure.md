# Structure — Govenr

```
app/                          Next.js App Router routes
  layout.tsx                  Shell: header (logo, nav, identity pill)
  page.tsx                    Hub — proposal list, cycle strip
  proposals/[id]/page.tsx     Proposal detail — tabbed
  about/page.tsx              Lineage page (DashCentral credit)
components/
  proposal-card.tsx           Hub card: title, meta, vote bar, stats
  vote-bar.tsx                Shared yes/no/abstain bar + numbers
  tab-nav.tsx                 Detail-page tabs
  comment-thread.tsx          Comments + reply form
  review-card.tsx             Stance badge, body, tip state
  tip-button.tsx              Tipping affordance + receipt display
  state-badge.tsx             needs-more-yes / not-funded / queued chip
lib/
  mirror/
    proposal-mirror.ts        L1 mirror interface + fixture impl
  services/
    content-service.ts        proposalContent (v1: fixture + local)
    comment-service.ts        comments (v1: localStorage)
    review-service.ts          reviews (v1: localStorage, one per identity)
    tip-service.ts            tip receipts (v1: localStorage, simulated)
    session-service.ts         Mock identity session
  format/
    dates.ts, dash.ts         Shared formatters
  types.ts                    Shared domain types (Proposal, Review, ...)
contracts/
  govenr-contract.json         v2 data contract (4 document types)
fixtures/
  proposals.testnet.json      Seed data (real _04 tallies, demo rest)
docs/
  spike-l1-mirror.md          Task 0 output — mirror path decision
```

## Rules

- One component per file, named after the component.
- `lib/types.ts` is the single source of domain types; components never
  re-declare them.
- Route params and service args are typed; no stringly-typed ids.
- Keep the `lib/` layer free of React imports — services are pure TS
  modules.
