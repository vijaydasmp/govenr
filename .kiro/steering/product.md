# Product — Govenr

## What this is

Govenr is a standalone, open-source governance app for Dash, built on
Dash Platform. The name is chosen: Govenr, rhyming with yappr and pollr — this ecosystem's naming line.

Two chains, two jobs:

- **L1 records the vote.** Proposals, tallies, finalization live on the
  Dash chain. Govenr mirrors them, read-only. The chain stays the sole
  authority on what passed.
- **Platform remembers why.** Proposal content, discussion, reviews, and
  tip receipts live as data contracts — decentralized, queryable,
  impossible to lose with any hosted server.

One-line thesis: **the chain records the vote; the platform remembers
why.**

## The problem being solved

Governance execution lives on L1 and works. Everything around the vote —
the proposal's actual content, the discussion, the reviews, the delivery
reports, the reasoning — lives on hosted pages, forums, and chat, and is
lost whenever one of them goes down. The DAO has lived this. Govenr gives
that layer a home that cannot be lost.

## v1 scope (this spec)

- Proposal hub with live-cycle list: title, owner, ask, tallies,
  deadline, engagement stats
- Proposal detail page: Overview (content, milestones, report refs),
  Discussion (comments), Reviews (stance + reasoning), Votes (tallies)
- Comments — one thread per proposal, nested replies
- Reviews — exactly one per identity per proposal, editable
- Tipping — DASH tips on reviews and comments with visible receipt
  records (v1: simulated; the payment flow is designed but no wallet
  integration)
- Mock identity session so the UI works without chain writes

## Out of scope (reject changes that add these to v1)

- **Any L1 writes.** No voting, no vote hints, no transaction signing.
- Key management or custody of any kind.
- MNO verification badges (v1.1), analytics/cluster views (v1.2),
  proposal drafting (v2), on-chain documents (v2 swap-in).
- Multi-tenant concerns, moderation tooling, notifications.

## Lineage (non-negotiable)

DashCentral served this DAO for years, and its loss is the gap Govenr
fills. The About page, the README, and any public description credit
Rango and that service in the first paragraph. We are successors, not
competitors — and Govenr exists so the community never again depends on
one person's unpaid service to keep its reasoning.

## Audience

Masternode owners first. Every screen must answer, in one glance, "what
is the DAO deciding this month, and what does the community think about
it?"
