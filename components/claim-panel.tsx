'use client';

/**
 * components/claim-panel.tsx
 *
 * Sign-to-own claim flow for a proposal.
 *
 * 1. Logged-in owner clicks "Claim this proposal" → Govenr shows a challenge.
 * 2. The owner signs the challenge in Dash Core with the private key of the
 *    proposal's PAYOUT address or its COLLATERAL (fee) address — both
 *    chain-sourced via the mirror, never typed by the user.
 * 3. The signature is pasted back and verified client-side (bitcoinjs-message,
 *    Dash prefix). No key material crosses the wire.
 * 4. On first claim the Govenr data contract is published to Platform testnet
 *    (one-time), then the immutable claim document is written.
 *
 * Honesty: the claim never touches L1 — it is Platform-side authorization
 * evidence. Editing (S9c) is unlocked for the claimant only.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/lib/platform/session-context';
import { createPlatformClient } from '@/lib/platform/client';
import { verifyDashMessage } from '@/lib/platform/verify';
import {
  buildClaimChallenge,
  submitClaim,
  fetchClaimForProposal,
} from '@/lib/platform/claims';
import {
  ensureContractPublished,
  getStoredContractId,
} from '@/lib/platform/contract';
import { describePlatformError } from '@/lib/platform/errors';

type ClaimState =
  | 'unknown'
  | 'unclaimed'
  | 'claimed-by-you'
  | 'claimed-by-other';

export default function ClaimPanel({
  proposalHash,
  paymentAddress,
  collateralAddress,
}: {
  proposalHash: string;
  paymentAddress: string | null;
  collateralAddress: string | null;
}) {
  const { session, sdk, setSdk, authKeyWif } = useSession();
  const [claimState, setClaimState] = useState<ClaimState>('unknown');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const appendLog = (msg: string) => setLog((prev) => [...prev.slice(-6), msg]);

  const sdkOrConnect = useCallback(async () => {
    const client = sdk ?? (await createPlatformClient());
    if (!sdk) setSdk(client);
    return client;
  }, [sdk, setSdk]);

  const loggedIn =
    session.status === 'ready' && session.identityId && authKeyWif;

  // Read path: look for an existing claim for this proposal.
  useEffect(() => {
    let cancelled = false;
    const contractId = getStoredContractId();
    if (!contractId) {
      setClaimState('unclaimed');
      return;
    }
    void (async () => {
      try {
        const client = await sdkOrConnect();
        const claim = await fetchClaimForProposal(
          client,
          contractId,
          proposalHash,
        );
        if (cancelled) return;
        if (!claim) {
          setClaimState('unclaimed');
          return;
        }
        setClaimState(
          session.identityId === claim.ownerId
            ? 'claimed-by-you'
            : 'claimed-by-other',
        );
      } catch {
        if (!cancelled) setClaimState('unclaimed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposalHash, session.identityId, sdkOrConnect]);

  const startClaim = () => {
    if (!session.identityId) return;
    setChallenge(buildClaimChallenge(proposalHash, session.identityId));
    setSignature('');
    setError(null);
    setLog([]);
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const anchors = [paymentAddress, collateralAddress].filter(
    (a): a is string => typeof a === 'string' && a.length > 0,
  );

  const submit = useCallback(async () => {
    if (!challenge || !session.identityId || !authKeyWif) return;
    setError(null);
    const sig = signature.trim();
    if (!sig) {
      setError('Paste the base64 signature from Dash Core.');
      return;
    }

    // 1. Verify the signature against either chain-sourced address.
    let verifiedAddress: string | null = null;
    for (const addr of anchors) {
      if (verifyDashMessage(challenge, addr, sig)) {
        verifiedAddress = addr;
        break;
      }
    }
    if (!verifiedAddress) {
      setError(
        'Signature did not verify against the payout or collateral address. Check the challenge text, the address you signed with, and the pasted signature.',
      );
      return;
    }
    appendLog('Signature verified against the on-chain address.');

    // 2. Publish the contract if needed (first claim ever), then submit.
    setBusy(true);
    try {
      const client = await sdkOrConnect();
      const contractId = await ensureContractPublished(
        client,
        session.identityId,
        authKeyWif,
        appendLog,
      );
      appendLog('Submitting the claim document to Platform…');
      await submitClaim(client, {
        contractId,
        identityId: session.identityId,
        authKeyWif,
        proposalHash,
        verifiedAddress,
        challenge,
        signature: sig,
      });
      setClaimState('claimed-by-you');
      setChallenge(null);
      setSignature('');
      // Tell the rest of the page (content panel → editor) that this
      // session just claimed the proposal — no reload needed.
      window.dispatchEvent(
        new CustomEvent('govenr:claim', { detail: { proposalHash } }),
      );
    } catch (err) {
      setError(describePlatformError(err));
    } finally {
      setBusy(false);
    }
  }, [
    challenge,
    signature,
    session.identityId,
    authKeyWif,
    anchors,
    proposalHash,
    sdkOrConnect,
  ]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  // Claimed by you — the door to editing (S9c placeholder for now).
  // Claimed by the session identity: no box needed — the proposal content
  // panel below already tells the owner "You own this proposal" and offers
  // the editor. The claim evidence stays on-chain either way.
  if (claimState === 'claimed-by-you') {
    return null;
  }

  // Claimed by someone else: no box needed either — the owner byline in
  // the page header already names the claimant, and the claim evidence
  // stays on-chain regardless.
  if (claimState === 'claimed-by-other') {
    return null;
  }

  // Not logged in.
  if (!loggedIn) {
    return (
      <div
        className="rounded-lg border px-6 py-4"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          Are you the owner of this proposal? Sign in with your Dash Platform
          testnet identity to claim it and edit its page.
        </p>
      </div>
    );
  }

  // Challenge flow in progress.
  if (challenge) {
    return (
      <div
        className="rounded-lg border px-6 py-5 space-y-4"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--gold)',
        }}
      >
        <p
          className="font-mono text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--gold)' }}
        >
          Claim this proposal
        </p>
        <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          In Dash Core (testnet), open the Debug console and paste one of the
          complete commands below (either address works), press Enter, then
          copy the base64 signature it prints and paste it at the bottom.
          <strong>Copy and paste only</strong> — one hand-typed character
          fails verification. Do not refresh this page in between.
        </p>
        {[
          paymentAddress
            ? { label: 'payout address', addr: paymentAddress }
            : null,
          collateralAddress
            ? { label: 'collateral (fee) address', addr: collateralAddress }
            : null,
        ]
          .filter((b): b is { label: string; addr: string } => b !== null)
          .map(({ label, addr }) => {
            const cmd = 'signmessage "' + addr + '" "' + challenge + '"';
            const copiedNow = copiedKey === label;
            return (
              <div
                key={label}
                className="rounded border p-3 space-y-2"
                style={{
                  backgroundColor: 'var(--surface-dim)',
                  borderColor: 'var(--border-strong)',
                }}
              >
                <p
                  className="font-mono text-xs tracking-widest uppercase"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {label}
                </p>
                <p
                  className="font-mono text-xs break-all"
                  style={{ color: 'var(--text)' }}
                >
                  {cmd}
                </p>
                <button
                  type="button"
                  onClick={() => copyText(label, cmd)}
                  className="font-mono text-xs focus-visible:outline-none focus-visible:ring-1"
                  style={{ color: 'var(--l1)' }}
                >
                  {copiedNow ? 'Copied ✓' : 'Copy full command'}
                </button>
              </div>
            );
          })}
        <div className="space-y-1">
          <label
            className="font-mono text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            Paste the base64 signature here
          </label>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={3}
            placeholder="base64 signature from signmessage…"
            className="w-full rounded border px-3 py-2 font-mono text-xs resize-none focus:outline-none focus-visible:ring-2"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text)',
            }}
            spellCheck={false}
            aria-label="Claim signature"
          />
        </div>
        {log.map((line, i) => (
          <p
            key={i}
            className="font-mono text-xs"
            style={{ color: 'var(--text-dim)' }}
            aria-live="polite"
          >
            {line}
          </p>
        ))}
        {error && (
          <p className="font-mono text-xs" style={{ color: 'var(--no)' }}>
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !signature.trim()}
            className="font-mono text-xs rounded px-4 py-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              backgroundColor: 'var(--slate)',
              color: '#fff',
              opacity: busy || !signature.trim() ? 0.45 : 1,
              cursor: busy || !signature.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Claiming…' : 'Verify & claim'}
          </button>
          <button
            type="button"
            onClick={() => {
              setChallenge(null);
              setError(null);
            }}
            className="font-mono text-xs rounded px-4 py-2 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              borderColor: 'var(--border-strong)',
              color: 'var(--text-dim)',
              backgroundColor: 'var(--surface)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Unclaimed + logged in → the claim button.
  return (
    <div
      className="rounded-lg border px-6 py-4"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <button
        type="button"
        onClick={startClaim}
        className="font-mono text-xs rounded px-4 py-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{
          borderColor: 'var(--gold)',
          color: 'var(--gold)',
          backgroundColor: 'var(--gold-dim)',
        }}
      >
        Claim this proposal
      </button>
      <p className="font-mono text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
        For the wallet that submitted this proposal: sign a one-time challenge
        with the payout or collateral address key to prove ownership and unlock
        editing.
      </p>
    </div>
  );
}
