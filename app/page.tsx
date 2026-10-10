/**
 * app/page.tsx — The Hub, as a DashCentral-style listed view.
 *
 * Server component: fetches from the mirror API route at request time
 * (ISR, revalidates every 60 s). The page reads like a front page:
 *
 *   masthead — brand headline, standfirst, edition strip (honesty badges)
 *   listed   — every active proposal as a full-width card: progress
 *              hairline, title, owner, payment terms, vote tallies,
 *              comments — stacked vertically, not a grid
 *
 * Every number is live from L1 (read-only). Voting happens in Dash Core,
 * never here — the count display is informational. Zero-vote handling is
 * delegated to VoteBar and StateBadge.
 */

import Link from 'next/link';
import { fetchProposals } from '@/lib/mirror/proposal-mirror';
import { resolveNetwork } from '@/lib/platform/network';
import ProposalCardTitle from '@/components/proposal-card-title';
import VoteBar from '@/components/vote-bar';
import StateBadge from '@/components/state-badge';
import { dashWithSymbol } from '@/lib/format/dash';
import { timeUntil, relativeTime } from '@/lib/format/dates';

// Revalidate every 60 s — matches the route handler's own ISR window.
export const revalidate = 60;

function totalVotesOf(p: { votes: { yes: number; no: number; abstain: number } }) {
  return p.votes.yes + p.votes.no + p.votes.abstain;
}

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string }>;
}) {
  const network = resolveNetwork((await searchParams)?.network);
  const { proposals, cycle } = await fetchProposals(network);

  const sourceBadgeStyle =
    cycle.source === 'unreachable'
      ? { bg: 'var(--gold-dim)', color: 'var(--no)' }
      : cycle.source === 'fixture'
      ? { bg: 'var(--gold-dim)', color: 'var(--gold)' }
      : cycle.network === 'testnet'
      ? { bg: 'var(--l1-dim)', color: 'var(--l1)' }
      : { bg: 'var(--rail-dim)', color: 'var(--rail)' };

  // Listed order: strongest net support first, then raw engagement.
  const ranked = [...proposals].sort((a, b) => {
    const netA = a.votes.yes - a.votes.no;
    const netB = b.votes.yes - b.votes.no;
    if (netA !== netB) return netB - netA;
    return totalVotesOf(b) - totalVotesOf(a);
  });

  // Real budget arithmetic from the live list — never invented totals.
  const monthlyAsk = proposals
    .filter((p) => p.isMonthly)
    .reduce((sum, p) => sum + p.amountDash, 0);
  const oneTimeAsk = proposals
    .filter((p) => !p.isMonthly)
    .reduce((sum, p) => sum + p.amountDash, 0);
  const deadlines = proposals
    .map((p) => p.votingDeadline)
    .filter((d): d is string => Boolean(d))
    .sort();
  const soonest = deadlines[0] ?? null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">

      {/* ------------------------------------------------ Masthead */}
      <header className="space-y-4">
        <p
          className="font-mono text-xs font-semibold tracking-[0.25em] uppercase"
          style={{ color: 'var(--gold)' }}
        >
          The DAO&rsquo;s front page
        </p>
        <h1
          className="font-serif text-5xl sm:text-6xl"
          style={{ color: 'var(--text)', lineHeight: 1.05 }}
        >
          Govenr
        </h1>
        <p
          className="max-w-2xl text-base leading-relaxed"
          style={{ color: 'var(--text-dim)' }}
        >
          Every active proposal, live from the chain — tallies, deadlines,
          and the reasoning beside them. L1 records the vote; Platform
          remembers why.
        </p>

        {/* Edition strip — honesty badges */}
        <div
          className="flex flex-wrap items-center gap-3 border-t border-b py-3"
          style={{ borderColor: 'var(--border)' }}
          aria-label="Cycle information"
        >
          <span
            className="font-mono text-xs rounded-full px-3 py-1"
            style={{
              backgroundColor: sourceBadgeStyle.bg,
              color: sourceBadgeStyle.color,
            }}
          >
            {cycle.source}
          </span>
          <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            {cycle.network}
          </span>
          <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} active
          </span>
          <span
            className="ml-auto font-mono text-xs"
            style={{ color: 'var(--text-dim)' }}
            title={`Last updated: ${cycle.lastUpdated}`}
          >
            updated {relativeTime(cycle.lastUpdated)}
          </span>
        </div>
      </header>

      {proposals.length === 0 ? (
        <p className="font-mono text-sm" style={{ color: 'var(--text-dim)' }}>
          {cycle.source === 'unreachable'
            ? 'Could not reach mainnet — nothing to show. This is a read-only mirror; try again in a minute.'
            : 'No proposals found for this cycle.'}
        </p>
      ) : (
        <>
          {/* ---------------------------------------- Listed proposals */}
          <section aria-label="Active proposals" className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-2">
              <p
                className="text-lg font-bold tracking-wide uppercase"
                style={{ color: 'var(--text)' }}
              >
                {proposals.length} active proposal
                {proposals.length !== 1 ? 's' : ''}
              </p>
              <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                active asks: {dashWithSymbol(monthlyAsk)} tDASH monthly
                {oneTimeAsk > 0
                  ? ` + ${dashWithSymbol(oneTimeAsk)} tDASH one-time`
                  : ''}
                {soonest ? ` · voting closes as soon as ${timeUntil(soonest)}` : ''}
              </p>
            </div>

            {network === 'mainnet' && (
              <p
                className="font-mono text-[10px] leading-relaxed"
                style={{ color: 'var(--text-dim)' }}
              >
                Mainnet is read-only, so these titles are the L1 object names.
                The title and description a claimant writes live on Dash
                Platform (testnet) for now.
              </p>
            )}

            <div className="space-y-4">
              {ranked.map((proposal) => {
                const net = proposal.votes.yes - proposal.votes.no;
                const pct = proposal.neededYesToFund > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (proposal.votes.yes / proposal.neededYesToFund) * 100
                      )
                    )
                  : 0;
                return (
                  <Link
                    key={proposal.hash}
                    href={`/proposals/${encodeURIComponent(proposal.id)}`}
                    className="group block rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--surface)',
                    }}
                    aria-label={`View proposal: ${proposal.title}`}
                  >
                    {/* Progress hairline — yes votes toward the funding threshold */}
                    <div
                      className="h-1 rounded-t-lg overflow-hidden"
                      style={{ backgroundColor: 'var(--border)' }}
                      title={`${pct}% of the yes votes needed to fund`}
                    >
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            net >= 0 ? 'var(--yes)' : 'var(--no)',
                        }}
                      />
                    </div>

                    <div className="p-5 space-y-3">
                      {/* Title + state */}
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h2
                          className="font-serif text-2xl leading-tight group-hover:underline underline-offset-8 decoration-1"
                          style={{ color: 'var(--text)' }}
                        >
                          <ProposalCardTitle
                            l1Title={proposal.title}
                            proposalHash={proposal.hash}
                          />
                        </h2>
                        <StateBadge
                          state={proposal.state}
                          zeroVotes={totalVotesOf(proposal) === 0}
                        />
                      </div>

                      {/* Owner + payment terms + deadline */}
                      <p
                        className="font-mono text-xs"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        by {proposal.ownerHandle} ·{' '}
                        {dashWithSymbol(proposal.amountDash)} tDASH{' '}
                        {proposal.isMonthly
                          ? `per month (${proposal.paymentsRemaining} payment${
                              proposal.paymentsRemaining !== 1 ? 's' : ''
                            } remaining)`
                          : 'one-time payment'}
                        {proposal.votingDeadline &&
                          ` · ${timeUntil(proposal.votingDeadline)} to vote`}
                      </p>

                      {/* Vote row: bar, net count, comments, CTA */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
                        <VoteBar
                          votes={proposal.votes}
                          className="min-w-[200px] max-w-md flex-1"
                        />
                        <div className="text-right">
                          <p
                            className="font-mono text-xl leading-none"
                            style={{
                              color: net >= 0 ? 'var(--yes)' : 'var(--no)',
                            }}
                          >
                            {net >= 0 ? '+' : ''}
                            {net}
                          </p>
                          <p
                            className="font-mono text-[10px] mt-1"
                            style={{ color: 'var(--text-dim)' }}
                          >
                            yes {proposal.votes.yes} · no {proposal.votes.no} ·
                            abstain {proposal.votes.abstain}
                          </p>
                        </div>
                        <p
                          className="font-mono text-xs"
                          style={{ color: 'var(--text-dim)' }}
                        >
                          {proposal.engagement.comments} comment
                          {proposal.engagement.comments !== 1 ? 's' : ''}
                        </p>
                        <p
                          className="ml-auto font-mono text-xs group-hover:underline underline-offset-4"
                          style={{ color: 'var(--l1)' }}
                        >
                          view →
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ------------------------------------------- Colophon */}
          <footer
            className="border-t pt-6 font-mono text-xs leading-relaxed"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            Votes read from L1 (read-only) · refreshed every 60 s ·{' '}
            {network === 'mainnet'
              ? 'mainnet mode is a read-only mirror — proposal documents live on testnet for now'
              : 'proposal text lives on Dash Platform as documents owned by their claimants'}{' '}
            · voting itself happens in Dash Core, never in this browser.
          </footer>
        </>
      )}
    </div>
  );
}
