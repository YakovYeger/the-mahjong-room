alter table public.games alter column turn_seconds set default 300;
update public.games
set turn_seconds = 300
where status = 'lobby' and mode = 'live' and turn_seconds = 60;

create index game_players_disconnect_deadline_idx
  on public.game_players (game_id, last_activity_at)
  where controller_type = 'human' and join_status <> 'replaced';

-- Charleston passes never use a live-turn deadline, including existing rooms
-- that were created before this behavior was corrected.
update public.games
set deadline_at = null, timeout_claim_token = null, timeout_claimed_until = null
where status = 'active' and phase = 'charleston';

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
      and (g.timeout_claimed_until is null or g.timeout_claimed_until < now())
      and (
        (g.phase <> 'charleston' and g.deadline_at is not null and g.deadline_at <= now())
        or exists (
          select 1 from public.game_players gp
          where gp.game_id = g.id
            and gp.controller_type = 'human'
            and gp.join_status <> 'replaced'
            and gp.last_activity_at <= now() - interval '2 minutes'
        )
      )
    order by least(
      coalesce(g.deadline_at, 'infinity'::timestamptz),
      coalesce((
        select min(gp.last_activity_at + interval '2 minutes')
        from public.game_players gp
        where gp.game_id = g.id
          and gp.controller_type = 'human'
          and gp.join_status <> 'replaced'
      ), 'infinity'::timestamptz)
    )
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
