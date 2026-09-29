/**
 * lib/platform/contract.ts
 *
 * Publishing and locating the Govenr data contract on Dash Platform testnet.
 *
 * The contract JSON (contracts/govenr-contract.json) ships with two
 * placeholders — $format_version and ownerId — which are filled
 * programmatically at publish time: ownerId becomes the logged-in identity,
 * $format_version is '1'. Publishing is one-time per owner identity.
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide, loadSdkModule } from '@/lib/platform/sdk-module';
import type { DashSdk } from '@/lib/platform/types';
import contractJson from '@/contracts/govenr-contract.json';

const KEY_CONTRACT_ID = 'govenr:platform:v1:contractid';

/** The stored data contract id, or null if never published on this device. */
export function getStoredContractId(): string | null {
  assertClientSide('getStoredContractId');
  return localStorage.getItem(KEY_CONTRACT_ID);
}

/** Remembers the published data contract id. */
export function storeContractId(id: string): void {
  assertClientSide('storeContractId');
  localStorage.setItem(KEY_CONTRACT_ID, id);
}

/** The Govenr contract JSON with both placeholders filled for this owner. */
export function buildGovenrContract(identityId: string): unknown {
  return {
    ...contractJson,
    ownerId: identityId,
    $format_version: '1',
  };
}

/**
 * Matches a WIF against the identity's registered public keys and builds the
 * signer context for write operations. Shared by contract publishing and
 * document creation.
 */
export async function getSigningContext(
  sdk: DashSdk,
  identityId: string,
  wif: string,
): Promise<{
  mod: Awaited<ReturnType<typeof loadSdkModule>>;
  identityKey: unknown;
  signer: unknown;
}> {
  assertClientSide('getSigningContext');
  const mod = await loadSdkModule();
  const identity = await sdk.identities.fetch(identityId);
  const keys = identity?.publicKeys ?? [];
  if (keys.length === 0) {
    throw new Error('Identity not found or has no registered keys.');
  }
  const privateKey = mod.PrivateKey.fromWIF(wif);
  const pubKeyHash = privateKey.getPublicKeyHash().toLowerCase();
  const identityKey = keys.find(
    (k) => k.getPublicKeyHash().toLowerCase() === pubKeyHash,
  );
  if (!identityKey) {
    throw new Error(
      'The logged-in key is not registered to this identity. Sign in with a key that belongs to it.',
    );
  }
  const signer = new mod.IdentitySigner();
  signer.addKeyFromWif(wif);
  return { mod, identityKey, signer };
}

/** Publishes the Govenr data contract to Platform testnet. One-time. */
export async function publishGovenrContract(
  sdk: DashSdk,
  identityId: string,
  authKeyWif: string,
  onLog?: (msg: string) => void,
): Promise<string> {
  assertClientSide('publishGovenrContract');
  const { mod, identityKey, signer } = await getSigningContext(
    sdk,
    identityId,
    authKeyWif,
  );

  onLog?.('Building the Govenr data contract…');
  const dataContract = mod.DataContract.fromJSON(
    buildGovenrContract(identityId) as never,
    false,
    0,
  );

  onLog?.('Publishing the contract to Platform testnet (one-time)…');
  const published = await sdk.contracts.publish({
    dataContract,
    identityKey,
    signer,
  });
  const id = published.id.toString();
  storeContractId(id);
  onLog?.(`Contract published: ${id.slice(0, 12)}…`);
  return id;
}

/**
 * Returns the contract id, publishing first if this device has none or the
 * stored one no longer exists on-chain. Safe to call before every claim.
 */
export async function ensureContractPublished(
  sdk: DashSdk,
  identityId: string,
  authKeyWif: string,
  onLog?: (msg: string) => void,
): Promise<string> {
  assertClientSide('ensureContractPublished');
  const stored = getStoredContractId();
  if (stored) {
    try {
      const existing = await sdk.contracts.fetch(stored);
      if (existing) return stored;
    } catch {
      /* fall through and publish */
    }
  }
  return publishGovenrContract(sdk, identityId, authKeyWif, onLog);
}
