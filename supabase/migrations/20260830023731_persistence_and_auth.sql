create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'completed', 'abandoned')),
  phase text not null check (phase in ('charleston', 'playing', 'completed')),
  state_version integer not null default 1 check (state_version > 0),
  training_card_version text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index games_owner_updated_idx on public.games (owner_id, updated_at desc);
create index games_owner_active_idx on public.games (owner_id, updated_at desc) where status = 'active';

create table public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  player_key text not null,
  seat text not null check (seat in ('east', 'south', 'west', 'north')),
  player_type text not null check (player_type in ('human', 'bot')),
  assistance_level smallint not null check (assistance_level between 0 and 4),
  primary key (game_id, player_key),
  unique (game_id, seat)
);

create index game_players_user_idx on public.game_players (user_id, game_id) where user_id is not null;

create table public.game_state (
  game_id uuid primary key references public.games(id) on delete cascade,
  state_json jsonb not null,
  state_version integer not null check (state_version > 0),
  updated_at timestamptz not null default now()
);

create table public.game_events (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (game_id, sequence)
);

create index game_events_game_created_idx on public.game_events (game_id, created_at);

create table public.game_actions (
  action_id uuid primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  expected_state_version integer not null check (expected_state_version > 0),
  resulting_state_version integer check (resulting_state_version > expected_state_version),
  created_at timestamptz not null default now()
);

create index game_actions_game_created_idx on public.game_actions (game_id, created_at);

create table public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  games_completed integer not null default 0 check (games_completed >= 0),
  current_assistance_level smallint not null default 0 check (current_assistance_level between 0 and 4),
  skills_json jsonb not null default '{}'::jsonb,
  experience_points integer not null default 0 check (experience_points >= 0),
  updated_at timestamptz not null default now()
);

create table public.game_reviews (
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  review_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

create index game_reviews_player_created_idx on public.game_reviews (player_id, created_at desc);

create table public.learning_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index learning_events_user_created_idx on public.learning_events (user_id, created_at desc);
create index learning_events_game_idx on public.learning_events (game_id) where game_id is not null;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_state enable row level security;
alter table public.game_events enable row level security;
alter table public.game_actions enable row level security;
alter table public.player_progress enable row level security;
alter table public.game_reviews enable row level security;
alter table public.learning_events enable row level security;

revoke all on table public.profiles, public.games, public.game_players, public.game_state,
  public.game_events, public.game_actions, public.player_progress, public.game_reviews,
  public.learning_events from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.games to authenticated;
grant select on table public.game_players to authenticated;
grant select, insert, update on table public.player_progress to authenticated;
grant select, insert, update on table public.game_reviews to authenticated;
grant select, insert on table public.learning_events to authenticated;

grant all on table public.profiles, public.games, public.game_players, public.game_state,
  public.game_events, public.game_actions, public.player_progress, public.game_reviews,
  public.learning_events to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy games_select_own on public.games for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy games_insert_own on public.games for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy games_update_own on public.games for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy game_players_select_owned_game on public.game_players for select to authenticated
  using (exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.owner_id = (select auth.uid())
  ));

create policy player_progress_select_own on public.player_progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy player_progress_insert_own on public.player_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy player_progress_update_own on public.player_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy game_reviews_select_own on public.game_reviews for select to authenticated
  using ((select auth.uid()) = player_id);
create policy game_reviews_insert_own on public.game_reviews for insert to authenticated
  with check (
    (select auth.uid()) = player_id
    and exists (
      select 1 from public.games
      where games.id = game_reviews.game_id
        and games.owner_id = (select auth.uid())
    )
  );
create policy game_reviews_update_own on public.game_reviews for update to authenticated
  using (
    (select auth.uid()) = player_id
    and exists (
      select 1 from public.games
      where games.id = game_reviews.game_id
        and games.owner_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = player_id
    and exists (
      select 1 from public.games
      where games.id = game_reviews.game_id
        and games.owner_id = (select auth.uid())
    )
  );

create policy learning_events_select_own on public.learning_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy learning_events_insert_own on public.learning_events for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      game_id is null
      or exists (
        select 1 from public.games
        where games.id = learning_events.game_id
          and games.owner_id = (select auth.uid())
      )
    )
  );
