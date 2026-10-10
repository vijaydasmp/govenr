/**
 * lib/mirror/proposal-mirror.ts
 *
 * SOURCE: live insight (testnet) | live node RPC (mainnet) | fixture
 * Swap point: the UI switch (?network=mainnet) or the NETWORK env var as a
 * deployment-wide default. See lib/platform/network.ts.
 *
 * Server-side only. Called from app/api/mirror/proposals/route.ts.
 * Do NOT import this module from client components — use the mirror API
 * route (/api/mirror/proposals) via proposalMirror (client cache) instead.
 *
 * Network selection:
 *   NETWORK=testnet  → GET https://insight.testnet.networks.dash.org/insight-api/gobject/list/proposal
 *   NETWORK=mainnet  → JSON-RPC POST https://dash-rpc.publicnode.com/ (gobject list + getgovernanceinfo)
 *   (default)        → testnet
 *   Any fetch failure → fixture fallback
 *
 * See docs/spike-l1-mirror.md for the path decision.
 */

import type {
  Proposal,
  ProposalState,
  ProposalVotes,
  CycleInfo,
  MirrorSource,
  MirrorResponse,
} from '@/lib/types';
import fixtureData from '@/fixtures/proposals.testnet.json';
import {
  getActiveNetwork,
  resolveNetwork,
  type GovenrNetwork,
} from '@/lib/platform/network';

// ---------------------------------------------------------------------------
// ProposalMirror interface — unchanged across all mirror paths
// ---------------------------------------------------------------------------

export interface ProposalMirror {
  /**
   * Returns current-cycle metadata including the data source.
   * Returns null before the first successful fetch completes.
   */
  getCycle(): CycleInfo | null;

  /**
   * Returns all proposals in the current cycle.
   * Always resolves — falls back to fixtures on any upstream error.
   * Call from client components only (uses a relative URL).
   */
  getProposals(): Promise<Proposal[]>;

  /**
   * Returns a single proposal by id or hash, or null.
   * Call from client components only.
   */
  getProposal(id: string): Promise<Proposal | null>;
}

// ---------------------------------------------------------------------------
// Client-side cache (60 s TTL) — hits /api/mirror/proposals (same-origin)
// ---------------------------------------------------------------------------

type CacheEntry = { data: MirrorResponse; fetchedAt: number };
// Keyed by network — flipping the switch must never serve the other
// network's cached data.
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

async function fetchFromRoute(): Promise<MirrorResponse> {
  const network = getActiveNetwork();
  const now = Date.now();
  const hit = _cache.get(network);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.data;
  }
  const res = await fetch(`/api/mirror/proposals?network=${network}`, {
    next: { revalidate: 60 },
  } as RequestInit);
  if (!res.ok) throw new Error(`Mirror fetch failed: HTTP ${res.status}`);
  const data = (await res.json()) as MirrorResponse;
  _cache.set(network, { data, fetchedAt: now });
  return data;
}

export const proposalMirror: ProposalMirror = {
  getCycle(): CycleInfo | null {
    return _cache.get(getActiveNetwork())?.data.cycle ?? null;
  },
  async getProposals(): Promise<Proposal[]> {
    return (await fetchFromRoute()).proposals;
  },
  async getProposal(id: string): Promise<Proposal | null> {
    const data = await fetchFromRoute();
    return data.proposals.find((p) => p.id === id || p.hash === id) ?? null;
  },
};

export default proposalMirror;

// ---------------------------------------------------------------------------
// Server-side fetch — called by the route handler only
// ---------------------------------------------------------------------------

const TESTNET_INSIGHT_URL =
  'https://insight.testnet.networks.dash.org/insight-api/gobject/list/proposal';

const MAINNET_RPC_URL = 'https://dash-rpc.publicnode.com/';

const FETCH_TIMEOUT_MS = 10_000;

// Raw shape coming back from the Insight API
interface InsightProposal {
  Hash?: string;
  CollateralHash?: string;
  CollateralAddress?: string;
  DataObject?: {
    name?: string;
    payment_address?: string;
    payment_amount?: number;
    start_epoch?: number;
    end_epoch?: number;
    type?: number;
    url?: string;
  };
  AbsoluteYesCount?: number;
  YesCount?: number;
  NoCount?: number;
  AbstainCount?: number;
}

// Raw shape coming back from the mainnet RPC gobject list
interface RpcGobjectEntry {
  Hash?: string;
  DataString?: string;
  AbsoluteYesCount?: number;
  YesCount?: number;
  NoCount?: number;
  AbstainCount?: number;
}

function epochToIso(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}

function deriveState(
  yes: number,
  no: number,
  neededYesToFund: number,
  deadline: string | null,
): ProposalState {
  if (neededYesToFund <= 0) return 'queued-next-cycle';
  const netYes = yes - no;
  if (netYes < 0) return 'not-funded';
  if (deadline !== null && new Date(deadline).getTime() > Date.now()) {
    return 'needs-more-yes';
  }
  return 'not-funded';
}

// ---------------------------------------------------------------------------
// Testnet adapter (Insight API)
// ---------------------------------------------------------------------------

async function fetchTestnet(): Promise<MirrorResponse> {
  const res = await fetch(TESTNET_INSIGHT_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Testnet Insight HTTP ${res.status}`);
  }

  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) {
    throw new Error('Testnet Insight: expected array, got unexpected shape');
  }

  const source: MirrorSource = 'live insight (testnet)';
  const now = new Date().toISOString();

  const proposals: Proposal[] = (raw as InsightProposal[]).flatMap((item) => {
    try {
      const hash = item.Hash;
      if (!hash) return [];

      const d = item.DataObject;
      if (!d || !d.name) return [];

      const yes = item.YesCount ?? 0;
      const no = item.NoCount ?? 0;
      const abstain = item.AbstainCount ?? 0;
      const votes: ProposalVotes = { yes, no, abstain };

      const endEpoch = d.end_epoch;
      const votingDeadline = endEpoch != null ? epochToIso(endEpoch) : null;
      const paymentStart =
        d.start_epoch != null ? epochToIso(d.start_epoch) : null;
      const paymentEnd = endEpoch != null ? epochToIso(endEpoch) : null;

      // neededYesToFund: rough estimate — absolute yes threshold unknown on
      // testnet; use AbsoluteYesCount proxy (negative means already funded)
      const absoluteYes = item.AbsoluteYesCount ?? yes - no;
      const neededYesToFund = absoluteYes < 0 ? 0 : Math.max(0, 1 - absoluteYes);

      const state = deriveState(yes, no, neededYesToFund, votingDeadline);

      const amountDash = d.payment_amount ?? 0;

      return [
        {
          id: d.name,
          hash,
          title: d.name,           // detail page will overlay richer title from content-service
          ownerHandle: d.payment_address
            ? `${d.payment_address.slice(0, 8)}…`
            : 'unknown',
          paymentAddress: d.payment_address ?? null,
          collateralAddress: item.CollateralAddress ?? null,
          amountDash,
          isMonthly: false,
          paymentsRemaining: 1,
          state,
          votes,
          neededYesToFund,
          votingDeadline,
          paymentStart,
          paymentEnd,
          engagement: { reviews: 0, comments: 0, tippedDash: 0, verifiedMnos: 0 },
        } satisfies Proposal,
      ];
    } catch {
      // Skip malformed entries — never crash the whole list
      return [];
    }
  });

  const cycle: CycleInfo = {
    cycle: 'live',
    label: 'Live testnet',
    network: 'testnet',
    lastUpdated: now,
    source,
  };

  return { source, cycle, proposals };
}

// ---------------------------------------------------------------------------
// Mainnet adapter (JSON-RPC)
// ---------------------------------------------------------------------------

async function rpcPost(method: string, params: unknown[]): Promise<unknown> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const res = await fetch(MAINNET_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Mainnet RPC HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: unknown };
  if (json.error) throw new Error(`Mainnet RPC error: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function fetchMainnet(): Promise<MirrorResponse> {
  const [gobjectsRaw, govInfoRaw] = await Promise.all([
    rpcPost('gobject', ['list', 'all', 'proposals']),
    rpcPost('getgovernanceinfo', []),
  ]);

  // gobject list returns a map keyed by hash
  if (typeof gobjectsRaw !== 'object' || gobjectsRaw === null) {
    throw new Error('Mainnet RPC: gobject list returned unexpected shape');
  }

  const govInfo =
    typeof govInfoRaw === 'object' && govInfoRaw !== null
      ? (govInfoRaw as Record<string, unknown>)
      : {};
  const fundingThreshold =
    typeof govInfo.fundingthreshold === 'number' ? govInfo.fundingthreshold : 10;

  const source: MirrorSource = 'live node RPC (mainnet)';
  const now = new Date().toISOString();

  const proposals: Proposal[] = Object.entries(
    gobjectsRaw as Record<string, RpcGobjectEntry>,
  ).flatMap(([hash, entry]) => {
    try {
      // Parse DataString (JSON-encoded proposal data)
      const dataStr = entry.DataString;
      if (!dataStr) return [];

      let parsed: unknown;
      try {
        parsed = JSON.parse(dataStr);
      } catch {
        return [];
      }

      // DataString is an array: [["proposal", {...}]]
      if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) return [];
      const inner = parsed[0][1] as Record<string, unknown> | undefined;
      if (!inner || typeof inner.name !== 'string') return [];

      const yes = entry.YesCount ?? 0;
      const no = entry.NoCount ?? 0;
      const abstain = entry.AbstainCount ?? 0;
      const votes: ProposalVotes = { yes, no, abstain };

      const endEpoch =
        typeof inner.end_epoch === 'number' ? inner.end_epoch : null;
      const votingDeadline = endEpoch != null ? epochToIso(endEpoch) : null;
      const paymentStart =
        typeof inner.start_epoch === 'number'
          ? epochToIso(inner.start_epoch)
          : null;
      const paymentEnd = endEpoch != null ? epochToIso(endEpoch) : null;

      const absoluteYes = entry.AbsoluteYesCount ?? yes - no;
      const neededYesToFund = Math.max(
        0,
        fundingThreshold - absoluteYes,
      );

      const state = deriveState(yes, no, neededYesToFund, votingDeadline);

      const amountDash =
        typeof inner.payment_amount === 'number' ? inner.payment_amount : 0;

      const paymentAddress =
        typeof inner.payment_address === 'string' ? inner.payment_address : '';

      return [
        {
          id: inner.name,
          hash,
          title: inner.name,
          ownerHandle: paymentAddress ? `${paymentAddress.slice(0, 8)}…` : 'unknown',
          paymentAddress: paymentAddress || null,
          collateralAddress: null, // RPC gobject collateral parsing: later story
          amountDash,
          isMonthly: false,
          paymentsRemaining: 1,
          state,
          votes,
          neededYesToFund,
          votingDeadline,
          paymentStart,
          paymentEnd,
          engagement: { reviews: 0, comments: 0, tippedDash: 0, verifiedMnos: 0 },
        } satisfies Proposal,
      ];
    } catch {
      return [];
    }
  });

  const cycle: CycleInfo = {
    cycle: 'live',
    label: 'Live mainnet',
    network: 'mainnet',
    lastUpdated: now,
    source,
  };

  return { source, cycle, proposals };
}

// ---------------------------------------------------------------------------
// Fixture fallback
// ---------------------------------------------------------------------------

function fixtureResponse(): MirrorResponse {
  const proposals: Proposal[] = fixtureData.proposals.map((p) => ({
    id: p.id,
    hash: p.hash,
    title: p.title,
    ownerHandle: p.ownerHandle,
    paymentAddress: null,
    collateralAddress: null,
    amountDash: p.amountDash,
    isMonthly: p.isMonthly,
    paymentsRemaining: p.paymentsRemaining,
    state: p.state as ProposalState,
    votes: { yes: p.votes.yes, no: p.votes.no, abstain: p.votes.abstain },
    neededYesToFund: p.neededYesToFund,
    votingDeadline: p.votingDeadline,
    paymentStart: p.paymentStart ?? null,
    paymentEnd: p.paymentEnd ?? null,
    engagement: {
      reviews: p.engagement.reviews,
      comments: p.engagement.comments,
      tippedDash: p.engagement.tippedDash,
      verifiedMnos: p.engagement.verifiedMnos,
    },
  }));

  const cycle: CycleInfo = {
    cycle: fixtureData._meta.cycle,
    label: fixtureData._meta.cycleLabel,
    network: fixtureData._meta.network,
    lastUpdated: fixtureData._meta.seededAt,
    source: 'fixture',
  };

  return { source: 'fixture', cycle, proposals };
}

// ---------------------------------------------------------------------------
// Public server-side entry point — called by the route handler
// ---------------------------------------------------------------------------

/**
 * Fetches proposals from the appropriate upstream based on the NETWORK env
 * variable. Falls back to fixtures on any error.
 *
 * NETWORK=testnet  → Insight API (default)
 * NETWORK=mainnet  → Dash Core JSON-RPC
 */
export async function fetchProposals(
  network: GovenrNetwork = resolveNetwork(process.env.NETWORK),
): Promise<MirrorResponse> {
  try {
    if (network === 'mainnet') {
      return await fetchMainnet();
    }
    return await fetchTestnet();
  } catch (err) {
    console.warn(`[mirror] ${network} fetch failed:`, err);
    // Testnet falls back to fixtures. Mainnet must NOT: serving testnet
    // fixtures under a mainnet label would state something false.
    if (network === 'mainnet') return unreachableResponse();
    return fixtureResponse();
  }
}

/**
 * Mainnet could not be reached. Empty, explicit, honestly labelled —
 * never testnet fixtures wearing a mainnet badge.
 */
function unreachableResponse(): MirrorResponse {
  return {
    source: 'unreachable',
    cycle: {
      cycle: '—',
      label: 'Mainnet unreachable',
      network: 'mainnet',
      lastUpdated: new Date().toISOString(),
      source: 'unreachable',
    },
    proposals: [],
  };
}
