'use client';
/**
 * components/proposal-owner-byline.tsx
 *
 * The "by …" line in a proposal's meta row: the claimant's DPNS name
 * (e.g. "hehe.dash") when the proposal has been claimed on Platform —
 * the claim is the on-chain proof that this identity controls the
 * proposal's payout address — falling back to the raw L1 handle
 * (payment address) for unclaimed proposals.
 *
 * Client component; the server renders the L1 handle first.
 */

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/platform/session-context';
import { createPlatformClient } from '@/lib/platform/client';
import { fetchClaimForProposal } from '@/lib/platform/claims';
import { fetchIdentityDisplayName } from '@/lib/platform/identity';
import { getStoredContractId } from '@/lib/platform/contract';

export default function ProposalOwnerByline({
  l1Handle,
  proposalHash,
}: {
  l1Handle: string | null;
  proposalHash: string;
}) {
  const { sdk, setSdk } = useSession();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const contractId = getStoredContractId();
    if (!contractId) return;
    void (async () => {
      try {
        const client = sdk ?? (await createPlatformClient());
        if (!sdk) setSdk(client);
        const claim = await fetchClaimForProposal(
          client,
          contractId,
          proposalHash,
        );
        if (!claim) return;
        const displayName = await fetchIdentityDisplayName(
          client,
          claim.ownerId,
        );
        if (!cancelled && displayName) setName(displayName);
      } catch {
        // Fails safe: the L1 handle stays.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposalHash, sdk, setSdk]);

  if (!l1Handle && !name) return null;
  return <>{name ?? l1Handle}</>;
}
