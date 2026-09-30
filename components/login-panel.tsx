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
import { createPlatformClient, NETWORK } from '@/lib/platform/client';
import { encryptMnemonic, decryptMnemonic } from '@/lib/platform/crypto';
import {
  saveEncryptedMnemonic,
  loadEncryptedMnemonic,
  saveIdentityId,
  loadIdentityId,
  saveKeySessionIdentity,
  rememberTabKey,
  clearKeySessionIdentity,
} from '@/lib/platform/wallet-store';
import {
  generateMnemonic,
  deriveFundingAddress,
  getFundingAddressBalance,
  registerIdentity,
  resolveIdentityFromMnemonic,
  resolveDpnsName,
  shortHandle,
  loginWithKey,
} from '@/lib/platform/identity';
import { deriveHighAuthKeyWif } from '@/lib/platform/key-managers';

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
  const { onLoginComplete, onStatusUpdate, setSdk, sdk: existingSdk, setAuthKeyWif } = useSession();
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
      clearKeySessionIdentity(); // mnemonic session supersedes any key session
      setAuthKeyWif(await deriveHighAuthKeyWif(mnemonic, NETWORK));
      onLoginComplete(identityId, handle);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed.');
      onStatusUpdate('locked');
    } finally {
      setBusy(false);
      setPassphrase('');
    }
  }, [passphrase, existingSdk, onLoginComplete, onStatusUpdate, setSdk, setAuthKeyWif, onDone]);

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
        aria-label="Recovery phrase — read and write it down"
      />
      <p
        className="font-mono text-[10px] leading-relaxed"
        style={{ color: 'var(--text-dim)' }}
      >
        No copy button on purpose: clipboards sync to other devices and
        keyboard histories. Write the phrase on paper instead.
      </p>
      <PrimaryButton onClick={onConfirmed}>
        I've saved it — continue
      </PrimaryButton>
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
  const { onLoginComplete, onStatusUpdate, setSdk, sdk: existingSdk, setAuthKeyWif } = useSession();
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
      const addr = await deriveFundingAddress(mnemonic);
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
            clearKeySessionIdentity(); // fresh identity supersedes any key session
            setAuthKeyWif(await deriveHighAuthKeyWif(mnemonic, NETWORK));

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
  }, [
    passphrase,
    confirm,
    mnemonic,
    existingSdk,
    onLoginComplete,
    onStatusUpdate,
    setSdk,
    setAuthKeyWif,
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
                Platform addresses can only receive credits through the{' '}
                <a
                  href={`https://bridge.thepasta.org/?address=${fundingAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--l1)' }}
                  className="underline focus-visible:outline-none focus-visible:ring-1"
                >
                  Dash Bridge
                </a>{' '}
                (community testnet tool). Send tDASH from your Dash Core testnet
                wallet through the bridge — 0.001 tDASH is plenty. No funds yet?{' '}
                <a
                  href="https://faucet.testnet.networks.dash.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--l1)' }}
                  className="underline focus-visible:outline-none focus-visible:ring-1"
                >
                  faucet
                </a>{' '}
                first, then bridge.
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
  const { onLoginComplete, onStatusUpdate, setSdk, sdk: existingSdk, setAuthKeyWif } = useSession();
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
      clearKeySessionIdentity(); // mnemonic session supersedes any key session
      setAuthKeyWif(await deriveHighAuthKeyWif(decrypted, NETWORK));
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
  }, [mnemonic, passphrase, existingSdk, onLoginComplete, onStatusUpdate, setSdk, setAuthKeyWif, onDone]);

  return (
    <div className="space-y-4">
      <SectionLabel>Import testnet wallet</SectionLabel>
      <h2 className="font-serif text-2xl" style={{ color: 'var(--text)' }}>
        Restore existing identity
      </h2>
      <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        For when your saved key is gone: this re-derives your Platform
        identity keys inside this browser from the phrase you wrote down
        when creating the identity. Signing stays local — nothing is sent
        anywhere. Choose a passphrase to encrypt the phrase on this device.
      </p>
      <p
        className="font-mono text-[10px] leading-relaxed"
        style={{ color: 'var(--text-dim)' }}
      >
        Use this only for an identity you created in Govenr. If your phrase
        controls a wallet with funds you care about, do not paste it into
        any website — including this one.
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
// Panel: Key-based sign-in (yappr-style default)
// ---------------------------------------------------------------------------

function KeyLoginPanel({
  onCreate,
  onRestore,
  onDone,
}: {
  onCreate: () => void;
  onRestore: () => void;
  onDone: () => void;
}) {
  const { onLoginComplete, onStatusUpdate, setSdk, sdk: existingSdk, setAuthKeyWif } =
    useSession();
  const [usernameOrId, setUsernameOrId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setError(null);
    const idInput = usernameOrId.trim();
    const wif = privateKey.trim();
    if (!idInput || !wif) {
      setError('Enter your username or identity ID, and your private key.');
      return;
    }
    setBusy(true);
    onStatusUpdate('connecting');
    try {
      const sdk = existingSdk ?? (await createPlatformClient());
      if (!existingSdk) setSdk(sdk);

      const result = await loginWithKey(sdk, idInput, wif);

      // Remember the key for this tab only; never written to disk.
      saveKeySessionIdentity(result.identityId);
      rememberTabKey(wif);
      setAuthKeyWif(wif);

      onLoginComplete(
        result.identityId,
        shortHandle(result.identityId, result.dpnsName),
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      onStatusUpdate('idle');
    } finally {
      setBusy(false);
      setPrivateKey('');
    }
  }, [
    usernameOrId,
    privateKey,
    existingSdk,
    onLoginComplete,
    onStatusUpdate,
    setSdk,
    setAuthKeyWif,
    onDone,
  ]);

  return (
    <div className="space-y-4">
      <SectionLabel>Dash Platform testnet identity</SectionLabel>
      <h2 className="font-serif text-2xl" style={{ color: 'var(--text)' }}>
        Sign in
      </h2>
      <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        Govenr uses your Dash Platform testnet identity for comments, reviews,
        and tips. Sign in with an authentication key — the High Auth or
        Critical Auth key from your identity export. The Master key cannot
        sign documents. Your keys stay in your browser — nothing is sent to
        any server.
      </p>
      <MonoInput
        label="Dash username or identity ID"
        value={usernameOrId}
        onChange={setUsernameOrId}
        placeholder="e.g., alice.dash or 5DbLw…"
      />
      <div className="space-y-1">
        <label
          className="font-mono text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          Private key
        </label>
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="High Auth or Critical Auth key (WIF)"
            className="w-full rounded border px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text)',
            }}
            autoComplete="off"
            spellCheck={false}
            aria-label="Private key"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="font-mono text-xs rounded border px-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-dim)',
              backgroundColor: 'var(--surface-dim)',
            }}
            aria-label={showKey ? 'Hide private key' : 'Show private key'}
          >
            {showKey ? 'hide' : 'show'}
          </button>
        </div>
      </div>
      {error && <StatusLine msg={error} isError />}
      <PrimaryButton onClick={signIn} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </PrimaryButton>
      <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
        Your keys never leave this device. All signing happens locally. The
        key is remembered for this tab only.
      </p>
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={onCreate}
          className="font-mono text-xs rounded px-4 py-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{
            borderColor: 'var(--gold)',
            color: 'var(--gold)',
            backgroundColor: 'var(--gold-dim)',
          }}
        >
          Create new testnet identity
        </button>
        <div>
          <button
            type="button"
            onClick={onRestore}
            className="font-mono text-xs text-left focus-visible:outline-none focus-visible:ring-1"
            style={{ color: 'var(--text-dim)' }}
          >
            Lost your saved key? Restore from your recovery phrase →
          </button>
          <p
            className="font-mono text-[10px] mt-1 leading-relaxed"
            style={{ color: 'var(--text-dim)' }}
          >
            Only the words Govenr showed you when creating this identity.
            Never paste a phrase that controls funds you care about.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root LoginPanel
// ---------------------------------------------------------------------------

type Flow = 'choose' | 'new-mnemonic' | 'new-setup' | 'import';

export default function LoginPanel() {
  const { session } = useSession();
  const [flow, setFlow] = useState<Flow>('choose');
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [done, setDone] = useState(false);

  // Transition: locked → show unlock directly
  const isLocked = session.status === 'locked';

  // Drop the plaintext mnemonic from memory as soon as the flow is done.
  const finishFlow = useCallback(() => {
    setGeneratedMnemonic('');
    setDone(true);
  }, []);

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
          onComplete={finishFlow}
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

  // Default: key-based sign-in (yappr-style) with create / restore options
  return (
    <div
      className="rounded-lg border p-6 max-w-lg mx-auto"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <KeyLoginPanel
        onCreate={startNew}
        onRestore={() => setFlow('import')}
        onDone={finishFlow}
      />
    </div>
  );
}
