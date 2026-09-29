# S9b — Claim flow (sign-to-own) — apply instructions

## What this package contains

The complete claim story, verified by full typecheck + lint + a live crypto
self-test (sign → Dash testnet address → verify):

- **Mirror**: proposals now carry `paymentAddress` (always) and
  `collateralAddress` (when the upstream exposes it) — chain-sourced anchors.
- **Claim panel** on every proposal detail page (client-side, uses your
  Platform session): challenge → sign in Dash Core → paste signature →
  verified against EITHER anchor address → claim document written to Platform.
- **Contract publish** (first claim ever): publishes the Govenr data contract
  to testnet under the logged-in identity, one-time, with honest labels.
- **Mnemonic sessions can claim too**: unlock/restore now derive the identity
  master key into memory (authKeyWif), so both login types can sign.
- **Contract v3**: five document types (claim added, `verifiedAddress` field).

## Files

| File | Status |
|---|---|
| `lib/platform/verify.ts` | NEW — Dash signmessage verification (bitcoinjs-message, Dash prefix) |
| `lib/platform/contract.ts` | NEW — contract publish + id persistence + signing context |
| `lib/platform/claims.ts` | NEW — challenge, submit claim, fetch claim |
| `components/claim-panel.tsx` | NEW — the claim UI |
| `lib/platform/key-managers.ts` | + deriveMasterKeyWif (mnemonic sessions) |
| `lib/platform/types.ts` | + contracts/documents on DashSdk, PlatformDocument |
| `components/login-panel.tsx` | + authKeyWif on mnemonic login/unlock/import |
| `lib/types.ts` | + paymentAddress / collateralAddress on Proposal |
| `lib/mirror/proposal-mirror.ts` | + collateral parsing (all mappings) |
| `lib/l1/dash-testnet.ts` | + CollateralAddress parsing |
| `app/proposals/[id]/page.tsx` | + ClaimPanel below the hash |
| `contracts/govenr-contract.json` | v3 — claim document type |
| `package.json` | + bitcoinjs-message 2.2.0 (install in the CODESPACE) |

## Apply (Mac)

    cd ~/govenr

    git status    # 8 modified + 3 new + package.json
    git add -A
    git commit -m "S9b: claim flow (sign-to-own) — contract publish, challenge/verify, claim document"
    git push

## Apply (Codespace) — the dependency

    cd /workspaces/govenr
    git pull
    npm install                 # installs bitcoinjs-message, updates the lockfile
    git add package-lock.json
    git commit -m "S9b: lockfile for bitcoinjs-message"
    git push
    npm run lint && npm run build
    npm run dev                 # port 3000

Then `git pull` once on the Mac so both trees match.

## The ceremony (your first claim)

1. Sign in (key or passphrase — both work now).
2. Open `governr-prop1` on the hub.
3. Below the hash: **Claim this proposal**.
4. Copy the challenge. In Dash Core (testnet) Debug console run
   `signmessage "yd83NmVwTmdZ4C7y3gmWxgf7prAj89q8ji" "<challenge>"`
   (or the collateral address if the panel shows one).
5. Paste the base64 result. **Verify & claim**.
6. First run publishes the Govenr contract to Platform testnet (one-time,
   honest label), then writes the claim. The panel turns gold:
   **Claimed by you**.

## If something fails (read the exact message)

- "did not verify" → the challenge text or address didn't match; re-copy.
- "insufficient" balance → the identity needs credits for the contract
  publish; tell me and we'll add a top-up step.
- Contract/JSON error → paste me the log lines; it's the one piece that
  only a live run can prove ($format_version value).

L1 remains read-only forever — the claim is Platform-side evidence only.
