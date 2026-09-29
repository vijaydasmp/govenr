/**
 * lib/platform/errors.ts
 *
 * Extracts a readable message from anything the evo-sdk throws. The SDK's
 * wasm errors (WasmDppError, WasmSdkError) have .message/.name getters but
 * do NOT extend Error — a generic instanceof check loses their text, which
 * cost us several blind iterations before this was understood.
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide } from '@/lib/platform/sdk-module';

/** Turns any thrown value (Error, wasm error object, plain value) into text. */
export function describePlatformError(err: unknown): string {
  assertClientSide('describePlatformError');
  if (err instanceof Error) return err.message;
  const e = err as { message?: unknown; name?: unknown };
  const message =
    typeof e?.message === 'string' || typeof e?.message === 'number'
      ? String(e.message)
      : '';
  if (message) {
    const name = typeof e?.name === 'string' ? e.name : '';
    return name ? `${name}: ${message}` : message;
  }
  try {
    const json = JSON.stringify(err);
    if (json && json !== '{}') return json;
  } catch {
    // not serializable
  }
  return 'Operation failed.';
}
