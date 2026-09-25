# Govenr v1 — Requirements

EARS format. Every requirement is testable from the running app.

## 1. Hub / L1 mirror

- WHEN the visitor opens `/`, THE SYSTEM SHALL display every proposal in
  the current cycle with title, owner handle, ask (DASH, monthly flag),
  payments remaining, vote tallies (yes/no/abstain), and voting deadline.
- WHEN a proposal's `neededYesToFund` is greater than zero and the
  deadline has not passed, THE SYSTEM SHALL display a state badge
  reading "needs +N yes".
- WHEN tallies are displayed anywhere, THE SYSTEM SHALL render a
  vote bar with proportional yes/no/abstain segments and exact numbers.
- WHEN the mirror data is older than 60 seconds, THE SYSTEM SHALL
  attempt a refresh and display the data's last-updated timestamp.
- WHEN the app renders any L1 data, THE SYSTEM SHALL label it
  read-only ("on chain · read-only") and SHALL NOT display any
  vote-casting control anywhere in the app.

## 2. Proposal detail

- WHEN the visitor opens `/proposals/[id]`, THE SYSTEM SHALL display
  the proposal header (title, owner, ask, state badge) and tabs:
  Overview, Discussion, Reviews, Votes.
- WHEN the Overview tab is active, THE SYSTEM SHALL display the
  proposal content (title, body, milestones, report refs) with a
  visible note that this content is hosted as Platform documents in v2.
- WHEN the Votes tab is active, THE SYSTEM SHALL display tallies,
  needed-votes, deadline, and a note that per-masternode analytics
  arrive in v1.2.

## 3. Discussion (comments)

- WHEN the Discussion tab is active, THE SYSTEM SHALL list comments for
  the proposal in ascending creation order, each showing author handle,
  relative time, and body.
- WHEN a signed-in user submits a non-empty comment (1–2000 chars),
  THE SYSTEM SHALL persist it via the comment service and show it in
  the thread immediately.
- WHEN a user replies to a comment, THE SYSTEM SHALL attach the reply
  visually nested under its parent (one level).

## 4. Reviews

- WHEN the Reviews tab is active, THE SYSTEM SHALL list reviews with
  author handle, stance badge (support/concern/neutral), body, helpful
  percentage, and total tipped DASH.
- WHEN a signed-in user who has not reviewed submits a stance + body
  (min 10 chars), THE SYSTEM SHALL create their review and show it.
- WHEN a signed-in user who has already reviewed edits and resubmits,
  THE SYSTEM SHALL update their existing review in place (one review
  per identity per proposal, ever).
- WHEN the user has already reviewed, THE SYSTEM SHALL offer "Edit
  your review" instead of a blank form.

## 5. Tipping (simulated in v1)

- WHEN any review or comment is displayed, THE SYSTEM SHALL show a tip
  affordance ("◆ tip") with the item's current total tipped DASH.
- WHEN a signed-in user clicks tip and confirms an amount, THE SYSTEM
  SHALL create a tip receipt record (docRef, toId, amountDash, txid)
  and update the item's visible total.
- WHEN a tip is recorded in v1, THE SYSTEM SHALL generate a simulated
  txid (`"sim-" + 60 random hex chars`) and display a clear "v1
  simulated — v2 settles on L1 via InstantSend" disclosure.
- WHEN the user is not signed in and clicks tip, THE SYSTEM SHALL
  prompt sign-in.

## 6. Identity session (mock in v1)

- WHEN the app loads, THE SYSTEM SHALL show the mock session pill
  (handle, balance) from the session service.
- WHEN identity-dependent actions occur, THE SYSTEM SHALL use the mock
  identity; no wallet, keys, or chain connection in v1.

## 7. Presentation & quality

- WHEN any data fails to load, THE SYSTEM SHALL render a readable empty
  state, never a crash or blank screen.
- WHEN `npm run lint` or `npm run build` runs, THE SYSTEM SHALL pass
  with zero lint warnings.

## Non-goals for v1

No L1 writes, no voting UI, no key management, no real payments, no
MNO badges, no analytics, no moderation, no notifications, no
markdown rendering.
