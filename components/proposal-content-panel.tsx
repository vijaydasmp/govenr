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

import { useCallback, useEffect, useRef, useState } from 'react';
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
import MarkdownView from '@/components/markdown-view';

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

/**
 * Toolbar actions — wrap the selection (or insert a placeholder) as
 * markdown. Media is by reference: images and videos are links in the
 * body; the renderer embeds them on the public page.
 */
const EDITOR_TOOLS: Array<{
  label: string;
  title: string;
  before: string;
  after: string;
  placeholder: string;
}> = [
  { label: 'B', title: 'Bold', before: '**', after: '**', placeholder: 'bold text' },
  { label: 'I', title: 'Italic', before: '*', after: '*', placeholder: 'italic text' },
  { label: 'H', title: 'Heading', before: '\n## ', after: '\n', placeholder: 'Section' },
  { label: 'List', title: 'Bullet list', before: '\n- ', after: '', placeholder: 'item' },
  { label: 'Quote', title: 'Quote', before: '\n> ', after: '\n', placeholder: 'quote' },
  { label: 'Link', title: 'Web link', before: '[', after: '](https://)', placeholder: 'link text' },
  { label: 'Image', title: 'Image by URL', before: '![', after: '](https://)', placeholder: 'alt text' },
  { label: 'Video', title: 'YouTube or Vimeo link — embeds on the public page', before: '[', after: '](https://)', placeholder: 'video title' },
];

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
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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
    setEditorTab('write');
    setEditing(true);
  };

  /** Wraps the current textarea selection with markdown syntax. */
  const insertAround = (before: string, after: string, placeholder: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const s = start + before.length;
      el.setSelectionRange(s, s + selected.length);
    });
  };

  const save = useCallback(async () => {
    if (!session.identityId || !authKeyWif) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 4 || trimmedTitle.length > 128) {
      setError('Title must be 4–128 characters.');
      return;
    }
    if (body.length > 20000) {
      setError('Description must be at most 16,000 characters (Platform caps strings at 16,383).');
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel text="Description (markdown)" />
            <div className="flex items-center gap-1" role="tablist" aria-label="Editor mode">
              {(['write', 'preview'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={editorTab === tab}
                  onClick={() => setEditorTab(tab)}
                  className="rounded px-2 py-0.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    backgroundColor: editorTab === tab ? 'var(--l1)' : 'transparent',
                    color: editorTab === tab ? '#ffffff' : 'var(--text-dim)',
                  }}
                >
                  {tab === 'write' ? 'Write' : 'Preview'}
                </button>
              ))}
            </div>
          </div>

          {editorTab === 'write' ? (
            <>
              <div
                className="flex flex-wrap items-center gap-1 rounded border px-2 py-1.5"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                role="toolbar"
                aria-label="Text formatting"
              >
                {EDITOR_TOOLS.map((tool) => (
                  <button
                    key={tool.label}
                    type="button"
                    title={tool.title}
                    aria-label={tool.title}
                    onClick={() => insertAround(tool.before, tool.after, tool.placeholder)}
                    className="rounded px-2 py-0.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={16000}
                rows={10}
                className="w-full rounded border px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2"
                style={inputStyle}
                aria-label="Description"
              />
              <p className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
                Images: ![…](url) · YouTube/Vimeo links embed automatically · the text stays a Platform document
              </p>
            </>
          ) : (
            <div
              className="min-h-40 rounded border px-3 py-2"
              style={inputStyle}
              aria-label="Preview"
            >
              {body.trim() ? (
                <MarkdownView body={body} />
              ) : (
                <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                  Nothing to preview yet.
                </p>
              )}
            </div>
          )}
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

        {content.body && <MarkdownView body={content.body} />}

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
