# Coach engine

The coach is an independent advisory unit under `src/coach`. It uses the player's rack, public discards/exposures, wall count, and card candidates. It excludes opponents' concealed racks and future wall tiles. Solo and multiplayer use visible-data adapters and the same policy/UI.

The exact hand followed in the card companion drives the coach. With no pin, the coach proposes a compatible current-fit direction, filtering proven natural-only shortages. A blocked/conflicting pin remains selected and pauses tile suggestions until the player explicitly changes direction.

`createCoachSession(context, decision, passCount)` returns an inspectable hand plan and recommendation. Group evidence includes current allocation, missing tiles, natural/Joker constraints, and unseen natural-copy bounds. Discard/Charleston advice reallocates after hypothetical removals and reports actual fit loss. Calls are checked against the target definition and simulated locked exposure. Valid Mahjong takes priority. Waiting and Charleston continuation suggest no tile action; blind/courtesy passes have separate policies.

`useCoach` manages the shared pin, memoized session, highlight visibility, and per-decision group focus. `CoachPanel` renders next-step guidance, hand comparison, and expandable reasons; it has no game-action/backend access. `getCoachHighlights` yields exclusive rack roles plus card-group and public-tile focus IDs. The table still owns selection and submits every move through existing rules/Supabase.

Post-game review remains event/stat-derived and has heuristic skill scores. Richer evidence-based review, exchange advice, calibrated table pressure, and assistance modes are future increments. See [the detailed audit, design, architecture, and roadmap](COACH_AUDIT_AND_DESIGN.md).
