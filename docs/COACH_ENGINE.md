# Coach Engine

The coach is deterministic and structurally separate from the rules engine. `CoachVisibleContext` contains the player rack, public discards and exposures, wall count, current call window, and ranked Training Card candidates. It deliberately excludes opponent concealed racks and future wall tiles.

Rules answer whether a move is legal. Hand analysis answers which hands are plausible. The coach translates that visible analysis into a timely teaching prompt. It never sees opponent racks or future wall tiles.

Recommendations cover Charleston passes, discards, calls, and draws. Each includes tile IDs, typed reason codes, confidence, a headline, and an explanation. The interface reveals these through three progressive hint levels and records how much help the player requested.

Post-game review is derived from canonical game events plus local coaching statistics. It reports Charleston completion, calls and exposures, joker exchanges, independent discard decisions, hint use, skill estimates, and the suggested assistance level for the next game.
