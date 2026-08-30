# Current Milestone

Milestone 3 — Structured Coach Mode and event-derived review

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
- Player-visible coach context that cannot access opponent racks or future wall order
- Structured Charleston, discard, call, and draw recommendations with typed reason codes
- Three progressive hint levels, tracked hint usage, and specific tile highlighting
- Event-derived review cards, competence scores, and assistance-level recommendation
- Versioned local progress containing completed games, skills, and assistance level
- 19 passing unit/integration tests across engine and coach behavior

## Next

- Simultaneous call priority, Mahjong-on-discard, concealed-hand restrictions, quints, and dead-tile analysis
- Durable guest-to-account progress migration
- Server-authoritative Supabase action endpoint, authentication, and reconnection
- Multiplayer only after the expanded engine simulation is stable

## Known Issues

- The coach completes the remaining wall after four independent human discard decisions so a first session stays approachable.
- Call priority is simplified to the next responding player in automated play.
- The courtesy pass is fully modeled by the engine; first-game coaching currently chooses zero tiles automatically.
- Skill scores are transparent heuristics rather than a trained mastery model.

## Architectural Decisions

- The rules engine stays pure TypeScript and UI-agnostic.
- Only the original Training Card ships; commercial annual card data is excluded.
- The coach may use only player-visible information.
- Accounts and Supabase are deferred until they solve persistence and multiplayer needs.
