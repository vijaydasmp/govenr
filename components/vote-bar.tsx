/**
 * components/vote-bar.tsx
 *
 * Shared yes/no/abstain bar + counts.
 * Zero-vote guard: when total === 0 renders a quiet mono "no votes yet"
 * label instead of a bar (avoids division by zero).
 *
 * Colour mapping (from design tokens):
 *   yes     → --yes  (#047857, green-700)
 *   no      → --no   (#c2410c, orange-700)
 *   abstain → --abs  (#94a3b8, slate-400)
 */

import type { ProposalVotes } from '@/lib/types';

interface VoteBarProps {
  votes: ProposalVotes;
  /** Optional extra class for the wrapper element */
  className?: string;
}

export default function VoteBar({ votes, className = '' }: VoteBarProps) {
  const { yes, no, abstain } = votes;
  const total = yes + no + abstain;

  if (total === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`} aria-label="No votes recorded yet">
        <span
          className="font-mono text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          no votes yet
        </span>
      </div>
    );
  }

  const yesPct = (yes / total) * 100;
  const noPct = (no / total) * 100;
  const abstainPct = (abstain / total) * 100;

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Bar */}
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`Votes: ${yes} yes, ${no} no, ${abstain} abstain`}
      >
        {yesPct > 0 && (
          <div
            style={{ width: `${yesPct}%`, backgroundColor: 'var(--yes)' }}
          />
        )}
        {noPct > 0 && (
          <div
            style={{ width: `${noPct}%`, backgroundColor: 'var(--no)' }}
          />
        )}
        {abstainPct > 0 && (
          <div
            style={{ width: `${abstainPct}%`, backgroundColor: 'var(--abs)' }}
          />
        )}
      </div>

      {/* Counts */}
      <div className="flex gap-3">
        <span className="font-mono text-xs" style={{ color: 'var(--yes)' }}>
          {yes} yes
        </span>
        <span className="font-mono text-xs" style={{ color: 'var(--no)' }}>
          {no} no
        </span>
        {abstain > 0 && (
          <span className="font-mono text-xs" style={{ color: 'var(--abs)' }}>
            {abstain} abs
          </span>
        )}
      </div>
    </div>
  );
}
