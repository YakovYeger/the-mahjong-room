# Rules Specification

## Rules baseline

The game teaches NMJL-style American Mah Jongg mechanics with an original, non-proprietary Training Card. The annual commercial card remains behind the replaceable hand-provider boundary and is not reproduced by this project.

## Implemented in the guided MVP

- Standard 152-tile wall: three numbered suits, Winds, Dragons, eight interchangeable Flowers, and eight Jokers
- East receives 14 tiles; South, West, and North receive 13
- First Charleston right/across/left and unanimous optional second Charleston left/across/right
- One- or two-tile blind-pass spaces on each Charleston's final pass
- Optional matched-count courtesy pass across from zero to three tiles
- Jokers cannot be passed in any Charleston phase
- Every turn keeps 13 total tiles between turns and 14 after a draw or claimed discard
- A called Pung, Kong, Quint, or Sextet is followed by a discard; Kongs do not receive replacement draws
- Every non-discarding player responds to the latest discard before play continues
- Mahjong claims take priority; competing exposure claims resolve to the closest player in turn order
- Calls must create an exact exposed group required by at least one still-viable Training Card hand
- Natural Flowers may be called as an eligible Flower group and may redeem a Joker from a Flower exposure
- On their active turn after drawing or calling, bots and the human may redeem matching natural tiles for Jokers in any exposed hand before discarding
- Discarded Jokers are dead and cannot be called
- The learning table keeps the entire chronological discard pool visible
- A dead-hand notice appears only when discard counts alone make every exposure-compatible Training Card line impossible; opponent racks and opponent exposures are deliberately excluded from that calculation
- Jokers may fill Pungs, Kongs, Quints, and Sextets but never singles or pairs
- Concealed Training Card hands cannot make ordinary exposures
- Mahjong requires exactly 14 physical tiles and an exact Training Card match
- A natural discard may complete any final group, including a single or pair, for Mahjong
- Games end through a valid Mahjong declaration or wall exhaustion
- Bots use the same legality, candidate, calling, Joker, and Mahjong services as the human player
- Public and player-private state projections keep concealed racks hidden

## Beginner-mode policy

The guided game prevents illegal actions before they occur rather than allowing the action and applying a dead-hand penalty. This preserves the underlying rule while making the first game teachable.

## Deliberately outside this MVP

- Physical-table procedures such as dice, wall breaking, tile naming, touching/racking commitment, and misnamed-discard penalties
- Editing the size of a newly made exposure before the caller's discard
- Formal payments, scoring, seat rotation, and multi-game table sessions
- Tournament-specific timing and penalty variations
- The rare all-four-players fully blind Charleston procedure; the guided interface supports one or two blind spaces while requiring at least one chosen tile

These boundaries must remain explicit. They may not be silently approximated in the UI.
