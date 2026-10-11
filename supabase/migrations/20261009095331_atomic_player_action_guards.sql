-- Validate human actions under the same room lock used by pause, heartbeat, and timeout handling.
create or replace function public.commit_player_action(
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
security invoker
set search_path = ''
as $$
declare
  receipt jsonb;
  locked_game public.games;
  locked_player public.game_players;
  checked_at timestamptz;
begin
  receipt := public.get_game_action_receipt(requested_game_id, requested_action_id, acting_user_id, request_hash_value);
  if receipt is not null then return receipt; end if;
  select * into locked_game from public.games where id = requested_game_id for update;
  if locked_game.id is null then raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND'; end if;
  -- Recheck after acquiring the room lock: another caller may have committed.
  receipt := public.get_game_action_receipt(requested_game_id, requested_action_id, acting_user_id, request_hash_value);
  if receipt is not null then return receipt; end if;
  if locked_game.state_version <> expected_version then
    return jsonb_build_object('conflict', true, 'status', 409, 'latestVersion', locked_game.state_version);
  end if;
  if locked_game.status <> 'active' then raise exception using errcode = 'P0001', message = 'GAME_NOT_ACTIVE'; end if;
  select * into locked_player from public.game_players
    where game_id = requested_game_id and user_id = acting_user_id and player_key = acting_player_key for update;
  if locked_player.player_key is null then raise exception using errcode = '42501', message = 'NOT_A_PARTICIPANT'; end if;
  if locked_player.controller_type <> 'human' or locked_player.join_status = 'replaced' then
    raise exception using errcode = '42501', message = 'SEAT_CONTROLLED_BY_BOT';
  end if;
  checked_at := clock_timestamp();
  if locked_player.last_activity_at <= checked_at - interval '2 minutes' then
    raise exception using errcode = 'P0001', message = 'GRACE_EXPIRED';
  end if;
  if locked_game.phase <> 'charleston' and locked_game.deadline_at <= checked_at then
    raise exception using errcode = 'P0001', message = 'DEADLINE_EXPIRED';
  end if;
  return public.commit_game_action(
    requested_game_id, requested_action_id, acting_user_id, acting_player_key,
    expected_version, action_type_value, request_hash_value, next_state,
    next_public_state, emitted_events, next_deadline, next_status, next_phase,
    response_value, response_status_value, timeout_player_keys, replacement_player_keys
  );
end;
$$;
revoke all on function public.commit_player_action(uuid,uuid,uuid,text,integer,text,text,jsonb,jsonb,jsonb,timestamptz,public.game_status,text,jsonb,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.commit_player_action(uuid,uuid,uuid,text,integer,text,text,jsonb,jsonb,jsonb,timestamptz,public.game_status,text,jsonb,integer,jsonb,jsonb) to service_role;

-- Resuming the cooperative Charleston must not start a turn clock.
create or replace function public.cast_pause_vote(
  requested_game_id uuid,
  voting_user_id uuid,
  requested_vote text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_game public.games;
  human_count integer;
  matching_count integer;
  remaining_seconds integer;
begin
  if requested_vote not in ('pause', 'resume') then raise exception using errcode = '23514', message = 'INVALID_PAUSE_VOTE'; end if;
  select * into locked_game from public.games where id = requested_game_id for update;
  if locked_game.id is null then raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND'; end if;
  if locked_game.mode = 'async' then raise exception using errcode = 'P0001', message = 'ASYNC_CANNOT_PAUSE'; end if;
  if not private.is_game_member(requested_game_id, voting_user_id) then raise exception using errcode = '42501', message = 'NOT_A_PARTICIPANT'; end if;
  if (requested_vote = 'pause' and locked_game.status <> 'active') or (requested_vote = 'resume' and locked_game.status <> 'paused') then
    raise exception using errcode = 'P0001', message = 'INVALID_PAUSE_STATE';
  end if;

  if not exists (select 1 from public.game_players where game_id = requested_game_id and user_id = voting_user_id and controller_type = 'human' and join_status <> 'replaced') then
    raise exception using errcode = '42501', message = 'SEAT_CONTROLLED_BY_BOT';
  end if;

  insert into public.game_pause_votes (game_id, user_id, vote)
  values (requested_game_id, voting_user_id, requested_vote)
  on conflict (game_id, user_id) do update set vote = excluded.vote, created_at = now();

  select count(*)::integer into human_count from public.game_players
  where game_id = requested_game_id and controller_type = 'human' and join_status <> 'replaced';
  select count(*)::integer into matching_count from public.game_pause_votes votes
  join public.game_players players on players.game_id = votes.game_id and players.user_id = votes.user_id
  where votes.game_id = requested_game_id and votes.vote = requested_vote
    and players.controller_type = 'human' and players.join_status <> 'replaced';

  if matching_count >= human_count then
    if requested_vote = 'pause' then
      remaining_seconds := greatest(0, ceil(extract(epoch from (locked_game.deadline_at - now())))::integer);
      update public.games set status = 'paused', paused_remaining_seconds = remaining_seconds, deadline_at = null, updated_at = now()
      where id = requested_game_id returning * into locked_game;
    else
      update public.games set status = 'active', deadline_at = case when locked_game.phase = 'charleston' then null else now() + make_interval(secs => coalesce(paused_remaining_seconds, turn_seconds)) end,
        paused_remaining_seconds = null, updated_at = now()
      where id = requested_game_id returning * into locked_game;
    end if;
    delete from public.game_pause_votes where game_id = requested_game_id;
  end if;
  return jsonb_build_object('game', to_jsonb(locked_game), 'votes', matching_count, 'required', human_count);
end;
$$;

revoke all on function public.cast_pause_vote(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cast_pause_vote(uuid, uuid, text) to service_role;


-- Automatic work must also respect a pause that happened after candidate computation.
create or replace function public.commit_game_action(
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
  prior_receipt private.game_actions;
  event_item jsonb;
  resulting_version integer := (next_state ->> 'stateVersion')::integer;
  resulting_sequence integer := (next_state ->> 'eventSequence')::integer;
begin
  select * into prior_receipt from private.game_actions where action_id = requested_action_id;
  if prior_receipt.action_id is not null then
    if prior_receipt.game_id <> requested_game_id or prior_receipt.request_hash is distinct from request_hash_value then
      raise exception using errcode = '23505', message = 'ACTION_ID_REUSED';
    end if;
    return jsonb_build_object('duplicate', true, 'status', prior_receipt.response_status, 'response', prior_receipt.response_json);
  end if;

  select * into locked_game from public.games where id = requested_game_id for update;
  if locked_game.id is null then raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND'; end if;
  select * into prior_receipt from private.game_actions where action_id = requested_action_id;
  if prior_receipt.action_id is not null then
    if prior_receipt.game_id <> requested_game_id or prior_receipt.request_hash is distinct from request_hash_value then
      raise exception using errcode = '23505', message = 'ACTION_ID_REUSED';
    end if;
    return jsonb_build_object('duplicate', true, 'status', prior_receipt.response_status, 'response', prior_receipt.response_json);
  end if;
  if action_type_value = 'BOT_RECOVERY' and locked_game.status <> 'active' then
    return jsonb_build_object('conflict', true, 'status', 409, 'latestVersion', locked_game.state_version);
  end if;
  if locked_game.state_version <> expected_version then
    return jsonb_build_object('conflict', true, 'status', 409, 'latestVersion', locked_game.state_version);
  end if;
  if resulting_version <= expected_version then raise exception using errcode = '23514', message = 'STATE_VERSION_NOT_ADVANCED'; end if;

  insert into private.game_actions (
    action_id, game_id, user_id, player_key, action_type, expected_state_version,
    resulting_state_version, request_hash, response_json, response_status, completed_at
  ) values (
    requested_action_id, requested_game_id, acting_user_id, acting_player_key, action_type_value, expected_version,
    resulting_version, request_hash_value, response_value, response_status_value, now()
  );

  update private.game_state set
    state_json = next_state,
    state_version = resulting_version,
    updated_by = acting_user_id,
    updated_at = now()
  where game_id = requested_game_id;

  for event_item in select value from jsonb_array_elements(coalesce(emitted_events, '[]'::jsonb)) loop
    insert into private.game_events (game_id, sequence, event_type, payload, actor_player_key, is_public)
    values (
      requested_game_id,
      (event_item ->> 'sequence')::integer,
      event_item ->> 'type',
      event_item - 'sequence' - 'type',
      acting_player_key,
      true
    );
    insert into public.game_public_events (game_id, sequence, event_type, payload)
    values (
      requested_game_id,
      (event_item ->> 'sequence')::integer,
      event_item ->> 'type',
      case
        when event_item ->> 'type' in ('TILE_DRAWN', 'TILES_PASSED')
          then event_item - 'sequence' - 'type' - 'tileId' - 'tileIds'
        else event_item - 'sequence' - 'type' - 'tileIds'
      end
    );
  end loop;

  update public.games set
    state_version = resulting_version,
    event_sequence = resulting_sequence,
    public_state = next_public_state,
    deadline_at = next_deadline,
    status = next_status,
    phase = next_phase,
    completed_at = case when next_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
    timeout_claim_token = null,
    timeout_claimed_until = null,
    updated_at = now()
  where id = requested_game_id;

  if acting_user_id is not null then
    update public.game_players set timeout_count = 0, last_activity_at = now()
    where game_id = requested_game_id and user_id = acting_user_id and controller_type = 'human';
  else
    update public.game_players gp set
      timeout_count = least(3, gp.timeout_count + 1),
      controller_type = case when replacement_player_keys ? gp.player_key then 'bot'::public.controller_type else gp.controller_type end,
      join_status = case when replacement_player_keys ? gp.player_key then 'replaced'::public.join_status else gp.join_status end,
      replaced_at = case when replacement_player_keys ? gp.player_key then now() else gp.replaced_at end,
      last_activity_at = now()
    where gp.game_id = requested_game_id
      and timeout_player_keys ? gp.player_key;
  end if;

  return jsonb_build_object('duplicate', false, 'status', response_status_value, 'response', response_value);
end;
$$;
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
  if locked_game.status <> 'active' then
    return jsonb_build_object('conflict', true, 'status', 409, 'latestVersion', locked_game.state_version);
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

-- One network round trip loads both the candidate state and its exact receipt.
create or replace function public.load_player_action_context(requested_game_id uuid, requested_action_id uuid, requesting_user_id uuid, request_hash_value text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare canonical jsonb;
begin
  canonical := public.load_canonical_game(requested_game_id);
  if canonical is null then raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND'; end if;
  if not exists (select 1 from jsonb_array_elements(canonical -> 'players') player where player ->> 'user_id' = requesting_user_id::text) then
    raise exception using errcode = '42501', message = 'NOT_A_PARTICIPANT';
  end if;
  return jsonb_build_object('record', canonical, 'receipt', public.get_game_action_receipt(requested_game_id,requested_action_id,requesting_user_id,request_hash_value));
end;
$$;
revoke all on function public.load_player_action_context(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.load_player_action_context(uuid,uuid,uuid,text) to service_role;
