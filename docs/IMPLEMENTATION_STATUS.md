# Current Milestone

Milestone 7 — Playing-table polish and visible information

## Complete

- Standard tile wall, deterministic shuffle, four-seat deal, private racks, and event/version tracking
- Fully interactive first Charleston and optional second Charleston in the correct directions
- Final-pass blind spaces and negotiated zero-to-three-tile courtesy passes
- Rule-aware original Training Card with explicit groups, concealed/exposed status, and Joker eligibility
- Exact 14-tile Mahjong validation with legal Joker substitution
- Mahjong from self-draw or the latest natural discard, including a final single or pair
- All-player discard responses, Mahjong priority, and deterministic closest-in-turn exposure priority
- Card-compatible Pungs, Kongs, Quints, Sextets, and Flower calls
- Correct post-call discard flow with no replacement draw after a Kong
- Natural-tile Joker exchanges, including interchangeable Flowers
- Wall-game completion without an artificial turn cutoff
- Bots that use the shared rules service for Charleston, calls, discards, and Mahjong
- Refined, show/hide Training Card rail with visual group spacing, C/X labels, Joker markers, candidate progress, and teaching notes
- Drag-and-drop and keyboard tile reordering that stays independent from game legality
- Custom, accessible suit marks with written labels on rack, discard, and exposed tiles
- Complete chronological discard pool rather than a latest-discard-only view
- Conservative dead-hand indicator proven solely from visible discards, never concealed or exposed opponent holdings
- Clear hover, focus, pressed, disabled, and responsive states across table actions
- Progressive coach, game review, guest progress, optional account foundation, and persistence schema
- Engine, coach, persistence, and deterministic simulation coverage

## Next

- Connect a dedicated Supabase project, apply the migration, and run database/advisor checks
- Server-authoritative game action endpoint with idempotency and optimistic version checks
- Reconnection and resume from canonical server state
- Add browser automation for the complete first-game route to continuous integration
- Multiplayer only after server-authoritative action handling is stable

## Explicit MVP boundaries

- Guided mode prevents illegal actions instead of simulating formal dead-hand penalties; its dead-hand symbol is informational and appears only when the discard pool alone proves the hand unavailable.
- Physical wall breaking, misnamed tiles, touch/rack timing, payments, and seat rotation are not part of the single-game learning MVP.
- The rare all-player fully blind Charleston procedure is not automated.
- Skill scores are transparent learning heuristics rather than a trained mastery model.
- The deployed preview remains guest-first until a Supabase project is connected.

## Architectural decisions

- The rules engine stays pure TypeScript and UI-agnostic.
- The Training Card, engine, bots, coach, and UI consume the same structured hand definitions.
- Only original Training Card content ships; commercial annual card data is excluded.
- The coach may use only player-visible information.
- Guest play remains the default; accounts are optional and migrate local progress only after a successful server save.
- Canonical game state and action history are server-only tables; browser roles receive no grants.
