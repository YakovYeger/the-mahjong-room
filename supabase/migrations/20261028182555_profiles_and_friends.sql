-- Friendship data stays server-only. The API supplies the verified session actor.
create table private.friendships (
  id uuid not null unique default gen_random_uuid(),
  user_low uuid not null references public.profiles(user_id) on delete cascade,
  user_high uuid not null references public.profiles(user_id) on delete cascade,
  requested_by uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (user_low,user_high),
  check (user_low < user_high),
  check (requested_by in (user_low,user_high))
);
create index friendships_requester_idx on private.friendships(requested_by);
create index friendships_high_idx on private.friendships(user_high);
alter table private.friendships enable row level security;
revoke all on private.friendships from public, anon, authenticated;
grant select, insert, update, delete on private.friendships to service_role;

create function private.friend_profile(actor uuid, target uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('username',p.username,'displayName',left(coalesce(nullif(p.display_name,''),p.username),48),
    'memberSince',p.created_at,'connectionId',f.id,'relationship',case when actor=target then 'self'
      when f.status='accepted' then 'friends' when f.requested_by=actor then 'outgoing'
      when f.status='pending' then 'incoming' else 'none' end)
  from public.profiles p left join private.friendships f on
    f.user_low=least(actor,target) and f.user_high=greatest(actor,target)
  where p.user_id=target and p.username is not null;
$$;
revoke all on function private.friend_profile(uuid,uuid) from public,anon,authenticated;
grant execute on function private.friend_profile(uuid,uuid) to service_role;

create function public.friends_snapshot(actor uuid, lookup_username text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare own jsonb; found_profile jsonb;
begin
  own := private.friend_profile(actor,actor);
  if own is null then raise exception 'PROFILE_REQUIRED'; end if;
  if lookup_username is not null then
    select private.friend_profile(actor,p.user_id) into found_profile from public.profiles p where p.username=lookup_username;
  end if;
  return jsonb_build_object('self',own,'lookup',found_profile,'connections',coalesce((
    select jsonb_agg(private.friend_profile(actor,peer) order by created_at desc,peer) from (
      select case when user_low=actor then user_high else user_low end peer,created_at
      from private.friendships where actor in (user_low,user_high)
    ) entries), '[]'::jsonb));
end;
$$;
revoke all on function public.friends_snapshot(uuid,text) from public,anon,authenticated;
grant execute on function public.friends_snapshot(uuid,text) to service_role;

create function public.change_friendship(actor uuid, target_username text, operation text, expected_id uuid default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare target uuid; low_id uuid; high_id uuid; edge private.friendships; affected integer;
begin
  if operation not in ('request','accept','decline','cancel','remove') or operation is null then raise exception 'INVALID_FRIEND_ACTION'; end if;
  if not exists(select 1 from public.profiles where user_id=actor and username is not null) then raise exception 'PROFILE_REQUIRED'; end if;
  select user_id into target from public.profiles where username=target_username;
  if target is null then raise exception 'PLAYER_NOT_FOUND'; end if;
  if target=actor then raise exception 'SELF_REQUEST'; end if;
  low_id := least(actor,target); high_id := greatest(actor,target);
  -- Consistent per-user locks serialize crossed requests and capacity checks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(low_id::text, 7341));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(high_id::text, 7341));
  select * into edge from private.friendships where user_low=low_id and user_high=high_id for update;
  if operation='request' then
    if edge.user_low is null then
      if (select count(*) from private.friendships where actor in (user_low,user_high)) >= 200
        or (select count(*) from private.friendships where target in (user_low,user_high)) >= 200 then raise exception 'FRIEND_LIMIT'; end if;
      insert into private.friendships(user_low,user_high,requested_by) values(low_id,high_id,actor);
    end if;
  elsif edge.id is distinct from expected_id or expected_id is null then
    raise exception 'FRIENDSHIP_CHANGED';
  elsif operation='accept' then
    update private.friendships set status='accepted' where user_low=low_id and user_high=high_id and status='pending' and requested_by=target;
    get diagnostics affected = row_count;
    if affected=0 then raise exception 'FRIENDSHIP_CHANGED'; end if;
  else
    delete from private.friendships where user_low=low_id and user_high=high_id and (
      (operation='cancel' and status='pending' and requested_by=actor) or
      (operation='decline' and status='pending' and requested_by=target) or
      (operation='remove' and status='accepted'));
    get diagnostics affected = row_count;
    if affected=0 then raise exception 'FRIENDSHIP_CHANGED'; end if;
  end if;
  return public.friends_snapshot(actor,target_username);
end;
$$;
revoke all on function public.change_friendship(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.change_friendship(uuid,text,text,uuid) to service_role;
