/**
 * lib/platform/client.ts
 *
 * Creates and connects an EvoSDK client for Dash Platform testnet.
 *
 * SOURCE: live Dash Platform (testnet DAPI)
 * Swap point: pass network='mainnet' when v2 goes to mainnet.
 *
 * Client-side only. Never import from server components.
 */

import { assertClientSide, loadSdkModule } from '@/lib/platform/sdk-module';
import type { DashSdk } from '@/lib/platform/types';

const NETWORK = 'testnet' as const;

/**
 * Create and connect an EvoSDK instance for testnet.
 * Returns the connected SDK handle.
 */
export async function createPlatformClient(): Promise<DashSdk> {
  assertClientSide('createPlatformClient');
  const { EvoSDK } = await loadSdkModule();
  const sdk = EvoSDK.testnetTrusted();
  await sdk.connect();
  return sdk as unknown as DashSdk;
}

export { NETWORK };
