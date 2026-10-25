-- 5th Ward Bishopric Hub: shared database.
-- Run once in Supabase: SQL Editor > New query > paste > Run.

-- Everyone who may use the app. Add a person by inserting their email (see the bottom of this file).
create table if not exists public.allowed_users (
  email text primary key
);
alter table public.allowed_users enable row level security;
-- No policies on purpose: nobody can read or change this list through the app's key.

-- True when the signed-in person's email is on the list.
create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_allowed() to authenticated;

-- Every kind of record the app keeps (events, appointments, members...) in one table: which list it belongs
-- to, its id, and the record itself.
create table if not exists public.records (
  store text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (store, id)
);
alter table public.records enable row level security;
grant select, insert, update, delete on public.records to authenticated;

drop policy if exists "allowed users read" on public.records;
drop policy if exists "allowed users add" on public.records;
drop policy if exists "allowed users change" on public.records;
drop policy if exists "allowed users remove" on public.records;
create policy "allowed users read" on public.records for select to authenticated using (public.is_allowed());
create policy "allowed users add" on public.records for insert to authenticated with check (public.is_allowed());
create policy "allowed users change" on public.records for update to authenticated using (public.is_allowed()) with check (public.is_allowed());
create policy "allowed users remove" on public.records for delete to authenticated using (public.is_allowed());

-- Live updates: one phone sees another's change without refreshing.
alter publication supabase_realtime add table public.records;

-- Who may sign in. Replace the address below with the real one (one line per person) before running.
insert into public.allowed_users (email) values ('someone@example.com') on conflict do nothing;
