# Daily puzzle catalog

Today’s puzzle is selected by UTC date. The archive lists dates starting November 8, 2026. Every date has a permanent route and is playable without an account. Answers are stored on the current browser by date; the previous single-answer format is still readable. Continuing into the hand does not alter the main practice save.

The v1 catalog is procedural: a date selects a recipe version, a seed and a fixed Training Card pattern. The generator allocates a legal winning hand, removes a natural tile, adds one nonmatching tile, and deals the remaining physical tiles to the wall and bots. The needed natural tile stays in the wall. There are no nightly jobs or database records. The catalog reconstructs earlier racks, including their original tile order.

Keep the v1 rotation, training pattern definitions, deck order and shuffle stable for published dates. A new generation method should use a new recipe version from a specified date, or add authored entries with an explicit date and fixture. The original launch puzzle is covered by a regression test.

## Table-reading puzzles

Treat these as a separate puzzle type. Show the player's rack, public exposures, discard history, and the relevant card. Never use opponents' concealed tiles to score the answer.

- Easy: ask which tile could complete a specific card group, or which candidate is unavailable because the other copies are visible.
- Medium: show one or two exposed sets and ask which discard most directly helps the compatible card lines. Explain the clues.
- Hard: show multiple plausible lines and players with competing threats. Ask for a safer discard and accept equivalent choices. The explanation should distinguish deductions from risk judgments.

Use authored snapshots to start so that each explanation has a clear reason. Avoid promising a tile is safe merely because it appeared in the discard pool earlier. For questions asking for a single correct answer, prove it from the visible constraints; otherwise score choices by clearly stated assumptions.
