# Profiles and friends (G16)

`/friends` shows the signed-in player's profile, exact-username lookup, incoming
requests, sent requests, and accepted friends. A player card shares only username,
display name, and join date. Emails, account IDs, progress, game history, and other
players' connections stay private. Display-name editing remains in Account.

Requests require explicit acceptance. Crossed requests stay pending. Senders can
cancel; recipients can accept or decline; either friend can remove a friendship
through a confirmation dialog. Removing a friend does not end shared games.
Existing private-table invite codes remain the way to invite players to a game.
Chat, public directories, partial-name search, friend email notifications, and
automatic room invitations are outside this feature.

## Backend and privacy

API routes verify the existing signed session and its live session record. The
server supplies the actor ID; request bodies cannot override it. Mutations reject
cross-origin requests and oversized bodies, and request/lookup rates are bounded.
Responses are private/no-store. The query scope clears on account changes, never
persists the social graph, and refreshes on focus/reconnect and every 30 seconds.
Writes are not automatically retried; refresh after an uncertain response.

`private.friendships` has one ordered row per pair, RLS enabled, and no browser
or anonymous grants. Security-invoker RPCs are service-only. Per-user transaction
locks serialize crossed requests and enforce a combined 200 friends/request
limit. Non-request actions require the current relationship UUID, so stale UI
cannot accept or remove a later request. Profile deletion cascades all edges.

## Validation and release

- SQL rollback fixtures exercise permissions, transition direction, self/missing
  players, duplicate/crossed requests, stale versions, unrelated users, bounded
  capacity, response fields, and account-deletion cleanup.
- A real concurrent PostgreSQL test confirms two simultaneous crossed requests
  leave exactly one pending edge, with no implicit acceptance.
- Isolated PostgreSQL 17 tests and Supabase CLI security advisors pass. Advisors
  report no issues. These use a minimal auth/profile harness, not a full local
  Supabase Auth/PostgREST stack.
- API tests verify authenticated actor binding, validation, origin/body limits,
  rate buckets, no-store responses, error mapping, and backend contract checking.
- Mounted and Chrome tests cover forms, request lifecycle, removal confirmation,
  Escape/cancellation, signed-out UI, native account/games/home navigation, and
  360/768/1280px layouts with 16px controls. Browser sessions/API responses are
  fabricated. On October 29, a real Supabase Auth/API journey with two disposable
  confirmed accounts verified profile lookup, request/accept/remove, and anonymous
  rejection against the production backend through the merged local app. Both
  accounts were removed afterward. Cross-device browser journeys remain beta work.

Apply `20261028182555_profiles_and_friends.sql` before the matching application
release. The migration was applied to production on October 29, 2026, recorded in
migration history as `20261029121947`. RLS and service-only grants were verified
against the actual database. Missing functions fail closed with a retryable Friends error.
The owner-private review uses simulated players without live database writes.

References: [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Postgres minor-release changes reviewed](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
