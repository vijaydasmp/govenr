/**
 * components/readonly-mainnet-notice.tsx
 *
 * Shown in place of the document panels when the app is reading mainnet.
 *
 * Govenr's documents (content, claims, comments) live in the testnet
 * contract, so on mainnet there is nothing to read yet. Saying so plainly
 * is better than an empty panel — and far better than inviting a claim
 * that cannot succeed.
 */

export default function ReadOnlyMainnetNotice({ what }: { what: string }) {
  return (
    <section
      className="rounded-lg border px-6 py-4 space-y-1"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      aria-label="Not available on mainnet"
    >
      <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        {what} on mainnet yet — this is the L1 view.
      </p>
      <p
        className="font-mono text-[10px] leading-relaxed"
        style={{ color: 'var(--text-dim)' }}
      >
        Proposal documents live on Dash Platform (testnet) for now. Mainnet
        in Govenr is read-only: governance objects and live tallies.
      </p>
    </section>
  );
}
