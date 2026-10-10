/**
 * lib/platform/network.ts
 *
 * Which Dash network this page is reading: testnet or mainnet.
 *
 * Precedence: the URL (?network=mainnet) → this browser's remembered
 * choice → testnet. Server components resolve it from searchParams;
 * client components resolve it from the URL and localStorage.
 *
 * Mainnet mode is READ-ONLY: L1 governance objects and live tallies.
 * Govenr's Platform documents (content, claims, comments) live in the
 * testnet contract, so they are not available on mainnet — see
 * MAINNET_CONTRACT_ID in lib/platform/contract.ts.
 */

export type GovenrNetwork = 'testnet' | 'mainnet';

const STORAGE_KEY = 'govenr:network';

export function isNetwork(value: unknown): value is GovenrNetwork {
  return value === 'testnet' || value === 'mainnet';
}

/** Deterministic resolution from a URL param (server components, routes). */
export function resolveNetwork(param?: string | null): GovenrNetwork {
  return isNetwork(param) ? param : 'testnet';
}

/** Client-side: the URL wins, then this browser's remembered choice. */
export function getActiveNetwork(): GovenrNetwork {
  if (typeof window === 'undefined') return 'testnet';
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('network');
    if (isNetwork(fromUrl)) return fromUrl;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isNetwork(stored)) return stored;
  } catch {
    // URL or storage unavailable — fall through to the default.
  }
  return 'testnet';
}

export function persistNetwork(network: GovenrNetwork): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, network);
  } catch {
    // Non-fatal: the URL still carries the choice.
  }
}

/** Label for copy that has to name the network it is talking about. */
export function networkLabel(network: GovenrNetwork): string {
  return network === 'mainnet' ? 'mainnet' : 'testnet';
}
