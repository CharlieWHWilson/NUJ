-- Ensure groups-to-mates junction table exists in all environments.

create extension if not exists pgcrypto;

create table if not exists public.group_mates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  mate_id uuid not null,
  added_at timestamptz not null default now(),
  unique (group_id, mate_id)
);

alter table public.group_mates enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.group_mates'::regclass
      and conname = 'group_mates_group_id_fkey'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'groups'
      and column_name = 'id'
  )
  and exists (
    select 1
    from pg_constraint
    where conrelid = 'public.groups'::regclass
      and contype in ('p', 'u')
      and pg_get_constraintdef(oid) ilike '%(id)%'
  ) then
    alter table public.group_mates
      add constraint group_mates_group_id_fkey
      foreign key (group_id)
      references public.groups(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.group_mates'::regclass
      and conname = 'group_mates_mate_id_fkey'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mates'
      and column_name = 'id'
  )
  and exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mates'::regclass
      and contype in ('p', 'u')
      and pg_get_constraintdef(oid) ilike '%(id)%'
  ) then
    alter table public.group_mates
      add constraint group_mates_mate_id_fkey
      foreign key (mate_id)
      references public.mates(id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_mates'
      and policyname = 'Users can view group_mates for their groups'
  ) then
    execute $policy$
      create policy "Users can view group_mates for their groups" on public.group_mates
        for select using (
          exists (select 1 from public.groups where id = group_id and user_id = auth.uid())
        )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_mates'
      and policyname = 'Users can add mates to their groups'
  ) then
    execute $policy$
      create policy "Users can add mates to their groups" on public.group_mates
        for insert with check (
          exists (select 1 from public.groups where id = group_id and user_id = auth.uid())
        )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_mates'
      and policyname = 'Users can remove mates from their groups'
  ) then
    execute $policy$
      create policy "Users can remove mates from their groups" on public.group_mates
        for delete using (
          exists (select 1 from public.groups where id = group_id and user_id = auth.uid())
        )
    $policy$;
  end if;
end $$;

create index if not exists idx_group_mates_group_id on public.group_mates(group_id);
create index if not exists idx_group_mates_mate_id on public.group_mates(mate_id);
