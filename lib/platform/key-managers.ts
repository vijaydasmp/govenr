/**
 * lib/platform/key-managers.ts
 *
 * Identity and platform-address key management for a BIP39 mnemonic.
 *
 * These are TypeScript ports of the canonical helper classes from the
 * official Dash Platform tutorials (dashpay/platform-tutorials,
 * setupDashClient-core.mjs). They are NOT part of @dashevo/evo-sdk itself —
 * the SDK ships the primitives (wallet.deriveKeyFromSeedWithPath,
 * PrivateKey, signers, IdentityPublicKeyInCreation) and the tutorials wrap
 * them in these managers. We port them so Govenr does not depend on a
 * third-party repo for key handling.
 *
 * Derivation paths (must match other Dash tools for compatibility):
 *   Platform address (BIP44):  m/44'/1'/0'/0/i   (testnet)
 *   Identity keys (DIP-13):    m/9'/1'/5'/0'/0'/{identityIndex}'/{keyIndex}'
 *
 * ⚠️ The managers hold private key WIFs in memory for the duration of a
 * session. They are derived from the decrypted mnemonic on demand and
 * dropped on logout. Never log them, never persist them.
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide, loadSdkModule } from '@/lib/platform/sdk-module';

type SdkModule = Awaited<ReturnType<typeof loadSdkModule>>;

export type NetworkName = 'testnet' | 'mainnet';

/** Spec for the five standard DIP-9 identity keys. */
const KEY_SPECS = [
  { keyId: 0, purpose: 'AUTHENTICATION', securityLevel: 'MASTER' },
  { keyId: 1, purpose: 'AUTHENTICATION', securityLevel: 'HIGH' },
  { keyId: 2, purpose: 'AUTHENTICATION', securityLevel: 'CRITICAL' },
  { keyId: 3, purpose: 'TRANSFER', securityLevel: 'CRITICAL' },
  { keyId: 4, purpose: 'ENCRYPTION', securityLevel: 'MEDIUM' },
] as const;

type KeyName = 'master' | 'authHigh' | 'auth' | 'transfer' | 'encryption';

const KEY_NAME_BY_ID: Record<number, KeyName> = {
  0: 'master',
  1: 'authHigh',
  2: 'auth',
  3: 'transfer',
  4: 'encryption',
};

type DerivedKeyEntry = {
  keyId: number;
  privateKeyWif: string;
  /** Only present for keys derived via createForNewIdentity(). */
  publicKey?: string;
};

export type AddressEntry = {
  bech32m: string;
  privateKeyWif: string;
  path: string;
};

/**
 * Build a DIP-13 identity key derivation path.
 * Returns the full hardened path:
 *   m/9'/{coin}'/5'/0'/0'/{identityIndex}'/{keyIndex}'
 */
async function dip13KeyPath(
  network: NetworkName,
  identityIndex: number,
  keyIndex: number,
): Promise<string> {
  const { wallet } = await loadSdkModule();
  const base =
    network === 'testnet'
      ? await wallet.derivationPathDip13Testnet(5)
      : await wallet.derivationPathDip13Mainnet(5);
  return `${base.path}/0'/0'/${identityIndex}'/${keyIndex}'`;
}

// ---------------------------------------------------------------------------
// IdentityKeyManager
// ---------------------------------------------------------------------------

/**
 * Manages DIP-13 identity keys derived from a mnemonic, mirroring the
 * official tutorial helper. Construct via create() (existing identity,
 * resolved on-chain by the master key's public key hash) or
 * createForNewIdentity() (keys for an identity not yet registered).
 */
export class IdentityKeyManager {
  private constructor(
    private readonly mod: SdkModule,
    private readonly keys: Record<KeyName, DerivedKeyEntry>,
    readonly identityId: string | null,
    readonly identityIndex: number,
  ) {}

  /**
   * Create a manager for an EXISTING identity. The identity id is resolved
   * from the mnemonic by looking up the master key's public key hash
   * on-chain — throws if no identity is registered for this mnemonic.
   */
  static async create(opts: {
    sdk: {
      identities: {
        byPublicKeyHash(hash: string): Promise<{ id: { toString(): string } } | null>;
      };
    };
    mnemonic: string;
    network: NetworkName;
    identityIndex?: number;
  }): Promise<IdentityKeyManager> {
    assertClientSide('IdentityKeyManager.create');
    const mod = await loadSdkModule();
    const { sdk, mnemonic, network } = opts;
    const identityIndex = opts.identityIndex ?? 0;

    const derive = async (keyIndex: number) => {
      const path = await dip13KeyPath(network, identityIndex, keyIndex);
      return wallet_derive(mod, mnemonic, path, network);
    };

    const [masterKey, authHighKey, authKey, transferKey, encryptionKey] =
      await Promise.all([derive(0), derive(1), derive(2), derive(3), derive(4)]);

    // Resolve the identity id from the master key's public key hash.
    const privateKey = mod.PrivateKey.fromWIF(masterKey.privateKeyWif);
    const pubKeyHash = privateKey.getPublicKeyHash();
    const identity = await sdk.identities.byPublicKeyHash(pubKeyHash);
    if (!identity) {
      throw new Error('No identity found for this recovery phrase on testnet.');
    }

    return new IdentityKeyManager(
      mod,
      {
        master: { keyId: 0, privateKeyWif: masterKey.privateKeyWif },
        authHigh: { keyId: 1, privateKeyWif: authHighKey.privateKeyWif },
        auth: { keyId: 2, privateKeyWif: authKey.privateKeyWif },
        transfer: { keyId: 3, privateKeyWif: transferKey.privateKeyWif },
        encryption: { keyId: 4, privateKeyWif: encryptionKey.privateKeyWif },
      },
      identity.id.toString(),
      identityIndex,
    );
  }

  /** Find the first unused DIP-13 identity index for a mnemonic. */
  static async findNextIndex(
    sdk: {
      identities: {
        byPublicKeyHash(hash: string): Promise<unknown | null>;
      };
    },
    mnemonic: string,
    network: NetworkName,
  ): Promise<number> {
    assertClientSide('IdentityKeyManager.findNextIndex');
    const mod = await loadSdkModule();
    for (let i = 0; ; i += 1) {
      const path = await dip13KeyPath(network, i, 0);
      const key = await wallet_derive(mod, mnemonic, path, network);
      const privateKey = mod.PrivateKey.fromWIF(key.privateKeyWif);
      const existing = await sdk.identities.byPublicKeyHash(
        privateKey.getPublicKeyHash(),
      );
      if (!existing) return i;
    }
  }

  /**
   * Create a manager for a NEW (not yet registered) identity — the keys that
   * sdk.addresses.createIdentity() will register. Auto-selects the next
   * unused identity index if omitted.
   */
  static async createForNewIdentity(opts: {
    sdk: unknown;
    mnemonic: string;
    network: NetworkName;
    identityIndex?: number;
  }): Promise<IdentityKeyManager> {
    assertClientSide('IdentityKeyManager.createForNewIdentity');
    const mod = await loadSdkModule();
    const { mnemonic, network } = opts;
    const idx =
      opts.identityIndex ??
      (await IdentityKeyManager.findNextIndex(
        opts.sdk as Parameters<
          typeof IdentityKeyManager.findNextIndex
        >[0],
        mnemonic,
        network,
      ));

    const derived = await Promise.all(
      KEY_SPECS.map((spec) =>
        wallet_derive(
          mod,
          mnemonic,
          '',
          network,
          spec.keyId,
          idx,
        ),
      ),
    );

    return new IdentityKeyManager(
      mod,
      {
        master: derived[0],
        authHigh: derived[1],
        auth: derived[2],
        transfer: derived[3],
        encryption: derived[4],
      },
      null,
      idx,
    );
  }

  /**
   * Build IdentityPublicKeyInCreation objects for all five standard keys.
   * Only works when public key data is available (createForNewIdentity).
   */
  getKeysInCreation(): InstanceType<SdkModule['IdentityPublicKeyInCreation']>[] {
    return KEY_SPECS.map((spec) => {
      const key = this.keys[KEY_NAME_BY_ID[spec.keyId]];
      if (!key.publicKey) {
        throw new Error(
          `Public key data not available for key ${spec.keyId}. Use createForNewIdentity().`,
        );
      }
      const pubKeyData = hexToBytes(key.publicKey);
      return new this.mod.IdentityPublicKeyInCreation({
        keyId: spec.keyId,
        purpose: this.mod.Purpose[spec.purpose],
        securityLevel: this.mod.SecurityLevel[spec.securityLevel],
        keyType: this.mod.KeyType.ECDSA_SECP256K1,
        data: pubKeyData,
      });
    });
  }

  /** Build an IdentitySigner loaded with all five key WIFs. */
  getFullSigner(): unknown {
    const signer = new this.mod.IdentitySigner();
    (Object.values(this.keys) as DerivedKeyEntry[]).forEach((key) => {
      signer.addKeyFromWif(key.privateKeyWif);
    });
    return signer;
  }

  /**
   * Build { identity, identityKey, signer } for one named key. Used later for
   * document signing (S9c). Requires the identity to be registered.
   */
  async getAuthKey(keyName: KeyName): Promise<{
    identityKey: DerivedKeyEntry;
    signer: unknown;
  }> {
    return {
      identityKey: this.keys[keyName],
      signer: this.getFullSigner(),
    };
  }
}

// ---------------------------------------------------------------------------
// AddressKeyManager
// ---------------------------------------------------------------------------

/**
 * Manages BIP44 platform address keys (the tdash1… bech32m addresses that
 * hold Platform credits). primaryAddress is the derived index-0 address
 * users fund before identity registration.
 */
export class AddressKeyManager {
  private constructor(
    private readonly mod: SdkModule,
    private readonly addresses: AddressEntry[],
    readonly network: NetworkName,
  ) {}

  get primaryAddress(): AddressEntry {
    return this.addresses[0];
  }

  static async create(opts: {
    sdk: unknown;
    mnemonic: string;
    network: NetworkName;
    count?: number;
  }): Promise<AddressKeyManager> {
    assertClientSide('AddressKeyManager.create');
    const mod = await loadSdkModule();
    const { mnemonic, network } = opts;
    const count = opts.count ?? 1;

    const addresses: AddressEntry[] = [];
    for (let i = 0; i < count; i += 1) {
      const pathInfo =
        network === 'testnet'
          ? await mod.wallet.derivationPathBip44Testnet(0, 0, i)
          : await mod.wallet.derivationPathBip44Mainnet(0, 0, i);
      const keyInfo = await mod.wallet.deriveKeyFromSeedWithPath({
        mnemonic,
        path: pathInfo.path,
        network,
      });

      const obj = keyInfo.toObject();
      const privateKey = mod.PrivateKey.fromWIF(obj.privateKeyWif);
      const signer = new mod.PlatformAddressSigner();
      const platformAddress = signer.addKey(privateKey);

      addresses.push({
        bech32m: platformAddress.toBech32m(network),
        privateKeyWif: obj.privateKeyWif,
        path: pathInfo.path,
      });
    }

    return new AddressKeyManager(mod, addresses, network);
  }

  /** A PlatformAddressSigner with the primary key loaded. */
  getSigner(): unknown {
    const signer = new this.mod.PlatformAddressSigner();
    const privateKey = this.mod.PrivateKey.fromWIF(
      this.primaryAddress.privateKeyWif,
    );
    signer.addKey(privateKey);
    return signer;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive one key at a DIP-13 path. Returns WIF + public key. */
async function wallet_derive(
  mod: SdkModule,
  mnemonic: string,
  path: string,
  network: NetworkName,
  keyIndex = 0,
  identityIndex = 0,
): Promise<DerivedKeyEntry & { publicKey: string }> {
  const resolved =
    path !== ''
      ? path
      : await dip13KeyPath(network, identityIndex, keyIndex);
  const keyInfo = await mod.wallet.deriveKeyFromSeedWithPath({
    mnemonic,
    path: resolved,
    network,
  });
  const obj = keyInfo.toObject();
  return {
    keyId: keyIndex,
    privateKeyWif: obj.privateKeyWif,
    publicKey: obj.publicKey,
  };
}

/** Browser-safe hex → bytes (replaces Buffer.from(hex, 'hex')). */
function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) {
    throw new Error('hexToBytes: expected even-length hex string');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const chunk = hex.slice(i * 2, i * 2 + 2);
    if (!/^[0-9A-Fa-f]{2}$/.test(chunk)) {
      throw new Error(`hexToBytes: invalid hex at offset ${i * 2}`);
    }
    out[i] = parseInt(chunk, 16);
  }
  return out;
}
