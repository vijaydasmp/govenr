# S9c — The Proposal Editor (proposalContent)

The gold "Claimed by you" panel's promise, made real: the claimant writes
the proposal's description, milestones, and report references, and they
render for everyone. The text lives on Dash Platform testnet as
`proposalContent` documents owned by the claimant — Govenr's server never
holds it. "L1 records the vote; Platform remembers why."

No new dependencies. No contract changes — the `proposalContent` document
type has been live in the published Govenr contract since the claim ceremony.

## Files

- `lib/platform/errors.ts` — NEW. Shared `describePlatformError` (wasm
  errors don't extend Error; this extracts their real message).
- `lib/platform/content.ts` — NEW. `fetchProposalContent` (public read) and
  `saveProposalContent` (create or replace with revision + 1n — the
  official update pattern).
- `components/proposal-content-panel.tsx` — NEW. The editor + public
  display. Editor only for the claimant (claim owner); content visible to
  everyone; honesty note always shown.
- `lib/platform/types.ts` — `revision` on documents, `replace` on the facade.
- `lib/platform/claims.ts` — `hexToBase64` exported for reuse.
- `components/claim-panel.tsx` — uses the shared error helper; the gold
  panel now points at the editor below it.
- `app/proposals/[id]/page.tsx` — mounts the panel where the tabs
  placeholder was.

## Apply (Mac)

```bash
cd ~/govenr
cp ~/Downloads/govenr-s9c/lib/platform/errors.ts              lib/platform/
cp ~/Downloads/govenr-s9c/lib/platform/content.ts            lib/platform/
cp ~/Downloads/govenr-s9c/lib/platform/types.ts              lib/platform/
cp ~/Downloads/govenr-s9c/lib/platform/claims.ts              lib/platform/
cp ~/Downloads/govenr-s9c/components/proposal-content-panel.tsx components/
cp ~/Downloads/govenr-s9c/components/claim-panel.tsx           components/
cp ~/Downloads/govenr-s9c/app/proposals/\[id\]/page.tsx       "app/proposals/[id]/"
git add -A && git status   # 6 modified + 2 new
git commit -m "S9c: proposal editor — content as Platform documents owned by the claimant"
git push
```

Codespace: `git pull`, `npm run build`, `npm run dev` (or let autopull/CI
carry it). No npm install — no dependency changes.

## Test flow (the editor ceremony)

1. Open a proposal you have claimed (e.g. `governr-prop1`) signed in as the
   claimant. Below the gold claim panel you should see the gold
   **"You own this proposal — Write proposal content"** CTA.
2. Click it → editor: title (4–128 chars), description (max 20,000),
   milestones (one per line), report references (one per line).
3. **Publish content** → writes a `proposalContent` document to Platform
   (green `Document Create` on the platform explorer) → the panel renders
   the content publicly with an honesty note.
4. **Edit content** → change something → **Save changes** → green
   `Document Replace` on the explorer; the panel re-renders with the update.
5. Sign out (or open in a private window): the content still renders for
   everyone; no edit button appears.

## Failure table

| Symptom | Meaning | Fix |
| --- | --- | --- |
| Nothing renders below the claim panel | No Govenr contract in this browser's localStorage (fresh device) or read failed silently | Claim a proposal from this browser first; otherwise non-fatal |
| "You own this proposal" CTA missing though you claimed | Claim read failed or you're signed in as a different identity | Check the identity pill; re-sign-in |
| Save fails with an error | The panel shows the real SDK message now — read it | Errors mention balance (faucet/bridge) or revision (reload the page to re-fetch, then retry) |
| Replace fails with revision conflict | The document changed since it was loaded | Reload the page and retry |

## Notes

- Body renders as plain preserved-whitespace text for now; a proper
  markdown renderer is a polish-queue item (needs a dependency, so it goes
  through the Codespace).
- Only the claimant can edit. Multiple claims by different identities are
  prevented on-chain by the unique `byProposal` index; the read shows the
  first content document.
