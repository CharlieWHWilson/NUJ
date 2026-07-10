-- Ensure Add Mate code search can read profiles across users.
-- This keeps write operations scoped to the owner while allowing read lookup.

alter table if exists public.profiles
  enable row level security;

drop policy if exists "Public profile lookup" on public.profiles;

create policy "Public profile lookup" on public.profiles
  for select
  using (true);

create policy if not exists "Users can insert their own profile" on public.profiles
  for insert
  with check (auth.uid() = id);

create policy if not exists "Users can update their own profile" on public.profiles
  for update
  using (auth.uid() = id);

create policy if not exists "Users can delete their own profile" on public.profiles
  for delete
  using (auth.uid() = id);