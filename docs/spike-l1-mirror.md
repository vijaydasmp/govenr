# Spike — L1 Mirror Path Decision

**Task:** Task 0 / Task 2a, Govenr v1 spec  
**Date:** 2026-09-25 (initial) · updated same session  
**Decision: Path B — DashCentral public API, fetched server-side**  
**Runtime fallback: Path C — fixture**

---

## What was asked

Decide which data source backs `lib/mirror/proposal-mirror.ts` for v1.
Three paths were evaluated in preference order:

| Path | Source | Status |
|------|--------|--------|
| A | DAPI Core gRPC-web — governance objects directly | **Rejected — endpoint does not exist** |
| B | Public REST API (DashCentral) — fetched server-side | **Chosen** |
| C | `fixtures/proposals.testnet.json` + manual refresh | **Runtime fallback** |

---

## Path A — DAPI Core gRPC-web

**Result: REJECTED — endpoint does not exist.**

The Dash Platform DAPI exposes a gRPC-web proxy (Envoy) on port 443 of
mainnet/testnet seed nodes. The Core gRPC surface, as documented at
[docs.dash.org/projects/platform/…/dapi-endpoints](https://docs.dash.org/projects/platform/en/latest/docs/reference/dapi-endpoints.html),
covers blocks, transactions, masternodes, and Platform layer-2 documents.

**No governance endpoint exists.** Governance data (proposals, vote
tallies) is synchronised via the P2P gossip protocol (`govsync` message),
not via any RPC or gRPC call. Reading it requires a fully synced Dash
Core node connected to the P2P network — not something a browser client
can do directly, and not something DAPI exposes.

Path A is architecturally unavailable from the browser. It cannot be
unblocked by a configuration change; it would require a new DAPI endpoint
to be added upstream in Dash Core.

---

## Path B — DashCentral public API ✓ CHOSEN

**Result: PASS. v1 ships on this path.**

DashCentral exposes a public, unauthenticated JSON API:

```
GET https://www.dashcentral.org/api/v1/budget
```

Returns an array of proposals for the current budget cycle with fields:
`hash`, `name` (slug / id), `title`, `yes`, `no`, `monthly_amount`,
`remaining_payment_count`, `total_payment_count`, `voting_deadline`
(unix timestamp), `will_be_funded`, `in_next_budget`,
`remaining_yes_votes_until_funding`, `owner_username`.

**Known gaps vs the full L1 picture:**

| Field | Available | Notes |
|-------|-----------|-------|
| Yes votes | ✓ | |
| No votes | ✓ | |
| Abstain votes | ✗ | Not in DashCentral API; set to 0 in v1 |
| Voting deadline | ✓ | Unix timestamp → ISO 8601 |
| Cycle label | Partial | Derived from `budget_cycle_end` if present |
| Proposal content (body, milestones) | ✗ | Platform documents layer |

Abstain counts are not exposed by DashCentral. A comment in
`app/api/mirror/proposals/route.ts` documents this. v2 (direct L1 read)
will provide the real value.

### Why server-side, not direct browser fetch

DashCentral does not advertise a CORS policy permitting arbitrary browser
origins. Fetching from a Next.js route handler (`app/api/mirror/proposals/route.ts`)
means:

- The browser never touches DashCentral directly.
- CORS is irrelevant — it's a same-origin call from the app to `/api/mirror/proposals`.
- The route handler can cache with `next: { revalidate: 60 }`, matching
  the hub's 60-second refresh loop.
- If DashCentral ever changes its CORS policy or goes down, the route
  handler is the single swap point — no UI code changes.

### Architecture

```
Browser / SSR
    │
    ▼
GET /api/mirror/proposals          ← Next.js route handler (server-side)
    │                              ← revalidates every 60 s
    ├─ fetch DashCentral /api/v1/budget (server-to-server, no CORS)
    │      │
    │      ├─ OK  → map DcProposal[] → Proposal[], source: 'live DashCentral (mainnet)'
    │      └─ any error → serve fixture, source: 'fixture'
    │
    └─ returns MirrorResponse { source, cycle, proposals }

lib/mirror/proposal-mirror.ts
    │
    ├─ getCycle()       → CycleInfo | null (from in-memory cache)
    ├─ getProposals()   → fetch /api/mirror/proposals → Proposal[]
    └─ getProposal(id)  → match by id or hash → Proposal | null
```

---

## Path C — Fixture fallback (runtime, not build-time)

Path C is no longer the primary path but remains the **runtime fallback**.
The route handler catches any fetch error, non-200 response, or unexpected
JSON shape and returns the fixture data with `source: 'fixture'`.

The hub renders a source badge near the cycle strip:
- `"live DashCentral (mainnet)"` — normal operation
- `"fixture"` — DashCentral unreachable or returned an error

This badge is an honesty requirement: users must always know whether they
are seeing live tallies or static seed data.

### Fixture manual refresh procedure

When the fixture needs updating (e.g. a new cycle starts and DashCentral
is down for an extended period):

1. Pull current tallies from a trusted source (Dash Core CLI, Dash Nexus,
   or a local Insight node):
   ```
   dash-cli gobject list funding
   ```
2. Edit `fixtures/proposals.testnet.json`:
   - Update `_meta.cycle`, `_meta.cycleLabel`, `_meta.seededAt`
   - Replace `proposals[]` with current cycle data
3. Commit: `chore: refresh L1 fixture — cycle <label> (<date>)`
4. No code changes required — the `MirrorResponse` shape is unchanged.

---

## v2 upgrade path

When a governance gRPC endpoint ships in Dash Core / DAPI:

- Replace the `fetch(DASHCENTRAL_URL, …)` block in
  `app/api/mirror/proposals/route.ts` with a DAPI gRPC-web call.
- `lib/mirror/proposal-mirror.ts` is unchanged — it calls the same
  `/api/mirror/proposals` route.
- No UI code changes required.

Alternatively, if a self-hosted Insight node with governance routes
enabled is available, the same route handler swap applies.

---

## Summary

| | Path A | Path B | Path C |
|---|---|---|---|
| Governance data available? | No (P2P only) | **Yes** | Yes (fixture) |
| CORS-from-browser? | N/A | Avoided (server-side) | N/A |
| Live mainnet tallies? | N/A | **Yes** | No (seeded) |
| Abstain counts? | N/A | No | Yes (seeded) |
| Reliability | — | DashCentral uptime | ✓ (static import) |
| v1 primary? | ✗ | **✓** | Fallback only |
