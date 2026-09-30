/**
 * lib/platform/contract.ts
 *
 * Publishing and locating the Govenr data contract on Dash Platform testnet.
 *
 * evo-sdk v4 note: DataContract.fromJSON expects the NEW Platform v1
 * serialization ($formatVersion + documentSchemas), which our JSON (old
 * dashpay-era documents naming) does not match. The correct way to build a
 * NEW contract is `new DataContract({ ownerId, identityNonce, schemas,
 * fullValidation })` — schemas are our per-document definitions verbatim
 * (indices live inside each schema, which ours already do). identityNonce is
 * the identity's current revision (the contract id derives from
 * hash(ownerId, identityNonce)). Publishing is one-time per owner identity.
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide, loadSdkModule } from '@/lib/platform/sdk-module';
import { assertSigningKey } from '@/lib/platform/identity';
import type { DashSdk } from '@/lib/platform/types';
import contractJson from '@/contracts/govenr-contract.json';

// v2: the all-string schema (hashes as 44-char base64). Bumping the key
// forces a fresh contract publish under the new schema — the v1 byteArray
// schema contract stays on-chain but is no longer used.
const KEY_CONTRACT_ID = 'govenr:platform:v3:contractid';

/** The stored data contract id, or null if never published on this device. */
/**
 * The live Govenr contract on testnet, used when this browser has none
 * stored — i.e. every first-time visitor. This is what makes proposal
 * content, titles and claims readable WITHOUT signing in.
 *
 * Configure it one of two ways:
 *   1. Environment (recommended for deploys): set
 *      NEXT_PUBLIC_GOVENR_CONTRACT_ID in Vercel → Settings →
 *      Environment Variables (and in .env.local for local dev), or
 *   2. Paste the id into the fallback string below.
 *
 * How to read the id from a browser that published it:
 *   localStorage.getItem('govenr:platform:v3:contractid')
 * or copy it from the Platform explorer's Data contracts table.
 */
export const KNOWN_DEMO_CONTRACT_ID =
  process.env.NEXT_PUBLIC_GOVENR_CONTRACT_ID ??
  '8EwaSu9QiTCcJdhkfAtuWhFGZPve7NhqJV2NmipRgcuJ';

export function getStoredContractId(): string | null {
  assertClientSide('getStoredContractId');
  const stored = localStorage.getItem(KEY_CONTRACT_ID);
  const canonical = KNOWN_DEMO_CONTRACT_ID || null;
  if (canonical) {
    // Canonical wins. A browser holding a different id (from an older
    // publish) would otherwise read and write a different contract than
    // everyone else — edits saved there are invisible to other readers.
    // Realign it so every browser reads and writes the same contract.
    if (stored !== canonical) {
      try {
        localStorage.setItem(KEY_CONTRACT_ID, canonical);
      } catch {
        // Storage unavailable — the canonical id is still returned below.
      }
    }
    return canonical;
  }
  return stored;
}

/** Remembers the published data contract id. */
export function storeContractId(id: string): void {
  assertClientSide('storeContractId');
  localStorage.setItem(KEY_CONTRACT_ID, id);
}

/** The per-document schemas from the contract JSON, keyed by document type. */
export function buildGovenrSchemas(): Record<string, object> {
  const docs = (contractJson as { documents: Record<string, object> })
    .documents;
  const schemas: Record<string, object> = {};
  for (const [name, schema] of Object.entries(docs)) {
    schemas[name] = schema;
  }
  return schemas;
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
  assertSigningKey(identityKey);
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

  // Official evo-sdk v4 pattern (platform-tutorials contract-register-binary):
  // the contract nonce is the identity's NEXT nonce.
  const identityNonce = await sdk.identities.nonce(identityId);

  onLog?.('Building the Govenr data contract…');
  const dataContract = new mod.DataContract({
    ownerId: identityId,
    identityNonce: (identityNonce ?? 0n) + 1n,
    schemas: buildGovenrSchemas(),
    fullValidation: true,
  });

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
  const canonical = KNOWN_DEMO_CONTRACT_ID;
  if (canonical) {
    // A canonical contract is configured for this deployment: it is the one
    // contract every browser reads and writes. NEVER publish a new one here
    // — a fresh publish derives a new id from hash(ownerId, nonce) and forks
    // content and claims into a stray contract that other browsers cannot see.
    try {
      const existing = await sdk.contracts.fetch(canonical);
      if (existing) return canonical;
    } catch {
      onLog?.('Canonical contract could not be fetched — check the id.');
    }
    return canonical;
  }
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
