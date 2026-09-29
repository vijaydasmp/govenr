/**
 * app/proposals/[id]/page.tsx — Proposal detail page
 *
 * v1 stub: resolves the proposal by id/hash from the mirror and renders
 * the title and basic metadata. Tabbed content (Overview, Discussion,
 * Reviews, Votes) is wired in a subsequent step.
 */

import { notFound } from 'next/navigation';
import { fetchProposals } from '@/lib/mirror/proposal-mirror';
import VoteBar from '@/components/vote-bar';
import StateBadge from '@/components/state-badge';
import { dashWithSymbol } from '@/lib/format/dash';
import { timeUntil } from '@/lib/format/dates';
import Link from 'next/link';
import ClaimPanel from '@/components/claim-panel';
import ProposalContentPanel from '@/components/proposal-content-panel';


export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProposalDetailPage({ params }: Props) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  const { proposals } = await fetchProposals();
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
        <h1
          className="font-serif text-3xl leading-snug"
          style={{ color: 'var(--text)' }}
        >
          {proposal.title}
        </h1>

        {/* Meta row */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          <span>{proposal.ownerHandle}</span>
          <span style={{ color: 'var(--text)' }}>
            {dashWithSymbol(proposal.amountDash)}
            {proposal.isMonthly && (
              <span style={{ color: 'var(--text-dim)' }}>
                {' '}× {proposal.paymentsRemaining}mo
              </span>
            )}
          </span>
          {proposal.votingDeadline && (
            <span>deadline {timeUntil(proposal.votingDeadline)}</span>
          )}
          <StateBadge state={proposal.state} zeroVotes={zeroVotes} />
        </div>

        {/* Vote bar */}
        <VoteBar votes={proposal.votes} className="max-w-md" />
      </div>

      {/* Hash */}
      <p
        className="font-mono text-xs break-all"
        style={{ color: 'var(--text-dim)' }}
      >
        {proposal.hash}
      </p>

      {/* Sign-to-own claim panel (client-side, Platform session) */}
      <ClaimPanel
        proposalHash={proposal.hash}
        paymentAddress={proposal.paymentAddress}
        collateralAddress={proposal.collateralAddress}
      />

      {/* S9c: proposal content — written by the claimant, stored on
          Platform, rendered for everyone. Discussion/Reviews/Votes come
          in a later step. */}
      <ProposalContentPanel proposalHash={proposal.hash} />
    </div>
  );
}
