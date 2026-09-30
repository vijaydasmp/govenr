'use client';
/**
 * components/proposal-card-title.tsx
 *
 * A magazine card's headline: the claimant's own title when the
 * proposal has one on Platform, the raw L1 object name otherwise.
 *
 * Client island inside the server-rendered hub — the server renders
 * the L1 name first (no empty flash on load), and the browser upgrades
 * it using the shared 60-second content read cache, so all cards plus
 * the detail page cost one query per proposal per minute.
 */

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/platform/session-context';
import { createPlatformClient } from '@/lib/platform/client';
import { fetchProposalContentCached } from '@/lib/platform/content';
import { getStoredContractId } from '@/lib/platform/contract';

export default function ProposalCardTitle({
  l1Title,
  proposalHash,
}: {
  l1Title: string;
  proposalHash: string;
}) {
  const { sdk, setSdk } = useSession();
  const [ownerTitle, setOwnerTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const contractId = getStoredContractId();
    if (!contractId) return;
    void (async () => {
      try {
        const client = sdk ?? (await createPlatformClient());
        if (!sdk) setSdk(client);
        const content = await fetchProposalContentCached(
          client,
          contractId,
          proposalHash,
        );
        if (!cancelled) setOwnerTitle(content?.title ?? null);
      } catch {
        // Read fails safe: the L1 name stays.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposalHash, sdk, setSdk]);

  return <>{ownerTitle ?? l1Title}</>;
}
