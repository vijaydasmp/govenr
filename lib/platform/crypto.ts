/**
 * lib/platform/crypto.ts
 *
 * Passphrase-based mnemonic encryption/decryption using the Web Crypto API.
 * Key material never leaves the browser, is never logged, and never sent
 * to any server.
 *
 * Scheme:
 *   Key derivation : PBKDF2-SHA256, 200 000 iterations, 256-bit key
 *   Encryption     : AES-GCM, 96-bit IV (random per encrypt call)
 *   Storage format : base64( salt[16] || iv[12] || ciphertext )
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide } from '@/lib/platform/sdk-module';

const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function decode(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw',
    encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts a mnemonic string with the given passphrase.
 * Returns a single base64 blob: salt || iv || ciphertext.
 */
export async function encryptMnemonic(
  mnemonic: string,
  passphrase: string,
): Promise<string> {
  assertClientSide('encryptMnemonic');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encode(mnemonic),
  );
  // Concatenate salt + iv + ciphertext into one buffer
  const combined = new Uint8Array(
    SALT_BYTES + IV_BYTES + ciphertext.byteLength,
  );
  combined.set(salt, 0);
  combined.set(iv, SALT_BYTES);
  combined.set(new Uint8Array(ciphertext), SALT_BYTES + IV_BYTES);
  return toBase64(combined.buffer);
}

/**
 * Decrypts an encrypted mnemonic blob with the given passphrase.
 * Throws if the passphrase is wrong or the blob is corrupt.
 */
export async function decryptMnemonic(
  blob: string,
  passphrase: string,
): Promise<string> {
  assertClientSide('decryptMnemonic');
  const combined = fromBase64(blob);
  const salt = combined.slice(0, SALT_BYTES);
  const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = combined.slice(SALT_BYTES + IV_BYTES);
  const key = await deriveKey(passphrase, salt);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
  } catch {
    throw new Error('Wrong passphrase or corrupt wallet data.');
  }
  return decode(new Uint8Array(plaintext));
}
