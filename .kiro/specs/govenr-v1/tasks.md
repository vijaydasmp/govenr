# Govenr v1 — Tasks

Build in order. Do not skip Task 0. Commit after every task with
`npm run lint && npm run build` passing.

---

## Task 0 — L1 mirror spike (timebox: one evening)

**Goal:** decide the mirror's real data source; document it.
- [ ] Probe DAPI core endpoints for governance objects (path A) with a
      throwaway script in `scripts/spike/` (excluded from build).
- [ ] If A fails, evaluate a public explorer/Insight-style API (path B)
      for proposal lists + vote counts, from the browser (CORS matters).
- [ ] If both fail, confirm fixture path C and write the manual refresh
      procedure.
- [ ] Write decision + evidence to `docs/spike-l1-mirror.md`.
- **Accept:** doc exists, names the chosen path, and v1's
  `proposal-mirror.ts` implementation matches it (v1 may ship path C).

## Task 1 — Scaffold

- [ ] `npx create-next-app@latest` (TypeScript, Tailwind, App Router,
      no src/, import alias `@/*`).
- [ ] Add `lib/types.ts` with all domain types from design.md.
- [ ] Header shell: logo "Govenr." (serif, slate + gold dot), nav
      (Proposals, About), session pill on the right.
- [ ] `npm run lint && npm run build` pass.
- **Accept:** app boots to a placeholder hub; types compile.

## Task 2 — Fixtures + mirror service

- [ ] Import `fixtures/proposals.testnet.json`; type it against
      `Proposal`.
- [ ] Implement `lib/mirror/proposal-mirror.ts` (path C: fixture).
- [ ] `getCycle()`, `getProposals()`, `getProposal(id)` with
      last-updated timestamp.
- **Accept:** hub placeholder lists proposal titles from the mirror in
      dev console or minimal markup.

## Task 3 — Hub page

- [ ] Cycle strip: "Cycle _04 · voting closes in N days · N proposals ·
      tallies refresh from L1 · read-only".
- [ ] `components/proposal-card.tsx` + `vote-bar.tsx` +
      `state-badge.tsx` per design.
- [ ] Card fields: title, owner, ask, payments remaining, vote bar +
      numbers, deadline, engagement row (reviews · comments · ◆ tipped).
- **Accept:** `/` renders all three seeded proposals with correct
      bars/numbers; "needs +162 yes" badge shows on _04.

## Task 4 — Proposal detail shell + Overview

- [ ] Route `/proposals/[id]`; `tab-nav.tsx` (Overview, Discussion,
      Reviews, Votes).
- [ ] Header: title, owner, ask, state badge, "on chain · read-only"
      chip.
- [ ] `content-service.ts` (fixture-backed); Overview renders body,
      milestones, report refs + the "hosted as Platform documents"
      note.
- [ ] Unknown id → friendly not-found linking back to hub.
- **Accept:** `_04` detail renders content; bad ids render not-found.

## Task 5 — Discussion

- [ ] `comment-service.ts` (localStorage `govenr:comments:v1:<hash>`).
- [ ] `comment-thread.tsx`: list (ascending), reply form, one-level
      nesting, relative timestamps.
- [ ] Validation: 1–2000 chars; empty submit disabled.
- **Accept:** seeded comments render; new comments persist across
      reload; replies nest under parents.

## Task 6 — Reviews

- [ ] `review-service.ts` — upsert semantics, one per session identity
      per proposal.
- [ ] `review-card.tsx`: stance badge, body, helpful %, ◆ tipped total.
- [ ] Form: stance select + body (min 10 chars); "Edit your review"
      when one exists.
- **Accept:** create, edit-in-place, and exactly-one-per-identity all
      behave; seeded pmbf review renders.

## Task 7 — Tipping (v1 simulated)

- [ ] `tip-service.ts`: `tip()` with simulated txid
      (`sim-` + 60 hex), `totalFor(docRef)`.
- [ ] `tip-button.tsx` on reviews and comments: inline amount
      (0.1–100, 3 decimals), confirm, total updates.
- [ ] Disclosure line under any simulated tip: "v1 simulated · v2
      settles on L1 via InstantSend."
- [ ] Not-signed-in click prompts sign-in.
- **Accept:** tipping a seeded review updates its total; receipts
      persist across reload; disclosure visible.

## Task 8 — Votes tab + session polish

- [ ] Votes tab: tallies, needed-votes, deadline, "analytics in v1.2"
      note.
- [ ] `session-service.ts` wired to the header pill (handle, balance).
- [ ] Empty states for all lists.
- **Accept:** every tab of `_04` complete and consistent.

## Task 9 — About/Lineage + final pass

- [ ] `/about`: the two-chain thesis in one paragraph + the DashCentral
      / Rango credit as the first paragraph (per product.md).
- [ ] README at repo root: quick start, lineage, v2 roadmap.
- [ ] Full `npm run lint && npm run build` clean; click through every
      screen at 375px and 1280px widths.
- **Accept:** clean build, clean screens, lineage unmissable.

## Task 10 — v2 prep (docs only, no code)

- [ ] `docs/v2-platform-swap.md`: per service, the exact Platform
      implementation notes (contract doc types, identity, DAPI reads).
- [ ] Note where `contracts/govenr-contract.json` fields map to v1
      types.
- **Accept:** a developer could start v2 from this doc alone.
