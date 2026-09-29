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
// Clear
// ---------------------------------------------------------------------------

/** Clears all platform session data from localStorage. */
export function clearWalletStore(): void {
  assertClientSide('clearWalletStore');
  localStorage.removeItem(KEY_WALLET);
  localStorage.removeItem(KEY_IDENTITY);
}
