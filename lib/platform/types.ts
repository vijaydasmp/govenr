/**
 * lib/platform/types.ts
 *
 * Shared types for the Platform identity layer.
 * Consumers import from here — never from @dashevo/evo-sdk directly.
 * All Platform access is client-side only (see sdk-module.ts).
 */

// ---------------------------------------------------------------------------
// Opaque SDK handle types
// These mirror the shapes we actually use; we keep them minimal so the SDK
// is never imported transitively from server code.
// ---------------------------------------------------------------------------

/** Minimal shape of an on-chain identity as used by Govenr. */
export type DashIdentity = {
  id: { toString(): string };
  publicKeys?: Array<{
    getPublicKeyHash(): string;
    /** Key purpose, e.g. AUTHENTICATION (enum value or name). */
    purpose?: unknown;
    /** Key security level, e.g. HIGH (enum value or name). */
    securityLevel?: unknown;
  }>;
  balance?: number | bigint;
  /** Identity revision — doubles as the nonce for contract creation. */
  revision?: bigint;
};

/** Minimal shape of a Platform document as used by Govenr (read path). */
export type PlatformDocument = {
  id: { toString(): string };
  ownerId: { toString(): string };
  createdAt?: bigint;
  /** Current revision — bumped by +1n on replace (update). */
  revision?: bigint;
  properties: Record<string, unknown>;
};

/** Opaque handle to a connected EvoSDK instance. */
export type DashSdk = {
  connect(): Promise<void>;
  contracts: {
    /** Fetches a data contract by id, or null/undefined if not found. */
    fetch(contractId: string): Promise<unknown>;
    publish(opts: {
      dataContract: unknown;
      identityKey: unknown;
      signer: unknown;
    }): Promise<{ id: { toString(): string } }>;
  };
  documents: {
    query(opts: {
      dataContractId: string;
      documentTypeName: string;
      where?: Array<[string, string, unknown]>;
      orderBy?: Array<[string, string]>;
      limit?: number;
    }): Promise<Map<string, PlatformDocument | undefined>>;
    create(opts: {
      document: unknown;
      identityKey: unknown;
      signer: unknown;
    }): Promise<void>;
    /** Replaces a mutable document (revision must be previous + 1n). */
    replace(opts: {
      document: unknown;
      identityKey: unknown;
      signer: unknown;
    }): Promise<void>;
  };
  identities: {
    /** Looks up an identity by master public key hash (hex string). */
    byPublicKeyHash(
      publicKeyHash: string,
    ): Promise<{ id: { toString(): string } } | null>;
    /** Fetches an identity by its id (base58 string). */
    fetch(identityId: string): Promise<DashIdentity | null>;
    /** Current identity nonce — used (incremented) for contract creation. */
    nonce(identityId: string): Promise<bigint | undefined>;
  };
  dpns: {
    usernames(opts: { identityId: string }): Promise<string[]>;
    /** Resolves a DPNS name (e.g. "alice.dash") to an identity id. */
    resolveName(name: string): Promise<string | undefined>;
  };
  addresses: {
    get(bech32m: string): Promise<{ balance?: bigint } | undefined>;
    createIdentity(opts: {
      identity: unknown;
      inputs: Array<{ address: string; amount: bigint }>;
      identitySigner: unknown;
      addressSigner: unknown;
    }): Promise<{ identity: { id: { toString(): string } } }>;
  };
  version(): number;
};

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

/** Possible states the session can be in. */
export type SessionStatus =
  | 'idle'           // no wallet stored, show login
  | 'locked'         // wallet stored but not yet unlocked
  | 'connecting'     // SDK connecting to DAPI
  | 'funding'        // identity not yet registered, waiting for tDASH
  | 'registering'    // identity registration in flight
  | 'ready'          // logged in, identity resolved
  | 'error';         // unrecoverable error this session

export type PlatformSession = {
  status: SessionStatus;
  /** Shortened identity id or DPNS name, e.g. "abc123…xyz" or "alice.dash" */
  displayHandle: string | null;
  /** Full identity id */
  identityId: string | null;
  /** bech32m Platform address for funding (shown during 'funding' state) */
  fundingAddress: string | null;
  /** Human-readable error for the 'error' state */
  errorMessage: string | null;
};

export const EMPTY_SESSION: PlatformSession = {
  status: 'idle',
  displayHandle: null,
  identityId: null,
  fundingAddress: null,
  errorMessage: null,
};
