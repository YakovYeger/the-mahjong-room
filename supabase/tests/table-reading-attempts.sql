begin;
select set_config('test.puzzle_user_one', gen_random_uuid()::text, true), set_config('test.puzzle_user_two', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('test.puzzle_user_one')::uuid), (current_setting('test.puzzle_user_two')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.puzzle_user_one'), true);
insert into public.table_reading_attempts(user_id,puzzle_date,tile_id) values (auth.uid(),'2026-11-22','tile-1');
insert into public.table_reading_attempts(user_id,puzzle_date,tile_id) values (auth.uid(),'2026-11-22','tile-2') on conflict(user_id,puzzle_date) do nothing;
do $$
begin
 if (select tile_id from public.table_reading_attempts where puzzle_date='2026-11-22') <> 'tile-1' then raise exception 'First answer overwritten'; end if;
 begin
  update public.table_reading_attempts set tile_id='tile-2';
  raise exception 'Update was permitted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.puzzle_user_two'), true);
do $$
begin
 if exists(select 1 from public.table_reading_attempts) then raise exception 'Other account readable'; end if;
 begin
  insert into public.table_reading_attempts(user_id,puzzle_date,tile_id) values (current_setting('test.puzzle_user_one')::uuid,'2026-11-21','tile-1');
  raise exception 'Other account write permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'First-answer immutability and account isolation passed' as result;
rollback;
