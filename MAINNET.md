# Mainnet read-only mode + network switch

A **Testnet | Mainnet** switch in the header. On mainnet the app is a
read-only mirror: real governance objects and live tallies from L1, with
every document panel saying plainly that Govenr's documents are not on
mainnet yet. On testnet, everything works exactly as before.

```
TESTNET | MAINNET      ← header switch
  ?network=mainnet     ← the choice lives in the URL (shareable, and the
                         server pages read it), remembered in localStorage
```

## What you get

- **Header switch** — one control, both networks, remembered per browser.
- **Mainnet L1** — the mirror's mainnet branch (JSON-RPC `gobject list` +
  `getgovernanceinfo`), normalized to the same shape as testnet.
- **Banner follows the network** — yellow "TESTNET · data may be reset" on
  testnet; a quiet "MAINNET · read-only mirror — L1 governance data only"
  on mainnet.
- **Honest document states** — on mainnet, content / claim / discussion
  panels each say "not available on mainnet yet — this is the L1 view"
  instead of showing an empty panel or, worse, inviting a claim.
- **Read-only login** — on mainnet, the sign-in modal says that signing
  in, claiming and authoring are testnet-only for now.

## The trap this closes

The mirror fell back to **`fixtures/proposals.testnet.json`** on any fetch
error. In mainnet mode that would have rendered *testnet* proposals under a
"Live mainnet" label — the app stating something false. Mainnet now has its
own failure mode: an empty list with `source: 'unreachable'` and a hub that
says *"Could not reach mainnet — nothing to show."*

## Files (14)

**New**
- `lib/platform/network.ts` — the network type, URL/localStorage resolution
- `components/readonly-mainnet-notice.tsx` — the shared "not on mainnet" panel

**Changed**
- `lib/mirror/proposal-mirror.ts` — `fetchProposals(network)`, per-network
  client cache, mainnet failure ≠ testnet fixtures
- `lib/types.ts` — `MirrorSource` gains `'unreachable'`
- `app/api/mirror/proposals/route.ts` — reads + validates `?network=`
- `app/page.tsx` — resolves the network, network-aware empty state + colophon
- `app/proposals/[id]/page.tsx` — resolves it, passes it to the panels
- `lib/platform/contract.ts` — no contract on mainnet (`MAINNET_CONTRACT_ID`
  placeholder for later)
- `components/app-header.tsx` — the switch
- `components/testnet-banner.tsx` — network-aware
- `components/login-panel.tsx` — read-only notice on mainnet
- `components/proposal-content-panel.tsx`, `claim-panel.tsx`,
  `discussion-panel.tsx` — `network` prop + honest mainnet state

## Apply (Mac / Codespace)

The zip mirrors the repo layout, so one copy merges the trees:

```bash
cd ~/govenr
cp -R ~/Downloads/govenr-mainnet/. .
npm run build
git add -A && git commit -m "Mainnet read-only mode with a testnet/mainnet switch"
git push
```

## Test flow

1. **Testnet (default):** everything as before — hub, proposals, content,
   discussion, login. The banner is yellow.
2. **Flip to Mainnet:** banner turns quiet, hub shows mainnet proposals and
   tallies, the colophon changes.
3. **Open a mainnet proposal:** facts + DAO Wars render from L1; content,
   claim and discussion each show the "not available on mainnet yet" panel.
4. **Sign in on mainnet:** the modal explains it is testnet-only.
5. **Flip back:** testnet demo intact.
6. **The one to check first:** whether mainnet data actually arrives. If the
   hub says "Could not reach mainnet", the publicnode RPC endpoint needs
   replacing (one line: `MAINNET_RPC_URL`). Verify this *before* the
   milestone promises mainnet read mode.

## Deployment note

The `NETWORK` env var still works as a deployment-wide default when no
`?network=` param is present — so the forum demo link stays testnet unless
someone flips the switch. No new env vars are required.

## Known limits (say them in the proposal)

- Signing in, claiming and authoring are **testnet-only**; mainnet is read.
- The banner and switch settle on the client after first paint (a banner is
  chrome, not data — no data state is ever wrong, which is the line that
  matters).
- A mainnet Platform contract does not exist yet, so mainnet proposals have
  no Govenr documents. `MAINNET_CONTRACT_ID` is the one place to fill in
  when that changes.
