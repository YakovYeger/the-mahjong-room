# Rules Specification

## Implemented in MVP

- A complete 152-tile American Mahjong wall: numbered suits, winds, dragons, flowers, and jokers
- Deterministic seeded Fisher-Yates shuffle
- Four seats with East receiving 14 tiles and other players 13
- Guided three-tile Charleston pass with four table actions
- Draw/discard turn enforcement and turn advancement
- Original Training Card provider with four teaching hands
- Valid/invalid Mahjong declaration boundary
- Event sequence and state version increments
- Public and player-private projections

## Deliberately simplified

The first interactive teaching slice omits calls, exposures, joker exchanges, optional Charleston phases, and full annual-card complexity. These are Milestone 4 rules work and must be added to the same engine rather than implemented in the UI.
