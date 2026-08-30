# Architecture

## Stack

- Vinext/Next.js-compatible App Router, React 19, and TypeScript
- Tailwind CSS 4 plus a small product-specific stylesheet
- Pure TypeScript game, bot, hand-analysis, and simulation modules
- Vitest for rules and simulation tests
- OpenAI Sites-compatible Cloudflare Worker build and hosting

The code is a standard Git repository and is ready to push to GitHub. Supabase Auth/Postgres/Realtime remains the recommended Milestone 4 addition when accounts and multiplayer require durable server-authoritative state; it is intentionally not required for guest-first MVP play.

## Boundaries

`src/game/` contains no React, browser, network, or hosting dependency. `applyGameAction` is the only rules transition entry point. Normal illegal moves return typed violations rather than throwing.

Commercial hand definitions are never embedded in the engine. `HandDefinitionProvider` is replaceable, and the MVP ships only an original `TrainingCardProvider`.

Canonical state contains all racks and the wall. Client-facing integrations must combine `getPublicGameState` with `getPlayerPrivateState`; opponent concealed tiles and future wall order never belong in the public projection.

## Later server boundary

When accounts arrive, action submissions will include an action ID and expected state version. A server transaction will authenticate, authorize, validate, apply, persist snapshot plus events, and then broadcast the public projection.
