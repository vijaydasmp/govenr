/**
 * app/about/page.tsx
 *
 * Placeholder About page (S5 ships the full version). Exists so the header
 * nav link resolves honestly instead of 404ing during the Stage 1 demo.
 */

import Link from 'next/link';

export const metadata = {
  title: 'About — Govenr',
};

export default function AboutPage() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-12 space-y-6">
      <div>
        <p
          className="font-mono text-xs font-semibold tracking-widest uppercase mb-2"
          style={{ color: 'var(--gold)' }}
        >
          About
        </p>
        <h1
          className="font-serif text-4xl leading-tight"
          style={{ color: 'var(--text)' }}
        >
          The chain records the vote.
          <br />
          Govenr remembers why.
        </h1>
      </div>

      <p className="max-w-2xl" style={{ color: 'var(--text)' }}>
        Govenr is an open-source governance app for Dash. Layer 1 — Dash Core —
        records masternode votes on budget proposals, and that record is
        immutable and trustless. But a vote is just the last line of a story.
        Govenr adds the rest: why a proposal exists, who stands behind it, what
        the community said while it was being written — stored as documents on
        Dash Platform, owned by the identities that wrote them.
      </p>

      <p className="max-w-2xl" style={{ color: 'var(--text)' }}>
        The chain stays read-only forever. Govenr never casts votes and never
        touches masternode keys. Your wallet signs; the app verifies.
      </p>

      <p
        className="max-w-2xl font-mono text-xs leading-relaxed"
        style={{ color: 'var(--text-dim)' }}
      >
        Lineage: inspired by DashCentral&apos;s proposal pages, Rango&apos;s
        tipping wallet, and yappr&apos;s Platform identity login. Built in the
        open.
      </p>

      <p
        className="font-mono text-xs"
        style={{ color: 'var(--text-dim)' }}
        aria-live="polite"
      >
        This page is a placeholder — the full story ships with the Stage 1
        release.
      </p>

      <Link
        href="/"
        className="inline-block font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ color: 'var(--text-dim)' }}
      >
        ← All proposals
      </Link>
    </section>
  );
}
