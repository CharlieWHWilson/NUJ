-- Ensure public.mates matches the app's expected schema shape.
-- This migration is intentionally defensive for legacy environments.

alter table if exists public.mates
  add column if not exists id uuid default gen_random_uuid();

alter table if exists public.mates
  add column if not exists user_id uuid;

alter table if exists public.mates
  add column if not exists mate_user_id uuid;

alter table if exists public.mates
  add column if not exists name text;

alter table if exists public.mates
  add column if not exists initials text;

alter table if exists public.mates
  add column if not exists last_checkin text;

alter table if exists public.mates
  add column if not exists days_since_checkin int;

alter table if exists public.mates
  add column if not exists created_at timestamptz default now();

alter table if exists public.mates
  add column if not exists updated_at timestamptz default now();

-- Backfill user_id from legacy owner_id when needed.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'mates' and column_name = 'owner_id'
  ) then
    update public.mates
    set user_id = owner_id
    where user_id is null;
  end if;
end $$;

-- Backfill mate_user_id from legacy mate_id when needed.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'mates' and column_name = 'mate_id'
  ) then
    update public.mates
    set mate_user_id = (mate_id::text)::uuid
    where mate_user_id is null
      and mate_id is not null
      and mate_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  end if;
end $$;

-- Ensure every row has a stable primary key id.
update public.mates
set id = gen_random_uuid()
where id is null;

with duplicate_ids as (
  select ctid,
         row_number() over (partition by id order by ctid) as rn
  from public.mates
)
update public.mates m
set id = gen_random_uuid()
from duplicate_ids d
where m.ctid = d.ctid
  and d.rn > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mates'::regclass
      and contype = 'p'
  ) then
    alter table public.mates add constraint mates_pkey primary key (id);
  end if;
end $$;

-- Backfill display fields where missing.
update public.mates
set name = 'Mate'
where name is null or btrim(name) = '';

update public.mates
set initials = upper(left(name, 1))
where initials is null or btrim(initials) = '';

update public.mates
set last_checkin = 'few-days'
where last_checkin is null;

update public.mates
set days_since_checkin = 3
where days_since_checkin is null;

create index if not exists idx_mates_user_id on public.mates(user_id);
create index if not exists idx_mates_mate_user_id on public.mates(mate_user_id);

with duplicate_pairs as (
  select ctid,
         row_number() over (partition by user_id, mate_user_id order by ctid) as rn
  from public.mates
  where user_id is not null
    and mate_user_id is not null
)
delete from public.mates m
using duplicate_pairs d
where m.ctid = d.ctid
  and d.rn > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mates_user_mate_unique'
      and conrelid = 'public.mates'::regclass
  ) then
    alter table public.mates
      add constraint mates_user_mate_unique unique (user_id, mate_user_id);
  end if;
end $$;

alter table public.mates enable row level security;

drop policy if exists "Users can view their own mates" on public.mates;
drop policy if exists "Users can create mates" on public.mates;
drop policy if exists "Users can update their own mates" on public.mates;
drop policy if exists "Users can delete their own mates" on public.mates;

create policy "Users can view their own mates" on public.mates
  for select using (auth.uid() = user_id);

create policy "Users can create mates" on public.mates
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own mates" on public.mates
  for update using (auth.uid() = user_id);

create policy "Users can delete their own mates" on public.mates
  for delete using (auth.uid() = user_id);