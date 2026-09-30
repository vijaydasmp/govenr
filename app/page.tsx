/**
 * app/page.tsx — The Hub, as a magazine front page.
 *
 * Server component: fetches from the mirror API route at request time
 * (ISR, revalidates every 60 s). The page reads like an issue:
 *
 *   masthead   — cycle as the issue title, standfirst, edition strip
 *   cover story — the most-voted proposal as a full editorial spread
 *   contents   — every other proposal as an editorial card
 *
 * Every number is live from L1 (read-only); art is generated from
 * proposal hashes, never fetched. Zero-vote handling is delegated to
 * VoteBar and StateBadge.
 */

import Link from 'next/link';
import { fetchProposals } from '@/lib/mirror/proposal-mirror';
import MagazineCard from '@/components/magazine-card';
import CoverArt from '@/components/cover-art';
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

export default async function HubPage() {
  const { proposals, cycle } = await fetchProposals();

  const sourceBadgeStyle =
    cycle.source === 'fixture'
      ? { bg: 'var(--gold-dim)', color: 'var(--gold)' }
      : cycle.network === 'testnet'
      ? { bg: 'var(--l1-dim)', color: 'var(--l1)' }
      : { bg: 'var(--rail-dim)', color: 'var(--rail)' };

  // Cover story: the most-voted active proposal.
  const ranked = [...proposals].sort((a, b) => totalVotesOf(b) - totalVotesOf(a));
  const featured = ranked[0] ?? null;
  const rest = ranked.slice(1);

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
          No proposals found for this cycle.
        </p>
      ) : (
        <>
          {/* -------------------------------------- Cover story */}
          {featured && (
            <section aria-label="Cover story">
              <p
                className="font-mono text-xs font-semibold tracking-[0.25em] uppercase mb-4"
                style={{ color: 'var(--text-dim)' }}
              >
                Cover story
              </p>
              <Link
                href={`/proposals/${encodeURIComponent(featured.id)}`}
                className="group grid gap-6 sm:grid-cols-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
                aria-label={`View proposal: ${featured.title}`}
              >
                {/* Text column */}
                <div className="sm:col-span-3 space-y-4">
                  <h2
                    className="font-serif text-4xl leading-tight group-hover:underline underline-offset-8 decoration-1"
                    style={{ color: 'var(--text)' }}
                  >
                    <ProposalCardTitle
                      l1Title={featured.title}
                      proposalHash={featured.hash}
                    />
                  </h2>

                  <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    <span>by {featured.ownerHandle}</span>
                    <span style={{ color: 'var(--text)' }}>
                      {dashWithSymbol(featured.amountDash)}
                      {featured.isMonthly && (
                        <span style={{ color: 'var(--text-dim)' }}>
                          {' '}× {featured.paymentsRemaining}mo
                        </span>
                      )}
                    </span>
                    {featured.votingDeadline && (
                      <span>{timeUntil(featured.votingDeadline)} to vote</span>
                    )}
                    <StateBadge
                      state={featured.state}
                      zeroVotes={totalVotesOf(featured) === 0}
                    />
                  </div>

                  {!(
                    featured.votes.yes === 0 &&
                    featured.votes.no === 0 &&
                    featured.votes.abstain === 0
                  ) && (
                    <p
                      className="font-mono text-sm"
                      style={{ color: 'var(--gold)' }}
                    >
                      needs +{featured.neededYesToFund} yes to fund
                    </p>
                  )}

                  <VoteBar votes={featured.votes} className="max-w-md" />
                </div>

                {/* Cover plate */}
                <div className="sm:col-span-2 space-y-2">
                  <div
                    className="rounded-lg overflow-hidden border transition-shadow group-hover:shadow-xl"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <CoverArt hash={featured.hash} className="block w-full h-56" />
                  </div>
                  <p
                    className="font-mono text-[10px] break-all"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {featured.hash}
                  </p>
                </div>
              </Link>
            </section>
          )}

          {/* -------------------------------------- Contents grid */}
          {rest.length > 0 && (
            <section aria-label="In this cycle" className="space-y-6">
              <div
                className="flex items-center gap-4 border-t pt-6"
                style={{ borderColor: 'var(--border)' }}
              >
                <p
                  className="font-mono text-xs font-semibold tracking-[0.25em] uppercase"
                  style={{ color: 'var(--text-dim)' }}
                >
                  In this cycle
                </p>
                <p
                  className="font-mono text-xs"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {rest.length} more proposal{rest.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {rest.map((proposal, i) => (
                  <MagazineCard key={proposal.hash} proposal={proposal} index={i + 1} />
                ))}
              </div>
            </section>
          )}

          {/* -------------------------------------- Colophon */}
          <footer
            className="border-t pt-6 font-mono text-xs leading-relaxed"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            Votes read from L1 (read-only) · refreshed every 60 s · covers
            generated from proposal hashes · proposal text lives on Dash
            Platform as documents owned by their claimants.
          </footer>
        </>
      )}
    </div>
  );
}
