# Coach Engine

The MVP coach is deterministic. It ranks original Training Card hands from the player-visible rack, identifies tiles contributing to the leading candidate, and reveals help progressively.

Rules answer whether a move is legal. Hand analysis answers which hands are plausible. The coach translates that visible analysis into a timely teaching prompt. It never sees opponent racks or future wall tiles.

The next milestone should extract explanation reason codes and track which hint level each player needed.
