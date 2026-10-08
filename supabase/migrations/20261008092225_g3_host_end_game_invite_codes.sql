create table private.game_invite_codes (
  game_id uuid primary key references public.games(id) on delete cascade,
  invite_code text not null,
  created_at timestamptz not null default now()
);

revoke all on table private.game_invite_codes from public, anon, authenticated;
grant all on table private.game_invite_codes to service_role;

create or replace function public.create_game_room(
  owner_user_id uuid,
  owner_player_key text,
  owner_display_name text,
  game_mode_value public.game_mode,
  turn_seconds_value integer,
  response_seconds_value integer,
  invite_code_value text,
  invite_expires_value timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_game public.games;
begin
  perform pg_advisory_xact_lock(hashtextextended(owner_user_id::text, 0));
  perform private.assert_active_game_capacity(owner_user_id);
  insert into public.games (
    owner_id, status, phase, mode, turn_seconds, response_seconds,
    invite_code_digest, invite_expires_at, training_card_version
  ) values (
    owner_user_id, 'lobby', 'charleston', game_mode_value, turn_seconds_value, response_seconds_value,
    encode(extensions.digest(upper(invite_code_value), 'sha256'), 'hex'), invite_expires_value, 'original-training-card-v1'
  ) returning * into created_game;

  insert into private.game_invite_codes (game_id, invite_code)
  values (created_game.id, upper(invite_code_value));

  insert into public.game_players (
    game_id, user_id, player_key, seat, controller_type, assistance_level, display_name
  ) values (
    created_game.id, owner_user_id, owner_player_key, 'east', 'human', 0, owner_display_name
  );
  return to_jsonb(created_game) || jsonb_build_object('invite_code', upper(invite_code_value));
end;
$$;

revoke all on function public.create_game_room(uuid, text, text, public.game_mode, integer, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_game_room(uuid, text, text, public.game_mode, integer, integer, text, timestamptz) to service_role;

create or replace function public.load_canonical_game(requested_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'game', to_jsonb(g) || jsonb_build_object(
      'invite_code', (select codes.invite_code from private.game_invite_codes codes where codes.game_id = g.id)
    ),
    'players', coalesce((select jsonb_agg(to_jsonb(gp) order by case gp.seat when 'east' then 1 when 'south' then 2 when 'west' then 3 else 4 end) from public.game_players gp where gp.game_id = g.id), '[]'::jsonb),
    'state', gs.state_json
  )
  from public.games g
  left join private.game_state gs on gs.game_id = g.id
  where g.id = requested_game_id;
$$;

revoke all on function public.load_canonical_game(uuid) from public, anon, authenticated;
grant execute on function public.load_canonical_game(uuid) to service_role;

create or replace function public.start_game_room(
  requested_game_id uuid,
  requesting_user_id uuid,
  roster jsonb,
  initial_state jsonb,
  initial_public_state jsonb,
  initial_deadline timestamptz,
  seed_reference uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_game public.games;
  roster_player jsonb;
  started_game jsonb;
begin
  select * into locked_game from public.games where id = requested_game_id for update;
  if locked_game.id is null then raise exception using errcode = 'P0002', message = 'GAME_NOT_FOUND'; end if;
  if locked_game.owner_id <> requesting_user_id then raise exception using errcode = '42501', message = 'HOST_REQUIRED'; end if;
  if locked_game.status <> 'lobby' then raise exception using errcode = 'P0001', message = 'GAME_ALREADY_STARTED'; end if;

  for roster_player in select value from jsonb_array_elements(roster) loop
    insert into public.game_players (
      game_id, user_id, player_key, seat, controller_type, assistance_level, display_name
    ) values (
      requested_game_id,
      nullif(roster_player ->> 'userId', '')::uuid,
      roster_player ->> 'playerKey',
      roster_player ->> 'seat',
      (roster_player ->> 'controllerType')::public.controller_type,
      coalesce((roster_player ->> 'assistanceLevel')::smallint, 4),
      roster_player ->> 'displayName'
    )
    on conflict (game_id, player_key) do update set
      controller_type = excluded.controller_type,
      display_name = excluded.display_name,
      assistance_level = excluded.assistance_level;
  end loop;

  insert into private.game_state (game_id, state_json, state_version, seed_ref, updated_by)
  values (requested_game_id, initial_state, (initial_state ->> 'stateVersion')::integer, seed_reference, requesting_user_id);

  insert into private.game_events (game_id, sequence, event_type, payload, actor_player_key, is_public)
  select requested_game_id, (event ->> 'sequence')::integer, event ->> 'type', event - 'sequence' - 'type', null, true
  from jsonb_array_elements(initial_state -> 'events') event;

  insert into public.game_public_events (game_id, sequence, event_type, payload)
  select requested_game_id, (event ->> 'sequence')::integer, event ->> 'type', '{}'::jsonb
  from jsonb_array_elements(initial_state -> 'events') event;

  update public.games g set
    status = 'active',
    phase = initial_state ->> 'phase',
    state_version = (initial_state ->> 'stateVersion')::integer,
    event_sequence = (initial_state ->> 'eventSequence')::integer,
    public_state = initial_public_state,
    deadline_at = initial_deadline,
    secure_seed_ref = seed_reference,
    started_at = now(),
    invite_expires_at = null,
    updated_at = now()
  where g.id = requested_game_id
  returning to_jsonb(g) into started_game;
  return started_game;
end;
$$;

revoke all on function public.start_game_room(uuid, uuid, jsonb, jsonb, jsonb, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.start_game_room(uuid, uuid, jsonb, jsonb, jsonb, timestamptz, uuid) to service_role;

create or replace function private.clear_closed_game_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('completed', 'abandoned') then
    delete from private.game_invite_codes where game_id = new.id;
    new.invite_code_digest := null;
    new.invite_expires_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.clear_closed_game_invite() from public, anon, authenticated;

create trigger games_clear_closed_invite_before_update
before update of status on public.games
for each row
when (new.status in ('completed', 'abandoned') and new.status is distinct from old.status)
execute function private.clear_closed_game_invite();
