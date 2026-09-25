# Govenr — Governance App on Dash Platform · Starter Kit

**Name: Govenr** — rhymes with yappr and pollr, the ecosystem's naming line. A standalone, open-source governance app on Dash
Platform. Two chains, two jobs: **L1 records the vote (read-only mirror);
Platform remembers why (content, discussion, reviews, tips).**

This kit contains everything Kiro needs to scaffold and build v1 in a
GitHub Codespace. v1 ships with **zero chain writes** (services backed by
fixtures + localStorage, with the on-chain v2 swap points designed in) —
the same discipline that shipped Missing Block.

---

## Kit contents

```
.devcontainer/devcontainer.json     Codespaces definition (Node 20, port 3000)
contracts/govenr-contract.json      v2 data contract (4 document types)
fixtures/proposals.testnet.json    Seed data: live-cycle proposals, tallies,
                                   comments, reviews — so v1 works before
                                   any chain connection exists
.kiro/steering/product.md          What Govenr is — scope rules, hard limits
.kiro/steering/tech.md             Stack, SDK, DAPI, service-swap pattern
.kiro/steering/structure.md        Repo layout conventions
.kiro/specs/govenr-v1/requirements.md   EARS-format requirements for v1
.kiro/specs/govenr-v1/design.md          Architecture + the Task 0 spike
.kiro/specs/govenr-v1/tasks.md           Build order (run spike first!)
README.md                          This file
```

## Quick start (GitHub Codespaces + Kiro)

1. Create a new **empty** GitHub repository (suggested name: `govenr`).
2. Upload this kit's files to the repo root (preserving paths — `.kiro/`
   and `.devcontainer/` must keep their dot-prefix folders).
3. Repo → **Code → Codespaces → Create codespace on main**.
4. Open the Kiro agent. It reads `.kiro/steering/*` automatically as
   always-on context.
5. Point Kiro at the spec: **"Build `.kiro/specs/govenr-v1/tasks.md` —
   start with Task 0."**
6. Preview at `http://localhost:3000`.

## The one non-negotiable rule

**The L1 chain is read-only for this app.** Govenr mirrors proposals and
tallies; it never casts votes, never touches masternode keys, never
re-implements governance. The chain stays the sole authority on what
passed. Any change that writes to L1 or holds user keys is out of scope —
reject it.

## Lineage

DashCentral served this DAO for years; when it went down, votes survived
on-chain while the reasoning was lost. Govenr is the successor, on rails
that can't be lost. Credit to Rango and that service belongs in the
About page, the README, and any public description — in the first
paragraph, not a footnote.
