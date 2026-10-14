-- Service-only session checks close the gap left by otherwise valid, revoked JWTs.
create or replace function public.account_session_active(requesting_user_id uuid, requesting_session_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id = requesting_session_id and s.user_id = requesting_user_id
    and (s.not_after is null or s.not_after > now()));
$$;
revoke all on function public.account_session_active(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_session_active(uuid, uuid) to service_role;

-- Replace identifying fields in retained, structured history. Never replace
-- arbitrary strings: a username such as "east" must not rewrite a seat or rule. Player keys and
-- tile/action IDs remain stable, so other players can still read their reviews.
create or replace function private.redact_account_values(value jsonb, identifiers text[], removed_user_id uuid)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare result jsonb;
begin
  if jsonb_typeof(value) = 'array' then
    select coalesce(jsonb_agg(private.redact_account_values(item, identifiers, removed_user_id) order by ordinal), '[]'::jsonb)
      into result from jsonb_array_elements(value) with ordinality as elements(item, ordinal);
    return result;
  elsif jsonb_typeof(value) = 'object' then
    select coalesce(jsonb_object_agg(key, case
      when key in ('name','display_name','displayName','username','email','playerName','full_name','avatar_url')
        and jsonb_typeof(item) = 'string' and item #>> '{}' = any(identifiers)
        then to_jsonb('Deleted player'::text)
      when key in ('user_id','userId','owner_id','ownerId','updated_by')
        and item #>> '{}' = removed_user_id::text then 'null'::jsonb
      else private.redact_account_values(item, identifiers, removed_user_id) end), '{}'::jsonb)
      into result from jsonb_each(value) as fields(key, item);
    return result;
  end if;
  return value;
end;
$$;
revoke all on function private.redact_account_values(jsonb, text[], uuid) from public, anon, authenticated;

create or replace function private.prepare_account_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare membership record; identifiers text[];
begin
  -- Locks use the same game-first ordering as joining a room. FK locks on the
  -- auth row also prevent a concurrent new seat from surviving user deletion.
  for membership in
    select g.id, g.status from public.games g where g.owner_id = old.id
      or exists (select 1 from public.game_players p where p.game_id = g.id and p.user_id = old.id)
    order by g.id for update
  loop
    if membership.status in ('lobby', 'active', 'paused') then
      raise exception using errcode = 'P0001', message = 'ACCOUNT_HAS_OPEN_GAMES';
    end if;
  end loop;
  select array_remove(array_agg(distinct identifier), null) into identifiers from (
    select old.email as identifier union all select old.id::text
    union all select username from public.profiles where user_id = old.id
    union all select display_name from public.profiles where user_id = old.id
    union all select display_name from public.game_players where user_id = old.id
    union all select old.raw_user_meta_data ->> 'full_name'
    union all select old.raw_user_meta_data ->> 'display_name'
    union all select old.raw_user_meta_data ->> 'name'
    union all select old.raw_user_meta_data ->> 'avatar_url'
  ) values_to_redact where identifier is not null and identifier <> '';
  for membership in
    select p.game_id from public.game_players p join public.games g on g.id = p.game_id
    where p.user_id = old.id and g.owner_id <> old.id
  loop
    update private.game_state set state_json = private.redact_account_values(state_json, identifiers, old.id) where game_id = membership.game_id;
    update public.games set public_state = private.redact_account_values(public_state, identifiers, old.id) where id = membership.game_id;
    update private.game_events set payload = private.redact_account_values(payload, identifiers, old.id) where game_id = membership.game_id;
    update public.game_public_events set payload = private.redact_account_values(payload, identifiers, old.id) where game_id = membership.game_id;
    update public.game_reviews set review_json = private.redact_account_values(review_json, identifiers, old.id) where game_id = membership.game_id;
    update private.game_actions set response_json = private.redact_account_values(response_json, identifiers, old.id) where game_id = membership.game_id;
    update public.player_notifications set payload = private.redact_account_values(payload, identifiers, old.id) where game_id = membership.game_id;
    update private.operational_events set metadata = private.redact_account_values(metadata, identifiers, old.id) where game_id = membership.game_id;
    update public.learning_events set metadata = private.redact_account_values(metadata, identifiers, old.id) where game_id = membership.game_id;
  end loop;
  delete from private.game_actions where user_id = old.id;
  delete from private.operational_events where user_id = old.id;
  -- Preserve seats in other players' completed tables instead of cascading them.
  update public.game_players set user_id = null, display_name = 'Deleted player', controller_type = 'bot', join_status = 'replaced'
    where user_id = old.id;
  -- Auth and the existing FKs remove sessions, profile, login identifiers,
  -- entitlements, owned games, progress, personal reviews, and notifications.
  return old;
end;
$$;
revoke all on function private.prepare_account_deletion() from public, anon, authenticated;
create trigger prepare_account_deletion before delete on auth.users
for each row execute function private.prepare_account_deletion();
