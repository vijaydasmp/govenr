'use client';

/**
 * lib/platform/session-context.tsx
 *
 * React context + provider for Dash Platform identity session state.
 *
 * On mount the provider checks localStorage:
 *   - No wallet stored  → status: 'idle'   (show login/create flow)
 *   - Wallet stored     → status: 'locked' (prompt for passphrase to unlock)
 *
 * The login flow (new wallet, existing wallet) lives in LoginPanel and calls
 * the context actions to drive state transitions here.
 *
 * Client-side only — this file has 'use client' and must never be imported
 * from server components or route handlers.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { PlatformSession, DashSdk } from '@/lib/platform/types';
import { EMPTY_SESSION } from '@/lib/platform/types';
import { hasStoredWallet, clearWalletStore } from '@/lib/platform/wallet-store';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export type SessionContextValue = {
  session: PlatformSession;

  /**
   * Called by LoginPanel when a new wallet has been created and the identity
   * registered. Saves session state and transitions to 'ready'.
   */
  onLoginComplete(identityId: string, displayHandle: string): void;

  /**
   * Called by LoginPanel while the funding/registration flow is in progress,
   * to update the session state displayed in the header.
   */
  onStatusUpdate(
    status: PlatformSession['status'],
    extra?: Partial<PlatformSession>,
  ): void;

  /** Clears all stored keys and resets to 'idle'. */
  logout(): void;

  /** Shared SDK instance once connected, or null. */
  sdk: DashSdk | null;
  setSdk(sdk: DashSdk): void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PlatformSession>(EMPTY_SESSION);
  const [sdk, setSdkState] = useState<DashSdk | null>(null);
  const initialized = useRef(false);

  // On mount: read localStorage to decide initial status.
  // We use a ref-guard so this runs exactly once even in strict-mode.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (hasStoredWallet()) {
      setSession((s) => ({ ...s, status: 'locked' }));
    }
    // else stays 'idle'
  }, []);

  const onLoginComplete = useCallback(
    (identityId: string, displayHandle: string) => {
      setSession({
        status: 'ready',
        identityId,
        displayHandle,
        fundingAddress: null,
        errorMessage: null,
      });
    },
    [],
  );

  const onStatusUpdate = useCallback(
    (
      status: PlatformSession['status'],
      extra: Partial<PlatformSession> = {},
    ) => {
      setSession((s) => ({ ...s, status, ...extra }));
    },
    [],
  );

  const logout = useCallback(() => {
    clearWalletStore();
    setSession(EMPTY_SESSION);
    setSdkState(null);
  }, []);

  const setSdk = useCallback((s: DashSdk) => {
    setSdkState(s);
  }, []);

  return (
    <SessionContext.Provider
      value={{ session, onLoginComplete, onStatusUpdate, logout, sdk, setSdk }}
    >
      {children}
    </SessionContext.Provider>
  );
}
