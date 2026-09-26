/**
 * lib/mirror/proposal-mirror.ts
 *
 * SOURCE: live DashCentral (mainnet) via /api/mirror/proposals
 * Fallback: fixture (served by the same route handler on fetch failure)
 * Swap point: replace the route handler's fetch target when a better L1
 * source is available. This module and the ProposalMirror interface are
 * unchanged on swap.
 *
 * IMPORTANT — client-only usage:
 * fetchMirror() uses a relative URL (/api/mirror/proposals) which only
 * resolves correctly in the browser. Do not call getProposals() or
 * getProposal() during SSR; use the route handler directly from server
 * components instead. getCycle() is always safe — it reads the in-memory
 * cache synchronously.
 *
 * See docs/spike-l1-mirror.md for the full path decision.
 */

import type { Proposal, CycleInfo, MirrorResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Interface — unchanged across all mirror paths
// ---------------------------------------------------------------------------

export interface ProposalMirror {
  /**
   * Returns current-cycle metadata including the data source.
   * Returns null before the first successful fetch completes.
   */
  getCycle(): CycleInfo | null;

  /**
   * Returns all proposals in the current cycle.
   * Always resolves — the route handler falls back to fixtures on API error.
   * Call from client components only (relative URL requires a browser base).
   */
  getProposals(): Promise<Proposal[]>;

  /**
   * Returns a single proposal by id (DashCentral slug) or hash, or null.
   * Call from client components only.
   */
  getProposal(id: string): Promise<Proposal | null>;
}

// ---------------------------------------------------------------------------
// In-memory cache — avoids redundant fetches within the same 60 s window.
// The route handler handles its own ISR cache on the server side.
// ---------------------------------------------------------------------------

type CacheEntry = {
  data: MirrorResponse;
  fetchedAt: number; // Date.now() ms
};

let _cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000;

async function fetchMirror(): Promise<MirrorResponse> {
  const now = Date.now();
  if (_cache !== null && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.data;
  }

  // Relative URL — works in the browser (same-origin).
  // next: { revalidate } is a Next.js server fetch extension; casting to
  // RequestInit suppresses the type error. In the browser the key is ignored
  // and the browser's own HTTP cache respects the Cache-Control headers the
  // route handler sets via revalidate = 60.
  const res = await fetch('/api/mirror/proposals', {
    next: { revalidate: 60 },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(`Mirror fetch failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as MirrorResponse;
  _cache = { data, fetchedAt: now };
  return data;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const proposalMirror: ProposalMirror = {
  getCycle(): CycleInfo | null {
    return _cache?.data.cycle ?? null;
  },

  async getProposals(): Promise<Proposal[]> {
    const data = await fetchMirror();
    return data.proposals;
  },

  async getProposal(id: string): Promise<Proposal | null> {
    const data = await fetchMirror();
    return data.proposals.find((p) => p.id === id || p.hash === id) ?? null;
  },
};

export default proposalMirror;
