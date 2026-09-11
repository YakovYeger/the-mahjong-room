# Current Milestone

Milestone 13 — Backend, accounts, private multiplayer, and timed turns

## Complete

- Standard tile wall, deterministic shuffle, four-seat deal, private racks, and event/version tracking
- Fully interactive first Charleston and optional second Charleston in the correct directions
- Final-pass blind spaces and negotiated zero-to-three-tile courtesy passes
- Rule-aware original Training Card with explicit groups, concealed/exposed status, and Joker eligibility
- Exact 14-tile Mahjong validation with legal Joker substitution
- Mahjong from self-draw or the latest natural discard, including a final single or pair
- All-player discard responses, Mahjong priority, and deterministic closest-in-turn exposure priority
- Card-compatible Pungs, Kongs, Quints, Sextets, and Flower calls
- Correct post-call discard flow with no replacement draw after a Kong
- Natural-tile Joker exchanges, including interchangeable Flowers
- Wall-game completion without an artificial turn cutoff
- Bots that use the shared rules service for Charleston, calls, discards, and Mahjong
- Refined, show/hide Training Card rail with visual group spacing, C/X labels, Joker markers, candidate progress, and teaching notes
- Drag-and-drop and keyboard tile reordering that stays independent from game legality
- Custom, accessible suit marks with written labels on rack, discard, and exposed tiles
- Complete chronological discard pool rather than a latest-discard-only view
- Conservative dead-hand indicator proven solely from visible discards, never concealed or exposed opponent holdings
- Clear hover, focus, pressed, disabled, and responsive states across table actions
- Motion-powered rack layout transitions with an explicit before/after drop marker
- Shared Joker redemption discovery used by both the human controls and bot turns
- Versioned, device-local game checkpoints with rack order, table state, coach state, and game number
- A tactile animated deal bridges the landing page and table and doubles as the persistence-loading state
- Ten original, rules-aware Training Card hands covering concealed pairs, exposed groups, singles, Quints, and Sextets
- Dynamic landing, table, and review copy for game two and beyond
- Full-screen landing composition that keeps its green feature panel inside the content frame
- Progressive coach, game review, guest progress, optional account foundation, and persistence schema
- Engine, coach, persistence, and deterministic simulation coverage
- Email/password registration with required unique username, username-or-email login, Google PKCE callback, recovery, and post-OAuth username selection
- Database-owned Free/Plus/Club entitlements with transactional 1/5/20 active-game enforcement
- Server-only canonical schema, participant-safe projections, fixed seat membership, and secure seed references
- Action envelopes, idempotent receipts, optimistic state-version commits, and conflict recovery
- Signed-in cloud game list, private room creation, expiring eight-character invites, 1–4 humans, and permanent bot fill at start
- Participant-specific snapshots, cross-device reconnects, database-triggered private Realtime signals, and presence indicators
- Live and async clocks, leased `SKIP LOCKED` timeout claims, deterministic timeout actions, three-strike permanent bot replacement, and unanimous live pause/resume
- In-app async turn inbox plus throttled optional Resend email delivery
- Configurable four-seat game creation and multiplayer projection/timer tests

## Next

- Add the dedicated project's server-only Supabase key to Sites, deploy saved version 13, and then enable the installed ten-second timeout Cron job
- Configure Google OAuth credentials, production SMTP/auth templates, and an optional verified Resend sender
- Run the private 1/2/3/4-human beta and measure action latency, Realtime latency, reconnects, conflicts, timeout lag, and database contention
- Add browser automation for account creation, room join/start, reconnect, and a complete multiplayer hand
- Add structured external metrics and alert thresholds before the 1,000-room load test
- Add browser automation for the complete first-game route to continuous integration

## Explicit MVP boundaries

- Guided mode prevents illegal actions instead of simulating formal dead-hand penalties; its dead-hand symbol is informational and appears only when the discard pool alone proves the hand unavailable.
- Physical wall breaking, misnamed tiles, touch/rack timing, payments, and seat rotation are not part of the single-game learning MVP.
- The rare all-player fully blind Charleston procedure is not automated.
- Skill scores are transparent learning heuristics rather than a trained mastery model.
- Billing collection remains deferred; entitlements can be assigned by admin until the beta validates pricing.
- Public matchmaking, spectators, mid-game human replacement, and chat remain outside the multiplayer MVP.

## Architectural decisions

- The rules engine stays pure TypeScript and UI-agnostic.
- The Training Card, engine, bots, coach, and UI consume the same structured hand definitions.
- Only original Training Card content ships; commercial annual card data is excluded.
- The coach may use only player-visible information.
- Guest play remains the default; accounts are optional and migrate local progress only after a successful server save.
- Canonical game state and action history are server-only tables; browser roles receive no grants.
