# Govenr v1 — Design

## Architecture

```
fixtures/proposals.testnet.json
        │
        ▼
lib/mirror/proposal-mirror.ts ──── ProposalMirror interface
        │                            (getCycle, getProposals, getProposal)
        ▼
app/page.tsx (Hub) ── components/proposal-card ── vote-bar
app/proposals/[id] ── tabs: Overview │ Discussion │ Reviews │ Votes
        │                    │              │
        ▼                    ▼              ▼
lib/services/content-service  comment-service  review-service
        └──────────── all: v1 fixture/localStorage, v2 Platform docs ────┘
lib/services/tip-service ── v1 simulated receipts (tipReceipt shape)
lib/services/session-service ── mock identity
```

## Task 0 spike — L1 governance data path

Goal: decide the mirror's real data source. Timebox: one evening.

1. **Path A:** check whether DAPI core endpoints expose governance
   objects (proposal list + per-proposal vote counts) via gRPC-web.
   Try against a testnet/mainnet DAPI endpoint with a small script.
2. **Path B:** evaluate a public explorer/Insight-style API that serves
   Dash governance objects with permissive CORS.
3. **Path C (fallback, ships v1):** the fixture file with a documented
   manual refresh procedure (edit numbers in `fixtures/`).

Decision criteria: reliability, CORS-from-browser, vote-count
granularity, terms of use. Write the decision + evidence to
`docs/spike-l1-mirror.md`. **v1 ships on Path C unless A or B passes
all criteria** — the `ProposalMirror` interface is identical either way,
so the swap is a file replacement, not a refactor.

## Core types (lib/types.ts)

```ts
type Proposal = {
  id: string; hash: string; title: string; ownerHandle: string;
  amountDash: number; isMonthly: boolean; paymentsRemaining: number;
  state: 'needs-more-yes' | 'not-funded' | 'queued-next-cycle';
  votes: { yes: number; no: number; abstain: number };
  neededYesToFund: number; votingDeadline: string | null;
  engagement: { reviews: number; comments: number;
                tippedDash: number; verifiedMnos: number };
};

type ProposalContent = { proposalHash: string; title: string;
  body: string; milestones: string[]; reportRefs: string[] };

type Comment = { id: string; proposalHash: string; parentId?: string;
  body: string; authorHandle: string; createdAt: string };

type Stance = 'support' | 'concern' | 'neutral';
type Review = { id: string; proposalHash: string; authorHandle: string;
  stance: Stance; body: string; mnoVerified: boolean;
  tippedDash: number; helpfulPct: number; createdAt: string };

type TipReceipt = { id: string; docRef: string; toId: string;
  amountDash: number; txid: string; createdAt: string };

type Session = { identityHandle: string; displayName: string;
  balanceDash: number };
```

## Service interfaces

```ts
interface ProposalMirror {
  getCycle(): CycleInfo;                      // { cycle, label, votingClosesInDays }
  getProposals(): Promise<Proposal[]>;
  getProposal(id: string): Promise<Proposal | null>;
}

interface ContentService {
  get(proposalHash: string): Promise<ProposalContent | null>;
  // v1: fixture-backed; v2: proposalContent documents
}

interface CommentService {
  list(proposalHash: string): Promise<Comment[]>;
  create(proposalHash: string, body: string, parentId?: string): Promise<Comment>;
  // v1: localStorage "govenr:comments:v1:<hash>"; v2: comment documents
}

interface ReviewService {
  list(proposalHash: string): Promise<Review[]>;
  upsert(proposalHash: string, stance: Stance, body: string): Promise<Review>;
  // one review per identity: v1 keyed by session handle; v2 unique index
}

interface TipService {
  tip(docRef: string, toId: string, amountDash: number): Promise<TipReceipt>;
  totalFor(docRef: string): Promise<number>;
  // v1: simulated txid "sim-" + 60 hex chars; v2: InstantSend + tipReceipt docs
}
```

## Key flows

**Review upsert:** the review form edits `reviewDraft` state; submit
calls `upsert`, which finds an existing review by session identity for
that proposalHash and replaces it, else creates. UI flips between
"Write a review" and "Edit your review" on that condition.

**Tip flow:** click tip → inline amount input (0.1–100 DASH, 3 decimals)
→ confirm → `TipService.tip()` → receipt created, item total updated via
`totalFor(docRef)`. A one-line disclosure renders under any simulated
tip: "v1 simulated · v2 settles on L1 via InstantSend."

**Mirror refresh:** hub page mounts → load → `setInterval` 60s →
re-fetch (v1: no-op with timestamp bump; keeps the v2 contract honest).

## Error & empty states

Empty lists render a centered quiet message ("No reviews yet — be the
first"). Unknown proposal id → a friendly not-found with a link back to
the hub. Fixture parse failure (corrupt file) → hard error page telling
the developer to re-extract the starter kit.

## v2 swap contract

Identical interfaces, Platform-backed implementations, `SOURCE`
header comments at each swap point. UI code must never import a
service's concrete implementation — only the interface module.
