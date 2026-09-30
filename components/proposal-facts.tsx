/**
 * components/proposal-facts.tsx — the proposal case file.
 *
 * The complete top-of-page information block, in the DashCentral
 * tradition (owner, amount, payment window, deadline, votes, funding
 * verdict) — but every value here is live from the L1 mirror, in the
 * house style, with no price feed and no account system.
 *
 * Server component: no state, no client JavaScript.
 */

import type { Proposal, ProposalState } from '@/lib/types';
import { dashWithSymbol } from '@/lib/format/dash';
import { timeUntil } from '@/lib/format/dates';

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function Fact({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <p
        className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase"
        style={{ color: 'var(--text-dim)' }}
      >
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
        {children}
      </p>
    </div>
  );
}

function verdictOf(
  state: ProposalState,
  neededYesToFund: number,
): { text: string; color: string } {
  if (state === 'queued-next-cycle' || neededYesToFund === 0) {
    // On our mirror, neededYesToFund === 0 means the threshold is met.
    return { text: 'funded by the current tally', color: 'var(--yes)' };
  }
  if (state === 'not-funded') {
    return { text: 'not funded at the current tally', color: 'var(--no)' };
  }
  return {
    text: `needs +${neededYesToFund} yes to fund`,
    color: 'var(--gold)',
  };
}

export default function ProposalFacts({ proposal }: { proposal: Proposal }) {
  const {
    amountDash,
    isMonthly,
    paymentsRemaining,
    votingDeadline,
    paymentStart,
    paymentEnd,
    votes,
    neededYesToFund,
    state,
    paymentAddress,
    hash,
  } = proposal;

  const totalVotes = votes.yes + votes.no + votes.abstain;
  const verdict = verdictOf(state, neededYesToFund);

  const deadlineColor = (() => {
    if (!votingDeadline) return 'var(--text-dim)';
    const ms = new Date(votingDeadline).getTime() - Date.now();
    return ms < 0 ? 'var(--text-dim)' : ms < 7 * 86_400_000 ? 'var(--no)' : 'var(--text)';
  })();

  return (
    <section
      className="rounded-lg border px-6 py-5"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      aria-label="Proposal facts"
    >
      <p
        className="font-mono text-[10px] font-semibold tracking-[0.25em] uppercase mb-4"
        style={{ color: 'var(--text-dim)' }}
      >
        The facts — live from L1
      </p>

      <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        <Fact label="Requested">
          {isMonthly
            ? `${dashWithSymbol(amountDash)} / month`
            : dashWithSymbol(amountDash)}
          {isMonthly && paymentsRemaining > 0 && (
            <span style={{ color: 'var(--text-dim)' }}>
              {' '}
              × {paymentsRemaining} month{paymentsRemaining !== 1 ? 's' : ''}
            </span>
          )}
          {!isMonthly && <span style={{ color: 'var(--text-dim)' }}> · one-time</span>}
        </Fact>

        <Fact label="Payment window">
          {paymentStart && paymentEnd
            ? `${shortDate(paymentStart)} → ${shortDate(paymentEnd)}`
            : 'not scheduled yet'}
          {paymentsRemaining > 0 && (
            <span style={{ color: 'var(--text-dim)' }}>
              {' '}
              · {paymentsRemaining} payment{paymentsRemaining !== 1 ? 's' : ''}{' '}
              remaining
            </span>
          )}
        </Fact>

        <Fact label="Voting deadline">
          {votingDeadline ? (
            <span style={{ color: deadlineColor }}>
              {timeUntil(votingDeadline)}
            </span>
          ) : (
            'not yet open'
          )}
        </Fact>

        <Fact label="Votes cast">
          {totalVotes === 0 ? (
            <span style={{ color: 'var(--text-dim)' }}>no votes yet</span>
          ) : (
            <span>
              <span style={{ color: 'var(--yes)' }}>{votes.yes} yes</span>
              {' · '}
              <span style={{ color: 'var(--no)' }}>{votes.no} no</span>
              {' · '}
              <span style={{ color: 'var(--text-dim)' }}>{votes.abstain} abstain</span>
            </span>
          )}
        </Fact>

        <Fact label="Funding verdict">
          <span style={{ color: verdict.color }}>{verdict.text}</span>
        </Fact>

        <Fact label="Payout address">
          {paymentAddress ? (
            <span
              className="font-mono text-xs break-all"
              style={{ color: 'var(--text-dim)' }}
            >
              {paymentAddress}
            </span>
          ) : (
            <span style={{ color: 'var(--text-dim)' }}>unknown</span>
          )}
        </Fact>

        <Fact label="Governance object" full>
          <span
            className="font-mono text-xs break-all"
            style={{ color: 'var(--text-dim)' }}
          >
            {hash}
          </span>
        </Fact>
      </dl>

      <p
        className="font-mono text-[10px] mt-4"
        style={{ color: 'var(--text-dim)' }}
      >
        Every field above is read from the chain — no price feeds, no
        accounts, nothing but the gobject and the votes. Your masternode&rsquo;s
        vote on this proposal appears here with the verified-MNO ceremony
        (Stage 2).
      </p>
    </section>
  );
}
