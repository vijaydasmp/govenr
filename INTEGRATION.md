# S9a — Platform testnet identity login (completed from Kiro WIP)

## What this is

Kiro got the session context, wallet store, crypto, login panel, and header
rewiring done before hitting its usage cap. This package completes and
corrects that work. The one real bug: Kiro imported `IdentityKeyManager` and
`AddressKeyManager` from `@dashevo/evo-sdk` — those classes do NOT exist in
the SDK. They are helper classes from the official Dash Platform tutorials
(dashpay/platform-tutorials, `setupDashClient-core.mjs`). This package ports
them into `lib/platform/key-managers.ts`, verified line-by-line against the
tutorial source, with derivation paths matching other Dash tools:

- Platform address (BIP44): `m/44'/1'/0'/0/i` (testnet)
- Identity keys (DIP-13): `m/9'/1'/5'/0'/0'/{identityIndex}'/{keyIndex}'`

## Files in this package

| File | Status | What changed |
|---|---|---|
| `lib/platform/key-managers.ts` | NEW | TypeScript port of the official `IdentityKeyManager` + `AddressKeyManager`. Holds WIFs in memory for the session only — dropped on logout, never persisted, never logged. |
| `lib/platform/identity.ts` | REWRITTEN | Now uses the real key managers. `deriveFundingAddress(mnemonic)` (no sdk arg). Registration flow matches the official tutorial exactly, including the proof-verification bug workaround (dashpay/platform#3095). |
| `lib/platform/types.ts` | UPDATED | Opaque `DashSdk` type matches actual SDK usage; removed the non-existent key-manager types. |
| `lib/platform/crypto.ts` | FIXED | ArrayBuffer-backed Uint8Array typing so WebCrypto accepts the salt/IV. Scheme unchanged: PBKDF2-SHA256 200k iterations + AES-GCM. |
| `components/login-panel.tsx` | FIXED | 1) Funding step now points at the **Dash Bridge** — platform addresses (tdash1…) CANNOT receive ordinary tDASH sends; L1 funds must cross via the bridge (`https://bridge.thepasta.org/?address=…`, the community tool used by the official tutorials). 2) Plaintext mnemonic is cleared from memory when the flow completes. 3) Honest funding copy (0.001 tDASH is plenty — identity creation costs 5,000,000 credits ≈ 0.00005 tDASH). 4) Removed dead code + unused import. |
| `app/about/page.tsx` | NEW | Placeholder About page so the header nav link resolves instead of 404ing during the demo. Full version is story S5. |
| `tsconfig.json` | FIXED | Added `"target": "ES2022"` — it was missing entirely (TS defaults to ES5), which broke BigInt literals and typed-array iteration. |

## Verification already done (by the author of this package)

- `tsc --noEmit`: 0 errors, full project, strict mode
- `eslint .`: 0 errors, 0 warnings
- Every SDK API used was checked against the actual `@dashevo/evo-sdk@4.1.1`
  type declarations shipped in node_modules, and the key-manager port was
  checked against the official tutorial source.
- `next build` could NOT run in the authoring sandbox (memory ceiling on
  wasm instantiation) — **run it in the Codespace**; it is the final gate.

## Apply

On the Mac, from the folder containing this zip:

    cd ~/govenr
    unzip -o /path/to/govenr-s9a-complete.zip
    git add -A
    git commit -m "S9a: Platform testnet identity login (complete key managers, bridge funding, about stub)"
    git push

Then in the Codespace:

    cd /workspaces/govenr
    git pull
    npm install          # only if needed; package.json/lockfile already have evo-sdk 4.1.1
    npm run lint && npm run build
    npm run dev           # port 3000

Note: evo-sdk 4.1.1 requires Node >= 18.18, so the current Node 20
container is fine — no rebuild needed.

## First-run ceremony (yours)

1. Click **Sign in** → **Create new testnet identity**.
2. Write the 12 words down. Really.
3. Set a passphrase (min 8 chars) — it encrypts the mnemonic in this
   browser only.
4. The panel shows a `tdash1…` funding address. Send it tDASH **through the
   Dash Bridge link in the panel** (the bridge converts L1 tDASH to Platform
   credits). From your funded Dash Core testnet wallet, 0.001 tDASH is
   plenty.
5. Watch the log: balance confirmed → keys derived → identity registered.
   The header pill shows your identity (shortened id — no DPNS name until
   one is registered; that's expected).
6. Refresh the page: the wallet is locked, **Unlock** with your passphrase.
7. Logout clears everything.

## Honest labels already in the UI

- Header badge next to the identity: `testnet`
- Login panel kicker: "Dash Platform testnet identity"
- Funding box: names the Dash Bridge as a community testnet tool

## Known follow-ups (later stories, not this one)

- DPNS name registration (so the pill can read like a handle)
- Claim flow (S9b) — `key-managers.ts` already exposes what it needs
- The `@doodhfara` entries in `fixtures/proposals.testnet.json` are fixture
  seed data only (shown under the "fixture" badge) — untouched on purpose.
