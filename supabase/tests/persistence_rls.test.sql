begin;
select plan(8);

select has_table('public', 'games', 'games table exists');
select has_table('public', 'game_state', 'canonical game state exists');
select has_table('public', 'game_events', 'event history exists');
select has_table('public', 'player_progress', 'player progress exists');
select has_index('public', 'games', 'games_owner_active_idx', 'active games have a partial owner index');
select has_index('public', 'game_events', 'game_events_game_id_sequence_key', 'event sequence is unique per game');
select policies_are('public', 'player_progress', array['player_progress_insert_own', 'player_progress_select_own', 'player_progress_update_own'], 'progress has explicit own-row policies');
select policies_are('public', 'learning_events', array['learning_events_insert_own', 'learning_events_select_own'], 'learning events have explicit own-row policies');

select * from finish();
rollback;
