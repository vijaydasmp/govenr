/**
 * lib/platform/content.ts
 *
 * S9c: the proposalContent document — the proposal text owned by the
 * claimant. "L1 records the vote; Platform remembers why": the hash and
 * votes come from the chain; the human-readable description lives here,
 * as documents on Dash Platform that no server controls.
 *
 *   fetchProposalContent — public read: what does this proposal say?
 *   saveProposalContent — claimant write: create or update (replace with
 *     incremented revision, per the official document-update tutorial)
 *
 * The L1 hash is stored as its 44-char base64 form (44 <= the 63-char
 * indexed-string limit) — same convention as the claim document.
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide } from '@/lib/platform/sdk-module';
import { getSigningContext } from '@/lib/platform/contract';
import { hexToBase64 } from '@/lib/platform/claims';
import type { DashSdk } from '@/lib/platform/types';

/** The proposal content as read from Platform. */
export type ProposalContent = {
  ownerId: string;
  documentId: string;
  revision: bigint;
  title: string;
  body: string;
  milestones: string;
  reportRefs: string;
  updatedAt: string | null;
};

/**
 * Returns the content document for a proposal, or null if none (or on any
 * read error — never crashes the page over a Platform hiccup).
 */
export async function fetchProposalContent(
  sdk: DashSdk,
  contractId: string,
  proposalHash: string,
): Promise<ProposalContent | null> {
  assertClientSide('fetchProposalContent');
  try {
    const results = await sdk.documents.query({
      dataContractId: contractId,
      documentTypeName: 'proposalContent',
      where: [['proposalHash', '==', hexToBase64(proposalHash)]],
      limit: 1,
    });
    for (const doc of results.values()) {
      if (!doc) continue;
      const props = (doc.properties ?? {}) as Record<string, unknown>;
      const revision =
        typeof doc.revision === 'bigint' ? doc.revision : 1n;
      return {
        ownerId: doc.ownerId.toString(),
        documentId: doc.id.toString(),
        revision,
        title: typeof props.title === 'string' ? props.title : '',
        body: typeof props.body === 'string' ? props.body : '',
        milestones: typeof props.milestones === 'string' ? props.milestones : '',
        reportRefs: typeof props.reportRefs === 'string' ? props.reportRefs : '',
        updatedAt: doc.createdAt
          ? new Date(Number(doc.createdAt)).toISOString()
          : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Creates the content document, or updates the existing one (replace with
 * revision + 1 — the official evo-sdk update pattern).
 */
export async function saveProposalContent(
  sdk: DashSdk,
  opts: {
    contractId: string;
    identityId: string;
    authKeyWif: string;
    proposalHash: string;
    title: string;
    body: string;
    milestones: string;
    reportRefs: string;
    existing: { documentId: string; revision: bigint } | null;
  },
): Promise<void> {
  assertClientSide('saveProposalContent');
  const { mod, identityKey, signer } = await getSigningContext(
    sdk,
    opts.identityId,
    opts.authKeyWif,
  );

  const properties = {
    proposalHash: hexToBase64(opts.proposalHash),
    title: opts.title,
    body: opts.body,
    milestones: opts.milestones,
    reportRefs: opts.reportRefs,
  };

  if (opts.existing) {
    // Update: same document id, revision + 1, sdk.documents.replace.
    const document = new mod.Document({
      properties,
      documentTypeName: 'proposalContent',
      dataContractId: opts.contractId,
      ownerId: opts.identityId,
      id: opts.existing.documentId,
      revision: opts.existing.revision + 1n,
    });
    await sdk.documents.replace({ document, identityKey, signer });
    return;
  }

  const document = new mod.Document({
    properties,
    documentTypeName: 'proposalContent',
    dataContractId: opts.contractId,
    ownerId: opts.identityId,
  });
  await sdk.documents.create({ document, identityKey, signer });
}
