create policy private_game_state_deny_browser on private.game_state
for all to anon, authenticated using (false) with check (false);
create policy private_game_events_deny_browser on private.game_events
for all to anon, authenticated using (false) with check (false);
create policy private_game_actions_deny_browser on private.game_actions
for all to anon, authenticated using (false) with check (false);

drop function public.claim_username(text);

create or replace function public.claim_username_for_user(requesting_user_id uuid, requested_username text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := private.normalize_username(requested_username);
  result public.profiles;
  login_email text;
begin
  if requesting_user_id is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if char_length(normalized_username) not between 3 and 24 or normalized_username !~ '^[a-z0-9_]+$' then
    raise exception using errcode = '23514', message = 'INVALID_USERNAME';
  end if;

  update public.profiles
  set username = normalized_username,
      display_name = coalesce(display_name, normalized_username),
      updated_at = now()
  where user_id = requesting_user_id and username is null
  returning * into result;

  if result.user_id is null then
    select * into result from public.profiles where user_id = requesting_user_id;
    if result.user_id is null then raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND'; end if;
    if result.username is distinct from normalized_username then
      raise exception using errcode = '23505', message = 'USERNAME_ALREADY_SET';
    end if;
  end if;

  select lower(email) into login_email from auth.users where id = requesting_user_id;
  insert into private.account_login_identifiers (identifier, user_id, email)
  values (normalized_username, requesting_user_id, login_email)
  on conflict (user_id) do update set identifier = excluded.identifier, email = excluded.email, updated_at = now();
  return result;
end;
$$;

revoke all on function public.claim_username_for_user(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_username_for_user(uuid, text) to service_role;

create index game_actions_user_id_idx on private.game_actions (user_id) where user_id is not null;
create index game_state_updated_by_idx on private.game_state (updated_by) where updated_by is not null;
create index operational_events_user_id_idx on private.operational_events (user_id) where user_id is not null;
create index game_pause_votes_user_id_idx on public.game_pause_votes (user_id);
create index player_notifications_game_id_idx on public.player_notifications (game_id) where game_id is not null;
create index user_entitlements_plan_id_idx on public.user_entitlements (plan_id);

drop index private.account_login_identifiers_user_idx;
drop index public.game_players_user_idx;
drop index public.game_pause_votes_game_idx;

comment on extension pg_net is 'Required for Cron HTTP dispatch. Supabase installs this non-relocatable extension with public as its extension namespace; its callable objects live in the net schema.';
