/**
 * components/proposal-card.tsx
 *
 * Hub card: serif title, mono meta row, vote bar, state chip, amount, deadline.
 * Clicking anywhere on the card navigates to /proposals/[id].
 *
 * Zero-vote handling is delegated to VoteBar and StateBadge — this component
 * only needs to pass zeroVotes through.
 */

import Link from 'next/link';
import type { Proposal } from '@/lib/types';
import VoteBar from '@/components/vote-bar';
import StateBadge from '@/components/state-badge';
import { dashWithSymbol } from '@/lib/format/dash';
import { timeUntil } from '@/lib/format/dates';

interface ProposalCardProps {
  proposal: Proposal;
}

export default function ProposalCard({ proposal }: ProposalCardProps) {
  const {
    id,
    title,
    ownerHandle,
    amountDash,
    isMonthly,
    paymentsRemaining,
    state,
    votes,
    neededYesToFund,
    votingDeadline,
    engagement,
  } = proposal;

  const totalVotes = votes.yes + votes.no + votes.abstain;
  const zeroVotes = totalVotes === 0;

  const deadline = timeUntil(votingDeadline);

  return (
    <Link
      href={`/proposals/${encodeURIComponent(id)}`}
      className="block rounded-lg border transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
      aria-label={`View proposal: ${title}`}
    >
      <article className="p-5 space-y-3">
        {/* Title */}
        <h2
          className="font-serif text-lg leading-snug"
          style={{ color: 'var(--text)' }}
        >
          {title}
        </h2>

        {/* Meta row */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          <span>{ownerHandle}</span>
          <span
            className="font-semibold"
            style={{ color: 'var(--text)' }}
          >
            {dashWithSymbol(amountDash)}
            {isMonthly && (
              <span style={{ color: 'var(--text-dim)' }}>
                {' '}× {paymentsRemaining}mo
              </span>
            )}
          </span>
          <span>deadline {deadline}</span>
        </div>

        {/* Vote bar — zero-vote guard lives inside VoteBar */}
        <VoteBar votes={votes} />

        {/* Footer: state chip + engagement stats */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <StateBadge state={state} zeroVotes={zeroVotes} />
            {!zeroVotes && neededYesToFund > 0 && (
              <span
                className="font-mono text-xs"
                style={{ color: 'var(--text-dim)' }}
              >
                needs {neededYesToFund} more yes
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-3 font-mono text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            {engagement.reviews > 0 && (
              <span>{engagement.reviews} review{engagement.reviews !== 1 ? 's' : ''}</span>
            )}
            {engagement.comments > 0 && (
              <span>{engagement.comments} comment{engagement.comments !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
