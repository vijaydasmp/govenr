/**
 * lib/platform/sdk-module.ts
 *
 * Dynamic import wrapper for @dashevo/evo-sdk.
 *
 * @dashevo/evo-sdk is ESM-only and ships a WASM bundle. It MUST be loaded
 * with a dynamic import() — never a static top-level import — so Next.js's
 * webpack does not attempt to bundle it at build time.
 *
 * All functions here are client-side only. assertClientSide() is the
 * build-time safeguard: it throws immediately if called in a Node/SSR
 * context, catching accidental server-side imports at development time.
 *
 * Consumers: lib/platform/client.ts, lib/platform/identity.ts
 * Never import this from a server component or a file without 'use client'.
 */

// ---------------------------------------------------------------------------
// Server-side guard
// ---------------------------------------------------------------------------

export function assertClientSide(caller: string): void {
  if (typeof window === 'undefined') {
    throw new Error(
      `[platform] ${caller} must only be called in the browser. ` +
        'Do not import lib/platform/* from server components or route handlers.',
    );
  }
}

// ---------------------------------------------------------------------------
// Cached module promise — load once per browser session
// ---------------------------------------------------------------------------

type EvoSdkModule = typeof import('@dashevo/evo-sdk');

let _modulePromise: Promise<EvoSdkModule> | null = null;

/**
 * Dynamically imports @dashevo/evo-sdk. Safe to call multiple times —
 * the module is only loaded once and the promise is shared.
 *
 * Must be called from a 'use client' component, after mount.
 */
export async function loadSdkModule(): Promise<EvoSdkModule> {
  assertClientSide('loadSdkModule');
  if (!_modulePromise) {
    // Dynamic import keeps the WASM bundle out of the server bundle.
    _modulePromise = import('@dashevo/evo-sdk');
  }
  return _modulePromise;
}
