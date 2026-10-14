-- Run after the account-management migration in a transaction; always roll back.
-- This fixture uses generated IDs and never deletes an existing account.
do $$
declare
  removed_user uuid := gen_random_uuid(); remaining_user uuid := gen_random_uuid();
  fixture_session uuid := gen_random_uuid(); hosted uuid := gen_random_uuid(); shared uuid := gen_random_uuid();
  fixture_email text := 'account-fixture-' || removed_user::text || '@example.test';
  receipt uuid := gen_random_uuid();
  outcome text;
begin
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
  values (removed_user,fixture_email,'{"provider":"email"}', '{"display_name":"Account fixture player"}'),
         (remaining_user,'account-fixture-' || remaining_user::text || '@example.test','{"provider":"email"}', '{}');
  insert into auth.sessions(id,user_id) values (fixture_session,removed_user);
  if not public.account_session_active(removed_user,fixture_session) then raise exception 'live session was rejected'; end if;
  if public.account_session_active(remaining_user,fixture_session) then raise exception 'session accepted wrong user'; end if;
  update auth.sessions set not_after = now() - interval '1 second' where id = fixture_session;
  if public.account_session_active(removed_user,fixture_session) then raise exception 'expired session was accepted'; end if;
  update auth.sessions set not_after = null where id = fixture_session;
  insert into public.games(id,owner_id,status,phase,training_card_version)
  values (hosted,removed_user,'completed','completed','training-card'),
         (shared,remaining_user,'active','playing','training-card');
  insert into public.game_players(game_id,user_id,player_key,seat,controller_type,assistance_level,display_name)
  values (shared,removed_user,'fixture-player','east','human',0,'Account fixture player');
  begin
    delete from auth.users where id = removed_user;
    raise exception 'open-game guard did not reject deletion';
  exception when sqlstate 'P0001' then
    get stacked diagnostics outcome = message_text;
    if outcome <> 'ACCOUNT_HAS_OPEN_GAMES' then raise; end if;
  end;
  if not exists (select 1 from auth.users where id=removed_user) then raise exception 'failed deletion removed account'; end if;
  update public.games set status='completed', phase='completed' where id=shared;
  insert into private.game_state(game_id,state_json,state_version)
  values (shared,jsonb_build_object('players',jsonb_build_array(jsonb_build_object('id','fixture-player','name','Account fixture player')), 'test_email',fixture_email),1);
  update public.games set public_state=jsonb_build_object('players',jsonb_build_array(jsonb_build_object('id','fixture-player','name','Account fixture player'))) where id=shared;
  insert into public.game_reviews(game_id,player_id,review_json)
  values (shared,removed_user,'{}'),(shared,remaining_user,'{"playerName":"Account fixture player","score":42}');
  insert into private.game_actions(action_id,game_id,user_id,player_key,action_type,expected_state_version,resulting_state_version,request_hash,response_status,response_json,completed_at)
  values (receipt,shared,remaining_user,'other-player','DRAW_TILE',1,2,'account-fixture',200,'{"players":[{"name":"Account fixture player"}],"acknowledged":true}',now());
  delete from auth.users where id=removed_user;
  if exists (select 1 from auth.users where id=removed_user) or public.account_session_active(removed_user,fixture_session) then raise exception 'account/session survived'; end if;
  if exists (select 1 from public.profiles where user_id=removed_user) then raise exception 'profile survived'; end if;
  if exists (select 1 from public.games where id=hosted) then raise exception 'owned history survived'; end if;
  if not exists (select 1 from public.game_players where game_id=shared and user_id is null and display_name='Deleted player') then raise exception 'shared seat was not preserved'; end if;
  if (select state_json #>> '{players,0,name}' from private.game_state where game_id=shared) <> 'Deleted player' then raise exception 'canonical name survived'; end if;
  if (select public_state #>> '{players,0,name}' from public.games where id=shared) <> 'Deleted player' then raise exception 'public name survived'; end if;
  if exists (select 1 from public.game_reviews where game_id=shared and player_id=removed_user) then raise exception 'personal review survived'; end if;
  if (select review_json ->> 'playerName' from public.game_reviews where game_id=shared and player_id=remaining_user) <> 'Deleted player' then raise exception 'retained review not redacted'; end if;
  if public.get_game_action_receipt(shared,receipt,remaining_user,'account-fixture') #>> '{response,players,0,name}' <> 'Deleted player' then raise exception 'retained receipt recovery was lost or not redacted'; end if;
  if private.redact_account_values('{"phase":"completed","seat":"east","type":{"suit":"bamboo"},"name":"east","userId":"00000000-0000-4000-8000-000000000001"}', array['east','completed','bamboo'], '00000000-0000-4000-8000-000000000001')
    <> '{"phase":"completed","seat":"east","type":{"suit":"bamboo"},"name":"Deleted player","userId":null}'::jsonb then raise exception 'redaction changed game semantics'; end if;
  if has_function_privilege('authenticated','public.account_session_active(uuid,uuid)','execute')
    or has_function_privilege('anon','public.account_session_active(uuid,uuid)','execute') then raise exception 'session lookup publicly executable'; end if;
end;
$$;
select 'account-management fixtures passed' as result;
