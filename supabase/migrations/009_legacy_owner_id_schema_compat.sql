-- Normalize legacy schemas that used owner_id/mate_id/group_id so app queries
-- using user_id/id work without errors.

do $$
begin
  -- mates: owner_id -> user_id
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'mates' and column_name = 'owner_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'mates' and column_name = 'user_id'
  ) then
    alter table public.mates rename column owner_id to user_id;
  end if;

  -- mates: mate_id -> id
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'mates' and column_name = 'mate_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'mates' and column_name = 'id'
  ) then
    alter table public.mates rename column mate_id to id;
  end if;

  -- groups: owner_id -> user_id
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'groups' and column_name = 'owner_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'groups' and column_name = 'user_id'
  ) then
    alter table public.groups rename column owner_id to user_id;
  end if;

  -- groups: group_id -> id
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'groups' and column_name = 'group_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'groups' and column_name = 'id'
  ) then
    alter table public.groups rename column group_id to id;
  end if;
end $$;

-- Ensure mates has id + user_id in all environments.
alter table if exists public.mates
  add column if not exists id uuid default gen_random_uuid();

alter table if exists public.mates
  add column if not exists user_id uuid;

update public.mates
set id = gen_random_uuid()
where id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'mates' and column_name = 'id'
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mates'::regclass
      and contype = 'p'
  ) then
    alter table public.mates add constraint mates_pkey primary key (id);
  end if;
end $$;

create index if not exists idx_mates_user_id on public.mates(user_id);

-- Ensure groups has id + user_id in all environments.
alter table if exists public.groups
  add column if not exists id uuid default gen_random_uuid();

alter table if exists public.groups
  add column if not exists user_id uuid;

update public.groups
set id = gen_random_uuid()
where id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'groups' and column_name = 'id'
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.groups'::regclass
      and contype = 'p'
  ) then
    alter table public.groups add constraint groups_pkey primary key (id);
  end if;
end $$;

create index if not exists idx_groups_user_id on public.groups(user_id);

-- Make sure checkins supports on_conflict=user_id.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'checkins' and column_name = 'user_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.checkins'::regclass
      and contype in ('p', 'u')
      and pg_get_constraintdef(oid) ilike '%(user_id)%'
  ) then
    alter table public.checkins
      add constraint checkins_user_id_key unique (user_id);
  end if;
end $$;