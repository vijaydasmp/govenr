'use client';
/**
 * components/proposal-content-panel.tsx — S9c: the proposal editor.
 *
 * The promise made by the gold "Claimed by you" panel, made real: the
 * claimant writes the proposal's description, and it renders for everyone.
 * The text is stored as `proposalContent` documents on Dash Platform
 * testnet, owned by the claimant — Govenr's server never holds it.
 *
 * Read path  : anyone — fetched from Platform on page load.
 * Write path : the claimant only (owner of the claim document).
 * Honesty    : a "lives on Platform" note is always shown with the content.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/lib/platform/session-context';
import { createPlatformClient } from '@/lib/platform/client';
import {
  fetchProposalContent,
  saveProposalContent,
  type ProposalContent,
} from '@/lib/platform/content';
import { fetchClaimForProposal } from '@/lib/platform/claims';
import { getStoredContractId } from '@/lib/platform/contract';
import { describePlatformError } from '@/lib/platform/errors';
import { shortHandle } from '@/lib/platform/identity';

function FieldLabel({ text }: { text: string }) {
  return (
    <label
      className="font-mono text-xs"
      style={{ color: 'var(--text-dim)' }}
    >
      {text}
    </label>
  );
}

const inputStyle = {
  backgroundColor: 'var(--surface)',
  borderColor: 'var(--border-strong)',
  color: 'var(--text)',
} as const;

export default function ProposalContentPanel({
  proposalHash,
}: {
  proposalHash: string;
}) {
  const { session, sdk, setSdk, authKeyWif } = useSession();
  const [content, setContent] = useState<ProposalContent | null>(null);
  const [checked, setChecked] = useState(false);
  const [isClaimant, setIsClaimant] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [milestones, setMilestones] = useState('');
  const [reportRefs, setReportRefs] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sdkOrConnect = useCallback(async () => {
    const client = sdk ?? (await createPlatformClient());
    if (!sdk) setSdk(client);
    return client;
  }, [sdk, setSdk]);

  const loggedIn =
    session.status === 'ready' && Boolean(session.identityId) && Boolean(authKeyWif);

  // Read path: content + claim, so we know both what it says and who may edit.
  useEffect(() => {
    let cancelled = false;
    const contractId = getStoredContractId();
    if (!contractId) {
      setChecked(true);
      return;
    }
    void (async () => {
      try {
        const client = await sdkOrConnect();
        const [fetched, claim] = await Promise.all([
          fetchProposalContent(client, contractId, proposalHash),
          fetchClaimForProposal(client, contractId, proposalHash),
        ]);
        if (cancelled) return;
        setContent(fetched);
        setIsClaimant(
          Boolean(
            loggedIn &&
              claim &&
              claim.ownerId === session.identityId,
          ),
        );
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposalHash, loggedIn, session.identityId, sdkOrConnect]);

  const startEditing = () => {
    setTitle(content?.title ?? '');
    setBody(content?.body ?? '');
    setMilestones(content?.milestones ?? '');
    setReportRefs(content?.reportRefs ?? '');
    setError(null);
    setEditing(true);
  };

  const save = useCallback(async () => {
    if (!session.identityId || !authKeyWif) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 4 || trimmedTitle.length > 128) {
      setError('Title must be 4–128 characters.');
      return;
    }
    if (body.length > 20000) {
      setError('Description must be at most 20,000 characters.');
      return;
    }
    if (milestones.length > 4096 || reportRefs.length > 4096) {
      setError('Milestones and report references are capped at 4,096 characters each.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = await sdkOrConnect();
      const contractId = getStoredContractId();
      if (!contractId) {
        throw new Error(
          'The Govenr contract is not published on this device yet — claim the proposal first.',
        );
      }
      await saveProposalContent(client, {
        contractId,
        identityId: session.identityId,
        authKeyWif,
        proposalHash,
        title: trimmedTitle,
        body,
        milestones,
        reportRefs,
        existing: content
          ? { documentId: content.documentId, revision: content.revision }
          : null,
      });
      const fresh = await fetchProposalContent(client, contractId, proposalHash);
      setContent(fresh);
      setEditing(false);
    } catch (err) {
      setError(describePlatformError(err));
    } finally {
      setBusy(false);
    }
  }, [
    title,
    body,
    milestones,
    reportRefs,
    content,
    proposalHash,
    session.identityId,
    authKeyWif,
    sdkOrConnect,
  ]);

  // Nothing to render until we have looked (and no contract was ever
  // published on this device — no claims, no content possible).
  if (!checked) return null;

  // ------------------------------------------------------------------
  // Editor
  // ------------------------------------------------------------------
  if (editing) {
    return (
      <div
        className="rounded-lg border px-6 py-5 space-y-4"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--gold)',
        }}
      >
        <p
          className="font-mono text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--gold)' }}
        >
          {content ? 'Edit proposal content' : 'Write proposal content'}
        </p>
        <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          Stored as documents on Dash Platform testnet under your identity —
          editable by you, readable by everyone, held by no server.
        </p>

        <div className="space-y-1">
          <FieldLabel text="Title" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={128}
            className="w-full rounded border px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2"
            style={inputStyle}
            aria-label="Title"
          />
        </div>

        <div className="space-y-1">
          <FieldLabel text="Description (markdown, plain lines for now)" />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={20000}
            rows={10}
            className="w-full rounded border px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2"
            style={inputStyle}
            aria-label="Description"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <FieldLabel text="Milestones (one per line)" />
            <textarea
              value={milestones}
              onChange={(e) => setMilestones(e.target.value)}
              maxLength={4096}
              rows={5}
              className="w-full rounded border px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2"
              style={inputStyle}
              aria-label="Milestones"
            />
          </div>
          <div className="space-y-1">
            <FieldLabel text="Report references (one per line)" />
            <textarea
              value={reportRefs}
              onChange={(e) => setReportRefs(e.target.value)}
              maxLength={4096}
              rows={5}
              className="w-full rounded border px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2"
              style={inputStyle}
              aria-label="Report references"
            />
          </div>
        </div>

        {error && (
          <p
            className="font-mono text-xs"
            style={{ color: 'var(--no)' }}
            aria-live="polite"
          >
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="rounded px-4 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--l1)', color: '#ffffff' }}
          >
            {busy ? 'Saving…' : content ? 'Save changes' : 'Publish content'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={busy}
            className="rounded border px-4 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2"
            style={{ ...inputStyle }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Claimant, no content yet — the writing CTA
  // ------------------------------------------------------------------
  if (isClaimant && !content) {
    return (
      <div
        className="rounded-lg border px-6 py-5 space-y-2"
        style={{
          backgroundColor: 'var(--gold-dim)',
          borderColor: 'var(--gold)',
        }}
      >
        <p
          className="font-mono text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--gold)' }}
        >
          You own this proposal
        </p>
        <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          L1 holds the hash and the votes — not what the proposal is about.
          Write its description and milestones; the text will live on Dash
          Platform as documents you control.
        </p>
        <button
          type="button"
          onClick={startEditing}
          className="rounded px-4 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2"
          style={{ backgroundColor: 'var(--gold)', color: '#ffffff' }}
        >
          Write proposal content
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Content exists — public display (edit button for the claimant)
  // ------------------------------------------------------------------
  if (content) {
    const milestoneLines = content.milestones
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return (
      <div
        className="rounded-lg border px-6 py-5 space-y-4"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
        aria-live="polite"
      >
        <div className="space-y-1">
          <p
            className="font-mono text-xs tracking-widest uppercase"
            style={{ color: 'var(--text-dim)' }}
          >
            Proposal content
          </p>
          <h2
            className="font-serif text-2xl leading-snug"
            style={{ color: 'var(--text)' }}
          >
            {content.title}
          </h2>
          <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            by {shortHandle(content.ownerId, null)}
            {content.updatedAt
              ? ` · updated ${new Date(content.updatedAt).toLocaleDateString()}`
              : ''}
          </p>
        </div>

        {content.body && (
          <p
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: 'var(--text)' }}
          >
            {content.body}
          </p>
        )}

        {milestoneLines.length > 0 && (
          <div className="space-y-1">
            <p
              className="font-mono text-xs tracking-widest uppercase"
              style={{ color: 'var(--text-dim)' }}
            >
              Milestones
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {milestoneLines.map((line, index) => (
                <li
                  key={index}
                  className="text-sm"
                  style={{ color: 'var(--text)' }}
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          This text lives on Dash Platform (testnet) as documents owned by
          the claimant — not on any server.
        </p>

        {isClaimant && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded px-4 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2"
            style={{ backgroundColor: 'var(--l1)', color: '#ffffff' }}
          >
            Edit content
          </button>
        )}
      </div>
    );
  }

  // No content, viewer not the claimant — nothing to show yet.
  return null;
}
