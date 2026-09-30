/**
 * lib/platform/comments.ts
 *
 * The discussion under a proposal — `comment` documents on the live
 * Govenr v3 contract. One thread per proposal; parentId nests replies
 * (v1 renders a flat, oldest-first thread).
 *
 * Same write path as the claim and content ceremonies (getSigningContext
 * + Document + documents.create, all-string values), just a document
 * type that already existed on-chain.
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide } from '@/lib/platform/sdk-module';
import { getSigningContext } from '@/lib/platform/contract';
import { hexToBase64 } from '@/lib/platform/claims';
import type { DashSdk } from '@/lib/platform/types';

/** A comment as read from Platform. */
export type CommentDoc = {
  id: string;
  ownerId: string;
  body: string;
  parentId: string | null;
  createdAt: string | null;
};

/**
 * All comments for a proposal, oldest first (the byProposal index is
 * proposalHash + $createdAt asc). Returns [] on any read error — the
 * discussion fails safe, it never blocks the page.
 */
export async function fetchComments(
  sdk: DashSdk,
  contractId: string,
  proposalHash: string,
): Promise<CommentDoc[]> {
  assertClientSide('fetchComments');
  try {
    const results = await sdk.documents.query({
      dataContractId: contractId,
      documentTypeName: 'comment',
      where: [['proposalHash', '==', hexToBase64(proposalHash)]],
      orderBy: [['$createdAt', 'asc']],
      limit: 100,
    });
    const out: CommentDoc[] = [];
    for (const doc of results.values()) {
      if (!doc) continue;
      const props = (doc.properties ?? {}) as Record<string, unknown>;
      out.push({
        id: doc.id.toString(),
        ownerId: doc.ownerId.toString(),
        body: typeof props.body === 'string' ? props.body : '',
        parentId:
          typeof props.parentId === 'string' && props.parentId.length > 0
            ? props.parentId
            : null,
        createdAt: doc.createdAt
          ? new Date(Number(doc.createdAt)).toISOString()
          : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Posts a comment as the logged-in identity. Body is validated by the
 * contract (1–2000 chars); no key material leaves the browser.
 */
export async function submitComment(
  sdk: DashSdk,
  opts: {
    contractId: string;
    identityId: string;
    authKeyWif: string;
    proposalHash: string;
    body: string;
    parentId?: string | null;
  },
): Promise<void> {
  assertClientSide('submitComment');
  const { mod, identityKey, signer } = await getSigningContext(
    sdk,
    opts.identityId,
    opts.authKeyWif,
  );

  const properties: Record<string, string> = {
    proposalHash: hexToBase64(opts.proposalHash),
    body: opts.body,
  };
  if (opts.parentId) properties.parentId = opts.parentId;

  const document = new mod.Document({
    properties,
    documentTypeName: 'comment',
    dataContractId: opts.contractId,
    ownerId: opts.identityId,
  });
  await sdk.documents.create({ document, identityKey, signer });
}
