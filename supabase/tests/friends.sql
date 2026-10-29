-- Run against the migration in an isolated database; all fixtures roll back.
begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003');
insert into public.profiles(user_id,username,display_name) values
('10000000-0000-4000-8000-000000000001','friend_alice','Alice'),
('10000000-0000-4000-8000-000000000002','friend_bob','Bob'),
('10000000-0000-4000-8000-000000000003','friend_carol','Carol');
create function pg_temp.assert(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
select pg_temp.assert(not has_function_privilege('authenticated','public.change_friendship(uuid,text,text,uuid)','execute'),'browser cannot call mutation');
select pg_temp.assert(not has_function_privilege('anon','public.friends_snapshot(uuid,text)','execute'),'anonymous cannot read profiles');
select pg_temp.assert(not has_table_privilege('authenticated','private.friendships','select'),'browser cannot enumerate friendships');
select pg_temp.assert((select relrowsecurity from pg_class where oid='private.friendships'::regclass),'RLS enabled');
set local role service_role;
do $$
declare a uuid='10000000-0000-4000-8000-000000000001'; b uuid='10000000-0000-4000-8000-000000000002'; c uuid='10000000-0000-4000-8000-000000000003'; s jsonb; edge uuid; old_edge uuid;
begin
  s:=public.change_friendship(a,'friend_bob','request');
  if s#>>'{lookup,relationship}' <> 'outgoing' then raise exception 'request not outgoing'; end if;
  edge:=(s#>>'{lookup,connectionId}')::uuid;
  perform public.change_friendship(a,'friend_bob','request');
  if (select count(*) from private.friendships)<>1 then raise exception 'duplicate request'; end if;
  s:=public.change_friendship(b,'friend_alice','request');
  if s#>>'{lookup,relationship}' <> 'incoming' then raise exception 'crossed request accepted implicitly'; end if;
  begin perform public.change_friendship(a,'friend_bob','accept',edge);raise exception 'FAILED sender accepted'; exception when raise_exception then if sqlerrm<>'FRIENDSHIP_CHANGED' then raise; end if; end;
  begin perform public.change_friendship(c,'friend_bob','accept',edge);raise exception 'FAILED unrelated actor accepted'; exception when raise_exception then if sqlerrm<>'FRIENDSHIP_CHANGED' then raise; end if; end;
  s:=public.change_friendship(b,'friend_alice','accept',edge);
  if s#>>'{lookup,relationship}' <> 'friends' then raise exception 'accept failed'; end if;
  if jsonb_array_length(public.friends_snapshot(c)->'connections')<>0 then raise exception 'unrelated actor sees friends'; end if;
  perform public.change_friendship(a,'friend_bob','remove',edge);
  s:=public.change_friendship(a,'friend_bob','request'); old_edge:=edge;edge:=(s#>>'{lookup,connectionId}')::uuid;
  begin perform public.change_friendship(b,'friend_alice','accept',old_edge);raise exception 'FAILED stale request accepted'; exception when raise_exception then if sqlerrm<>'FRIENDSHIP_CHANGED' then raise; end if; end;
  perform public.change_friendship(b,'friend_alice','decline',edge);
  s:=public.change_friendship(a,'friend_bob','request');edge:=(s#>>'{lookup,connectionId}')::uuid;
  perform public.change_friendship(a,'friend_bob','cancel',edge);
  begin perform public.change_friendship(a,'friend_alice','request');raise exception 'FAILED self request'; exception when raise_exception then if sqlerrm<>'SELF_REQUEST' then raise; end if; end;
  begin perform public.change_friendship(a,'missing_player','request');raise exception 'FAILED missing player'; exception when raise_exception then if sqlerrm<>'PLAYER_NOT_FOUND' then raise; end if; end;
  s:=public.change_friendship(a,'friend_bob','request');
  if (s->'lookup') ? 'email' or (s->'lookup') ? 'user_id' then raise exception 'private fields leaked'; end if;
end $$;
reset role;
delete from auth.users where id='10000000-0000-4000-8000-000000000002';
select pg_temp.assert((select count(*) from private.friendships)=0,'account deletion cascades');
-- Capacity includes both pending and accepted edges.
insert into auth.users(id) select ('30000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid from generate_series(1,200) g;
insert into public.profiles(user_id,username) select id,'capacity_'||row_number() over(order by id) from auth.users where id::text like '30000000%';
insert into private.friendships(user_low,user_high,requested_by)
select '10000000-0000-4000-8000-000000000001',user_id,'10000000-0000-4000-8000-000000000001' from public.profiles where username like 'capacity_%';
do $$ begin
  begin perform public.change_friendship('10000000-0000-4000-8000-000000000001','friend_carol','request');raise exception 'FAILED capacity';
  exception when raise_exception then if sqlerrm<>'FRIEND_LIMIT' then raise; end if; end;
end $$;
rollback;
