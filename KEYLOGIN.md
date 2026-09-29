# Key-based sign-in (yappr-style) — S9a follow-up

## What this adds

The login panel now mirrors yappr's pattern, tuned to Govenr's design system:

- **Default panel: "Sign in"** with two fields — *Dash username or identity
  ID* (accepts `alice.dash`, bare `alice`, or a full identity ID) and
  *Private key* (WIF) with a show/hide toggle.
- The key is **verified on-chain** against the identity's registered public
  keys — any key registered to the identity works (High, Critical, Master).
- **Create new testnet identity** — prominent gold button, runs the existing
  mnemonic ceremony unchanged.
- **Restore with recovery phrase** — demoted to a quiet link, as the advanced
  path it is.
- Passkey and Wallet-QR options: deliberately deferred (v1.x backlog).

## Session behavior (honest by design)

- The private key is held **in memory + sessionStorage for this tab only** —
  it is never written to localStorage, never sent anywhere. Close the tab
  and it's gone; refresh the tab and you stay signed in.
- Mnemonic sessions still unlock with a passphrase as before.
- Logout clears everything (mnemonic blob, identity, key session, tab key).
- Signing in via mnemonic clears any stale key session, and vice versa.

## Files changed

| File | Change |
|---|---|
| `components/login-panel.tsx` | New `KeyLoginPanel` as the default; create/restore preserved |
| `lib/platform/identity.ts` | `loginWithKey()` — resolves name/ID, verifies key on-chain |
| `lib/platform/wallet-store.ts` | Key-session storage (identity marker + tab-scoped key) |
| `lib/platform/session-context.tsx` | Silent re-auth on refresh for key sessions; `authKeyWif` in context (memory only) for future stories (S9b claim, S9c documents) |
| `lib/platform/types.ts` | `dpns.resolveName`, `identities.fetch`, `DashIdentity.publicKeys` on the opaque SDK type |

Verified: `tsc --noEmit` 0 errors (strict), `eslint .` 0 errors/warnings.
Run `next build` in the Codespace as the final gate.

## Apply

    cd ~/govenr
    unzip -o govenr-keylogin.zip     # files extract at repo root
    rm govenr-keylogin.zip
    git status    # expect 5 modified
    git add -A
    git commit -m "S9a: yappr-style key sign-in (username/ID + private key, create identity, phrase restore)"
    git push

Codespace: `git pull` → `npm run lint && npm run build` → `npm run dev`.

## Try it with your yappr identity

If you hold the private key you use for yappr (the one you type into its
login form), enter your yappr username (e.g. `yourname.dash`) and that key.
Govenr will resolve the name on testnet, verify the key against the
identity's registered keys, and sign you in — same identity, second app,
proven from chain data. That screenshot belongs in the thread post.
