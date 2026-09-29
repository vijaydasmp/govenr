/**
 * lib/platform/identity.ts
 *
 * Identity registration, lookup, and DPNS name resolution wrappers.
 *
 * SOURCE: live Dash Platform (testnet DAPI)
 * Swap point: pass network='mainnet' to the key managers for mainnet.
 *
 * Client-side only. Never import from server components.
 *
 * Key managers are ports of the official Dash Platform tutorial helpers
 * (see lib/platform/key-managers.ts for provenance).
 *
 * Known SDK issue (dashpay/platform#3095):
 *   sdk.addresses.createIdentity() may throw a proof-verification error
 *   even when the identity was successfully created. The real identity ID
 *   is embedded in the error message. We extract it and treat this as
 *   a success — same workaround as the official tutorials. Any other
 *   error is re-thrown.
 */

import { assertClientSide, loadSdkModule } from '@/lib/platform/sdk-module';
import { NETWORK } from '@/lib/platform/client';
import {
  AddressKeyManager,
  IdentityKeyManager,
} from '@/lib/platform/key-managers';
import type { DashSdk } from '@/lib/platform/types';

// ---------------------------------------------------------------------------
// Mnemonic generation
// ---------------------------------------------------------------------------

/** Generate a fresh BIP-39 mnemonic (12 words). */
export async function generateMnemonic(): Promise<string> {
  assertClientSide('generateMnemonic');
  const { wallet } = await loadSdkModule();
  return wallet.generateMnemonic();
}

// ---------------------------------------------------------------------------
// Address key manager (for funding address + identity creation)
// ---------------------------------------------------------------------------

/** Derives the primary Platform address (bech32m tdash1…) from a mnemonic.
 * This is the address users fund before identity registration. */
export async function deriveFundingAddress(
  mnemonic: string,
): Promise<string> {
  assertClientSide('deriveFundingAddress');
  const addrKm = await AddressKeyManager.create({
    sdk: null,
    mnemonic,
    network: NETWORK,
    count: 1,
  });
  return addrKm.primaryAddress.bech32m;
}

// ---------------------------------------------------------------------------
// Balance polling
// ---------------------------------------------------------------------------

/**
 * Returns the current balance (in credits) of a Platform address, or null
 * if the address has not yet appeared on-chain.
 */
export async function getFundingAddressBalance(
  sdk: DashSdk,
  bech32m: string,
): Promise<bigint | null> {
  assertClientSide('getFundingAddressBalance');
  try {
    const info = await sdk.addresses.get(bech32m);
    if (!info || info.balance === undefined) return null;
    return typeof info.balance === 'bigint'
      ? info.balance
      : BigInt(info.balance);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Identity registration
// ---------------------------------------------------------------------------

/** Credits transferred from the funding address to the new identity. */
const IDENTITY_FUNDING_CREDITS = 5_000_000n; // matches the official tutorials

/**
 * Registers a new identity on testnet and returns its ID string.
 *
 * Handles the known proof-verification bug (dashpay/platform#3095) by
 * extracting the real identity ID from the error message when the error
 * pattern matches — identical to the official tutorial workaround.
 */
export async function registerIdentity(
  sdk: DashSdk,
  mnemonic: string,
  onLog?: (msg: string) => void,
): Promise<string> {
  assertClientSide('registerIdentity');
  const mod = await loadSdkModule();

  onLog?.('Deriving identity keys…');
  const [keyManager, addrKm] = await Promise.all([
    IdentityKeyManager.createForNewIdentity({
      sdk,
      mnemonic,
      network: NETWORK,
    }),
    AddressKeyManager.create({ sdk, mnemonic, network: NETWORK }),
  ]);

  onLog?.('Building identity shell…');
  // Browser-safe random 32 bytes (replaces node:crypto randomBytes).
  const randomId = crypto.getRandomValues(new Uint8Array(32));
  const identity = new mod.Identity(new mod.Identifier(randomId));
  for (const key of keyManager.getKeysInCreation()) {
    identity.addPublicKey(key.toIdentityPublicKey());
  }

  onLog?.('Submitting identity creation state transition…');
  try {
    const result = await sdk.addresses.createIdentity({
      identity,
      inputs: [
        {
          address: addrKm.primaryAddress.bech32m,
          amount: IDENTITY_FUNDING_CREDITS,
        },
      ],
      identitySigner: keyManager.getFullSigner(),
      addressSigner: addrKm.getSigner(),
    });
    const id = result.identity.id.toString();
    onLog?.(`Identity registered: ${id}`);
    return id;
  } catch (err: unknown) {
    // Known SDK bug: proof verification fails but identity was created.
    // Extract the real identity ID from the error message.
    const msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/proof returned identity (\w+) but/);
    if (match) {
      const id = match[1];
      onLog?.(`Identity registered (proof quirk): ${id}`);
      return id;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Existing identity login
// ---------------------------------------------------------------------------

/**
 * Resolves the identity ID from a mnemonic (for returning users).
 * Looks up the master key's public key hash on-chain.
 */
export async function resolveIdentityFromMnemonic(
  sdk: DashSdk,
  mnemonic: string,
): Promise<string> {
  assertClientSide('resolveIdentityFromMnemonic');
  const km = await IdentityKeyManager.create({
    sdk,
    mnemonic,
    network: NETWORK,
  });
  if (!km.identityId) {
    throw new Error('No identity found for this recovery phrase on testnet.');
  }
  return km.identityId;
}

// ---------------------------------------------------------------------------
// DPNS name lookup
// ---------------------------------------------------------------------------

/** Returns the first registered DPNS name for an identity, or null. */
export async function resolveDpnsName(
  sdk: DashSdk,
  identityId: string,
): Promise<string | null> {
  assertClientSide('resolveDpnsName');
  try {
    const names = await sdk.dpns.usernames({ identityId });
    if (Array.isArray(names) && names.length > 0) return names[0];
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Display handle helper
// ---------------------------------------------------------------------------

/** Short display handle: DPNS name if available, else 6…4 of the identity id. */
export function shortHandle(
  identityId: string,
  dpnsName: string | null,
): string {
  if (dpnsName) return dpnsName;
  if (identityId.length <= 12) return identityId;
  return `${identityId.slice(0, 6)}…${identityId.slice(-4)}`;
}
