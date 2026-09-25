/**
 * lib/format/dates.ts
 *
 * All date/time formatting for Govenr. The single place to change if we
 * ever swap locale or date library.
 *
 * Rules:
 * - Store dates as ISO 8601 UTC strings everywhere.
 * - Render via these helpers — never call new Date() or toLocaleDateString()
 *   directly in components.
 */

/**
 * Returns a human-readable relative time string, e.g. "2d ago", "3h ago",
 * "just now". Suitable for comment/review timestamps.
 */
export function relativeTime(isoUtc: string): string {
  const now = Date.now();
  const then = new Date(isoUtc).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now'; // future dates — shouldn't happen
  if (diffMs < 60_000) return 'just now';

  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

/**
 * Returns a countdown string from now to a future ISO 8601 UTC deadline,
 * e.g. "12d 4h", "2h 30m", "expired".
 * Used for voting deadline display in the cycle strip and proposal cards.
 */
export function timeUntil(isoUtc: string | null): string {
  if (!isoUtc) return '—';
  const diffMs = new Date(isoUtc).getTime() - Date.now();
  if (diffMs <= 0) return 'expired';

  const totalMins = Math.floor(diffMs / 60_000);
  const mins = totalMins % 60;
  const totalHours = Math.floor(totalMins / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Returns a short absolute date string, e.g. "Sep 25, 2026".
 * Used for submitted-on dates in proposal headers.
 */
export function shortDate(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
