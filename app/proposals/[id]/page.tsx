/**
 * app/proposals/[id]/page.tsx — Proposal detail page
 *
 * DashCentral order: header → case file (facts) → the voting panel →
 * claim → description → discussion. The reader decides with the numbers
 * in view; the reasoning follows.
 */

import { notFound } from 'next/navigation';
import { fetchProposals } from '@/lib/mirror/proposal-mirror';
import { resolveNetwork } from '@/lib/platform/network';
import VoteBar from '@/components/vote-bar';
import StateBadge from '@/components/state-badge';
import Link from 'next/link';
import ClaimPanel from '@/components/claim-panel';
import ProposalContentPanel from '@/components/proposal-content-panel';
import ProposalDisplayTitle from '@/components/proposal-display-title';
import VoteCtaPanel from '@/components/vote-cta-panel';
import DiscussionPanel from '@/components/discussion-panel';
import ProposalOwnerByline from '@/components/proposal-owner-byline';
import ProposalFacts from '@/components/proposal-facts';
import DaoWars from '@/components/dao-wars';


export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ network?: string }>;
}

export default async function ProposalDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const network = resolveNetwork((await searchParams)?.network);

  const { proposals } = await fetchProposals(network);
  const proposal = proposals.find(
    (p) => p.id === decodedId || p.hash === decodedId,
  );

  if (!proposal) notFound();

  const totalVotes = proposal.votes.yes + proposal.votes.no + proposal.votes.abstain;
  const zeroVotes = totalVotes === 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      {/* Back link */}
      <Link
        href="/"
        className="font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ color: 'var(--text-dim)' }}
      >
        ← All proposals
      </Link>

      {/* Header */}
      <div className="space-y-3">
        {/* The claimant's own title when one exists; the L1 object
            name otherwise (kept visible as a small mono line). */}
        <ProposalDisplayTitle
          l1Title={proposal.title}
          proposalHash={proposal.hash}
        />

        {/* Meta row */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          {/* Claimant's DPNS name when claimed (e.g. hehe.dash);
              the raw L1 handle (payment address) otherwise. */}
          <ProposalOwnerByline
            l1Handle={proposal.ownerHandle}
            proposalHash={proposal.hash}
          />
          <StateBadge state={proposal.state} zeroVotes={zeroVotes} />
        </div>

        {/* Vote bar */}
        <VoteBar votes={proposal.votes} className="max-w-md" />
      </div>

      {/* DAO Wars — the tally, made physical. Read-only; L1 votes. */}
      <DaoWars
        yes={proposal.votes.yes}
        no={proposal.votes.no}
        abstain={proposal.votes.abstain}
        neededYesToFund={proposal.neededYesToFund}
      />

      {/* The case file — every number live from L1 */}
      <ProposalFacts proposal={proposal} />

      {/* The voting panel — with the facts, before the description
          (DashCentral order: decide first, read after) */}
      <VoteCtaPanel proposalHash={proposal.hash} />

      {/* Sign-to-own claim panel (client-side, Platform session) */}
      <ClaimPanel
        proposalHash={proposal.hash}
        paymentAddress={proposal.paymentAddress}
        collateralAddress={proposal.collateralAddress}
        network={network}
      />

      {/* S9c: proposal content — written by the claimant, stored on
          Platform, rendered for everyone. Discussion/Reviews/Votes come
          in a later step. */}
      <ProposalContentPanel proposalHash={proposal.hash} network={network} />

      {/* The discussion — comments as Platform documents owned by their
          authors. Anyone can read; signed-in identities can post. */}
      <DiscussionPanel proposalHash={proposal.hash} network={network} />
    </div>
  );
}
