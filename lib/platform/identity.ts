/**
 * lib/platform/identity.ts
 *
 * Identity registration, lookup, and DPNS name resolution wrappers.
 *
 * SOURCE: live Dash Platform (testnet DAPI)
 * Swap point: pass network='mainnet' in createPlatformClient for mainnet.
 *
 * Client-side only. Never import from server components.
 *
 * Known SDK issue (dashpay/platform#3095):
 *   sdk.addresses.createIdentity() may throw a proof-verification error
 *   even when the identity was successfully created. The real identity ID
 *   is embedded in the error message. We extract it and treat this as
 *   a success. Any other error is re-thrown.
 */

import { assertClientSide, loadSdkModule } from '@/lib/platform/sdk-module';
import { NETWORK } from '@/lib/platform/client';
import type { DashSdk } from '@/lib/platform/types';

// ---------------------------------------------------------------------------
// Mnemonic generation
// ---------------------------------------------------------------------------

/**
 * Generate a fresh BIP-39 mnemonic (12 words).
 * Uses wallet.generateMnemonic() from the SDK.
 */
export async function generateMnemonic(): Promise<string> {
  assertClientSide('generateMnemonic');
  const { wallet } = await loadSdkModule();
  return wallet.generateMnemonic();
}

// ---------------------------------------------------------------------------
// Address key manager (for funding address + identity creation)
// ---------------------------------------------------------------------------

/**
 * Derives the primary Platform address (bech32m tdash1…) from a mnemonic.
 * This is the address users fund with tDASH before identity registration.
 */
export async function deriveFundingAddress(
  sdk: DashSdk,
  mnemonic: string,
): Promise<string> {
  assertClientSide('deriveFundingAddress');
  const { AddressKeyManager } = await loadSdkModule();
  const addrKm = await AddressKeyManager.create({
    sdk: sdk as unknown as Parameters<typeof AddressKeyManager.create>[0]['sdk'],
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

const IDENTITY_FUNDING_CREDITS = 5_000_000n; // 5 000 000 credits ≈ 0.0005 DASH

/**
 * Registers a new identity on testnet and returns its ID string.
 *
 * Handles the known proof-verification bug by extracting the real identity
 * ID from the error message when the error pattern matches.
 */
export async function registerIdentity(
  sdk: DashSdk,
  mnemonic: string,
  onLog?: (msg: string) => void,
): Promise<string> {
  assertClientSide('registerIdentity');
  const { AddressKeyManager, IdentityKeyManager, Identity, Identifier } =
    await loadSdkModule();

  onLog?.('Deriving keys…');

  const rawSdk =
    sdk as unknown as Parameters<typeof AddressKeyManager.create>[0]['sdk'];

  const [addrKm, keyManager] = await Promise.all([
    AddressKeyManager.create({ sdk: rawSdk, mnemonic, network: NETWORK }),
    IdentityKeyManager.createForNewIdentity({
      sdk: rawSdk,
      mnemonic,
      network: NETWORK,
    }),
  ]);

  onLog?.('Building identity shell…');

  // randomBytes equivalent via Web Crypto
  const randomId = crypto.getRandomValues(new Uint8Array(32));
  const identity = new Identity(new Identifier(randomId));
  keyManager.getKeysInCreation().forEach((key: { toIdentityPublicKey(): unknown }) => {
    (identity as unknown as { addPublicKey(k: unknown): void }).addPublicKey(
      key.toIdentityPublicKey(),
    );
  });

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
 * Uses the master key's public key hash to look up the on-chain identity.
 */
export async function resolveIdentityFromMnemonic(
  sdk: DashSdk,
  mnemonic: string,
): Promise<string> {
  assertClientSide('resolveIdentityFromMnemonic');
  const { IdentityKeyManager } = await loadSdkModule();
  const rawSdk =
    sdk as unknown as Parameters<typeof IdentityKeyManager.create>[0]['sdk'];
  const km = await IdentityKeyManager.create({
    sdk: rawSdk,
    mnemonic,
    network: NETWORK,
  });
  const id = km.identityId;
  if (!id) throw new Error('No identity found for this mnemonic on testnet.');
  return id;
}

// ---------------------------------------------------------------------------
// DPNS name lookup
// ---------------------------------------------------------------------------

/**
 * Returns the first registered DPNS name for an identity, or null.
 * e.g. "alice.dash"
 */
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

/**
 * Returns a short display handle: DPNS name if available, otherwise
 * first 6 + "…" + last 4 chars of the identity id.
 */
export function shortHandle(
  identityId: string,
  dpnsName: string | null,
): string {
  if (dpnsName) return dpnsName;
  if (identityId.length <= 12) return identityId;
  return `${identityId.slice(0, 6)}…${identityId.slice(-4)}`;
}
