/**
 * lib/platform/verify.ts
 *
 * Verification of Dash Core `signmessage` signatures — the claim proof.
 *
 * bitcoinjs-message v2 takes the message prefix as a string and decodes the
 * address version-agnostically, so Dash testnet y… addresses verify natively.
 * This verifies a signature against a chain-sourced address WITHOUT any
 * private key — the "app verifies" half of the rule.
 *
 * CRITICAL: the prefix string must START WITH ITS LENGTH BYTE. Dash Core
 * serializes the magic as a compact-size string: varint(21) + the 21 bytes of
 * "Dash Signed Message:" + newline. bitcoinjs-message bakes that length byte
 * into the prefix (its Bitcoin default is \u0018 + "Bitcoin Signed Message:\n").
 * "Dash Signed Message:\n" is 21 chars = 0x15, so the prefix is
 * \u0015 + the text — without the 0x15 byte every real Dash Core signature
 * fails to verify (verified against Core's exact serialization).
 *
 * Client-side only. Never import from server components.
 */

import { verify as verifySignedMessage } from 'bitcoinjs-message';
import { assertClientSide } from '@/lib/platform/sdk-module';

/** The message magic Dash Core's signmessage prefixes before hashing:
 * 0x15 = the compact-size length of the 21-byte magic string itself. */
const DASH_MESSAGE_PREFIX = '\u0015Dash Signed Message:\n';

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
