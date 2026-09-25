'use client';

/**
 * components/app-header.tsx
 *
 * Top navigation bar: Govenr logo, nav links, session identity pill.
 * Matches wireframe-v0.html `.app-nav` and design.md header spec.
 *
 * Client component so it can read the current pathname for the active
 * link underline. Session data is imported from the service (mock in v1).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { sessionService } from '@/lib/services/session-service';
import { dashWithSymbol } from '@/lib/format/dash';

const session = sessionService.getSession();

const navLinks = [
  { label: 'Proposals', href: '/' },
  { label: 'About', href: '/about' },
];

export default function AppHeader() {
  const pathname = usePathname();

  return (
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
            // Proposals tab is active on / and /proposals/*
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

        {/* Session pills — pushed to the right */}
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <span
            className="font-mono text-xs rounded-full px-3 py-1 border"
            style={{
              color: 'var(--text-dim)',
              borderColor: 'var(--border-strong)',
              backgroundColor: 'var(--surface)',
            }}
          >
            @{session.identityHandle}.dash
          </span>
          <span
            className="font-mono text-xs rounded-full px-3 py-1"
            style={{ backgroundColor: 'var(--slate)', color: '#fff' }}
          >
            {dashWithSymbol(session.balanceDash)} DASH
          </span>
        </div>
      </nav>
    </header>
  );
}
