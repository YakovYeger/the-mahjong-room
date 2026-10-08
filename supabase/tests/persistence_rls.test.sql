begin;
select plan(18);

select has_schema('private', 'private server-only schema exists');
select has_table('public', 'games', 'public games projection exists');
select has_table('private', 'game_state', 'canonical state moved to private schema');
select has_table('private', 'game_events', 'authoritative events moved to private schema');
select has_table('private', 'game_actions', 'idempotency receipts moved to private schema');
select has_table('public', 'game_public_events', 'sanitized event history exists');
select has_table('public', 'user_entitlements', 'database-owned entitlements exist');
select has_table('public', 'player_notifications', 'turn inbox exists');

select has_index('public', 'games', 'games_active_deadline_idx', 'overdue active games have a partial deadline index');
select has_index('public', 'games', 'games_invite_code_digest_idx', 'invite digests have a partial unique index');
select has_index('public', 'game_players', 'game_players_game_user_lookup_idx', 'membership lookups are indexed');
select has_index('public', 'player_notifications', 'player_notifications_unread_idx', 'unread notifications have a partial index');

select policies_are('public', 'games', array['games_select_member'], 'games are readable only through membership policy');
select policies_are('public', 'game_players', array['game_players_select_member'], 'rosters are readable only by members');
select policies_are('public', 'game_public_events', array['game_public_events_select_member'], 'public events are readable only by members');
select policies_are('public', 'user_entitlements', array['entitlements_select_own'], 'entitlements are readable only by their owner');

select function_privs_are('public', 'resolve_login_identifier', array['text'], 'service_role', array['EXECUTE'], 'only the server role can resolve usernames');
select function_privs_are('public', 'commit_game_action', array['uuid','uuid','uuid','text','integer','text','text','jsonb','jsonb','jsonb','timestamp with time zone','game_status','text','jsonb','integer','jsonb','jsonb'], 'service_role', array['EXECUTE'], 'only the server role can commit canonical actions');

select * from finish();
rollback;
