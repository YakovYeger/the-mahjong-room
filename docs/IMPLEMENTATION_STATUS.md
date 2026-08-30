# Current Milestone

Milestone 2 — Complete table-rule foundation

## Complete

- Project skeleton and product documentation
- Strong domain types and replaceable card-provider boundary
- Complete tile wall, deterministic shuffle, deal, Charleston, draw/discard loop, typed actions, and events
- Four-hand original Training Card and deterministic candidate ranking
- Three bots using the same hand-analysis utilities as the coach
- 100-game simulation target and unit tests
- Guest-first responsive game table, progressive hints, candidate hands, completed-game review, and versioned local progress
- Hidden-information projections and Sites-ready build
- Correct first/optional-second Charleston directions and matched courtesy passes
- Discard call windows, pass responses, public pung/kong exposures, and replacement-draw behavior
- Joker-backed calls and natural-tile joker exchanges, including guided table controls
- 13 engine tests and 100-game expanded-rule simulation

## Next

- Simultaneous call priority, Mahjong-on-discard, concealed-hand restrictions, quints, and dead-tile analysis
- Durable guest progress and event-derived reviews
- Server-authoritative Supabase action endpoint, authentication, and reconnection
- Multiplayer only after the expanded engine simulation is stable

## Known Issues

- The coach completes the remaining wall after four independent human discard decisions so a first session stays approachable.
- Call priority is simplified to the next responding player in automated play.
- The courtesy pass is fully modeled by the engine; first-game coaching currently chooses zero tiles automatically.

## Architectural Decisions

- The rules engine stays pure TypeScript and UI-agnostic.
- Only the original Training Card ships; commercial annual card data is excluded.
- The coach may use only player-visible information.
- Accounts and Supabase are deferred until they solve persistence and multiplayer needs.
