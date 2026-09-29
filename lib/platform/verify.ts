/**
 * lib/platform/verify.ts
 *
 * Verification of Dash Core `signmessage` signatures — the claim proof.
 *
 * The evo-sdk ships signMessage but no verifier, so we use bitcoinjs-message
 * (battle-tested ECDSA recovery). bitcoinjs-message v2 takes the message
 * prefix as a string and decodes the address version-agnostically, so Dash
 * testnet y… addresses verify natively. This verifies a signature against a
 * chain-sourced address WITHOUT any private key — the "app verifies" half of
 * the rule.
 *
 * Client-side only. Never import from server components.
 */

import { verify as verifySignedMessage } from 'bitcoinjs-message';
import { assertClientSide } from '@/lib/platform/sdk-module';

/** The message magic Dash Core's signmessage prefixes before hashing. */
const DASH_MESSAGE_PREFIX = 'Dash Signed Message:\n';

/**
 * Verifies a base64 signature produced by Dash Core's signmessage for the
 * given address. Returns false (never throws) on any malformed input or
 * verification failure — callers render their own honest error.
 */
export function verifyDashMessage(
  message: string,
  address: string,
  signatureBase64: string,
): boolean {
  assertClientSide('verifyDashMessage');
  try {
    return verifySignedMessage(
      message,
      address,
      signatureBase64,
      DASH_MESSAGE_PREFIX,
    );
  } catch {
    return false;
  }
}
