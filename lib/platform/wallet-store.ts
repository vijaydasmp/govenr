/**
 * lib/platform/wallet-store.ts
 *
 * localStorage-backed wallet persistence.
 *
 * Keys (namespaced per tech.md convention):
 *   govenr:platform:v1:wallet  — encrypted mnemonic blob (base64)
 *   govenr:platform:v1:identity — stored identity id (plain string)
 *
 * The mnemonic blob is the output of encryptMnemonic() — passphrase-
 * encrypted AES-GCM. The raw mnemonic is never written to storage.
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide } from '@/lib/platform/sdk-module';

const KEY_WALLET = 'govenr:platform:v1:wallet';
const KEY_IDENTITY = 'govenr:platform:v1:identity';

// ---------------------------------------------------------------------------
// Wallet blob (encrypted mnemonic)
// ---------------------------------------------------------------------------

/** Returns true if an encrypted wallet is present in storage. */
export function hasStoredWallet(): boolean {
  assertClientSide('hasStoredWallet');
  return localStorage.getItem(KEY_WALLET) !== null;
}

/** Saves the encrypted mnemonic blob. */
export function saveEncryptedMnemonic(blob: string): void {
  assertClientSide('saveEncryptedMnemonic');
  localStorage.setItem(KEY_WALLET, blob);
}

/** Returns the encrypted mnemonic blob, or null if not present. */
export function loadEncryptedMnemonic(): string | null {
  assertClientSide('loadEncryptedMnemonic');
  return localStorage.getItem(KEY_WALLET);
}

// ---------------------------------------------------------------------------
// Identity id
// ---------------------------------------------------------------------------

/** Saves the identity id. */
export function saveIdentityId(id: string): void {
  assertClientSide('saveIdentityId');
  localStorage.setItem(KEY_IDENTITY, id);
}

/** Returns the stored identity id, or null. */
export function loadIdentityId(): string | null {
  assertClientSide('loadIdentityId');
  return localStorage.getItem(KEY_IDENTITY);
}

// ---------------------------------------------------------------------------
// Key-based session (yappr-style sign-in)
// ---------------------------------------------------------------------------

const KEY_KEYSESSION = 'govenr:platform:v1:keysession';
const TAB_WIF = 'govenr:platform:v1:tabkey';

/** Marks a key-based session and remembers which identity it belongs to. */
export function saveKeySessionIdentity(identityId: string): void {
  assertClientSide('saveKeySessionIdentity');
  localStorage.setItem(KEY_KEYSESSION, identityId);
}

/** Returns the remembered identity id for a key-based session, or null. */
export function loadKeySessionIdentity(): string | null {
  assertClientSide('loadKeySessionIdentity');
  return localStorage.getItem(KEY_KEYSESSION);
}

/** Clears the key-based session marker and the tab-scoped key. */
export function clearKeySessionIdentity(): void {
  assertClientSide('clearKeySessionIdentity');
  localStorage.removeItem(KEY_KEYSESSION);
  try {
    sessionStorage.removeItem(TAB_WIF);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/**
 * Holds the sign-in key for this browser tab only. sessionStorage clears
 * when the tab closes, so the key is never written to disk.
 */
export function rememberTabKey(wif: string): void {
  assertClientSide('rememberTabKey');
  try {
    sessionStorage.setItem(TAB_WIF, wif);
  } catch {
    /* storage unavailable — session stays in memory only */
  }
}

/** Returns the tab-scoped sign-in key, or null. */
export function loadTabKey(): string | null {
  assertClientSide('loadTabKey');
  try {
    return sessionStorage.getItem(TAB_WIF);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

/** Clears all platform session data from storage. */
export function clearWalletStore(): void {
  assertClientSide('clearWalletStore');
  localStorage.removeItem(KEY_WALLET);
  localStorage.removeItem(KEY_IDENTITY);
  localStorage.removeItem(KEY_KEYSESSION);
  try {
    sessionStorage.removeItem(TAB_WIF);
  } catch {
    /* storage unavailable */
  }
}
