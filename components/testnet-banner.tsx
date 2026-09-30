/**
 * components/testnet-banner.tsx
 *
 * Yappr-style environment banner: full-width, yellow, unmistakable, and
 * deliberately non-dismissible. Anyone arriving from a link should know
 * within one glance that this is testnet — before they read anything else.
 *
 * When mainnet read mode ships, this becomes conditional per environment.
 */
export default function TestnetBanner() {
  return (
    <div
      role="note"
      aria-label="Testnet environment"
      className="w-full text-center font-mono text-xs tracking-wide px-4 py-2"
      style={{ backgroundColor: '#ffd60a', color: '#1a1a1a' }}
    >
      TESTNET · Running on Dash Platform testnet — data may be reset
    </div>
  );
}
