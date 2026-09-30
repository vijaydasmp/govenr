'use client';
/**
 * components/vote-cta-panel.tsx — the action bar.
 *
 * Compact and friendly: thumb up / thumb down / abstain. A click
 * copies the official Dash Core voting command to the clipboard —
 * Govenr is read-only on L1 forever; the masternode owner casts the
 * vote in their own console. The exact commands live behind a
 * collapsible, out of the way.
 *
 *   gobject vote-many <governance-hash> funding yes|no|abstain
 *
 * (Format per the official Dash governance docs. `vote-many` triggers
 * every masternode configured in dash.conf; `gobject vote` casts from
 * a single one. Over SSH, prefix with ~/.dashcore/dash-cli.)
 */

import { useState, type ReactElement } from 'react';

type VoteChoice = 'yes' | 'no' | 'abstain';

function ThumbUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M2 21h4V9H2v12zM23 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M22 3h-4v12h4V3zM1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2z" />
    </svg>
  );
}

function AbstainIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

const CHOICES: Array<{
  choice: VoteChoice;
  label: string;
  Icon: () => ReactElement;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    choice: 'yes',
    label: 'Yes',
    Icon: ThumbUpIcon,
    color: 'var(--yes)',
    bg: 'rgba(4, 120, 87, 0.08)',
    border: 'var(--yes)',
  },
  {
    choice: 'no',
    label: 'No',
    Icon: ThumbDownIcon,
    color: 'var(--no)',
    bg: 'rgba(194, 65, 12, 0.08)',
    border: 'var(--no)',
  },
  {
    choice: 'abstain',
    label: 'Abstain',
    Icon: AbstainIcon,
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
      className="rounded-lg border px-6 py-4 space-y-3"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className="font-mono text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-dim)' }}
        >
          Vote
        </p>
        <p className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
          click to copy the command for your Dash Core console
        </p>
      </div>

      <div className="flex flex-wrap gap-3" role="group" aria-label="Vote choice">
        {CHOICES.map(({ choice, label, Icon, color, bg, border }) => (
          <button
            key={choice}
            type="button"
            onClick={() => void copy(choice)}
            className="flex items-center gap-2 rounded-lg border px-6 py-2.5 font-serif text-xl transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: bg, borderColor: border, color }}
            aria-label={`Copy ${choice} vote command`}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>

      {copied && (
        <p
          className="font-mono text-xs break-all"
          style={{ color: 'var(--yes)' }}
          aria-live="polite"
        >
          Copied — paste it in Dash Core (Tools → Debug console):
          gobject vote-many {proposalHash} funding {copied}
        </p>
      )}
      {failed && (
        <p className="font-mono text-xs" style={{ color: 'var(--no)' }}>
          Clipboard blocked — open the commands below and copy manually.
        </p>
      )}

      <details className="group">
        <summary
          className="font-mono text-[10px] cursor-pointer select-none"
          style={{ color: 'var(--text-dim)' }}
        >
          show commands
        </summary>
        <div
          className="mt-2 space-y-1 border-t pt-2 font-mono text-[10px] break-all"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          <p>
            console: gobject vote-many {proposalHash} funding yes|no|abstain
          </p>
          <p>
            ssh: ~/.dashcore/dash-cli gobject vote-many {proposalHash}{' '}
            funding yes|no|abstain
          </p>
          <p>
            vote-many triggers every masternode in dash.conf — use
            gobject vote to cast from a single one.
          </p>
        </div>
      </details>
    </div>
  );
}
