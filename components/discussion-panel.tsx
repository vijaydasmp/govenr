'use client';
/**
 * components/discussion-panel.tsx — the discussion under a proposal.
 *
 * "Discussion happens here, with respect to the funding proposal."
 * Comments are `comment` documents on Dash Platform (testnet), owned by
 * their authors — the same document layer as the proposal content, so
 * the reasoning around a funding decision can't be lost when a hosted
 * forum goes down. That is the whole point of Govenr.
 *
 * v1 renders a flat, oldest-first thread; replies (parentId) arrive
 * with a later story. Anyone can read; logged-in identities can post.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/lib/platform/session-context';
import ReadOnlyMainnetNotice from '@/components/readonly-mainnet-notice';
import type { GovenrNetwork } from '@/lib/platform/network';
import { createPlatformClient } from '@/lib/platform/client';
import { fetchComments, submitComment } from '@/lib/platform/comments';
import { getStoredContractId } from '@/lib/platform/contract';
import { describePlatformError } from '@/lib/platform/errors';
import IdentityDisplayName from '@/components/identity-display-name';
import { shortHandle } from '@/lib/platform/identity';
import { relativeTime } from '@/lib/format/dates';

const inputStyle = {
  backgroundColor: 'var(--surface)',
  borderColor: 'var(--border-strong)',
  color: 'var(--text)',
} as const;

export default function DiscussionPanel({
  proposalHash,
  network = 'testnet',
}: {
  proposalHash: string;
  network?: GovenrNetwork;
}) {
  const { session, sdk, setSdk, authKeyWif } = useSession();
  const [comments, setComments] = useState<ReturnType<
    typeof fetchComments
  > extends Promise<infer T>
    ? T
    : never>([]);
  const [checked, setChecked] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sdkOrConnect = useCallback(async () => {
    const client = sdk ?? (await createPlatformClient());
    if (!sdk) setSdk(client);
    return client;
  }, [sdk, setSdk]);

  const loggedIn =
    session.status === 'ready' && Boolean(session.identityId) && Boolean(authKeyWif);

  const load = useCallback(async () => {
    const contractId = getStoredContractId();
    if (!contractId) {
      setChecked(true);
      return;
    }
    try {
      const client = await sdkOrConnect();
      const list = await fetchComments(client, contractId, proposalHash);
      setComments(list);
    } finally {
      setChecked(true);
    }
  }, [proposalHash, sdkOrConnect]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const post = useCallback(async () => {
    if (!session.identityId || !authKeyWif) return;
    const trimmed = body.trim();
    if (trimmed.length < 1) {
      setError('Write something first.');
      return;
    }
    if (trimmed.length > 2000) {
      setError('Comments are capped at 2,000 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = await sdkOrConnect();
      const contractId = getStoredContractId();
      if (!contractId) {
        throw new Error(
          'The Govenr contract is not published on this device yet — claim a proposal first.',
        );
      }
      await submitComment(client, {
        contractId,
        identityId: session.identityId,
        authKeyWif,
        proposalHash,
        body: trimmed,
      });
      setBody('');
      const list = await fetchComments(client, contractId, proposalHash);
      setComments(list);
    } catch (err) {
      setError(describePlatformError(err));
    } finally {
      setBusy(false);
    }
  }, [body, proposalHash, session.identityId, authKeyWif, sdkOrConnect]);

  // Mainnet is read-only: comments are Platform documents, and they live on
  // testnet. Say so rather than showing an empty thread.
  if (network === 'mainnet') {
    return <ReadOnlyMainnetNotice what="Discussion is not available" />;
  }

  return (
    <div
      className="rounded-lg border px-6 py-5 space-y-4"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className="font-mono text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-dim)' }}
        >
          Discussion
        </p>
        {checked && (
          <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Composer */}
      {loggedIn ? (
        <div className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Add to the discussion — your comment becomes a Platform document owned by you."
            aria-label="Write a comment"
            className="w-full rounded border px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2"
            style={inputStyle}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {body.length}/2000
            </span>
            <button
              type="button"
              onClick={() => void post()}
              disabled={busy || body.trim().length === 0}
              className="rounded px-4 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
              style={{ backgroundColor: 'var(--l1)', color: '#ffffff' }}
            >
              {busy ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </div>
      ) : (
        <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          Sign in with your testnet identity to join the discussion.
        </p>
      )}

      {error && (
        <p className="font-mono text-xs" style={{ color: 'var(--no)' }} aria-live="polite">
          {error}
        </p>
      )}

      {/* Thread — oldest first */}
      {checked && comments.length > 0 && (
        <ul className="space-y-4 pt-1 list-none" role="list" aria-label="Comments">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="space-y-1 border-t pt-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="flex flex-wrap items-center gap-x-3 font-mono text-xs"
                style={{ color: 'var(--text-dim)' }}
              >
                <span style={{ color: 'var(--text)' }}>
                  <IdentityDisplayName
                    identityId={comment.ownerId}
                    fallback={shortHandle(comment.ownerId, null)}
                  />
                </span>
                {comment.createdAt && <span>{relativeTime(comment.createdAt)}</span>}
              </div>
              <p
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: 'var(--text)' }}
              >
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {checked && comments.length === 0 && (
        <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          No comments yet — be the first to weigh in.
        </p>
      )}

      <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        Comments live on Dash Platform (testnet) as documents owned by
        their authors — not on any server. L1 records the vote; Platform
        remembers why.
      </p>
    </div>
  );
}
