# Rules Specification

## Implemented in MVP

- A complete 152-tile American Mahjong wall: numbered suits, winds, dragons, flowers, and jokers
- Deterministic seeded Fisher-Yates shuffle
- Four seats with East receiving 14 tiles and other players 13
- Deterministic, four-seat three-tile pass collection and distribution
- First Charleston pass order (right, across, left), optional second Charleston (left, across, right), and matched-count courtesy passes
- Draw/discard turn enforcement and turn advancement
- Discard call windows, pass responses, exposed pungs and kongs, and replacement draws after kongs
- Joker use inside callable sets and matching natural-tile exchanges from visible exposures
- Original Training Card provider with four teaching hands
- Valid/invalid Mahjong declaration boundary
- Event sequence and state version increments
- Public and player-private projections

## Deliberately simplified

The engine does not yet resolve simultaneous call priority, concealed-hand restrictions, quints, dead-tile analysis, or every edge case from full annual-card play. These must remain engine rules rather than UI-only behavior. Full annual-card complexity stays behind a licensed provider.
