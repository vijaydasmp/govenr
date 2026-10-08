'use client';

/**
 * components/dao-wars.tsx
 *
 * The tally, made physical: a read-only tug-of-war between YES and NO,
 * plus the funding line the vote has to cross.
 *
 * Two honesties are designed in, not bolted on:
 *   1. The tug is RELATIVE (yes vs no among cast votes). The FUNDING LINE
 *      is ABSOLUTE (the network's threshold). Showing both means winning
 *      the tug can never be mistaken for being funded.
 *   2. Abstain never pulls. It is counted and named separately.
 *
 * Nothing here votes. L1 does that; this only shows it.
 */

type Props = {
  yes: number;
  no: number;
  abstain: number;
  neededYesToFund: number;
};

export default function DaoWars({ yes, no, abstain, neededYesToFund }: Props) {
  const decided = yes + no;
  const net = yes - no;
  const total = decided + abstain;

  // -100 (all no) .. 0 (dead even) .. +100 (all yes), among cast votes only.
  const pull = decided > 0 ? ((yes - no) / decided) * 100 : 0;

  // The knot renders at its TRUE position on the first paint — no entry
  // animation from the centre. A rope that starts centred would state
  // something false until JavaScript runs, and this app does not do that.
  // Movement is still animated: the CSS transition below fires whenever the
  // tally changes (the 60 s refresh), which is when the pull is meaningful.
  const markerPct = 50 + (pull / 100) * 50;

  // Distance to the funding line, in absolute votes: the net we have, over
  // the net we would need (current net + the yes still required).
  const funded = neededYesToFund <= 0;
  const target = net + neededYesToFund;
  const toLinePct = funded
    ? 100
    : target > 0
      ? Math.max(0, Math.min(100, (net / target) * 100))
      : 0;

  const yesLeads = net > 0;
  const even = net === 0;

  return (
    <section
      className="rounded-lg border px-5 py-4 space-y-3"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      aria-label="Vote tug of war"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p
          className="font-mono text-xs font-semibold tracking-[0.25em] uppercase"
          style={{ color: 'var(--gold)' }}
        >
          DAO wars
        </p>
        <p className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
          the tally, made physical — read-only; the chain votes, this shows it
        </p>
      </div>

      {total === 0 ? (
        <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          the rope is slack — no votes yet
        </p>
      ) : (
        <>
          {/* The rope */}
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-lg leading-none"
              style={{ color: 'var(--no)' }}
            >
              {no}
            </span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--no)' }}>
              NO
            </span>

            <div
              className="relative flex-1 h-6"
              role="img"
              aria-label={`Tug of war: ${yes} yes pulling against ${no} no, net ${
                net > 0 ? '+' : ''
              }${net}`}
            >
              {/* track */}
              <div
                className="absolute inset-x-0 top-1/2 h-1.5 rounded-full"
                style={{
                  backgroundColor: 'var(--border)',
                  transform: 'translateY(-50%)',
                }}
              />
              {/* centre mark */}
              <div
                className="absolute top-1/2 left-1/2 h-4 w-px"
                style={{
                  backgroundColor: 'var(--border-strong)',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              {/* the knot */}
              <div
                className="absolute top-1/2 h-4 w-4 rounded-sm border"
                style={{
                  left: `${markerPct}%`,
                  transform: 'translate(-50%, -50%) rotate(45deg)',
                  transition: 'left 900ms ease-out, background-color 400ms ease-out',
                  backgroundColor: even
                    ? 'var(--text-dim)'
                    : yesLeads
                      ? 'var(--yes)'
                      : 'var(--no)',
                  borderColor: 'var(--surface)',
                }}
              />
            </div>

            <span className="font-mono text-[10px]" style={{ color: 'var(--yes)' }}>
              YES
            </span>
            <span
              className="font-mono text-lg leading-none"
              style={{ color: 'var(--yes)' }}
            >
              {yes}
            </span>
          </div>

          {/* The funding line — the absolute rule, shown apart from the tug */}
          <div className="space-y-1">
            <div
              className="relative h-1 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--border)' }}
            >
              <div
                className="h-full"
                style={{
                  width: `${toLinePct}%`,
                  transition: 'width 900ms ease-out',
                  backgroundColor: funded ? 'var(--gold)' : 'var(--l1)',
                }}
              />
            </div>
            <p
              className="font-mono text-[10px]"
              style={{ color: funded ? 'var(--gold)' : 'var(--text-dim)' }}
            >
              {funded
                ? 'above the funding line'
                : `funding line: needs +${neededYesToFund} yes`}
            </p>
          </div>

          {/* Counts — abstain named, never folded into a side */}
          <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            yes {yes} · no {no} · abstain {abstain}
            {abstain > 0 ? ' (abstain does not pull)' : ''} · net{' '}
            {net > 0 ? '+' : ''}
            {net}
          </p>
        </>
      )}
    </section>
  );
}
