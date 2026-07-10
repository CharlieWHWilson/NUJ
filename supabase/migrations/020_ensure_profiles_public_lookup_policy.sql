-- Ensure Add Mate code search can read profiles across users.
-- This keeps write operations scoped to the owner while allowing read lookup.

alter table if exists public.profiles
  enable row level security;

drop policy if exists "Public profile lookup" on public.profiles;

create policy "Public profile lookup" on public.profiles
  for select
  using (true);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert their own profile'
  ) then
    create policy "Users can insert their own profile" on public.profiles
      for insert
      with check (auth.uid() = id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update their own profile'
  ) then
    create policy "Users can update their own profile" on public.profiles
      for update
      using (auth.uid() = id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can delete their own profile'
  ) then
    create policy "Users can delete their own profile" on public.profiles
      for delete
      using (auth.uid() = id);
  end if;
end
$$;