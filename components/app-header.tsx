'use client';

/**
 * components/app-header.tsx
 *
 * Top navigation bar: Govenr logo, nav links, session identity pill.
 * Session state comes from SessionContext — no mock data anywhere.
 *
 * Session pill rendering by status:
 *   idle / locked     → "Sign in" button that opens LoginPanel
 *   connecting /
 *   funding /
 *   registering       → spinner + status label
 *   ready             → identity handle (DPNS name or shortened id) + logout
 *   error             → "Error" pill + retry
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/platform/session-context';
import {
  getActiveNetwork,
  persistNetwork,
  type GovenrNetwork,
} from '@/lib/platform/network';
import LoginPanel from '@/components/login-panel';

const navLinks = [
  { label: 'Proposals', href: '/' },
  { label: 'About', href: '/about' },
];

const STATUS_LABELS: Record<string, string> = {
  connecting: 'connecting…',
  funding: 'awaiting funds…',
  registering: 'registering…',
};

export default function AppHeader() {
  const pathname = usePathname();
  const { session, logout } = useSession();
  const [showLogin, setShowLogin] = useState(false);
  const router = useRouter();

  // Network switch. The URL carries the choice (?network=mainnet) and
  // localStorage remembers it; the server pages read the param, so the
  // whole page (mirror + panels) follows the switch.
  const [network, setNetwork] = useState<GovenrNetwork>('testnet');
  useEffect(() => {
    setNetwork(getActiveNetwork());
  }, []);
  const switchNetwork = (next: GovenrNetwork) => {
    if (next === network) return;
    persistNetwork(next);
    setNetwork(next);
    router.push(next === 'mainnet' ? `${pathname}?network=mainnet` : pathname);
    router.refresh();
  };

  // Auto-close login panel once session becomes ready
  const isReady = session.status === 'ready';

  return (
    <>
      <header
        className="border-b"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <nav
          className="max-w-5xl mx-auto flex items-center gap-6 px-6 py-3 flex-wrap"
          aria-label="Main navigation"
        >
          {/* Logo */}
          <Link
            href="/"
            className="font-serif text-xl shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ color: 'var(--slate)' }}
            aria-label="Govenr — home"
          >
            Govenr
            <span style={{ color: 'var(--gold)', fontStyle: 'italic' }}>.</span>
          </Link>

          {/* Nav links */}
          <ul className="flex items-center gap-5 list-none" role="list">
            {navLinks.map(({ label, href }) => {
              const isActive =
                href === '/'
                  ? pathname === '/' || pathname.startsWith('/proposals')
                  : pathname === href || pathname.startsWith(href + '/');
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className="font-mono text-xs font-semibold tracking-widest uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{
                      color: isActive ? 'var(--slate)' : 'var(--text-dim)',
                      borderBottom: isActive
                        ? '2px solid var(--gold)'
                        : '2px solid transparent',
                      paddingBottom: '2px',
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Network switch — testnet demo, or the read-only mainnet mirror */}
          <div
            className="flex items-center rounded-full border overflow-hidden"
            role="group"
            aria-label="Dash network"
          >
            {(['testnet', 'mainnet'] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => switchNetwork(n)}
                aria-pressed={network === n}
                title={
                  n === 'mainnet'
                    ? 'Mainnet — read-only L1 mirror'
                    : 'Testnet — the full demo'
                }
                className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{
                  backgroundColor: network === n ? 'var(--gold)' : 'transparent',
                  color: network === n ? 'var(--surface)' : 'var(--text-dim)',
                }}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Session area — pushed right */}
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            {/* idle or locked → sign-in button */}
            {(session.status === 'idle' || session.status === 'locked') && (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="font-mono text-xs rounded-full px-3 py-1 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-dim)',
                  backgroundColor: 'var(--surface)',
                }}
                aria-label="Sign in to Dash Platform testnet"
              >
                {session.status === 'locked' ? 'Unlock' : 'Sign in'}
              </button>
            )}

            {/* in-progress states */}
            {(session.status === 'connecting' ||
              session.status === 'funding' ||
              session.status === 'registering') && (
              <span
                className="font-mono text-xs rounded-full px-3 py-1 border"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-dim)',
                  backgroundColor: 'var(--surface)',
                }}
                aria-live="polite"
              >
                {STATUS_LABELS[session.status] ?? session.status}
              </span>
            )}

            {/* ready → identity handle + network badge + logout */}
            {session.status === 'ready' && session.displayHandle && (
              <>
                <span
                  className="font-mono text-xs rounded-full px-3 py-1"
                  style={{
                    backgroundColor: 'var(--l1-dim)',
                    color: 'var(--l1)',
                  }}
                  title="Dash Platform testnet identity"
                >
                  testnet
                </span>
                <span
                  className="font-mono text-xs rounded-full px-3 py-1 border"
                  style={{
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text)',
                    backgroundColor: 'var(--surface)',
                  }}
                  aria-label={`Logged in as ${session.displayHandle}`}
                >
                  {session.displayHandle}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="font-mono text-xs rounded-full px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ backgroundColor: 'var(--slate)', color: '#fff' }}
                  aria-label="Log out"
                >
                  Logout
                </button>
              </>
            )}

            {/* error state */}
            {session.status === 'error' && (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="font-mono text-xs rounded-full px-3 py-1 border focus-visible:outline-none focus-visible:ring-2"
                style={{
                  borderColor: 'var(--no)',
                  color: 'var(--no)',
                  backgroundColor: 'var(--surface)',
                }}
                title={session.errorMessage ?? 'An error occurred'}
              >
                Error — retry
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* Login panel — overlays as a centered modal when open */}
      {showLogin && !isReady && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Dash Platform testnet identity login"
        >
          <div className="relative w-full max-w-lg">
            <LoginPanel />
            <button
              type="button"
              onClick={() => setShowLogin(false)}
              className="absolute -top-3 -right-3 font-mono text-xs w-7 h-7 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2"
              style={{ backgroundColor: 'var(--surface-dim)', color: 'var(--text-dim)' }}
              aria-label="Close login panel"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
