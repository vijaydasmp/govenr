# Spike — L1 Mirror Path Decision

**Task:** Task 0, Govenr v1 spec  
**Date:** 2026-09-25  
**Timebox:** one evening  
**Decision: Path C — fixture with documented manual refresh**

---

## What was asked

Decide which data source backs `lib/mirror/proposal-mirror.ts` for v1.
Three paths were evaluated in preference order:

| Path | Source | Preferred? |
|------|--------|------------|
| A | DAPI Core gRPC-web — governance objects directly | Most preferred |
| B | Public REST API (Insight-style) — governance routes | Second |
| C | `fixtures/proposals.testnet.json` + manual refresh | Fallback |

The spike script lives at `scripts/spike/probe-l1-mirror.mjs` (excluded
from build). It probes B live and documents A by reference to the
official DAPI endpoint registry.

---

## Path A — DAPI Core gRPC-web

**Result: FAIL — endpoint does not exist.**

The Dash Platform DAPI exposes a gRPC-web proxy (Envoy) on port 443 of
mainnet/testnet seed nodes. The Core gRPC surface, as documented at
[docs.dash.org/projects/platform/…/dapi-endpoints](https://docs.dash.org/projects/platform/en/latest/docs/reference/dapi-endpoints.html),
covers:

- `broadcastTransaction`, `getBestBlockHeight`, `getBlock`
- `getBlockchainStatus`, `getMasternodeStatus`, `getTransaction`
- `subscribeToBlockHeadersWithChainLocks`
- `subscribeToMasternodeList`
- `subscribeToTransactionsWithProofs`

**No governance endpoint exists.** Governance data (proposals, vote
tallies) is synchronized via the P2P gossip protocol (`govsync`
message), not via any RPC or gRPC call. Reading it requires a fully
synced Dash Core node — not something a browser client can do directly.

The Platform gRPC surface (`getDocuments`, `getDataContract`, etc.)
covers Platform layer-2 documents only, not L1 governance objects.

Path A is architecturally unavailable from a browser. It cannot be
unblocked by a configuration change; it would require a new DAPI
endpoint to be added to Dash Core / Platform.

---

## Path B — Public Insight REST API

**Result: FAIL — governance routes not mounted on live instance.**

`insight.dash.org` runs `@dashevo/insight-api`, which historically
defined budget/proposal routes. The live instance returns 404 for every
governance path probed:

```
GET https://insight.dash.org/insight-api/governance/proposals?count=5
  → HTTP 404   CORS: *

GET https://insight.dash.org/api/governance/proposals
  → HTTP 404   CORS: *

GET https://insight.dash.org/insight-api/proposal?count=5
  → HTTP 404   CORS: *
```

CORS is open (`access-control-allow-origin: *`), so the origin policy
is not the blocker — the routes simply are not mounted on the current
deployment. The Insight instance appears to be running in a
block-explorer-only configuration.

No other public, permissively-CORS'd REST endpoint for Dash governance
data was found that is reliably maintained. DashCentral's own API was
not public, and the service itself is down.

A self-hosted Insight node with governance routes enabled would pass
Path B. That is a viable v1.1 upgrade path if the operator is willing
to maintain the node.

---

## Path C — Fixture fallback ✓ CHOSEN

**Result: PASS. v1 ships on this path.**

`fixtures/proposals.testnet.json` contains:

- `_meta`: cycle label, network, seed timestamp
- `proposals[]`: all three Cycle _04 proposals with real tallies
  (yes/no/abstain counts as of 2026-09-25), state badges, and
  engagement stats
- `content{}`: full body, milestones, and report refs for
  `BTCBACKPORTSVIJAY_04`
- `reviews{}`: two seeded reviews for `BTCBACKPORTSVIJAY_04`
- `comments{}`: two seeded comments for `BTCBACKPORTSVIJAY_04`

The file is imported statically (no fetch, no CORS concern). Parse
confirmed:

```
Cycle: _04, proposals: 3
  [BTCBACKPORTSVIJAY_04]    yes=274 no=122 abs=0
  [C2POOL_FINISH_03]        yes=210 no=61  abs=2
  [PLATFORM_APP_DIRECTORY_01] yes=44 no=6  abs=1
```

### Manual refresh procedure (until Path A or B is available)

When a new governance cycle starts:

1. Open Dash Core wallet or CLI. Run:
   ```
   dash-cli gobject list funding
   ```
   or pull from a trusted explorer (e.g. Dash Nexus, a local Insight node)
   that exposes the current proposals and vote tallies.

2. Edit `fixtures/proposals.testnet.json`:
   - Update `_meta.cycle`, `_meta.cycleLabel`, `_meta.seededAt`
   - Replace `proposals[]` with the current cycle's objects, mapping fields:
     - `votes.yes / no / abstain` → from `absoluteYesCount` / `noCount` / `abstainCount`
     - `neededYesToFund` → `mnodeBudgetRequestAmount` threshold minus current yes
     - `votingDeadline` → superblock date in ISO 8601 UTC
     - `state` → derive from `neededYesToFund` and deadline
   - Retain (or reset) `engagement` stats manually or from Platform docs

3. Commit the updated fixture on its own commit with message:
   `chore: refresh L1 fixture — cycle <label> (<date>)`

4. No code changes required — the `ProposalMirror` interface is unchanged.

---

## v2 upgrade path

When Path A or B becomes viable:

- Replace `lib/mirror/proposal-mirror.ts` implementation only.
- The interface (`ProposalMirror`) — `getCycle()`, `getProposals()`,
  `getProposal(id)` — does not change.
- No UI code changes required (per the service-swap pattern in
  `tech.md`).
- The `SOURCE: local | platform` comment at the top of the file marks
  the swap point.

**Likely v2 path:** a lightweight server-side route in the Next.js app
(`app/api/proposals/route.ts`) that proxies a self-hosted Insight node
or a future DAPI governance endpoint, keeping CORS concerns server-side.
The browser client calls `/api/proposals` — same shape as the fixture
interface.

---

## Summary

| | Path A | Path B | Path C |
|---|---|---|---|
| Governance data available? | No | No (not mounted) | Yes (fixture) |
| CORS-from-browser? | N/A | ✓ (but moot) | N/A |
| Reliability | — | Depends on third-party ops | ✓ (static import) |
| Build dependency | gRPC-web setup | fetch | None |
| v1 ships? | ✗ | ✗ | **✓** |

v1 ships on **Path C**. The `ProposalMirror` interface is the same
regardless of path. When a better source is available, the swap is
one file.
