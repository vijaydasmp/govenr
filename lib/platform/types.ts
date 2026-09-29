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

/** Opaque handle to a connected EvoSDK instance. */
export type DashSdk = {
  connect(): Promise<void>;
  identities: {
    fetch(id: string): Promise<DashIdentity | null>;
    byPublicKeyHash(hash: Uint8Array): Promise<DashIdentity | null>;
  };
  dpns: {
    usernames(opts: { identityId: string }): Promise<string[]>;
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

export type DashIdentity = {
  id: { toString(): string };
  balance: number | bigint;
};

/** Opaque key manager — wraps DIP-9 derived keys for signing. */
export type DashKeyManager = {
  identityId: string | null;
  getAuth(): Promise<{
    identity: DashIdentity;
    identityKey: unknown;
    signer: unknown;
  }>;
  getFullSigner(): unknown;
  getKeysInCreation(): Array<{
    toIdentityPublicKey(): unknown;
  }>;
};

export type DashAddressKeyManager = {
  primaryAddress: {
    bech32m: string;
  };
  getSigner(): unknown;
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
