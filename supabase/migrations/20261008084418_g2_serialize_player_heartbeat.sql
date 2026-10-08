create or replace function public.heartbeat_game_player(requested_game_id uuid, requesting_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_game public.games;
  current_player public.game_players;
begin
  select * into locked_game from public.games where id = requested_game_id for update;
  if locked_game.id is null or locked_game.status <> 'active' then
    return jsonb_build_object('accepted', false, 'reason', 'game_not_active');
  end if;

  select * into current_player from public.game_players
  where game_id = requested_game_id and user_id = requesting_user_id for update;
  if current_player.player_key is null or current_player.join_status = 'replaced'
    or current_player.controller_type <> 'human' then
    return jsonb_build_object('accepted', false, 'reason', 'seat_replaced');
  end if;
  if current_player.last_activity_at <= now() - interval '2 minutes' then
    return jsonb_build_object('accepted', false, 'reason', 'grace_expired');
  end if;

  update public.game_players set last_activity_at = now(), join_status = 'joined'
  where game_id = requested_game_id and user_id = requesting_user_id;
  return jsonb_build_object('accepted', true);
end;
$$;

revoke all on function public.heartbeat_game_player(uuid, uuid) from public, anon, authenticated;
grant execute on function public.heartbeat_game_player(uuid, uuid) to service_role;

-- The recovery worker computes a candidate in application code. Lock and
-- recheck the player activity in the same transaction as the action commit,
-- so a heartbeat arriving at the grace boundary wins or loses atomically.
create or replace function public.commit_timeout_action(
  requested_game_id uuid,
  requested_action_id uuid,
  acting_user_id uuid,
  acting_player_key text,
  expected_version integer,
  action_type_value text,
  request_hash_value text,
  next_state jsonb,
  next_public_state jsonb,
  emitted_events jsonb,
  next_deadline timestamptz,
  next_status public.game_status,
  next_phase text,
  response_value jsonb,
  response_status_value integer default 200,
  timeout_player_keys jsonb default '[]'::jsonb,
  replacement_player_keys jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_game public.games;
begin
  select * into locked_game from public.games where id = requested_game_id for update;
  if locked_game.id is null then
    raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND';
  end if;
  if locked_game.state_version <> expected_version then
    return jsonb_build_object('conflict', true, 'status', 409, 'latestVersion', locked_game.state_version);
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(emitted_events, '[]'::jsonb)) event_item
    join public.game_players gp
      on gp.game_id = requested_game_id and gp.player_key = event_item ->> 'playerId'
    where event_item ->> 'type' = 'PLAYER_CONTROL_CHANGED'
      and event_item ->> 'reason' = 'disconnect'
      and gp.last_activity_at > now() - interval '2 minutes'
  ) then
    return jsonb_build_object('conflict', true, 'status', 409, 'latestVersion', locked_game.state_version);
  end if;

  return public.commit_game_action(
    requested_game_id, requested_action_id, acting_user_id, acting_player_key,
    expected_version, action_type_value, request_hash_value, next_state,
    next_public_state, emitted_events, next_deadline, next_status, next_phase,
    response_value, response_status_value, timeout_player_keys, replacement_player_keys
  );
end;
$$;

revoke all on function public.commit_timeout_action(uuid, uuid, uuid, text, integer, text, text, jsonb, jsonb, jsonb, timestamptz, public.game_status, text, jsonb, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_timeout_action(uuid, uuid, uuid, text, integer, text, text, jsonb, jsonb, jsonb, timestamptz, public.game_status, text, jsonb, integer, jsonb, jsonb) to service_role;
