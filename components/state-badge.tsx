/**
 * components/state-badge.tsx
 *
 * Chip showing the funding state of a proposal.
 * When zeroVotes is true the chip renders dimmed — total votes are zero
 * so the state is provisional (tallies not yet meaningful).
 *
 * States:
 *   needs-more-yes   → amber background
 *   not-funded       → orange/red background
 *   queued-next-cycle → green background
 */

import type { ProposalState } from '@/lib/types';

interface StateBadgeProps {
  state: ProposalState;
  /** Pass true when yes+no+abstain === 0 to dim the chip */
  zeroVotes?: boolean;
}

const STATE_LABELS: Record<ProposalState, string> = {
  'needs-more-yes': 'needs more yes',
  'not-funded': 'not funded',
  'queued-next-cycle': 'queued',
};

const STATE_STYLES: Record<ProposalState, { bg: string; color: string }> = {
  'needs-more-yes': { bg: 'rgba(161,98,7,0.12)', color: '#92600a' },
  'not-funded':     { bg: 'rgba(194,65,12,0.10)', color: '#c2410c' },
  'queued-next-cycle': { bg: 'rgba(4,120,87,0.10)', color: '#047857' },
};

export default function StateBadge({ state, zeroVotes = false }: StateBadgeProps) {
  const label = STATE_LABELS[state];
  const { bg, color } = STATE_STYLES[state];

  return (
    <span
      className="font-mono text-xs rounded-full px-2 py-0.5 whitespace-nowrap"
      style={{
        backgroundColor: bg,
        color: zeroVotes ? 'var(--text-dim)' : color,
        opacity: zeroVotes ? 0.6 : 1,
      }}
      aria-label={`Proposal state: ${label}${zeroVotes ? ' (no votes yet)' : ''}`}
    >
      {label}
    </span>
  );
}
