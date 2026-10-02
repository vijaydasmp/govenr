# Govenr (DEV TEST)

**L1 records the vote; Platform remembers why.**

An open-source governance reader and authoring surface for Dash, where the
proposal document itself — rich text, images, video embeds, milestones,
report references — lives as a **Dash Platform document under the proposal
owner's own identity**. Editable by the owner, readable by everyone, held by
no server.

- **Demo (testnet):** (REPLACE: https://…)
- **Pre-proposal discussion:** (REPLACE: Dash Forum thread URL)
- **Status:** Stage 1 — testnet, single maintainer, under active development.

## Why

A Dash governance proposal today is two things: an on-chain object with a
title, an amount, and a link — and, somewhere else, the actual proposal.
That "somewhere else" is a server. Forum software, a portal, a spreadsheet.
Often good ones, run by good people — but infrastructure the DAO does not
govern, cannot audit, and would lose if it went away.

Govenr stores the DAO's memory where it records its decisions: on-chain.

The vote stays on L1, untouched. Masternodes vote with their own Core,
exactly as now. Govenr reads the tally and shows it.

## What it does

- **Magazine hub** — all proposals with live tallies, states, cycle facts.
- **Proposal case file** — payment window, amounts, owner claim, milestones,
  report references.
- **Authoring** — markdown editor with live preview, image carousels,
  video embeds. The document is stored as a Platform document owned by
  the proposal's claimed identity.
- **Claim ceremony** — the proposal owner proves control of the on-chain
  payment address (payout or collateral key) to bind the gobject to their
  Platform identity. The proof is stored so anyone can re-verify it
  independently against chain data.
- **Discussion** — per-proposal comments as Platform documents.

## What this is not (on purpose)

- **Not a wallet, not a custodian.** No funds, no key custody beyond your
  own tab's session for signing claims.
- **Not a vote caster.** L1's governance is never touched.
- **Not finished.** Single maintainer, testnet-stage, deliberately
  documented gaps. The vote-verification ceremony for masternodes
  (challenge-based signing, key never leaves Core) is designed and
  crypto-proven in PoC, not yet in the app.

## Run it

```bash
git clone https://github.com/vijaydasmp/govenr.git
cd govenr
npm install
npm run dev
```

Or open it in a GitHub Codespace (Node 20, port 3000 — devcontainer
included). Reads live testnet governance data; a fixture file seeds the
hub when chain data is unavailable.

## Repository

- `app/` — Next.js App Router pages
- `components/` — hub, proposal page, claim/login panels, markdown view
- `lib/platform/` — identity, key managers, Platform document reads/writes
- `lib/mirror/` — L1 governance object mirroring (read-only)
- `contracts/` — the Platform data contract definition (4 document types)
- `fixtures/` — seed data for offline/dev mode
- `scripts/` — testnet helpers (proposal generator; testnet-only by design,
  refuses mainnet)

## Relationship to DashCentral

DashCentral has served this DAO for years and remains actively maintained
today — Govenr is not a "DashCentral is broken" project, because it isn't
broken. The case is architectural, not about uptime or effort: the DAO's
document layer deserves the same property as its money — on-chain, owned by
the network, outliving any single service, no matter how well run. The
document format is open and Platform-native; anyone — DashCentral included
— is welcome to read and write it natively, and the best outcome for Dash
is if they do.

## License

MIT. Fork it, run it, improve it — the network can always replace the
maintainer, and that's the point.

Maintained by [Vijay Manikpuri](https://github.com/vijaydasmp) (Cryptotura),
funded Dash backporter. Govenr is his full focus.
