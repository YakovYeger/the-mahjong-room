# Current Milestone

MVP — Guided first game

## Complete

- Project skeleton and product documentation
- Strong domain types and replaceable card-provider boundary
- Complete tile wall, deterministic shuffle, deal, Charleston, draw/discard loop, typed actions, and events
- Four-hand original Training Card and deterministic candidate ranking
- Three bots using the same hand-analysis utilities as the coach
- 100-game simulation target and unit tests
- Guest-first responsive game table, progressive hints, candidate hands, completed-game review, and versioned local progress
- Hidden-information projections and Sites-ready build

## Next

- Full calls, exposures, joker exchange, and optional Charleston rules
- Durable guest progress and event-derived reviews
- Server-authoritative Supabase action endpoint, authentication, and reconnection
- Multiplayer only after the expanded engine simulation is stable

## Known Issues

- The coach completes the remaining wall after four independent human discard decisions so a first session stays approachable.
- Calls and exposures are not yet part of the interactive slice.

## Architectural Decisions

- The rules engine stays pure TypeScript and UI-agnostic.
- Only the original Training Card ships; commercial annual card data is excluded.
- The coach may use only player-visible information.
- Accounts and Supabase are deferred until they solve persistence and multiplayer needs.
