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
 * Fallback: fetchProposals() never throws — it returns fixture data with
 * source: 'fixture' when the upstream is unreachable.
 */

import { NextResponse } from 'next/server';
import type { MirrorResponse } from '@/lib/types';
import { fetchProposals } from '@/lib/mirror/proposal-mirror';

// ISR — do NOT combine with force-dynamic; that disables the cache.
export const revalidate = 60;

export async function GET(): Promise<NextResponse<MirrorResponse>> {
  const data = await fetchProposals();
  return NextResponse.json(data);
}
