# Persistence Data Model

## Account-owned data

- `profiles`: optional display information keyed to `auth.users`.
- `player_progress`: completed games, assistance level, skill scores, and experience points.
- `game_reviews`: a player's event-derived review for a game they own.
- `learning_events`: append-only product learning signals, optionally tied to an owned game.

Authenticated browser access is limited by explicit grants and row-level-security policies. Every write checks `auth.uid()`; game-linked records also verify ownership of the referenced game.

## Game records

- `games`: lifecycle metadata, owner, card version, and optimistic state version.
- `game_players`: seats, player types, and assistance levels.
- `game_state`: canonical serialized state and version.
- `game_events`: append-only ordered domain events.
- `game_actions`: idempotency receipts with expected and resulting versions.

Canonical state, events, and action receipts have no `anon` or `authenticated` grants. They are reserved for the server-authoritative game service planned for the next milestone.

## Guest migration

The local key `mahjong-room-progress-v1` contains only summarized learning progress. On sign-in, the client reads current server progress, merges each field without lowering prior achievement, writes through the authenticated API, and clears local data only after success.
