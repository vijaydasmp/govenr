/**
 * lib/format/dash.ts
 *
 * DASH amount formatting for Govenr.
 *
 * Rules (from tech.md):
 * - Store as `amountDash: number`.
 * - Render with max 3 decimal places, trailing zeros trimmed.
 * - The ◆ glyph is the standard DASH symbol in this app.
 */

/**
 * Formats a DASH amount as a plain number string with up to 3 decimal
 * places, trailing zeros trimmed.
 *
 * Examples:
 *   formatDash(4.2)    → "4.2"
 *   formatDash(4.200)  → "4.2"
 *   formatDash(12.4)   → "12.4"
 *   formatDash(0.1)    → "0.1"
 *   formatDash(100)    → "100"
 */
export function formatDash(amount: number): string {
  // toFixed(3) then strip trailing zeros after the decimal point
  const fixed = amount.toFixed(3);
  // Remove trailing zeros: "4.200" → "4.2", "100.000" → "100"
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/**
 * Formats a DASH amount with the ◆ symbol prefix.
 *
 * Examples:
 *   dashWithSymbol(4.2)  → "◆ 4.2"
 *   dashWithSymbol(12.4) → "◆ 12.4"
 */
export function dashWithSymbol(amount: number): string {
  return `◆ ${formatDash(amount)}`;
}

/**
 * Formats a DASH amount with the ◆ symbol and " DASH" suffix.
 * Used in proposal cards where units aren't otherwise clear.
 *
 * Example: dashFull(55) → "◆ 55 DASH"
 */
export function dashFull(amount: number): string {
  return `◆ ${formatDash(amount)} DASH`;
}
