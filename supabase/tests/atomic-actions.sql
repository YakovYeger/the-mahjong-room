-- Run through the SQL connector (or psql) after the migration. Uses an existing
-- fixture owner; every test row and change is rolled back. No real table changes.
begin;
set local role service_role;
do $$
declare
  owner uuid;
  room uuid := gen_random_uuid();
  action uuid := gen_random_uuid();
  result jsonb;
  rejected boolean;
  expected text;
  caught text;
begin
  select owner_id into owner from public.games limit 1;
  if owner is null then raise exception 'Seed a fixture owner/game before running this test'; end if;
  insert into public.games(id,owner_id,status,phase,state_version,training_card_version)
    values(room,owner,'active','charleston',1,'atomic-test-fixture');
  insert into public.game_players(game_id,user_id,player_key,seat,controller_type,assistance_level,display_name,join_status,last_activity_at)
    values(room,owner,'alice','east','human',0,'Atomic fixture','joined',clock_timestamp());
  insert into private.game_state(game_id,state_json,state_version) values(room,'{"stateVersion":1,"eventSequence":0}'::jsonb,1);

  foreach expected in array array['GAME_NOT_ACTIVE','SEAT_CONTROLLED_BY_BOT','GRACE_EXPIRED','DEADLINE_EXPIRED','NOT_A_PARTICIPANT'] loop
    update public.games set status='active',phase='charleston',deadline_at=null where id=room;
    update public.game_players set controller_type='human',join_status='joined',last_activity_at=clock_timestamp() where game_id=room;
    if expected='GAME_NOT_ACTIVE' then update public.games set status='paused' where id=room; end if;
    if expected='SEAT_CONTROLLED_BY_BOT' then update public.game_players set controller_type='bot',join_status='replaced' where game_id=room; end if;
    if expected='GRACE_EXPIRED' then update public.game_players set last_activity_at=clock_timestamp()-interval '121 seconds' where game_id=room; end if;
    if expected='DEADLINE_EXPIRED' then update public.games set phase='playing',deadline_at=clock_timestamp()-interval '1 second' where id=room; end if;
    rejected := false;
    begin
      perform public.commit_player_action(room,action,case when expected='NOT_A_PARTICIPANT' then gen_random_uuid() else owner end,'alice',1,'TEST','test-hash',
        '{"stateVersion":2,"eventSequence":0}'::jsonb,'{}'::jsonb,'[]'::jsonb,null,'active','charleston','{"confirmed":true}'::jsonb);
    exception when others then
      get stacked diagnostics caught = message_text;
      if caught <> expected then raise exception 'Expected %, received %', expected, caught; end if;
      rejected := true;
    end;
    if not rejected then raise exception 'Guard % allowed the commit',expected; end if;
    if (select state_version from public.games where id=room) <> 1 then raise exception 'A rejected action advanced the table'; end if;
  end loop;

  update public.games set status='active',phase='charleston',deadline_at=null where id=room;
  update public.game_players set controller_type='human',join_status='joined',last_activity_at=clock_timestamp() where game_id=room;
  perform public.cast_pause_vote(room,owner,'pause');
  perform public.cast_pause_vote(room,owner,'resume');
  if (select deadline_at from public.games where id=room) is not null then raise exception 'Charleston resume started a clock'; end if;

  result := public.commit_player_action(room,action,owner,'alice',1,'TEST','test-hash',
    '{"stateVersion":2,"eventSequence":0}'::jsonb,'{}'::jsonb,'[]'::jsonb,null,'active','charleston','{"confirmed":true}'::jsonb);
  if result->>'duplicate' <> 'false' then raise exception 'Fresh action was not committed'; end if;
  update public.games set status='paused' where id=room;
  result := public.commit_player_action(room,action,owner,'alice',1,'TEST','test-hash',
    '{"stateVersion":2,"eventSequence":0}'::jsonb,'{}'::jsonb,'[]'::jsonb,null,'active','charleston','{"confirmed":true}'::jsonb);
  if result->>'duplicate' <> 'true' or result->'response' <> '{"confirmed":true}'::jsonb then raise exception 'Lost-response replay failed'; end if;
  result := public.load_player_action_context(room,action,owner,'test-hash');
  if result->'receipt'->>'duplicate' <> 'true' or result->'record'->'game'->>'status' <> 'paused' then raise exception 'Combined context lost receipt or status'; end if;
  rejected := false;
  begin
    perform public.load_player_action_context(room,action,owner,'changed-hash');
  exception when unique_violation then rejected := true;
  end;
  if not rejected then raise exception 'Changed payload reused a receipt'; end if;

  result := public.commit_timeout_action(room,gen_random_uuid(),null,'system',2,'TIMEOUT','timeout-hash',
    '{"stateVersion":3,"eventSequence":0}'::jsonb,'{}'::jsonb,'[]'::jsonb,null,'active','charleston','{}'::jsonb);
  if result->>'conflict' <> 'true' then raise exception 'Timeout resumed a paused room'; end if;
  result := public.commit_game_action(room,gen_random_uuid(),null,'system',2,'BOT_RECOVERY','recovery-hash',
    '{"stateVersion":3,"eventSequence":0}'::jsonb,'{}'::jsonb,'[]'::jsonb,null,'active','charleston','{}'::jsonb);
  if result->>'conflict' <> 'true' then raise exception 'Bot recovery resumed a paused room'; end if;

  update public.games set status='active',phase='playing',deadline_at=clock_timestamp()-interval '1 second' where id=room;
  update public.game_players set last_activity_at=clock_timestamp() where game_id=room;
  result := public.commit_timeout_action(room,gen_random_uuid(),null,'system',2,'TIMEOUT','heartbeat-race-hash',
    '{"stateVersion":3,"eventSequence":1}'::jsonb,'{}'::jsonb,
    '[{"type":"PLAYER_CONTROL_CHANGED","sequence":1,"playerId":"alice","controllerType":"bot","reason":"disconnect"}]'::jsonb,
    null,'active','playing','{}'::jsonb,200,'["alice"]'::jsonb,'["alice"]'::jsonb);
  if result->>'conflict' <> 'true' then raise exception 'A stale timeout replaced a freshly reconnected player'; end if;
  if (select state_version from public.games where id=room) <> 2 then raise exception 'Duplicate/automatic work advanced the table'; end if;

  if has_function_privilege('anon','public.load_player_action_context(uuid,uuid,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.load_player_action_context(uuid,uuid,uuid,text)','EXECUTE') then raise exception 'Private context is publicly callable'; end if;
end;
$$;
select true as atomic_action_regressions_passed;
rollback;
