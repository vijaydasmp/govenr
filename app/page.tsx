/**
 * app/page.tsx — Hub placeholder
 *
 * Task 1: boots to confirm the scaffold works.
 * Task 3 replaces this with the full cycle strip + proposal cards.
 */

export default function HubPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <p
        className="font-mono text-xs font-semibold tracking-widest uppercase mb-3"
        style={{ color: 'var(--gold)' }}
      >
        Standalone app · v1
      </p>
      <h1
        className="font-serif text-5xl mb-4"
        style={{ color: 'var(--text)', lineHeight: 1.08 }}
      >
        Govenr{' '}
        <em style={{ color: 'var(--slate)' }}>— the DAO&apos;s memory, on Platform.</em>
      </h1>
      <p
        className="font-serif text-lg max-w-2xl"
        style={{ color: 'var(--text-dim)' }}
      >
        Proposal hub loading&hellip; Task 3 wires the fixture mirror here.
      </p>
    </div>
  );
}
