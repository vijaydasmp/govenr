/**
 * app/api/mirror/proposals/route.ts
 *
 * Server-side proxy for the L1 governance mirror.
 * Network selection (NETWORK env var) and normalization live in
 * lib/mirror/proposal-mirror.ts — this handler is a thin wrapper.
 *
 * ISR at 60 s: Next.js serves from the edge cache and regenerates in the
 * background when stale. The client-side proposalMirror adds its own 60 s
 * in-memory layer on top.
 *
 * Network: ?network=mainnet selects the read-only mainnet mirror; the
 * NETWORK env var is the default when the param is absent.
 *
 * Fallback: fetchProposals() never throws. Testnet returns fixtures with
 * source: 'fixture'; mainnet returns an empty list with source:
 * 'unreachable' — testnet fixtures are never served under a mainnet label.
 */

import { NextResponse } from 'next/server';
import type { MirrorResponse } from '@/lib/types';
import { fetchProposals } from '@/lib/mirror/proposal-mirror';
import { resolveNetwork } from '@/lib/platform/network';

// ISR — do NOT combine with force-dynamic; that disables the cache.
export const revalidate = 60;

export async function GET(req: Request): Promise<NextResponse<MirrorResponse>> {
  // The network comes from the switch (?network=mainnet); the NETWORK env
  // var remains the default, so a deployment can still pin one.
  const network = resolveNetwork(new URL(req.url).searchParams.get('network'));
  const data = await fetchProposals(network);
  return NextResponse.json(data);
}
