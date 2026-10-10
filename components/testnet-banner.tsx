'use client';

/**
 * components/testnet-banner.tsx
 *
 * Environment banner: full-width, unmistakable, deliberately
 * non-dismissible. Anyone arriving from a link should know within one
 * glance which network they are reading.
 *
 *   testnet → yellow, "data may be reset"
 *   mainnet → quiet, "read-only mirror"
 *
 * The network comes from the same source as the header switch (the URL,
 * then this browser's remembered choice). It resolves on the client, so
 * the first paint is testnet and it corrects immediately — a banner is
 * chrome, not data.
 */

import { useEffect, useState } from 'react';
import { getActiveNetwork, type GovenrNetwork } from '@/lib/platform/network';

export default function TestnetBanner() {
  const [network, setNetwork] = useState<GovenrNetwork>('testnet');
  useEffect(() => {
    setNetwork(getActiveNetwork());
  }, []);

  const mainnet = network === 'mainnet';

  return (
    <div
      role="note"
      aria-label={mainnet ? 'Mainnet read-only mirror' : 'Testnet environment'}
      className="w-full text-center font-mono text-xs tracking-wide px-4 py-2"
      style={
        mainnet
          ? {
              backgroundColor: 'var(--surface-dim)',
              color: 'var(--text)',
              borderBottom: '1px solid var(--border)',
            }
          : { backgroundColor: '#ffd60a', color: '#1a1a1a' }
      }
    >
      {mainnet
        ? 'MAINNET · read-only mirror — L1 governance data only; proposal documents live on testnet for now'
        : 'TESTNET · Running on Dash Platform testnet — data may be reset'}
    </div>
  );
}
