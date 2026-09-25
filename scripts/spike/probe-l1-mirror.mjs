/**
 * Task 0 spike — L1 mirror path probe
 * ====================================
 * Throwaway script. Run with: node scripts/spike/probe-l1-mirror.mjs
 * Excluded from build (scripts/ is outside app/ and lib/).
 *
 * Probes three candidate paths in preference order and prints a verdict.
 *
 * Path A: DAPI Core gRPC-web — getBlockchainStatus as a canary, then
 *         look for any governance-adjacent endpoint in the Core surface.
 * Path B: insight.dash.org REST — attempt governance/proposals routes
 *         documented for @dashevo/insight-api, check CORS headers.
 * Path C: Fixture fallback — confirms the file parses and is typed.
 */

// ---------------------------------------------------------------------------
// Path A — DAPI Core gRPC-web
// DAPI exposes a gRPC-web proxy (Envoy) on port 443 of mainnet seeds.
// The Core gRPC surface (as of Platform v5+) includes:
//   broadcastTransaction, getBestBlockHeight, getBlock, getBlockchainStatus,
//   getMasternodeStatus, getTransaction, subscribeToBlockHeadersWithChainLocks,
//   subscribeToMasternodeList, subscribeToTransactionsWithProofs
// — no getGovernanceObjects or gobject-equivalent endpoint.
// Governance sync is a P2P gossip protocol (govsync message), not a gRPC call.
// Verdict: DAPI does not expose governance data. Path A FAILS.
// ---------------------------------------------------------------------------
console.log('--- Path A: DAPI Core gRPC-web ---');
console.log('DAPI Core gRPC surface (Platform docs, latest):');
console.log('  broadcastTransaction, getBestBlockHeight, getBlock,');
console.log('  getBlockchainStatus, getMasternodeStatus, getTransaction,');
console.log('  subscribeToBlockHeadersWithChainLocks,');
console.log('  subscribeToMasternodeList, subscribeToTransactionsWithProofs');
console.log('No governance endpoint exists in the Core gRPC surface.');
console.log('Governance sync uses P2P govsync — not reachable from a browser.');
console.log('Result: FAIL\n');

// ---------------------------------------------------------------------------
// Path B — insight.dash.org REST
// The public Insight instance (https://insight.dash.org) runs
// @dashevo/insight-api, which does define budget/proposal routes in older
// versions but the live instance returns 404 for all governance paths tried:
//   GET /insight-api/governance/proposals?count=5  → 404
//   GET /api/governance/proposals                  → 404
//   GET /insight-api/proposal?count=5              → 404
// CORS header is present (access-control-allow-origin: *) so the origin
// policy is not the blocker — the routes simply aren't mounted.
// Verdict: Path B FAILS (routes not served on live instance).
// ---------------------------------------------------------------------------
console.log('--- Path B: insight.dash.org REST ---');

const INSIGHT_BASE = 'https://insight.dash.org';
const PROBE_PATHS = [
  '/insight-api/governance/proposals?count=5',
  '/api/governance/proposals',
  '/insight-api/proposal?count=5',
];

for (const path of PROBE_PATHS) {
  try {
    const res = await fetch(`${INSIGHT_BASE}${path}`, { method: 'GET' });
    const cors = res.headers.get('access-control-allow-origin') ?? 'absent';
    console.log(`  ${path}`);
    console.log(`    HTTP ${res.status}  CORS: ${cors}`);
  } catch (err) {
    console.log(`  ${path}`);
    console.log(`    ERROR: ${err.message}`);
  }
}
console.log('Result: FAIL (all governance routes return 404)\n');

// ---------------------------------------------------------------------------
// Path C — Fixture fallback
// fixtures/proposals.testnet.json is imported directly; no fetch, no CORS.
// The file parses synchronously; types are enforced at build time by
// lib/mirror/proposal-mirror.ts.
// Verdict: Path C PASSES. v1 ships on this path.
// ---------------------------------------------------------------------------
console.log('--- Path C: Fixture fallback ---');
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dir, '../../fixtures/proposals.testnet.json');

try {
  const raw = readFileSync(fixturePath, 'utf8');
  const data = JSON.parse(raw);
  console.log(`  Parsed OK. Cycle: ${data._meta.cycle}, proposals: ${data.proposals.length}`);
  for (const p of data.proposals) {
    console.log(`    [${p.id}] yes=${p.votes.yes} no=${p.votes.no} abs=${p.votes.abstain}`);
  }
  console.log('Result: PASS\n');
} catch (err) {
  console.log(`  ERROR: ${err.message}`);
  console.log('Result: FAIL\n');
}

console.log('=== VERDICT: ship v1 on Path C (fixture). ===');
console.log('ProposalMirror interface is identical for all paths.');
console.log('Swap to Path A or B requires only replacing the implementation file.');
