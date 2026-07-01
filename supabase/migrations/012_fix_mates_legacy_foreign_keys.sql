-- Remove legacy FK constraints that incorrectly bind mates.id to users,
-- then enforce correct FK relationships for user_id and mate_user_id.

-- Drop specific known legacy constraint name if present.
alter table if exists public.mates
  drop constraint if exists mates_mate_id_fkey;

-- Drop mates policies temporarily so type changes are allowed.
drop policy if exists "Users can view their own mates" on public.mates;
drop policy if exists "Users can create mates" on public.mates;
drop policy if exists "Users can update their own mates" on public.mates;
drop policy if exists "Users can delete their own mates" on public.mates;
drop policy if exists mates_select_own on public.mates;
drop policy if exists mates_insert_own on public.mates;
drop policy if exists mates_update_own on public.mates;
drop policy if exists mates_delete_own on public.mates;

-- Drop any FK currently attached to column id on public.mates.
do $$
declare
  fk_record record;
begin
  for fk_record in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join unnest(c.conkey) with ordinality as ck(attnum, ord) on true
    join pg_attribute a on a.attrelid = t.oid and a.attnum = ck.attnum
    where n.nspname = 'public'
      and t.relname = 'mates'
      and c.contype = 'f'
      and a.attname = 'id'
  loop
    execute format('alter table public.mates drop constraint if exists %I', fk_record.conname);
  end loop;
end $$;

-- Ensure compatible column types.
alter table if exists public.mates
  alter column user_id type uuid using user_id::uuid;

alter table if exists public.mates
  alter column mate_user_id type uuid using mate_user_id::uuid;

-- Add expected FKs if missing.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mates_user_id_fkey'
      and conrelid = 'public.mates'::regclass
  ) then
    alter table public.mates
      add constraint mates_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'mates_mate_user_id_fkey'
      and conrelid = 'public.mates'::regclass
  ) then
    alter table public.mates
      add constraint mates_mate_user_id_fkey
      foreign key (mate_user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end $$;

alter table public.mates enable row level security;

create policy "Users can view their own mates" on public.mates
  for select using (auth.uid() = user_id);

create policy "Users can create mates" on public.mates
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own mates" on public.mates
  for update using (auth.uid() = user_id);

create policy "Users can delete their own mates" on public.mates
  for delete using (auth.uid() = user_id);