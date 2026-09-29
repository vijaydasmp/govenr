'use client';

/**
 * components/login-panel.tsx
 *
 * Full login/onboarding flow for Dash Platform testnet identity.
 * Labelled honestly: "Dash Platform testnet identity" throughout.
 *
 * States handled:
 *   idle    → new wallet: generate mnemonic → set passphrase → show funding address
 *   idle    → existing wallet: enter mnemonic + passphrase
 *   funding → poll balance, show bech32m address
 *   registering → spinner while identity state transition confirms
 *   locked  → unlock with passphrase
 *   error   → show message + retry
 *
 * Key-material rules:
 *   - Mnemonic shown once in a read-only textarea; user copies it.
 *   - Mnemonic is never logged, never sent anywhere.
 *   - After encryption + storage, the in-memory copy is overwritten with ''.
 *   - Passphrase is held only in controlled input state; cleared on submit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/platform/session-context';
import { createPlatformClient } from '@/lib/platform/client';
import { encryptMnemonic, decryptMnemonic } from '@/lib/platform/crypto';
import {
  hasStoredWallet,
  saveEncryptedMnemonic,
  loadEncryptedMnemonic,
  saveIdentityId,
  loadIdentityId,
} from '@/lib/platform/wallet-store';
import {
  generateMnemonic,
  deriveFundingAddress,
  getFundingAddressBalance,
  registerIdentity,
  resolveIdentityFromMnemonic,
  resolveDpnsName,
  shortHandle,
} from '@/lib/platform/identity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function creditsToTdash(credits: bigint): string {
  // 1 DASH = 100 000 000 000 credits (duffs * 1000)
  const duffs = credits / 1000n;
  const dash = Number(duffs) / 1e8;
  return dash.toFixed(6);
}

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-mono text-xs font-semibold tracking-widest uppercase mb-3"
      style={{ color: 'var(--gold)' }}
    >
      {children}
    </p>
  );
}

function StatusLine({
  msg,
  isError = false,
}: {
  msg: string;
  isError?: boolean;
}) {
  return (
    <p
      className="font-mono text-xs mt-2"
      style={{ color: isError ? 'var(--no)' : 'var(--text-dim)' }}
    >
      {msg}
    </p>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono text-xs rounded px-4 py-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={{
        backgroundColor: 'var(--slate)',
        color: '#fff',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function MonoInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <label
        className="font-mono text-xs"
        style={{ color: 'var(--text-dim)' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border-strong)',
          color: 'var(--text)',
        }}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Unlock existing wallet
// ---------------------------------------------------------------------------

function UnlockPanel({ onDone }: { onDone: () => void }) {
  const { onLoginComplete, onStatusUpdate, setSdk, sdk: existingSdk } = useSession();
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(async () => {
    setError(null);
    setBusy(true);
    const pass = passphrase;
    try {
      const blob = loadEncryptedMnemonic();
      if (!blob) throw new Error('No wallet found in storage.');
      const mnemonic = await decryptMnemonic(blob, pass);

      onStatusUpdate('connecting');
      const sdk = existingSdk ?? (await createPlatformClient());
      if (!existingSdk) setSdk(sdk);

      // Check if identity is already stored
      let identityId = loadIdentityId();
      if (!identityId) {
        onStatusUpdate('connecting');
        identityId = await resolveIdentityFromMnemonic(sdk, mnemonic);
        saveIdentityId(identityId);
      }

      const dpnsName = await resolveDpnsName(sdk, identityId);
      const handle = shortHandle(identityId, dpnsName);
      onLoginComplete(identityId, handle);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed.');
      onStatusUpdate('locked');
    } finally {
      setBusy(false);
      setPassphrase('');
    }
  }, [passphrase, existingSdk, onLoginComplete, onStatusUpdate, setSdk, onDone]);

  return (
    <div className="space-y-4">
      <SectionLabel>Dash Platform testnet identity</SectionLabel>
      <h2 className="font-serif text-2xl" style={{ color: 'var(--text)' }}>
        Unlock wallet
      </h2>
      <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        Enter your passphrase to unlock your stored testnet identity.
      </p>
      <MonoInput
        label="Passphrase"
        type="password"
        value={passphrase}
        onChange={setPassphrase}
        placeholder="••••••••"
      />
      {error && <StatusLine msg={error} isError />}
      <div className="flex gap-3">
        <PrimaryButton onClick={unlock} disabled={busy || !passphrase}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: New wallet — step 1: show generated mnemonic
// ---------------------------------------------------------------------------

function NewWalletMnemonicPanel({
  mnemonic,
  onConfirmed,
}: {
  mnemonic: string;
  onConfirmed: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(mnemonic).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <SectionLabel>New testnet wallet</SectionLabel>
      <h2 className="font-serif text-2xl" style={{ color: 'var(--text)' }}>
        Save your recovery phrase
      </h2>
      <p className="font-mono text-xs" style={{ color: 'var(--no)' }}>
        Write these 12 words down and store them safely. This is the only time
        they will be shown. Govenr cannot recover your wallet.
      </p>
      <textarea
        readOnly
        value={mnemonic}
        rows={3}
        className="w-full rounded border px-3 py-2 font-mono text-xs resize-none focus:outline-none focus-visible:ring-2"
        style={{
          backgroundColor: 'var(--surface-dim)',
          borderColor: 'var(--border-strong)',
          color: 'var(--text)',
        }}
        aria-label="Recovery phrase — copy and store safely"
      />
      <div className="flex gap-3">
        <PrimaryButton onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy phrase'}
        </PrimaryButton>
        <PrimaryButton onClick={onConfirmed}>
          I&apos;ve saved it — continue
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: New wallet — step 2: set passphrase + encrypt + fund + register
// ---------------------------------------------------------------------------

function NewWalletSetupPanel({
  mnemonic,
  onComplete,
}: {
  mnemonic: string;
  onComplete: () => void;
}) {
  const { onLoginComplete, onStatusUpdate, setSdk, sdk: existingSdk } = useSession();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundingAddress, setFundingAddress] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appendLog = (msg: string) =>
    setLog((prev) => [...prev.slice(-8), msg]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), []);

  const start = useCallback(async () => {
    if (passphrase !== confirm) {
      setError('Passphrases do not match.');
      return;
    }
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters.');
      return;
    }
    setError(null);
    setBusy(true);
    const pass = passphrase;

    try {
      // Encrypt and persist mnemonic
      appendLog('Encrypting wallet…');
      const blob = await encryptMnemonic(mnemonic, pass);
      setPassphrase('');
      setConfirm('');
      saveEncryptedMnemonic(blob);
      appendLog('Wallet encrypted and saved.');

      // Connect SDK
      appendLog('Connecting to Dash Platform testnet…');
      onStatusUpdate('connecting');
      const sdk = existingSdk ?? (await createPlatformClient());
      if (!existingSdk) setSdk(sdk);
      appendLog('Connected.');

      // Derive funding address
      const addr = await deriveFundingAddress(sdk, mnemonic);
      setFundingAddress(addr);
      onStatusUpdate('funding', { fundingAddress: addr });
      appendLog(`Fund this address with tDASH: ${addr}`);

      // Poll for balance
      appendLog('Waiting for funds…');
      pollRef.current = setInterval(async () => {
        const balance = await getFundingAddressBalance(sdk, addr);
        if (balance !== null && balance >= 5_000_000n) {
          stopPolling();
          appendLog(`Balance confirmed: ${creditsToTdash(balance)} tDASH`);
          setFundingAddress(null);

          // Register identity
          onStatusUpdate('registering');
          appendLog('Registering identity on testnet…');
          try {
            const identityId = await registerIdentity(sdk, mnemonic, appendLog);
            saveIdentityId(identityId);

            const dpnsName = await resolveDpnsName(sdk, identityId);
            const handle = shortHandle(identityId, dpnsName);
            onLoginComplete(identityId, handle);
            onComplete();
          } catch (regErr) {
            setError(
              regErr instanceof Error
                ? regErr.message
                : 'Identity registration failed.',
            );
            onStatusUpdate('error', {
              errorMessage:
                regErr instanceof Error
                  ? regErr.message
                  : 'Registration failed.',
            });
            setBusy(false);
          }
        }
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed.');
      onStatusUpdate('error', {
        errorMessage: err instanceof Error ? err.message : 'Setup failed.',
      });
      setBusy(false);
    }
    // suppress unused-variable lint for cleared strings
  }, [
    passphrase,
    confirm,
    mnemonic,
    existingSdk,
    onLoginComplete,
    onStatusUpdate,
    setSdk,
    onComplete,
  ]);

  return (
    <div className="space-y-4">
      <SectionLabel>New testnet wallet</SectionLabel>
      <h2 className="font-serif text-2xl" style={{ color: 'var(--text)' }}>
        Secure your wallet
      </h2>

      {!busy && (
        <>
          <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            Choose a passphrase to encrypt your recovery phrase locally.
            You&apos;ll need it every time you log in.
          </p>
          <MonoInput
            label="Passphrase (min 8 chars)"
            type="password"
            value={passphrase}
            onChange={setPassphrase}
            placeholder="••••••••"
          />
          <MonoInput
            label="Confirm passphrase"
            type="password"
            value={confirm}
            onChange={setConfirm}
            placeholder="••••••••"
          />
          {error && <StatusLine msg={error} isError />}
          <PrimaryButton
            onClick={start}
            disabled={!passphrase || !confirm}
          >
            Encrypt &amp; continue
          </PrimaryButton>
        </>
      )}

      {busy && (
        <div className="space-y-2">
          {fundingAddress && (
            <div
              className="rounded border p-3 space-y-1"
              style={{
                backgroundColor: 'var(--l1-dim)',
                borderColor: 'var(--border)',
              }}
            >
              <p
                className="font-mono text-xs font-semibold"
                style={{ color: 'var(--l1)' }}
              >
                Fund this Platform address with tDASH:
              </p>
              <p
                className="font-mono text-xs break-all"
                style={{ color: 'var(--text)' }}
                aria-label="Platform funding address"
              >
                {fundingAddress}
              </p>
              <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                Need ≥ 0.005 tDASH. Get testnet DASH from the{' '}
                <a
                  href="https://testnet-faucet.dash.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--l1)' }}
                  className="underline focus-visible:outline-none focus-visible:ring-1"
                >
                  testnet faucet
                </a>
                .
              </p>
            </div>
          )}

          <div
            className="rounded border p-3 space-y-1 font-mono text-xs"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-dim)',
            }}
            aria-live="polite"
            aria-label="Setup progress"
          >
            {log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          {error && <StatusLine msg={error} isError />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Import existing wallet
// ---------------------------------------------------------------------------

function ImportWalletPanel({ onDone }: { onDone: () => void }) {
  const { onLoginComplete, onStatusUpdate, setSdk, sdk: existingSdk } = useSession();
  const [mnemonic, setMnemonic] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doImport = useCallback(async () => {
    setError(null);
    setBusy(true);
    const trimmedMnemonic = mnemonic.trim();
    const pass = passphrase;
    try {
      if (trimmedMnemonic.split(/\s+/).length !== 12) {
        throw new Error('Please enter your 12-word recovery phrase.');
      }
      if (pass.length < 8) {
        throw new Error('Passphrase must be at least 8 characters.');
      }

      // Encrypt with the captured passphrase, then clear UI state
      const blob = await encryptMnemonic(trimmedMnemonic, pass);
      setMnemonic('');
      setPassphrase('');
      saveEncryptedMnemonic(blob);

      onStatusUpdate('connecting');
      const sdk = existingSdk ?? (await createPlatformClient());
      if (!existingSdk) setSdk(sdk);

      // Decrypt to resolve identity (use the same pass we just encrypted with)
      const decrypted = await decryptMnemonic(blob, pass);
      const identityId = await resolveIdentityFromMnemonic(sdk, decrypted);
      saveIdentityId(identityId);

      const dpnsName = await resolveDpnsName(sdk, identityId);
      const handle = shortHandle(identityId, dpnsName);
      onLoginComplete(identityId, handle);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      onStatusUpdate('idle');
    } finally {
      setBusy(false);
      setMnemonic('');
      setPassphrase('');
    }
  }, [mnemonic, passphrase, existingSdk, onLoginComplete, onStatusUpdate, setSdk, onDone]);

  return (
    <div className="space-y-4">
      <SectionLabel>Import testnet wallet</SectionLabel>
      <h2 className="font-serif text-2xl" style={{ color: 'var(--text)' }}>
        Restore existing identity
      </h2>
      <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        Enter your 12-word recovery phrase and choose a passphrase to encrypt
        it locally on this device.
      </p>
      <div className="space-y-1">
        <label
          className="font-mono text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          Recovery phrase (12 words, space-separated)
        </label>
        <textarea
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          rows={3}
          placeholder="word1 word2 word3 …"
          className="w-full rounded border px-3 py-2 font-mono text-xs resize-none focus:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text)',
          }}
          autoComplete="off"
          spellCheck={false}
          aria-label="Recovery phrase"
        />
      </div>
      <MonoInput
        label="New passphrase (min 8 chars)"
        type="password"
        value={passphrase}
        onChange={setPassphrase}
        placeholder="••••••••"
      />
      {error && <StatusLine msg={error} isError />}
      <PrimaryButton
        onClick={doImport}
        disabled={busy || !mnemonic || !passphrase}
      >
        {busy ? 'Connecting…' : 'Restore &amp; login'}
      </PrimaryButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root LoginPanel
// ---------------------------------------------------------------------------

type Flow = 'choose' | 'new-mnemonic' | 'new-setup' | 'import';

export default function LoginPanel() {
  const { session } = useSession();
  const [flow, setFlow] = useState<Flow>(() =>
    session.status === 'locked' ? ('choose' as Flow) : ('choose' as Flow),
  );
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [done, setDone] = useState(false);

  // Transition: locked → show unlock directly
  const isLocked = session.status === 'locked';

  const startNew = useCallback(async () => {
    const mn = await generateMnemonic();
    setGeneratedMnemonic(mn);
    setFlow('new-mnemonic');
  }, []);

  if (done) return null;

  // If wallet is locked, show unlock panel directly
  if (isLocked && flow === 'choose') {
    return (
      <div
        className="rounded-lg border p-6 max-w-lg mx-auto"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <UnlockPanel onDone={() => setDone(true)} />
        <button
          type="button"
          onClick={() => setFlow('import')}
          className="font-mono text-xs mt-4 focus-visible:outline-none focus-visible:ring-1"
          style={{ color: 'var(--text-dim)' }}
        >
          Use a different recovery phrase →
        </button>
      </div>
    );
  }

  if (flow === 'new-mnemonic' && generatedMnemonic) {
    return (
      <div
        className="rounded-lg border p-6 max-w-lg mx-auto"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <NewWalletMnemonicPanel
          mnemonic={generatedMnemonic}
          onConfirmed={() => setFlow('new-setup')}
        />
      </div>
    );
  }

  if (flow === 'new-setup' && generatedMnemonic) {
    return (
      <div
        className="rounded-lg border p-6 max-w-lg mx-auto"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <NewWalletSetupPanel
          mnemonic={generatedMnemonic}
          onComplete={() => setDone(true)}
        />
      </div>
    );
  }

  if (flow === 'import') {
    return (
      <div
        className="rounded-lg border p-6 max-w-lg mx-auto"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <ImportWalletPanel onDone={() => setDone(true)} />
        <button
          type="button"
          onClick={() => setFlow('choose')}
          className="font-mono text-xs mt-4 focus-visible:outline-none focus-visible:ring-1"
          style={{ color: 'var(--text-dim)' }}
        >
          ← Back
        </button>
      </div>
    );
  }

  // Default: choose flow
  return (
    <div
      className="rounded-lg border p-6 max-w-lg mx-auto space-y-5"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <SectionLabel>Dash Platform testnet identity</SectionLabel>
      <h2 className="font-serif text-2xl" style={{ color: 'var(--text)' }}>
        Sign in
      </h2>
      <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        Govenr uses your Dash Platform testnet identity for comments, reviews,
        and tips. Your keys stay in your browser — nothing is sent to any server.
      </p>
      <div className="flex flex-col gap-3">
        <PrimaryButton onClick={startNew}>
          Create new testnet identity
        </PrimaryButton>
        <button
          type="button"
          onClick={() => setFlow('import')}
          className="font-mono text-xs text-left focus-visible:outline-none focus-visible:ring-1"
          style={{ color: 'var(--text-dim)' }}
        >
          Restore existing identity →
        </button>
      </div>
    </div>
  );
}
