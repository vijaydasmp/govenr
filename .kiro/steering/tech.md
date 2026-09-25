# Tech — Govenr

## Stack

- **Next.js 14+ (App Router) + TypeScript (strict)** — no `any`, no
  non-null assertions where avoidable.
- **Tailwind CSS** for styling. No component library in v1.
- **React hooks + context** for state. No Redux/Zustand.
- No backend server, no database. The app is a client that (v1) reads
  fixtures + localStorage; (v2) talks to Dash Platform via DAPI
  (gRPC-web from the browser) — the same architecture as yappr.

## The service-swap pattern (critical)

Every data concern gets a `lib/<concern>/` service module with a typed
interface. v1 implements it against **fixtures + localStorage**; v2
swaps the implementation for Platform documents **without touching any
UI code**. This is the exact pattern that shipped the Missing Block
quiz (`lib/services/quiz-service.ts`).

Rules:

1. Services never throw for "not found" — they return empty/null and
   let the UI render empty states.
2. Fixtures load from `fixtures/proposals.testnet.json` (imported, not
   fetched).
3. localStorage keys are namespaced: `govenr:<concern>:v1:<key>`.
4. All writes in v1 are local; a `SOURCE: local | platform` flag in each
   service header comment marks the swap point.

## The L1 mirror (Task 0 spike decides the path)

The mirror reads governance data (proposals + tallies). Candidate paths,
in preference order:

- **A. DAPI core endpoint** — if DAPI exposes governance objects
  directly, use it (best: same origin as v2 Platform reads).
- **B. Public explorer/Insight-style API** — if a reliable public API
  serves governance objects and votes.
- **C. Fixture fallback** — `fixtures/proposals.testnet.json` with a
  documented manual refresh procedure. v1 ships on C if A and B fail the
  spike. The interface (`ProposalMirror`) is identical either way.

Spike output: `docs/spike-l1-mirror.md` with the decision and evidence.

## Commands & quality gates

```bash
npm run lint    # must pass, zero warnings allowed
npm run build   # must pass before any commit
npm run dev     # http://localhost:3000
```

## Conventions

- Dates: store ISO 8601 UTC strings; render with a single
  `lib/format/dates.ts` helper.
- Money: `amountDash: number`, formatted via `lib/format/dash.ts`
  (3 decimals max, trailing zeros trimmed).
- Vote bars: yes = green-700, no = orange-700, abstain = slate-400.
- Accessibility: semantic elements, keyboard-reachable interactive
  elements, visible focus states.
- Comments and reviews render body text as plain text (no markdown
  rendering in v1).
