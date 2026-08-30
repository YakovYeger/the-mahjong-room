# Architecture

## Stack

- Vinext/Next.js-compatible App Router, React 19, and TypeScript
- Tailwind CSS 4 plus a small product-specific stylesheet
- Pure TypeScript game, bot, hand-analysis, and simulation modules
- Vitest for rules and simulation tests
- Supabase Auth/Postgres for optional accounts and durable progress
- OpenAI Sites-compatible Cloudflare Worker build and hosting

The code is a standard Git repository hosted on GitHub. Supabase is an optional adapter: without environment variables the application remains fully playable and stores versioned progress on the device. With a configured project, cookie-based passwordless auth migrates that progress to an account.

## Boundaries

`src/game/` contains no React, browser, network, or hosting dependency. `applyGameAction` is the only rules transition entry point. Normal illegal moves return typed violations rather than throwing.

Commercial hand definitions are never embedded in the engine. `HandDefinitionProvider` is replaceable, and the MVP ships only an original `TrainingCardProvider`.

Canonical state contains all racks and the wall. Client-facing integrations must combine `getPublicGameState` with `getPlayerPrivateState`; opponent concealed tiles and future wall order never belong in the public projection.

## Persistence and server boundary

`src/persistence/` owns the browser schema and merge policy. Guest data is deleted only after the authenticated `/api/progress` save succeeds. The API derives `user_id` from `auth.getUser()` and never accepts ownership from request data.

The migration separates user-visible progress and reviews from server-only canonical game state, action receipts, and event history. Every public table has row-level security. Browser roles receive explicit minimum grants; canonical state tables are reserved for a future trusted action service.

In the next stage, action submissions will include an action ID and expected state version. A server transaction will authenticate, authorize, validate, apply, persist snapshot plus events, and then broadcast only the public projection.
