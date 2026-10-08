# Persistence Data Model

## Account-owned data

- `profiles`: normalized unique public username, display name, and avatar keyed to `auth.users`.
- `plans` / `user_entitlements`: database-owned Free, Plus, and Club active-game limits.
- `player_progress`: completed games, assistance level, skill scores, and experience points.
- `game_reviews`: a player's event-derived review for a game they own.
- `learning_events`: append-only product learning signals, optionally tied to an owned game.

Authenticated browser access is limited by explicit grants and row-level-security policies. Entitlements are never accepted from editable user metadata or trusted from stale JWT claims.

## Game records

- `games`: lifecycle, mode, timers, owner, sanitized projection, version, deadline, and invite digest.
- `game_players`: fixed seats, user membership, controller, assistance, timeout count, and replacement state.
- `private.game_state`: canonical serialized state, seed reference, and version.
- `private.game_events`: append-only authoritative history.
- `private.game_actions`: idempotency receipts with request hash, expected/resulting versions, and original response.
- `game_public_events`: sanitized animation and reconnect history.
- `game_pause_votes`: one current live-table vote per human.
- `player_notifications`: in-app turn inbox and email-delivery state.
- `private.account_login_identifiers`: protected username-to-email resolver used only by the login service.
- `private.rate_limits`: fixed-window server rate-limit buckets.

Canonical state, events, action receipts, login identifiers, and rate limits have no browser grants. Public game records are readable only through indexed membership checks; another participant's rack is never stored in a public projection.

## Guest migration

The local key `mahjong-room-progress-v1` contains only summarized learning progress. On sign-in, the client reads current server progress, merges each field without lowering prior achievement, writes through the authenticated API, and clears local data only after success.
