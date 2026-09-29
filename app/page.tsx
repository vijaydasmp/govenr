/**
 * app/page.tsx — Proposal Hub
 *
 * Server component: fetches from the mirror API route at request time
 * (ISR, revalidates every 60 s). Renders the cycle strip, source badge,
 * and a card per proposal.
 *
 * Zero-vote handling is delegated to VoteBar and StateBadge inside
 * ProposalCard — this page just passes proposals through.
 */

import { fetchProposals } from '@/lib/mirror/proposal-mirror';
import ProposalCard from '@/components/proposal-card';
import { relativeTime } from '@/lib/format/dates';

// Revalidate every 60 s — matches the route handler's own ISR window.
export const revalidate = 60;

export default async function HubPage() {
  const { proposals, cycle } = await fetchProposals();

  const sourceBadgeStyle =
    cycle.source === 'fixture'
      ? { bg: 'var(--gold-dim)', color: 'var(--gold)' }
      : cycle.network === 'testnet'
      ? { bg: 'var(--l1-dim)', color: 'var(--l1)' }
      : { bg: 'var(--rail-dim)', color: 'var(--rail)' };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

      {/* Page header */}
      <div className="space-y-1">
        <p
          className="font-mono text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--gold)' }}
        >
          Proposals
        </p>
        <h1
          className="font-serif text-4xl"
          style={{ color: 'var(--text)', lineHeight: 1.1 }}
        >
          {cycle.label}
        </h1>
      </div>

      {/* Cycle strip — source badge + deadline */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
        aria-label="Cycle information"
      >
        {/* Source badge */}
        <span
          className="font-mono text-xs rounded-full px-3 py-1"
          style={{
            backgroundColor: sourceBadgeStyle.bg,
            color: sourceBadgeStyle.color,
          }}
        >
          {cycle.source}
        </span>

        {/* Network */}
        <span
          className="font-mono text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          {cycle.network}
        </span>

        {/* Proposal count */}
        <span
          className="font-mono text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
        </span>

        {/* Last updated — pushed right */}
        <span
          className="ml-auto font-mono text-xs"
          style={{ color: 'var(--text-dim)' }}
          title={`Last updated: ${cycle.lastUpdated}`}
        >
          updated {relativeTime(cycle.lastUpdated)}
        </span>
      </div>

      {/* Proposal list */}
      {proposals.length === 0 ? (
        <p
          className="font-mono text-sm"
          style={{ color: 'var(--text-dim)' }}
        >
          No proposals found for this cycle.
        </p>
      ) : (
        <ul className="space-y-4 list-none" role="list" aria-label="Proposals">
          {proposals.map((proposal) => (
            <li key={proposal.hash}>
              <ProposalCard proposal={proposal} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
