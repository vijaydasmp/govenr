/**
 * lib/types.ts
 *
 * Single source of domain types for Govenr v1.
 * Components and services import from here — never re-declare these types
 * elsewhere. See design.md for the authoritative definitions.
 */

// ---------------------------------------------------------------------------
// L1 mirror types
// ---------------------------------------------------------------------------

export type ProposalState =
  | 'needs-more-yes'
  | 'not-funded'
  | 'queued-next-cycle';

export type ProposalVotes = {
  yes: number;
  no: number;
  abstain: number;
};

export type ProposalEngagement = {
  reviews: number;
  comments: number;
  tippedDash: number;
  verifiedMnos: number;
};

export type Proposal = {
  id: string;
  hash: string;
  title: string;
  ownerHandle: string;
  amountDash: number;
  isMonthly: boolean;
  paymentsRemaining: number;
  state: ProposalState;
  votes: ProposalVotes;
  neededYesToFund: number;
  /** ISO 8601 UTC string, or null for queued proposals with no deadline yet */
  votingDeadline: string | null;
  engagement: ProposalEngagement;
};

/**
 * Where the mirror data was sourced from in this response.
 * Rendered as a small badge near the cycle strip (honesty requirement).
 */
export type MirrorSource =
  | 'live insight (testnet)'
  | 'live node RPC (mainnet)'
  | 'fixture';

export type CycleInfo = {
  cycle: string;       // e.g. "_04"
  label: string;       // e.g. "Cycle _04"
  network: string;     // "testnet" | "mainnet"
  lastUpdated: string; // ISO 8601 UTC
  source: MirrorSource;
};

/**
 * Shape returned by GET /api/mirror/proposals.
 * Defined here (not in the route file) so lib/ modules can import it
 * without pulling in next/server.
 */
export type MirrorResponse = {
  source: MirrorSource;
  cycle: CycleInfo;
  proposals: Proposal[];
};

// ---------------------------------------------------------------------------
// Platform document types (v1: fixture + localStorage; v2: data contracts)
// ---------------------------------------------------------------------------

export type ProposalContent = {
  proposalHash: string;
  title: string;
  body: string;
  milestones: string[];
  reportRefs: string[];
};

export type Comment = {
  id: string;
  proposalHash: string;
  /** Omit for top-level comments; set to parent comment id for replies */
  parentId?: string;
  body: string;
  authorHandle: string;
  createdAt: string; // ISO 8601 UTC
};

export type Stance = 'support' | 'concern' | 'neutral';

export type Review = {
  id: string;
  proposalHash: string;
  authorHandle: string;
  stance: Stance;
  body: string;
  /** Reserved for v1.1 — always false in v1 */
  mnoVerified: boolean;
  tippedDash: number;
  /** 0–100, percentage of readers who found this review helpful */
  helpfulPct: number;
  createdAt: string; // ISO 8601 UTC
};

export type TipReceipt = {
  id: string;
  /** "<type>:<documentId>", e.g. "review:rev-seed-001" */
  docRef: string;
  toId: string;
  amountDash: number;
  /**
   * L1 transaction id.
   * v1: simulated — "sim-" + 60 random hex chars.
   * v2: real InstantSend txid.
   */
  txid: string;
  createdAt: string; // ISO 8601 UTC
};

// ---------------------------------------------------------------------------
// Session (mock in v1)
// ---------------------------------------------------------------------------

export type Session = {
  identityHandle: string;
  displayName: string;
  balanceDash: number;
};
