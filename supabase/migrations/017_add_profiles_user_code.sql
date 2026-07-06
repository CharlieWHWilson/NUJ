-- Add a short public user code for profile lookup/sharing.
-- Keep auth.users UUIDs as internal keys and expose this code in the UI instead.

alter table if exists public.profiles
  add column if not exists user_code text;

create or replace function public.generate_profile_user_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code text := '';
  i integer;
begin
  for i in 1..7 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;

  return code;
end;
$$;

create or replace function public.assign_profile_user_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  if new.user_code is not null and length(trim(new.user_code)) > 0 then
    new.user_code := upper(trim(new.user_code));
    return new;
  end if;

  loop
    candidate := public.generate_profile_user_code();
    exit when not exists (
      select 1
      from public.profiles p
      where p.user_code = candidate
    );
  end loop;

  new.user_code := candidate;
  return new;
end;
$$;

drop trigger if exists trg_assign_profile_user_code on public.profiles;

create trigger trg_assign_profile_user_code
before insert or update on public.profiles
for each row
execute function public.assign_profile_user_code();

-- Backfill missing codes for existing profiles.
do $$
declare
  row_id uuid;
  candidate text;
begin
  for row_id in
    select p.id
    from public.profiles p
    where p.user_code is null or length(trim(p.user_code)) = 0
  loop
    loop
      candidate := public.generate_profile_user_code();
      exit when not exists (
        select 1
        from public.profiles p2
        where p2.user_code = candidate
      );
    end loop;

    update public.profiles
    set user_code = candidate
    where id = row_id;
  end loop;
end;
$$;

-- Normalize any existing values and enforce format/uniqueness.
update public.profiles
set user_code = upper(trim(user_code))
where user_code is not null;

create unique index if not exists idx_profiles_user_code_unique
  on public.profiles (user_code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_code_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_code_format
      check (user_code ~ '^[A-Z0-9]{7}$');
  end if;
end;
$$;

alter table public.profiles
  alter column user_code set not null;
