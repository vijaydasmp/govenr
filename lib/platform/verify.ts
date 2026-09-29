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
 * CRITICAL, learned the hard way: the prefix string must START WITH ITS
 * LENGTH BYTE, and Dash Core's magic is still "DarkCoin Signed Message:\n"
 * (dash src/util/message.cpp, MESSAGE_MAGIC) — the original 2014 DarkCoin
 * name, kept for compatibility. It is NOT "Dash Signed Message:\n".
 * Core serializes: varint(25) + the 25-byte magic + varint(len) + message,
 * then double-SHA256. bitcoinjs-message bakes the length byte into the
 * prefix (its Bitcoin default is \u0018 + "Bitcoin Signed Message:\n"), so the
 * Dash prefix is \u0019 + "DarkCoin Signed Message:\n". Verified byte-exact
 * against Core's MessageHash implementation.
 *
 * Client-side only. Never import from server components.
 */

import { verify as verifySignedMessage } from 'bitcoinjs-message';
import { assertClientSide } from '@/lib/platform/sdk-module';

/** The message magic Dash Core's signmessage prefixes before hashing (dash
 * src/util/message.cpp: MESSAGE_MAGIC), WITH its compact-size length byte:
 * 0x19 = 25 = byte length of "DarkCoin Signed Message:" + newline. */
const DASH_MESSAGE_PREFIX = '\u0019DarkCoin Signed Message:\n';

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
  } catch (err) {
    // Surface the real cause (bad base64, missing Buffer shim, etc.) in the
    // browser console instead of silently reporting a signature mismatch.
    console.error('[govenr] signature verification error:', err);
    return false;
  }
}
