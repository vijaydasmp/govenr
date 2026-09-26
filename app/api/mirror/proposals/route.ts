/**
 * app/api/mirror/proposals/route.ts
 *
 * Server-side proxy for the DashCentral public governance API.
 * The browser never touches DashCentral directly — all fetching happens
 * here, so CORS is never a concern.
 *
 * Revalidates every 60 s via ISR (revalidate = 60). The hub's client-side
 * 60-second refresh loop re-requests this route, which Next.js serves from
 * the ISR cache and regenerates in the background when stale.
 *
 * Fallback: if the DashCentral fetch fails (network error, 4xx/5xx, or
 * parse error) the handler returns local fixture data with source: 'fixture'.
 * The hub renders a source badge so users always know which data they see.
 */

import { NextResponse } from 'next/server';
import type {
  Proposal,
  ProposalState,
  CycleInfo,
  MirrorSource,
  MirrorResponse,
} from '@/lib/types';
import fixtureData from '@/fixtures/proposals.testnet.json';

// ---------------------------------------------------------------------------
// Route segment config — ISR at 60 s
// (do NOT combine with force-dynamic; that would disable the cache)
// ---------------------------------------------------------------------------

export const revalidate = 60;

// ---------------------------------------------------------------------------
// DashCentral API types (raw shapes — never exported, never leak into UI)
// ---------------------------------------------------------------------------

type DcProposal = {
  hash: string;
  name: string;                          // URL-safe slug — used as Proposal.id
  title: string;
  monthly_amount: number;
  remaining_payment_count: number;
  total_payment_count: number;
  yes: number;
  no: number;
  // abstain is not provided by DashCentral; always set to 0 in v1.
  // v2 (direct L1 read) will supply the real value.
  will_be_funded: boolean;
  in_next_budget: boolean;
  remaining_yes_votes_until_funding: number;
  voting_deadline: number | null;        // unix timestamp or null
  owner_username: string;
};

type DcBudgetResponse = {
  budget_cycle_start?: string;
  budget_cycle_end?: string;
  proposals: DcProposal[];
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function deriveState(p: DcProposal): ProposalState {
  if (p.in_next_budget || p.will_be_funded) return 'queued-next-cycle';
  if (p.voting_deadline !== null && p.remaining_yes_votes_until_funding > 0) {
    return 'needs-more-yes';
  }
  return 'not-funded';
}

function mapProposal(p: DcProposal): Proposal {
  return {
    id: p.name,
    hash: p.hash,
    title: p.title,
    ownerHandle: `@${p.owner_username}`,
    amountDash: p.monthly_amount,
    isMonthly: p.total_payment_count > 1,
    paymentsRemaining: p.remaining_payment_count,
    state: deriveState(p),
    votes: {
      yes: p.yes,
      no: p.no,
      abstain: 0, // DashCentral does not expose abstain counts
    },
    neededYesToFund: Math.max(0, p.remaining_yes_votes_until_funding),
    votingDeadline:
      p.voting_deadline !== null
        ? new Date(p.voting_deadline * 1000).toISOString()
        : null,
    // Engagement (reviews, comments, tips) comes from Platform documents,
    // not the L1 mirror. Zeroed here; the services layer overlays real values.
    engagement: { reviews: 0, comments: 0, tippedDash: 0, verifiedMnos: 0 },
  };
}

function buildCycleFromDc(data: DcBudgetResponse, source: MirrorSource): CycleInfo {
  const now = new Date().toISOString();
  const label = data.budget_cycle_end
    ? `Cycle ending ${data.budget_cycle_end.slice(0, 10)}`
    : 'Current cycle';
  return {
    cycle: data.budget_cycle_end ?? 'live',
    label,
    network: 'mainnet',
    lastUpdated: now,
    source,
  };
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
    amountDash: p.amountDash,
    isMonthly: p.isMonthly,
    paymentsRemaining: p.paymentsRemaining,
    state: p.state as ProposalState,
    votes: { yes: p.votes.yes, no: p.votes.no, abstain: p.votes.abstain },
    neededYesToFund: p.neededYesToFund,
    votingDeadline: p.votingDeadline,
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
// Route handler
// ---------------------------------------------------------------------------

const DASHCENTRAL_URL = 'https://www.dashcentral.org/api/v1/budget';

export async function GET(): Promise<NextResponse<MirrorResponse>> {
  try {
    const res = await fetch(DASHCENTRAL_URL, {
      headers: { Accept: 'application/json' },
      // next.revalidate is a Next.js server fetch extension; used here for
      // fine-grained per-fetch cache control on the server side.
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn(`[mirror] DashCentral HTTP ${res.status} — fixture fallback`);
      return NextResponse.json(fixtureResponse());
    }

    const raw: unknown = await res.json();

    if (
      typeof raw !== 'object' ||
      raw === null ||
      !Array.isArray((raw as Record<string, unknown>).proposals)
    ) {
      console.warn('[mirror] DashCentral response shape unexpected — fixture fallback');
      return NextResponse.json(fixtureResponse());
    }

    const dcData = raw as DcBudgetResponse;
    const source: MirrorSource = 'live DashCentral (mainnet)';
    const proposals = dcData.proposals.map(mapProposal);
    const cycle = buildCycleFromDc(dcData, source);

    return NextResponse.json({ source, cycle, proposals });
  } catch (err) {
    console.warn('[mirror] DashCentral fetch threw — fixture fallback:', err);
    return NextResponse.json(fixtureResponse());
  }
}
