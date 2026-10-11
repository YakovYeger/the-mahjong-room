# Backend reliability and verification

The Supabase architecture remains authoritative: clients submit intentions, the pure rules engine validates them, and database transactions commit a versioned result. TanStack Query owns the client snapshot cache. Realtime announces changes; HTTP reads remain the source of participant-safe state.

## Failure handling

- Queries are scoped by authenticated identity and game. Account changes create a new QueryClient; logout/unmount cancels and removes private reads. Late responses cannot repopulate the previous account's cache.
- Strict schemas reject malformed snapshots, another seat's rack, canonical secrets, and concealed event payloads. Older versions and older same-version timestamps cannot replace newer state. Heartbeat activity timestamps merge monotonically.
- HTTP requests time out after eight seconds. Reads retry transient failures twice. Invalid contracts and deterministic HTTP rejections do not retry as reads. Writes do not use TanStack's automatic retry or offline queue.
- A move gets one action ID. Immediate retry and later recovery preserve its exact envelope. Uncertain outcomes block new moves; automatic recovery has a fifteen-second cooldown. Receipt confirmation continues even if a refresh discovers a terminal table. This pending envelope is in memory: after reload, the canonical snapshot determines the accepted state.
- Foreground fallback reads run every five seconds in lobbies, fifteen seconds for live tables, and thirty seconds for async tables. Terminal tables stop polling once any pending receipt is confirmed. Reconnect, focus, visibility return, and private broadcasts also refresh.
- Human commits lock the game and seat, then check version, active status, current human control, grace, and deadline. Exact receipts can replay after a table pauses or closes. Fresh heartbeats are rechecked before disconnect takeover. Bot/timeout commits cannot advance paused tables.
- Snapshot reads use a single canonical record and can resolve expired deadlines or disconnect grace. Scheduled timeout processing remains necessary for rooms with no active reader.

## Coverage

| Area | Automated evidence |
| --- | --- |
| HTTP timeouts, cancellation, HTML proxy errors, authorization classification | `tests/cloud-api.test.ts` |
| Existing username hydrates immediately after password login | `tests/account-login.test.ts` |
| SDK-verified JWT identity; invalid signatures/expiry/identity rejected | `tests/auth-identity.test.ts` |
| Host end confirmation/cancellation and duplicate-click prevention | `tests/end-game-dialog.test.ts` |
| Actual rules moves, receipt replay, uncertain recovery, offline rejection, read retries, coalescing, stale reads, cache privacy, heartbeat merging | `tests/table-query.test.ts` |
| Mounted React hooks/provider: subscription stability, lobby start, same-version pause, reconnect, logout, account switch, StrictMode, independent inbox/list, offline room writes | `tests/cloud-hooks.test.ts` |
| Actual route → service → rules → projection; one-record read, malformed requests, pause race, deadline recovery, unauthenticated responses | `tests/cloud-routes.test.ts` |
| Receipt context, replay precedence, notifications, action schema, snapshot synchronization | `tests/action-receipts.test.ts`, `tests/action-request.test.ts`, `tests/action-schema.test.ts`, `tests/snapshot-sync.test.ts` |
| SQL locks/guards, replay, pause/resume timing, fresh heartbeat, function privileges | `supabase/tests/atomic-actions.sql` |
| Engine, coach, tile conservation, multiplayer projection and timers | Existing engine and multiplayer suites |

The HTTP/controller tests inject failures with in-memory transport. Route tests execute the real application code with a mock RPC ledger. The SQL fixtures were separately executed against the actual production functions inside a transaction and rolled back. These are distinct layers; the mock ledger does not prove real database concurrency under load.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Run the SQL file through an authorized SQL connection separately; it needs an existing game owner and rolls its fixtures back. Do not use it as a deployment script.

`npx tsx scripts/verify-authenticated-journey.ts [existing-live-test-room-id]` is an opt-in test against the running local app and its configured real Supabase backend. It reads `LOCAL_USER`, `LOCAL_USER_EMAIL`, and `LOCAL_USER_PASS` from ignored `.env.local` (email is descriptive; login uses the username). It creates live/async rooms, uses one human with three bots, exercises private snapshot validation, no-store headers, unauthenticated rejection, the Free plan room limit, pause rejection, moves, receipt replay, deadline/conflict recovery, and receipt replay after ending a room. It ends only the selected/created test rooms and retains their history. Supply a test lobby/active room only; do not point it at a game you intend to continue. This script is intentionally outside the ordinary unit suite and does not test email delivery or multiple human accounts.

## Remaining release checks

Application changes are included in the October 11 Sites release. Database migrations `20261008210557_get_game_action_receipt.sql` and `20261009095331_atomic_player_action_guards.sql` are applied to production. The matching application is packaged and pushed by the Sites release workflow.

Authenticated multi-browser journeys, real-device touch/keyboard checks, 1–4-human beta sessions, and multi-room load tests remain. Measure action latency, peer-visible latency, conflicts, reconnect success, timeout lag, database contention, and heartbeat cost. No tests establish zero interruptions or unlimited throughput. The next design phase should unify the online and local presentation while preserving this transport boundary and existing drag behavior.
