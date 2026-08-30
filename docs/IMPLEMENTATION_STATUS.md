# Current Milestone

Milestone 4 — Guest persistence and account foundation

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
- 23 passing unit/integration tests across engine, coach, and persistence behavior
- Versioned guest progress with merge-safe account migration
- Passwordless account screen and server-side magic-link confirmation endpoint
- Authenticated progress API that derives ownership from the verified session
- Supabase schema for games, canonical state, actions, events, reviews, and learning progress
- Row-level security, explicit grants, ownership policies, and pgTAP schema checks

## Next

- Simultaneous call priority, Mahjong-on-discard, concealed-hand restrictions, quints, and dead-tile analysis
- Connect a dedicated Supabase project, apply the migration, and run database/advisor checks
- Server-authoritative game action endpoint with idempotency and optimistic version checks
- Reconnection and resume from canonical server state
- Multiplayer only after the expanded engine simulation is stable

## Known Issues

- The coach completes the remaining wall after four independent human discard decisions so a first session stays approachable.
- Call priority is simplified to the next responding player in automated play.
- The courtesy pass is fully modeled by the engine; first-game coaching currently chooses zero tiles automatically.
- Skill scores are transparent heuristics rather than a trained mastery model.
- The repository has no Supabase project credentials; the deployed preview therefore remains guest-first and the account page clearly reports that connection is pending.
- Database tests are committed but require a linked or local Supabase Postgres instance to execute.

## Architectural Decisions

- The rules engine stays pure TypeScript and UI-agnostic.
- Only the original Training Card ships; commercial annual card data is excluded.
- The coach may use only player-visible information.
- Guest play remains the default; accounts are optional and migrate local progress only after a successful server save.
- Canonical game state and action history are server-only tables; browser roles receive no grants.
