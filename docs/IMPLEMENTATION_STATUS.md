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
- Cloud rack selection, drag-to-reorder, drag-to-discard, keyboard shortcuts, touch move controls, and device-local order restoration
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
- Five-minute default live turns with pre-room duration choices, untimed Charleston, server heartbeats, visible two-minute reconnect grace, and transactional bot takeover after disconnect expiry
- Bot play stops and retires a table when its final human seat is replaced; reconnect also retires legacy all-bot stalls
- G3 host controls: invite code stays available through active play, only the host can end a table for everyone, and terminal tables clear invite credentials
- G4 leave confirmation: active and paused tables explain the two-minute reconnect grace and bot takeover; Stay, Escape, and dismiss preserve the seat, while Leave returns to the games list
- G5 game-over review: completed wins, wall games, and abandoned tables show a clear terminal outcome, immutable final review, and next-game navigation; completed games reveal final racks and winning Training Card line, while abandoned games keep opponents' concealed racks hidden
- Owners can delete their cloud games and saved history from the games list
- In-app async turn inbox plus throttled optional Resend email delivery
- Configurable four-seat game creation and multiplayer projection/timer tests

## Cleanup and server reliability — first batch

- Extracted the guest tile renderer, shared Training Card labels, cloud countdown, and disconnect notices into `src/table`.
- Added one strict Zod action contract for the cloud API; malformed fields, duplicate IDs, and oversized selections are rejected before the rules engine.
- Stabilized private Realtime channels across snapshot updates and refresh on subscription recovery, visibility return, and same-version pause/resume broadcasts.
- Coalesced snapshot fetches, prevented stale responses from rolling back acknowledged moves, and preserved valid selections across unrelated refreshes.
- Fixed automatic bot advancement through courtesy submissions that increment the state version without emitting events.
- Added server-only receipt lookup before status/version/grace validation. Exact retries return the original response, mismatched user/game/payload requests are rejected, and concurrent duplicate commits skip turn notifications.
- Added one immediate network retry with the original action ID and payload; HTTP rejections are not retried and moves are not queued offline.
- Fixed the existing TypeScript errors and corrected the stale timed-Charleston test. Lint recognizes the existing sortable callback refs.
- Supabase migration `20261008210557_get_game_action_receipt.sql` is applied to the production project. Checked server-only privileges and receipt replay/mismatch guards using fixtures rolled back after verification.

## Backend and TanStack integration — second batch

- Added an account-scoped TanStack Query provider for cloud routes, shared authoritative table queries, independent games/inbox queries, and mutation status. Logout/account changes cancel reads and clear private caches; concealed racks are never persisted in the query cache.
- Extracted cloud transport, validated room/snapshot contracts, heartbeat handling, and submission/recovery into tested controllers and hooks. Local selection and drag ordering remain in the existing UI.
- Added bounded HTTP timeouts, selective read retries, coalesced refreshes, visibility/focus/reconnect recovery, and foreground polling as a fallback when Realtime fails. Lobby version zero and same-version pause/resume updates are supported.
- Lost action responses retain the original action ID and payload for receipt recovery; new moves are blocked until confirmation. Recovery is throttled and remains available after terminal snapshots. Offline writes are rejected rather than queued.
- Snapshot reads now load one consistent canonical record. Expired decisions/disconnect grace can recover on a read without waiting for the scheduled worker.
- Combined canonical context and receipt lookup into one RPC. Transactional player commits recheck status, seat ownership/control, version, grace, and deadline under locks. Paused tables reject timeout/bot recovery; Charleston stays untimed on resume.
- Applied `20261009095331_atomic_player_action_guards.sql` to production and executed rollback-only SQL regression fixtures against the actual database functions.
- Added mounted React integration, HTTP failure injection, query/controller, actual API route/service/rules integration, and database regression coverage. See [BACKEND_RELIABILITY.md](BACKEND_RELIABILITY.md) for the coverage boundaries and commands.

Frontend/server application changes are included in the October 11 Sites release. The two database migrations are applied. The next product phase is shared table design and visual parity; production beta, browser journeys, and load/latency measurement remain release work.

## Authenticated verification — October 11

- Executed browser journeys with a real test account for sign-in/out, live room creation/start, Charleston and zero courtesy passing, pause/resume, rack reordering/reload, leave cancellation, and async creation/start/move/host end.
- Fixed missing username hydration after login, replaced unsupported native host-end confirmation with an accessible dialog, and filtered closed-room notifications from the turn inbox.
- Replaced repeated game API `getUser()` calls with SDK-verified `getClaims()` identity checks and signing-key caching. Invalid/expired identities remain rejected; display metadata is not authorization.
- Added an opt-in real-backend runner and regression coverage. The user confirmed the observed Auth/network timeouts occurred during train travel with internet loss. The interrupted whole live/async runner did not complete; these observations do not establish a backend performance defect. See [AUTHENTICATED_TEST_RESULTS.md](AUTHENTICATED_TEST_RESULTS.md) for evidence and remaining scope. The changes are included in the October 11 Sites release.

## In Progress

- G6 responsive tabletop: opponents are placed relative to the player's seat, the shared discard area sits in the table center, and phone racks reflow into two rows with safe-area spacing. Mobile polish now adds tactile tile faces, a compact two-column Training Card with tile groups, a hamburger home menu, and a coach note below the decorative rack. Timeout and bot-takeover notices are transient and only appear for newly observed events; active-game invites are hidden because seats lock at start. Remaining: review phone portrait, phone landscape, tablet, and desktop layouts and tune any overlap or sizing issues.

## Next

- Next product order: G11 accessibility settings, G8 wall/grouped discards, G21 fullscreen table, then G16 profiles/friends. G15 account management is complete.
- Configure production SMTP/auth templates and an optional verified Resend sender
- Disable the legacy project's timeout Cron job after reconnecting its original Supabase organization; its retired secret is rejected by production
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

## Release preparation — October 11

- Removed the boardgame.io experiment, its socket tests, launch scripts, and exclusive dependencies. Supabase remains the authoritative online backend.
- Preserved offline rejection, bounded retries, receipt recovery, and reconnect coverage for real connectivity interruptions.
- Release validation after removal: 115 tests across 17 files, typecheck, and lint pass. The release workflow also builds the deployment artifact.
- Dependency audit after removal still reports 23 advisories in the retained dependency tree; removing the experiment does not resolve all existing dependency maintenance work.

## Canonical repository — October 11

- GitHub `YakovYeger/the-mahjong-room` is the application source of truth; Sites handles deployment.
- Integrated existing GitHub main history with the tested version 37 source without force-pushing. The current TanStack transport, dnd-kit interactions, mobile navigation, and transactional action guards supersede older implementations of the same features.
- Retained the migration timestamps already applied to production and omitted byte-identical copies under older GitHub filenames to avoid duplicate migrations.

## Account management — October 14

- G15 account settings: profile details and display-name edits, verified password change/recovery, global sign-out, and confirmed self-service deletion.
- Server APIs reject revoked sessions immediately. A transactional deletion trigger guards open tables, removes owned history, and anonymizes retained completed seats/history at other hosts' tables.
- Tested with isolated local Supabase Auth/database fixtures and desktop/mobile browser journeys. Production SMTP and Google OAuth require release verification.
- Applied `20261014090351_account_management.sql` to production and passed rollback-only account/session/deletion fixtures against the actual database. See [ACCOUNT_MANAGEMENT.md](ACCOUNT_MANAGEMENT.md) for policy, tests, and release order.

## Accessibility settings — October 14

- G11 adds device-saved Large Text, Low Light, High Contrast, full rack suit names, and reduced motion. The Table menu opens settings without leaving the game.
- Shared type uses relative units; enlarged racks, headings, actions, and navigation reflow. Portaled controls inherit the selected palette, and active/away seats have written state labels.
- Preferences apply before paint, follow live system motion changes, and synchronize between tabs. Storage failures preserve usable session controls with a clear status.
- Tests cover persistence, validation, keyboard interaction, and focus return; browser review covers portrait/landscape phones, tablet, desktop, and crowded public tables. See [ACCESSIBILITY.md](ACCESSIBILITY.md) for scope and limits. This feature is prepared on `codex/accessibility-settings` for review before integration into the public release.
