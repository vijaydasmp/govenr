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

import type {
  Proposal,
  ProposalState,
  CycleInfo,
} from '@/lib/types';
import fixtureData from '@/fixtures/proposals.testnet.json';

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

const VALID_STATES: ProposalState[] = [
  'needs-more-yes',
  'not-funded',
  'queued-next-cycle',
];

/**
 * Validates that a raw fixture entry has the expected shape and returns it
 * typed as Proposal. Throws with a clear message on corrupt fixture data so
 * the developer sees it immediately rather than a silent empty-state.
 */
function parseProposal(raw: unknown): Proposal {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Fixture parse error: proposal entry is not an object');
  }

  const p = raw as Record<string, unknown>;

  for (const key of ['id', 'hash', 'title', 'ownerHandle', 'state']) {
    if (typeof p[key] !== 'string') {
      throw new Error(`Fixture parse error: proposal.${key} must be a string`);
    }
  }

  if (!VALID_STATES.includes(p.state as ProposalState)) {
    throw new Error(
      `Fixture parse error: proposal.state "${String(p.state)}" is not a valid ProposalState`,
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

// Parse once at module load so a corrupt fixture fails fast at startup.
const _proposals: Proposal[] = (fixtureData.proposals as unknown[]).map(
  parseProposal,
);

const _cycle: CycleInfo = {
  cycle: fixtureData._meta.cycle,
  label: fixtureData._meta.cycleLabel,
  network: fixtureData._meta.network,
  lastUpdated: fixtureData._meta.seededAt,
};

/**
 * Fixture-backed implementation of ProposalMirror (Path C).
 *
 * getCycle() is synchronous — data is available at module load.
 * getProposals() / getProposal() are async to match the interface contract
 * that network-backed implementations will honour.
 */
export const fixtureProposalMirror: ProposalMirror = {
  getCycle(): CycleInfo {
    return _cycle;
  },

  async getProposals(): Promise<Proposal[]> {
    return _proposals;
  },

  async getProposal(id: string): Promise<Proposal | null> {
    return _proposals.find((p) => p.id === id) ?? null;
  },
};

export default fixtureProposalMirror;
