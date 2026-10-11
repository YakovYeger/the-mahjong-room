# Mahjong Room: backend, React, and tabletop tooling research

Researched 8 October 2026. This is a recommendation based on the current repository, initial learning-game design, Milestone 13 roadmap, and primary documentation. It is not a production benchmark or a change to the running backend.

## Recommended direction

Keep Supabase for the beta. Keep the pure TypeScript rules engine, React DOM table, dnd-kit, and Motion. Add TanStack Query and shared runtime schemas first; introduce accessible UI primitives selectively. Prioritize reusable table components and multiplayer browser tests over another framework rewrite.

If measurements show that live-room coordination is the limiting factor, evaluate a room runtime alongside Supabase. Cloudflare Durable Objects are the most natural first candidate because the application already runs on Workers. Colyseus is the stronger candidate if we choose a dedicated Node game-server deployment. These recommendations are architectural judgments, not claims that either option is faster in our installation.

## What web tabletop systems teach us

The important distinction is between a rules-enforced learning game and an unrestricted virtual tabletop. Mahjong needs private racks, legal-action enforcement, simultaneous claims, deterministic priority, timers, and recovery. It does not currently need physics, arbitrary piece placement, a continuous simulation, or a 3D scene.

Board Game Arena's developer documentation organizes gameplay around explicit states, including multiple active players. Boardzilla models pieces, spaces, player actions, and game flow. boardgame.io provides phases, state management, multiplayer, and lobby features. The transferable lesson is to model legal decisions and player-visible information explicitly; a generic rendering engine does not solve these problems. [BGA state-machine documentation](https://en.doc.boardgamearena.com/Your_game_state_machine%3A_states.inc.php), [Boardzilla game structure](https://docs.boardzilla.io/game/board), [boardgame.io](https://boardgame.io/).

## Is Supabase appropriate?

Yes, for our current four-seat turn-based and asynchronous game. Durable transactional storage fits game checkpoints, action receipts, membership, accounts, learning progress, and history. The current implementation already validates actions on the server, commits a state version through Postgres, and gives each participant a sanitized snapshot. Realtime is a notification mechanism, not the rules authority.

Our implementation uses private database-triggered Broadcast signals rather than exposing concealed canonical state through Postgres Changes. This is a sensible choice. Supabase documents per-subscriber authorization and ordered single-thread processing as scaling constraints for Postgres Changes, and offers Broadcast as the alternative. This does not mean every four-player room needs a different backend. [Broadcast](https://supabase.com/docs/guides/realtime/broadcast), [Postgres Changes scaling](https://supabase.com/docs/guides/realtime/postgres-changes#scaling-postgres-changes).

The 1,000-room goal needs sizing and a realistic load test. As an illustrative upper-bound scenario, 1,000 four-human live tables mean roughly 4,000 player connections before extra tabs or spectators. Their existing 20-second heartbeat schedule alone averages about 200 HTTP requests per second. These are calculations from our design, not measured throughput. Current documented connection defaults are 500 for capped Pro and 10,000 for Pro without a spend cap; project configuration and message quotas must also be checked. [Realtime limits](https://supabase.com/docs/guides/realtime/limits).

The ten-second timeout sweep is our implementation choice. Under healthy scheduling, an expired deadline may wait nearly one sweep interval before processing, plus execution/network delay; outages can extend that further. Supabase Cron supports schedules as frequent as every second, so this is not an inherent ten-second platform limitation. Short discard-response windows need an explicit timeout-lag target and load test. [Supabase Cron](https://supabase.com/docs/guides/cron).

The changelog was reviewed. The current private-alpha database scaling offerings are not a reason to migrate the beta, and no unrelated platform change was made. [Supabase changelog](https://supabase.com/changelog).

## Backend alternatives

| Option | What it gives us | Main cost / decision |
| --- | --- | --- |
| Current Supabase + authoritative API | Durable games and accounts; existing implementation; live and async modes | Custom coordination and timeout processing; quantify database requests and contention |
| Supabase + Cloudflare Durable Objects | A named room object can coordinate clients, use persistent storage, and run scheduled work | Custom authentication, projection, command handling, recovery, and storage ownership; verify hosting support |
| Supabase + Colyseus | Room lifecycle, synchronization, per-client StateView, and reconnection support | Dedicated server operations, state-schema adaptation, durable recovery, and an account bridge |
| boardgame.io | Turn-based game framework; evaluated, then removed from this project | Not adopted; retain Supabase and the existing rules engine |
| Nakama | Broader gaming backend with authoritative matches and active/passive turn-based patterns | Substantial operational and integration change; better justified by a broader social/matchmaking platform |
| Boardzilla | Tabletop-specific piece/action/flow abstractions and browser UI workflow | Different domain model and UI assumptions; research candidate rather than an immediate migration |

Cloudflare documents room-style coordination with WebSockets and hibernation. Hibernation keeps connections open but resets in-memory state, so persisted recovery is mandatory. Its alarms provide at-least-once execution, not an exact-once or zero-lag timer: timeout commands still need idempotency. [WebSockets and hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [alarms](https://developers.cloudflare.com/durable-objects/api/alarms/).

Colyseus has explicit per-client state filtering, but unfiltered fields are public by default. Its reconnection flow can reserve a seat, with automatic or token-based manual reconnect. These are useful building blocks, not an automatic port of our rack privacy, bot takeover, or durable async games. [StateView](https://docs.colyseus.io/state/view), [reconnection](https://docs.colyseus.io/room/reconnection).

Nakama supports active turn-based matches and passive games that save state while players are offline. It requires custom match logic. Its broader scope is not necessary for the current private-table learning MVP. [Nakama multiplayer](https://heroiclabs.com/docs/nakama/concepts/multiplayer/).

A hybrid must have one authoritative owner per match. Do not let Postgres and a room object independently accept moves. A pilot would define which store acknowledges a committed command, how versions advance, and how history/progress reaches Supabase. Reliable replication/checkpointing is real additional work.

## Library shortlist

| Priority | Tool | Specific use in our application |
| --- | --- | --- |
| First runtime addition | TanStack Query | Room list, participant snapshots, notifications, mutation status, request cancellation/deduplication, and reconnect refresh |
| First runtime addition | Zod | Shared action-envelope and snapshot schemas; infer API types from validated shapes instead of duplicating handwritten checks |
| Selective runtime addition | React Aria Components | Accessible dialogs, menus, selection widgets, and press behavior with our own visual design |
| First test addition | Playwright | Multi-browser-context games, reload/reconnect, competing claims, mobile viewport flows, and screenshots |
| Next rules-test addition | fast-check | Generated action sequences and model-based tests for conservation, legality, privacy, and replay invariants |
| After component extraction | Storybook + MSW | Develop and verify tile/rack/coach/dialog states, including slow/error/conflict responses, without playing a full hand |
| Conditional | XState | A connection/submission/recovery workflow if a typed reducer becomes difficult to maintain |

TanStack Query supplies caching, invalidation, retry behavior, and focus/reconnect refresh policies. Configure these intentionally: it is not a WebSocket transport or rules engine. Realtime can invalidate the relevant query; mutation responses can update it. [Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation).

Game-specific constraints for a Query integration:

- Key private snapshots by authenticated identity, game, and seat; clear them at logout/seat changes. Do not persist concealed racks in a general-purpose query-cache checkpoint.
- Accept only snapshots whose versions do not move the current view backward; reject stale responses even if they finish last.
- Coalesce redundant action-response and Broadcast-triggered refreshes; support cancellation.
- Retry safe reads deliberately. Do not queue stale offline moves or blindly retry expired claims. A retry of the same intended command must retain its original action ID.
- Show immediate local selection/reordering and a pending move animation, while the server confirms committed gameplay. A concealed draw cannot be invented optimistically.

Zod can validate discriminated action unions and expose inferred TypeScript types. Zod Mini is available if browser bundle size becomes material. Schemas validate shape; tile ownership, turn eligibility, and legal Mahjong still belong in the rules/service layer. [Zod API](https://zod.dev/api), [Zod Mini](https://zod.dev/packages/mini).

React Aria supplies unstyled accessible behavior and device-adaptive interactions. My preference is selective adoption for the learning game's touch and keyboard UX. Radix Primitives is also a reasonable choice if we only need a small set of overlays. Choose one for common primitives; keep native buttons where they are sufficient. Do not install both entire systems or replace dnd-kit without a concrete interaction problem. [React Aria](https://react-aria.adobe.com/), [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility).

Playwright's retrying assertions suit asynchronous multiplayer UI updates. fast-check can generate commands and check a model over long traces. Storybook provides isolated UI scenarios, while MSW handles network mocking. These tools address different failure modes and are development dependencies. [Playwright assertions](https://playwright.dev/docs/test-assertions), [fast-check model testing](https://fast-check.dev/docs/advanced/model-based-testing/), [Storybook testing](https://storybook.js.org/docs/writing-tests), [MSW](https://mswjs.io/docs/).

XState provides explicit workflow/state-machine modeling. It should replace a difficult orchestration reducer, not become a second independent source of gameplay truth. We can start with React's reducer and adopt a pinned stable release only if its value is demonstrated. [XState](https://stately.ai/docs/xstate).

## Highest-value code changes before more packages

Repository observations:

- `app/game-experience.tsx` is 656 lines and combines landing, table, coaching, animations, persistence, and interaction state.
- `app/games/[id]/page.tsx` is 364 lines and combines network subscriptions, heartbeats, snapshots, rack preferences, countdown updates, actions, and rendering.
- Tile/card presentation exists separately in guest play, cloud play, and the experiment.
- The cloud Realtime effect depends on the entire snapshot. It removes and recreates the channel after snapshot changes, causing avoidable subscription churn.
- `refresh()` unconditionally clears selected tiles. An unrelated refresh can interrupt a player's selection.
- Snapshot fetch responses are applied without a monotonic-version check. Overlapping requests can therefore install an older view after a newer one.
- A one-second clock updates state in the page component, rerendering the page subtree. Isolate the countdown and profile the result rather than assuming a performance problem or adding memoization everywhere.
- API data is often asserted with `as` instead of runtime validation; the action-envelope guard is handwritten.

The proposed boundaries are:

```text
game/                  Pure tile rules, structured Training Card, legality
coach/                 Advice from the participant-visible context
contracts/             Shared action and snapshot schemas
table/components/      TileFace, Rack, OpponentSeat, DiscardPool,
                       TrainingCard, CoachPanel, ActionBar, TurnClock
table/controller/      Selection, local rack order, pending/error workflow
table/transports/      Local rules adapter, Supabase adapter
server/                Authorization, membership, commits, scheduler integration
```

All table transports should expose one participant-safe view model and action contract. Components should not import backend SDKs. The pure rules and coach should not import React. A second backend can then exercise the same table and accessibility behavior instead of requiring another complete UI.

Keep authoritative snapshots, local rack/selection state, and transient motion state separate. Local reordering should remain immediate during network latency; unrelated table updates should preserve selected physical IDs that are still legal and still in the rack. A player's one-second countdown should not drive rack animation or reset interaction state.

## Keep / defer

Keep dnd-kit for rack sorting/discard gestures and Motion for transitions. Motion already supports reduced-motion preferences, and our guest experience uses that capability. Standardize the same behavior across variants. [dnd-kit](https://dndkit.com/), [Motion accessibility](https://motion.dev/docs/react-accessibility).

Defer Redux or Zustand unless shared local state has a demonstrated problem that component boundaries and a reducer do not solve. Do not store a duplicate authoritative game in both a global client store and a query cache.

Do not add Phaser, PixiJS, Three.js, or react-three-fiber for the current table. This is a workload-based recommendation: the bounded number of tiles and accessible controls are well served by React DOM. Reconsider rendering technology only for measured rendering limits or a requested 3D/physics experience. A renderer would not replace rules, networking, or accessibility work.

Do not add tRPC, a new router, or a new app framework just to gain cleaner types. Shared schemas and narrow adapters address the immediate need. React Hook Form is optional for future complex account/settings forms, not a necessary dependency for tile play.

The boardgame.io experiment and its server dependencies were removed on October 11. The application retains Supabase, TanStack Query, and the existing pure Mahjong rules engine.

## Adoption order and decision gates

1. Extract shared tile/rack/card/table components and participant-safe transport boundaries.
2. Stabilize subscriptions, preserve valid selection, and enforce monotonic snapshot acceptance.
3. Add TanStack Query and shared schemas at the network boundary.
4. Add a small accessibility primitive layer and verify touch, keyboard, focus restoration, zoom, and reduced motion on the actual devices.
5. Establish browser tests and generated rules/privacy traces. Fix the existing typecheck and stale timed-Charleston test before treating CI as a release gate.
6. Measure action acceptance, peer-visible update latency, snapshot requests per move, conflicts, reconnect success, timeout lag, database contention, and per-room operating cost. Use redacted operational metadata, not racks or wall contents.
7. Run the existing 1/2/3/4-human beta and a realistic multi-room load test. If coordination/latency or timeout precision remains unacceptable after client and query improvements, compare one Durable Object per room against a Colyseus room using the same pure rules.

At the research stage, no libraries were installed and no backend was migrated. The implementation now uses shared Zod contracts and TanStack Query for cloud tables, game lists, and notifications, with mounted React and API integration tests. Subscription, snapshot, bot, and transactional receipt handling are covered in `IMPLEMENTATION_STATUS.md` and `BACKEND_RELIABILITY.md`. Accessibility primitives, shared table design, browser journeys, and load measurement remain the next stages.
