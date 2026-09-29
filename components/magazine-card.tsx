/**
 * components/magazine-card.tsx
 *
 * The editorial card — the magazine "story page" for one proposal:
 * generative cover plate on top, index number, category kicker, serif
 * headline, byline, live vote bar, state. Clicking navigates to the
 * proposal page.
 *
 * Server component.
 */

import Link from 'next/link';
import type { Proposal } from '@/lib/types';
import VoteBar from '@/components/vote-bar';
import StateBadge from '@/components/state-badge';
import CoverArt from '@/components/cover-art';
import { dashWithSymbol } from '@/lib/format/dash';
import { timeUntil } from '@/lib/format/dates';

interface MagazineCardProps {
  proposal: Proposal;
  index: number;
}

export default function MagazineCard({
  proposal,
  index,
}: MagazineCardProps) {
  const {
    id,
    hash,
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
  const num = String(index + 1).padStart(2, '0');

  return (
    <Link
      href={`/proposals/${encodeURIComponent(id)}`}
      className="group block rounded-lg border overflow-hidden transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
      aria-label={`View proposal: ${title}`}
    >
      <article>
        {/* Cover plate */}
        <div className="relative">
          <CoverArt hash={hash} className="block w-full h-32" />
          <span
            className="absolute top-2 left-3 font-mono text-xs tracking-widest"
            style={{ color: 'rgba(255, 255, 255, 0.8)' }}
          >
            {num}
          </span>
        </div>

        <div className="p-5 space-y-3">
          {/* Category kicker */}
          <p
            className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: 'var(--text-dim)' }}
          >
            {isMonthly ? 'Monthly' : 'One-time'} ·{' '}
            {dashWithSymbol(amountDash)}
            {isMonthly && paymentsRemaining > 0 && (
              <span> /mo × {paymentsRemaining}</span>
            )}
          </p>

          {/* Headline */}
          <h2
            className="font-serif text-2xl leading-tight group-hover:underline underline-offset-4 decoration-1"
            style={{ color: 'var(--text)' }}
          >
            {title}
          </h2>

          {/* Byline */}
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            <span>by {ownerHandle}</span>
            {votingDeadline && (
              <span>{timeUntil(votingDeadline)} left</span>
            )}
            {!zeroVotes && neededYesToFund > 0 && (
              <span style={{ color: 'var(--gold)' }}>
                needs +{neededYesToFund} yes
              </span>
            )}
          </div>

          {/* Live vote bar — L1 */}
          <VoteBar votes={votes} />

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <StateBadge state={state} zeroVotes={zeroVotes} />
            <div
              className="flex items-center gap-3 font-mono text-xs"
              style={{ color: 'var(--text-dim)' }}
            >
              {engagement.reviews > 0 && (
                <span>
                  {engagement.reviews} review
                  {engagement.reviews !== 1 ? 's' : ''}
                </span>
              )}
              {engagement.comments > 0 && (
                <span>
                  {engagement.comments} comment
                  {engagement.comments !== 1 ? 's' : ''}
                </span>
              )}
              {engagement.reviews === 0 && engagement.comments === 0 && (
                <span>{totalVotes} votes on chain</span>
              )}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
