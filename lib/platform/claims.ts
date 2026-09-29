/**
 * lib/platform/claims.ts
 *
 * The sign-to-own claim lifecycle:
 *   buildClaimChallenge — the message the proposal owner signs in Dash Core
 *   submitClaim         — writes the immutable claim document to Platform
 *   fetchClaimForProposal — read path: who, if anyone, has claimed a proposal
 *
 * The claim proves the claiming identity (document owner) controls a private
 * key of the proposal's on-chain payout OR collateral address. Both addresses
 * come from the mirror (chain data), never from user input.
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide } from '@/lib/platform/sdk-module';
import { getSigningContext } from '@/lib/platform/contract';
import type { DashSdk } from '@/lib/platform/types';

/** A fresh challenge: govenr-claim:<proposalHash>:<identityId>:<nonce>. */
export function buildClaimChallenge(
  proposalHash: string,
  identityId: string,
): string {
  assertClientSide('buildClaimChallenge');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return `govenr-claim:${proposalHash}:${identityId}:${nonce}`;
}

/**
 * Writes the claim document to Platform testnet. $ownerId is set by Platform
 * from the signing identity — the claimant.
 */
export async function submitClaim(
  sdk: DashSdk,
  opts: {
    contractId: string;
    identityId: string;
    authKeyWif: string;
    proposalHash: string;
    verifiedAddress: string;
    challenge: string;
    signature: string;
  },
): Promise<void> {
  assertClientSide('submitClaim');
  const { mod, identityKey, signer } = await getSigningContext(
    sdk,
    opts.identityId,
    opts.authKeyWif,
  );
  const document = new mod.Document({
    properties: {
      proposalHash: opts.proposalHash,
      verifiedAddress: opts.verifiedAddress,
      challenge: opts.challenge,
      signature: opts.signature,
    },
    documentTypeName: 'claim',
    dataContractId: opts.contractId,
    ownerId: opts.identityId,
  });
  await sdk.documents.create({ document, identityKey, signer });
}

export type ExistingClaim = {
  ownerId: string;
  verifiedAddress: string;
  claimedAt: string | null;
};

/**
 * Returns the claim for a proposal, or null if unclaimed (or unreadable —
 * never crashes the page over a Platform hiccup).
 */
export async function fetchClaimForProposal(
  sdk: DashSdk,
  contractId: string,
  proposalHash: string,
): Promise<ExistingClaim | null> {
  assertClientSide('fetchClaimForProposal');
  try {
    const results = await sdk.documents.query({
      dataContractId: contractId,
      documentTypeName: 'claim',
      where: [['proposalHash', '==', proposalHash]],
      limit: 1,
    });
    for (const doc of results.values()) {
      if (!doc) continue;
      const props = doc.properties;
      const verifiedAddress =
        typeof props.verifiedAddress === 'string' ? props.verifiedAddress : '';
      const createdAt = doc.createdAt;
      return {
        ownerId: doc.ownerId.toString(),
        verifiedAddress,
        claimedAt: createdAt
          ? new Date(Number(createdAt)).toISOString()
          : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}
