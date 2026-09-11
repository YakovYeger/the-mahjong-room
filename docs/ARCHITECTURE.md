# Architecture

## Stack

- Vinext/Next.js-compatible App Router, React 19, and TypeScript
- Tailwind CSS 4 plus a small product-specific stylesheet
- Pure TypeScript game, bot, hand-analysis, and simulation modules
- Vitest for rules and simulation tests
- Supabase Auth, Postgres, Realtime, Vault, Cron, and pg_net for accounts and durable multiplayer
- OpenAI Sites-compatible Cloudflare Worker build and hosting

The code is a standard Git repository hosted on GitHub. Supabase remains optional for the guest table: without environment variables the application is fully playable and stores one versioned checkpoint on the device. Signed-in games use cookie-based password or Google authentication and a server-authoritative action service.

## Boundaries

`src/game/` contains no React, browser, network, or hosting dependency. `applyGameAction` is the only rules transition entry point. Normal illegal moves return typed violations rather than throwing.

Commercial hand definitions are never embedded in the engine. `HandDefinitionProvider` is replaceable, and the MVP ships only an original `TrainingCardProvider`.

Canonical state contains all racks and the wall. Client-facing integrations must combine `getPublicGameState` with `getPlayerPrivateState`; opponent concealed tiles and future wall order never belong in the public projection.

## Authoritative service boundary

`src/persistence/` owns the browser schema and merge policy. Guest data is deleted only after the authenticated `/api/progress` save succeeds. The API derives `user_id` from `auth.getUser()` and never accepts ownership from request data.

`app/api/games` owns room creation, membership, snapshots, actions, pause votes, and timeout processing. It derives the user from `auth.getUser()`, maps that user to one fixed seat, loads canonical state using a server-only secret, applies the same pure rules engine used by guest play, advances bots, and commits through one optimistic-concurrency database function.

Each action has a UUID and expected state version. Duplicate UUIDs return their stored response; competing actions against one version produce one winner and a `409` for the loser. Canonical racks, wall, receipts, and history live in `private`. Membership-safe tables in `public` use explicit grants and RLS.

One private Realtime channel exists per game. Database broadcasts contain only the game ID, resulting version, event sequence, and deadline. Presence is cosmetic. Clients always refetch a sanitized snapshot after broadcasts or reconnects.

Supabase Cron invokes the internal timeout endpoint every ten seconds. Workers claim overdue rows with a short lease and `FOR UPDATE SKIP LOCKED`; timeout action IDs are deterministic, and strikes plus third-strike bot replacement commit with the action. Async turns also create an in-app notification and at most one email in a six-hour throttle window.
