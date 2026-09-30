'use client';
/**
 * components/vote-cta-panel.tsx — the action bar.
 *
 * The most action-oriented area of the proposal page: cast your vote.
 * Govenr is read-only on L1 forever — the vote is cast by the
 * masternode owner, in their own Dash Core console. This panel
 * prepares the exact official command and copies it to the clipboard:
 *
 *   gobject vote-many <governance-hash> funding yes|no|abstain
 *
 * (Format per the official Dash governance docs. `vote-many` triggers
 * every masternode configured in dash.conf; `gobject vote` casts from a
 * single one. Over SSH, prefix with ~/.dashcore/dash-cli.)
 */

import { useState } from 'react';

type VoteChoice = 'yes' | 'no' | 'abstain';

const CHOICES: Array<{
  choice: VoteChoice;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    choice: 'yes',
    label: 'Yes',
    color: 'var(--yes)',
    bg: 'rgba(4, 120, 87, 0.08)',
    border: 'var(--yes)',
  },
  {
    choice: 'no',
    label: 'No',
    color: 'var(--no)',
    bg: 'rgba(194, 65, 12, 0.08)',
    border: 'var(--no)',
  },
  {
    choice: 'abstain',
    label: 'Abstain',
    color: 'var(--text-dim)',
    bg: 'var(--surface)',
    border: 'var(--border-strong, var(--border))',
  },
];

/** Clipboard with a legacy fallback for non-secure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function VoteCtaPanel({
  proposalHash,
}: {
  proposalHash: string;
}) {
  const [copied, setCopied] = useState<VoteChoice | null>(null);
  const [failed, setFailed] = useState(false);

  const copy = async (choice: VoteChoice) => {
    const ok = await copyText(
      `gobject vote-many ${proposalHash} funding ${choice}`,
    );
    setFailed(!ok);
    setCopied(ok ? choice : null);
    if (ok) window.setTimeout(() => setCopied(null), 5000);
  };

  return (
    <div
      className="rounded-lg border px-6 py-5 space-y-4"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <p
        className="font-mono text-xs font-semibold tracking-widest uppercase"
        style={{ color: 'var(--text-dim)' }}
      >
        Vote — L1 records it, your masternode casts it
      </p>

      <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        Govenr never votes for you. Click a choice to copy the exact
        command, then paste it into your masternode owner’s console —
        Window → Console in Dash Core, or SSH to the masternode.
      </p>

      <div className="flex flex-wrap gap-3" role="group" aria-label="Vote choice">
        {CHOICES.map((item) => (
          <button
            key={item.choice}
            type="button"
            onClick={() => void copy(item.choice)}
            className="rounded-lg border px-8 py-3 font-serif text-2xl transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              backgroundColor: item.bg,
              borderColor: item.border,
              color: item.color,
            }}
            aria-label={`Copy ${item.choice} vote command`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {copied && (
        <p
          className="font-mono text-xs break-all"
          style={{ color: 'var(--yes)' }}
          aria-live="polite"
        >
          Copied — paste this in your Dash Core console:
          gobject vote-many {proposalHash} funding {copied}
        </p>
      )}
      {failed && (
        <p className="font-mono text-xs" style={{ color: 'var(--no)' }}>
          Clipboard blocked — copy the command manually from below.
        </p>
      )}

      <div
        className="space-y-1 border-t pt-3 font-mono text-[10px] break-all"
        style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
      >
        <p>console: gobject vote-many {proposalHash} funding yes|no|abstain</p>
        <p>
          ssh: ~/.dashcore/dash-cli gobject vote-many {proposalHash} funding
          yes|no|abstain
        </p>
        <p>
          vote-many triggers every masternode in dash.conf — use
          gobject vote to cast from a single one.
        </p>
      </div>
    </div>
  );
}
