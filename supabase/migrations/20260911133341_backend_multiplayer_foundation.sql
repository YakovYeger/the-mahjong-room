create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant usage on schema private to authenticated;

alter table public.game_state set schema private;
alter table public.game_events set schema private;
alter table public.game_actions set schema private;

create type public.game_mode as enum ('live', 'async');
create type public.game_status as enum ('lobby', 'active', 'paused', 'completed', 'abandoned');
create type public.controller_type as enum ('human', 'bot');
create type public.join_status as enum ('joined', 'disconnected', 'replaced');

create or replace function private.normalize_username(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(normalize(trim(value), NFKC));
$$;

alter table public.profiles
  add column username text,
  add column avatar_url text,
  add constraint profiles_username_format check (
    username is null
    or (
      username = private.normalize_username(username)
      and char_length(username) between 3 and 24
      and username ~ '^[a-z0-9_]+$'
    )
  );

create unique index profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

create table private.account_login_identifiers (
  identifier text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index account_login_identifiers_user_idx
  on private.account_login_identifiers (user_id);

create table public.plans (
  id text primary key,
  name text not null,
  active_game_limit integer not null check (active_game_limit > 0),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plans (id, name, active_game_limit, sort_order)
values ('free', 'Free', 1, 1), ('plus', 'Plus', 5, 2), ('club', 'Club', 20, 3)
on conflict (id) do update set
  name = excluded.name,
  active_game_limit = excluded.active_game_limit,
  sort_order = excluded.sort_order,
  updated_at = now();

create table public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free' references public.plans(id),
  source text not null default 'system' check (source in ('system', 'admin', 'billing', 'promotion')),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index public.games_owner_active_idx;
alter table public.games drop constraint games_status_check;
alter table public.games alter column status drop default;
alter table public.games alter column status type public.game_status using status::public.game_status;
alter table public.games alter column status set default 'lobby'::public.game_status;
alter table public.games drop constraint games_state_version_check;
alter table public.games alter column state_version set default 0;
alter table public.games add constraint games_state_version_check check (state_version >= 0);
alter table public.games
  add column mode public.game_mode not null default 'live',
  add column event_sequence integer not null default 0 check (event_sequence >= 0),
  add column turn_seconds integer not null default 60 check (turn_seconds between 15 and 604800),
  add column response_seconds integer not null default 15 check (response_seconds between 5 and 86400),
  add column deadline_at timestamptz,
  add column paused_remaining_seconds integer check (paused_remaining_seconds is null or paused_remaining_seconds >= 0),
  add column public_state jsonb not null default '{}'::jsonb,
  add column invite_code_digest text,
  add column invite_expires_at timestamptz,
  add column secure_seed_ref uuid,
  add column started_at timestamptz,
  add column timeout_claim_token uuid,
  add column timeout_claimed_until timestamptz;

create index games_active_deadline_idx on public.games (deadline_at, id)
  where status = 'active' and deadline_at is not null;
create index games_timeout_claim_idx on public.games (timeout_claimed_until, deadline_at)
  where status = 'active' and deadline_at is not null;
create unique index games_invite_code_digest_idx on public.games (invite_code_digest)
  where invite_code_digest is not null;

alter table public.game_players rename column player_type to controller_type;
alter table public.game_players drop constraint game_players_player_type_check;
alter table public.game_players alter column controller_type type public.controller_type using controller_type::public.controller_type;
alter table public.game_players
  add column join_status public.join_status not null default 'joined',
  add column timeout_count smallint not null default 0 check (timeout_count between 0 and 3),
  add column replaced_at timestamptz,
  add column last_activity_at timestamptz not null default now(),
  add column display_name text not null default 'Player';

create unique index game_players_user_game_unique_idx
  on public.game_players (user_id, game_id)
  where user_id is not null;
create index game_players_game_user_lookup_idx
  on public.game_players (game_id, user_id)
  where user_id is not null;
create index game_players_active_user_idx
  on public.game_players (user_id, game_id)
  where user_id is not null and controller_type = 'human' and join_status <> 'replaced';

alter table private.game_state
  add column seed_ref uuid,
  add column updated_by uuid references auth.users(id) on delete set null;

alter table private.game_events
  add column actor_player_key text,
  add column is_public boolean not null default false;

alter table private.game_actions rename column player_id to user_id;
alter table private.game_actions
  add column player_key text,
  add column request_hash text,
  add column response_json jsonb,
  add column response_status integer,
  add column completed_at timestamptz;
alter table private.game_actions alter column action_type drop not null;

create table public.game_public_events (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (game_id, sequence)
);

create index game_public_events_game_sequence_idx
  on public.game_public_events (game_id, sequence desc);

create table public.game_pause_votes (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('pause', 'resume')),
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index game_pause_votes_game_idx on public.game_pause_votes (game_id);

create table public.player_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  kind text not null check (kind in ('turn_started', 'seat_replaced', 'game_completed')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  email_status text not null default 'not_requested' check (email_status in ('not_requested', 'pending', 'sent', 'failed')),
  email_attempted_at timestamptz,
  created_at timestamptz not null default now()
);

create index player_notifications_unread_idx
  on public.player_notifications (user_id, created_at desc)
  where read_at is null;
create index player_notifications_email_pending_idx
  on public.player_notifications (created_at)
  where email_status = 'pending';

create table private.rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (bucket, subject_hash, window_started_at)
);

create index rate_limits_expiry_idx on private.rate_limits (window_started_at);

create table private.operational_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  game_id uuid references public.games(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  state_version integer,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index operational_events_type_created_idx on private.operational_events (event_type, created_at desc);
create index operational_events_game_created_idx on private.operational_events (game_id, created_at desc) where game_id is not null;

create or replace function private.is_game_member(check_game_id uuid, check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_players gp
    where gp.game_id = check_game_id
      and gp.user_id = check_user_id
  );
$$;

revoke all on function private.is_game_member(uuid, uuid) from public, anon;
grant execute on function private.is_game_member(uuid, uuid) to authenticated, service_role;

create or replace function private.game_id_from_topic(topic_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when topic_value ~ '^game:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then split_part(topic_value, ':', 2)::uuid
    else null
  end;
$$;

revoke all on function private.game_id_from_topic(text) from public, anon;
grant execute on function private.game_id_from_topic(text) to authenticated, service_role;

create or replace function private.active_game_limit(check_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.active_game_limit, 1)
  from public.user_entitlements ue
  join public.plans p on p.id = ue.plan_id
  where ue.user_id = check_user_id
    and (ue.valid_until is null or ue.valid_until > now());
$$;

create or replace function private.active_game_count(check_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct gp.game_id)::integer
  from public.game_players gp
  join public.games g on g.id = gp.game_id
  where gp.user_id = check_user_id
    and gp.controller_type = 'human'
    and gp.join_status <> 'replaced'
    and g.status in ('lobby', 'active', 'paused');
$$;

create or replace function private.assert_active_game_capacity(check_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.active_game_count(check_user_id) >= coalesce(private.active_game_limit(check_user_id), 1) then
    raise exception using errcode = 'P0001', message = 'ACTIVE_GAME_LIMIT_REACHED';
  end if;
end;
$$;

revoke all on function private.active_game_limit(uuid), private.active_game_count(uuid), private.assert_active_game_capacity(uuid) from public, anon, authenticated;
grant execute on function private.active_game_limit(uuid), private.active_game_count(uuid), private.assert_active_game_capacity(uuid) to service_role;

create or replace function private.sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  normalized_username text;
begin
  requested_username := nullif(new.raw_user_meta_data ->> 'username', '');
  normalized_username := case when requested_username is null then null else private.normalize_username(requested_username) end;

  if normalized_username is not null and (
    char_length(normalized_username) not between 3 and 24
    or normalized_username !~ '^[a-z0-9_]+$'
  ) then
    raise exception using errcode = '23514', message = 'INVALID_USERNAME';
  end if;

  insert into public.profiles (user_id, username, display_name, avatar_url)
  values (
    new.id,
    normalized_username,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), normalized_username),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (user_id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  insert into public.user_entitlements (user_id, plan_id, source)
  values (new.id, 'free', 'system')
  on conflict (user_id) do nothing;

  if new.email is not null then
    insert into private.account_login_identifiers (identifier, user_id, email)
    values (coalesce(normalized_username, lower(new.email)), new.id, lower(new.email))
    on conflict (user_id) do update set
      email = excluded.email,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_synced on auth.users;
create trigger on_auth_user_synced
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function private.sync_auth_user();

create or replace function public.claim_username(requested_username text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_username text := private.normalize_username(requested_username);
  result public.profiles;
  login_email text;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if char_length(normalized_username) not between 3 and 24 or normalized_username !~ '^[a-z0-9_]+$' then
    raise exception using errcode = '23514', message = 'INVALID_USERNAME';
  end if;

  update public.profiles
  set username = normalized_username,
      display_name = coalesce(display_name, normalized_username),
      updated_at = now()
  where user_id = current_user_id and username is null
  returning * into result;

  if result.user_id is null then
    select * into result from public.profiles where user_id = current_user_id;
    if result.username is distinct from normalized_username then
      raise exception using errcode = '23505', message = 'USERNAME_ALREADY_SET';
    end if;
  end if;

  select lower(email) into login_email from auth.users where id = current_user_id;
  insert into private.account_login_identifiers (identifier, user_id, email)
  values (normalized_username, current_user_id, login_email)
  on conflict (user_id) do update set identifier = excluded.identifier, email = excluded.email, updated_at = now();
  return result;
end;
$$;

revoke all on function public.claim_username(text) from public, anon;
grant execute on function public.claim_username(text) to authenticated;

create or replace function public.resolve_login_identifier(identifier_value text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ali.email
  from private.account_login_identifiers ali
  where ali.identifier = private.normalize_username(identifier_value)
  limit 1;
$$;

revoke all on function public.resolve_login_identifier(text) from public, anon, authenticated;
grant execute on function public.resolve_login_identifier(text) to service_role;

create or replace function public.consume_rate_limit(
  bucket_value text,
  subject_value text,
  limit_value integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  next_count integer;
begin
  if limit_value < 1 or window_seconds < 1 then return false; end if;
  insert into private.rate_limits (bucket, subject_hash, window_started_at, request_count)
  values (bucket_value, encode(extensions.digest(subject_value, 'sha256'), 'hex'), window_start, 1)
  on conflict (bucket, subject_hash, window_started_at) do update
    set request_count = private.rate_limits.request_count + 1
  returning request_count into next_count;
  return next_count <= limit_value;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

create or replace function public.record_operational_event(
  event_type_value text,
  game_id_value uuid default null,
  user_id_value uuid default null,
  state_version_value integer default null,
  duration_ms_value integer default null,
  metadata_value jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.operational_events (event_type, game_id, user_id, state_version, duration_ms, metadata)
  values (event_type_value, game_id_value, user_id_value, state_version_value, duration_ms_value, metadata_value);
$$;

revoke all on function public.record_operational_event(text, uuid, uuid, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.record_operational_event(text, uuid, uuid, integer, integer, jsonb) to service_role;

create or replace function public.load_canonical_game(requested_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'game', to_jsonb(g),
    'players', coalesce((select jsonb_agg(to_jsonb(gp) order by case gp.seat when 'east' then 1 when 'south' then 2 when 'west' then 3 else 4 end) from public.game_players gp where gp.game_id = g.id), '[]'::jsonb),
    'state', gs.state_json
  )
  from public.games g
  left join private.game_state gs on gs.game_id = g.id
  where g.id = requested_game_id;
$$;

revoke all on function public.load_canonical_game(uuid) from public, anon, authenticated;
grant execute on function public.load_canonical_game(uuid) to service_role;

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

  insert into public.game_players (
    game_id, user_id, player_key, seat, controller_type, assistance_level, display_name
  ) values (
    created_game.id, owner_user_id, owner_player_key, 'east', 'human', 0, owner_display_name
  );
  return to_jsonb(created_game);
end;
$$;

revoke all on function public.create_game_room(uuid, text, text, public.game_mode, integer, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_game_room(uuid, text, text, public.game_mode, integer, integer, text, timestamptz) to service_role;

create or replace function public.join_game_room(
  joining_user_id uuid,
  joining_player_key text,
  joining_display_name text,
  invite_code_value text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_game public.games;
  open_seat text;
begin
  select * into target_game
  from public.games
  where invite_code_digest = encode(extensions.digest(upper(invite_code_value), 'sha256'), 'hex')
  for update;
  if target_game.id is null or target_game.invite_expires_at <= now() then
    raise exception using errcode = 'P0002', message = 'INVITE_NOT_FOUND';
  end if;
  if target_game.status <> 'lobby' then raise exception using errcode = 'P0001', message = 'SEATS_LOCKED'; end if;
  if exists (select 1 from public.game_players where game_id = target_game.id and user_id = joining_user_id) then
    return to_jsonb(target_game);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(joining_user_id::text, 0));
  perform private.assert_active_game_capacity(joining_user_id);
  select candidate.seat into open_seat
  from (values ('south', 2), ('west', 3), ('north', 4)) candidate(seat, ordinal)
  where not exists (
    select 1 from public.game_players gp
    where gp.game_id = target_game.id and gp.seat::text = candidate.seat
  )
  order by candidate.ordinal
  limit 1;
  if open_seat is null then raise exception using errcode = 'P0001', message = 'ROOM_FULL'; end if;

  insert into public.game_players (
    game_id, user_id, player_key, seat, controller_type, assistance_level, display_name
  ) values (
    target_game.id, joining_user_id, joining_player_key, open_seat, 'human', 0, joining_display_name
  );
  return to_jsonb(target_game);
end;
$$;

revoke all on function public.join_game_room(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.join_game_room(uuid, text, text, text) to service_role;

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
    invite_code_digest = null,
    invite_expires_at = null,
    updated_at = now()
  where g.id = requested_game_id
  returning to_jsonb(g) into started_game;
  return started_game;
end;
$$;

revoke all on function public.start_game_room(uuid, uuid, jsonb, jsonb, jsonb, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.start_game_room(uuid, uuid, jsonb, jsonb, jsonb, timestamptz, uuid) to service_role;

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

revoke all on function public.commit_game_action(uuid, uuid, uuid, text, integer, text, text, jsonb, jsonb, jsonb, timestamptz, public.game_status, text, jsonb, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_game_action(uuid, uuid, uuid, text, integer, text, text, jsonb, jsonb, jsonb, timestamptz, public.game_status, text, jsonb, integer, jsonb, jsonb) to service_role;

create or replace function public.claim_overdue_games(worker_token uuid, batch_size integer default 25)
returns table (game_id uuid, state_version integer)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select g.id
    from public.games g
    where g.status = 'active'
      and g.deadline_at <= now()
      and (g.timeout_claimed_until is null or g.timeout_claimed_until < now())
    order by g.deadline_at
    for update skip locked
    limit greatest(1, least(batch_size, 100))
  ), claimed as (
    update public.games g
    set timeout_claim_token = worker_token,
        timeout_claimed_until = now() + interval '45 seconds'
    from due
    where g.id = due.id
    returning g.id, g.state_version
  )
  select claimed.id, claimed.state_version from claimed;
$$;

revoke all on function public.claim_overdue_games(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_overdue_games(uuid, integer) to service_role;

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

  insert into public.game_pause_votes (game_id, user_id, vote)
  values (requested_game_id, voting_user_id, requested_vote)
  on conflict (game_id, user_id) do update set vote = excluded.vote, created_at = now();

  select count(*)::integer into human_count from public.game_players
  where game_id = requested_game_id and controller_type = 'human' and join_status <> 'replaced';
  select count(*)::integer into matching_count from public.game_pause_votes
  where game_id = requested_game_id and vote = requested_vote;

  if matching_count >= human_count then
    if requested_vote = 'pause' then
      remaining_seconds := greatest(0, ceil(extract(epoch from (locked_game.deadline_at - now())))::integer);
      update public.games set status = 'paused', paused_remaining_seconds = remaining_seconds, deadline_at = null, updated_at = now()
      where id = requested_game_id returning * into locked_game;
    else
      update public.games set status = 'active', deadline_at = now() + make_interval(secs => coalesce(paused_remaining_seconds, turn_seconds)),
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

create or replace function private.broadcast_game_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state_version is distinct from old.state_version
    or new.status is distinct from old.status
    or new.deadline_at is distinct from old.deadline_at then
    perform realtime.send(
      jsonb_build_object(
        'gameId', new.id,
        'stateVersion', new.state_version,
        'eventSequence', new.event_sequence,
        'deadlineAt', new.deadline_at
      ),
      'game.updated',
      'game:' || new.id::text,
      true
    );
  end if;
  return new;
end;
$$;

create trigger games_broadcast_after_commit
after update of state_version, status, deadline_at on public.games
for each row execute function private.broadcast_game_update();

create or replace function private.invoke_turn_timeout_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  endpoint_url text;
  worker_secret text;
begin
  select decrypted_secret into endpoint_url from vault.decrypted_secrets where name = 'mahjong_turn_timeout_url' limit 1;
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'mahjong_turn_timeout_secret' limit 1;
  if endpoint_url is null or worker_secret is null then return; end if;
  perform net.http_post(
    url := endpoint_url,
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || worker_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
end;
$$;

revoke all on function private.invoke_turn_timeout_worker() from public, anon, authenticated;
grant execute on function private.invoke_turn_timeout_worker() to service_role;

select cron.schedule(
  'mahjong-turn-timeouts',
  '10 seconds',
  'select private.invoke_turn_timeout_worker()'
);

insert into public.user_entitlements (user_id, plan_id, source)
select id, 'free', 'system' from auth.users
on conflict (user_id) do nothing;

insert into public.profiles (user_id, display_name, avatar_url)
select id,
  coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), nullif(raw_user_meta_data ->> 'full_name', '')),
  nullif(raw_user_meta_data ->> 'avatar_url', '')
from auth.users
on conflict (user_id) do nothing;

drop policy if exists games_select_own on public.games;
drop policy if exists games_insert_own on public.games;
drop policy if exists games_update_own on public.games;
drop policy if exists game_players_select_owned_game on public.game_players;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

alter table public.plans enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.game_public_events enable row level security;
alter table public.game_pause_votes enable row level security;
alter table public.player_notifications enable row level security;

revoke all on table public.profiles, public.plans, public.user_entitlements, public.games,
  public.game_players, public.game_public_events, public.game_pause_votes,
  public.player_notifications from anon, authenticated;

grant select on table public.profiles, public.plans, public.user_entitlements, public.games,
  public.game_players, public.game_public_events, public.game_pause_votes,
  public.player_notifications to authenticated;
grant update (read_at) on table public.player_notifications to authenticated;

grant all on all tables in schema private to service_role;
grant all on table public.profiles, public.plans, public.user_entitlements, public.games,
  public.game_players, public.game_public_events, public.game_pause_votes,
  public.player_notifications to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy plans_select_authenticated on public.plans for select to authenticated using (true);
create policy entitlements_select_own on public.user_entitlements for select to authenticated
  using ((select auth.uid()) = user_id);
create policy games_select_member on public.games for select to authenticated
  using (private.is_game_member(id, (select auth.uid())));
create policy game_players_select_member on public.game_players for select to authenticated
  using (private.is_game_member(game_id, (select auth.uid())));
create policy game_public_events_select_member on public.game_public_events for select to authenticated
  using (private.is_game_member(game_id, (select auth.uid())));
create policy game_pause_votes_select_member on public.game_pause_votes for select to authenticated
  using (private.is_game_member(game_id, (select auth.uid())));
create policy player_notifications_select_own on public.player_notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy player_notifications_update_own on public.player_notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy game_members_receive_realtime on realtime.messages
for select to authenticated
using (
  private.is_game_member(private.game_id_from_topic((select realtime.topic())), (select auth.uid()))
);

create policy game_members_send_presence on realtime.messages
for insert to authenticated
with check (
  private.is_game_member(private.game_id_from_topic((select realtime.topic())), (select auth.uid()))
);

comment on schema private is 'Server-only canonical Mahjong state, action receipts, login identifiers, and rate-limit buckets.';
comment on table public.game_public_events is 'Sanitized events safe for every current game participant.';
comment on function public.commit_game_action is 'Atomic optimistic-concurrency and idempotency boundary for authoritative game actions.';
