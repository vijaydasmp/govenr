/**
 * lib/mirror/proposal-mirror.ts
 *
 * SOURCE: local (fixture)
 * Swap point: replace this implementation with a fetch-backed or
 * gRPC-backed version when Path A or B passes the spike criteria.
 * The ProposalMirror interface must not change on swap.
 *
 * See docs/spike-l1-mirror.md for the path decision and evidence.
 */

import fixtureData from '../../fixtures/proposals.testnet.json';

// ---------------------------------------------------------------------------
// Domain types (mirrored from lib/types.ts — import from there in app code)
// ---------------------------------------------------------------------------

export type ProposalState =
  | 'needs-more-yes'
  | 'not-funded'
  | 'queued-next-cycle';

export interface ProposalVotes {
  yes: number;
  no: number;
  abstain: number;
}

export interface ProposalEngagement {
  reviews: number;
  comments: number;
  tippedDash: number;
  verifiedMnos: number;
}

export interface Proposal {
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
  votingDeadline: string | null; // ISO 8601 UTC, or null for queued proposals
  engagement: ProposalEngagement;
}

export interface CycleInfo {
  cycle: string;         // e.g. "_04"
  label: string;         // e.g. "Cycle _04"
  network: string;       // e.g. "testnet" | "mainnet"
  lastUpdated: string;   // ISO 8601 UTC — when the fixture was last seeded
}

// ---------------------------------------------------------------------------
// Interface — identical for all mirror paths (fixture, REST, gRPC)
// ---------------------------------------------------------------------------

export interface ProposalMirror {
  /**
   * Returns current-cycle metadata.
   * Synchronous: the fixture is a static import, available immediately.
   */
  getCycle(): CycleInfo;

  /**
   * Returns all proposals in the current cycle, ordered as they appear
   * in the fixture (typically: active first, queued last).
   */
  getProposals(): Promise<Proposal[]>;

  /**
   * Returns a single proposal by its `id` field (e.g. "BTCBACKPORTSVIJAY_04"),
   * or null if no proposal with that id exists.
   */
  getProposal(id: string): Promise<Proposal | null>;
}

// ---------------------------------------------------------------------------
// Path C implementation — fixture-backed, no network calls
// ---------------------------------------------------------------------------

/**
 * Validates that a raw fixture proposal has the shape we expect.
 * Returns the proposal typed as Proposal, or throws with a clear message.
 * Keeps the rest of the app safe from corrupt fixture data.
 */
function parseProposal(raw: unknown): Proposal {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Fixture parse error: proposal entry is not an object');
  }

  const p = raw as Record<string, unknown>;

  const requiredStrings = ['id', 'hash', 'title', 'ownerHandle', 'state'];
  for (const key of requiredStrings) {
    if (typeof p[key] !== 'string') {
      throw new Error(`Fixture parse error: proposal.${key} must be a string`);
    }
  }

  const validStates: ProposalState[] = [
    'needs-more-yes',
    'not-funded',
    'queued-next-cycle',
  ];
  if (!validStates.includes(p.state as ProposalState)) {
    throw new Error(
      `Fixture parse error: proposal.state "${p.state}" is not a valid ProposalState`,
    );
  }

  if (typeof p.votes !== 'object' || p.votes === null) {
    throw new Error('Fixture parse error: proposal.votes must be an object');
  }
  const v = p.votes as Record<string, unknown>;
  if (
    typeof v.yes !== 'number' ||
    typeof v.no !== 'number' ||
    typeof v.abstain !== 'number'
  ) {
    throw new Error('Fixture parse error: proposal.votes fields must be numbers');
  }

  if (typeof p.engagement !== 'object' || p.engagement === null) {
    throw new Error('Fixture parse error: proposal.engagement must be an object');
  }
  const e = p.engagement as Record<string, unknown>;

  return {
    id: p.id as string,
    hash: p.hash as string,
    title: p.title as string,
    ownerHandle: p.ownerHandle as string,
    amountDash: typeof p.amountDash === 'number' ? p.amountDash : 0,
    isMonthly: typeof p.isMonthly === 'boolean' ? p.isMonthly : false,
    paymentsRemaining:
      typeof p.paymentsRemaining === 'number' ? p.paymentsRemaining : 0,
    state: p.state as ProposalState,
    votes: {
      yes: v.yes as number,
      no: v.no as number,
      abstain: v.abstain as number,
    },
    neededYesToFund:
      typeof p.neededYesToFund === 'number' ? p.neededYesToFund : 0,
    votingDeadline:
      typeof p.votingDeadline === 'string' ? p.votingDeadline : null,
    engagement: {
      reviews: typeof e.reviews === 'number' ? e.reviews : 0,
      comments: typeof e.comments === 'number' ? e.comments : 0,
      tippedDash: typeof e.tippedDash === 'number' ? e.tippedDash : 0,
      verifiedMnos: typeof e.verifiedMnos === 'number' ? e.verifiedMnos : 0,
    },
  };
}

// Parse once at module load — fail loud if the fixture is corrupt so the
// developer knows immediately rather than seeing a silent empty state.
const _proposals: Proposal[] = (
  fixtureData.proposals as unknown[]
).map(parseProposal);

const _cycle: CycleInfo = {
  cycle: fixtureData._meta.cycle,
  label: fixtureData._meta.cycleLabel,
  network: fixtureData._meta.network,
  lastUpdated: fixtureData._meta.seededAt,
};

/**
 * Fixture-backed implementation of ProposalMirror (Path C).
 *
 * getCycle() is synchronous because the data is available at module load.
 * getProposals() / getProposal() are async to keep the interface
 * consistent with future network-backed implementations.
 *
 * v1 refresh cadence: the hub page calls getProposals() on mount and on a
 * 60-second interval; here those calls are no-ops (returns the same data).
 * In a network-backed implementation they would re-fetch.
 */
export const fixtureProposalMirror: ProposalMirror = {
  getCycle(): CycleInfo {
    return _cycle;
  },

  async getProposals(): Promise<Proposal[]> {
    // Simulate the async boundary that v2 will cross over the wire.
    return _proposals;
  },

  async getProposal(id: string): Promise<Proposal | null> {
    return _proposals.find((p) => p.id === id) ?? null;
  },
};

// Default export for convenience — app code imports this.
export default fixtureProposalMirror;
