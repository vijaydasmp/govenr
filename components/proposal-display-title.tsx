'use client';
/**
 * components/proposal-display-title.tsx
 *
 * The page's big title: the claimant's own title for the proposal when
 * one exists on Platform (the owner's words), falling back to the raw
 * L1 object name. Whenever the two differ, the L1 name stays visible
 * as a small mono line — the chain object is the truth; the title is
 * the author's.
 *
 * Client component: Platform content is read from the browser (the
 * server renders the L1 title first, so the page never flashes empty).
 */

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/platform/session-context';
import { createPlatformClient } from '@/lib/platform/client';
import { fetchProposalContentCached } from '@/lib/platform/content';
import { getStoredContractId } from '@/lib/platform/contract';

export default function ProposalDisplayTitle({
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
        // Read fails safe: the L1 title stays.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposalHash, sdk, setSdk]);

  const title = ownerTitle ?? l1Title;

  return (
    <div className="space-y-1">
      <h1
        className="font-serif text-3xl leading-snug"
        style={{ color: 'var(--text)' }}
      >
        {title}
      </h1>
      {ownerTitle && ownerTitle !== l1Title && (
        <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          L1 object: {l1Title}
        </p>
      )}
    </div>
  );
}
