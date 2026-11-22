create table public.table_reading_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  puzzle_date date not null,
  tile_id text not null check (tile_id ~ '^tile-[0-9]{1,3}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, puzzle_date)
);
alter table public.table_reading_attempts enable row level security;
revoke all on public.table_reading_attempts from anon, authenticated;
grant select, insert on public.table_reading_attempts to authenticated;
create policy "Read own puzzle attempts" on public.table_reading_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Save own first puzzle attempt" on public.table_reading_attempts
  for insert to authenticated with check (
    user_id = (select auth.uid()) and puzzle_date <= (now() at time zone 'UTC')::date
  );
