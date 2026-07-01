-- Fix legacy mates.id configurations where inserts fail with NULL id.

create extension if not exists pgcrypto;

alter table if exists public.mates
  add column if not exists id uuid;

alter table if exists public.mates
  alter column id set default gen_random_uuid();

update public.mates
set id = gen_random_uuid()
where id is null;

alter table if exists public.mates
  alter column id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mates'::regclass
      and contype = 'p'
  ) then
    alter table public.mates
      add constraint mates_pkey primary key (id);
  end if;
end $$;