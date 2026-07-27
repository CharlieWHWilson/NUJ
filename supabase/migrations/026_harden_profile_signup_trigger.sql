-- Harden auth signup profile creation for mixed legacy schemas.
-- Prevents "Database error saving new user" when profile columns/constraints differ.

-- Ensure legacy columns exist so trigger inserts do not fail on NOT NULL constraints.
alter table if exists public.profiles
  add column if not exists username text,
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone text;

-- Supabase starter schemas often created a unique username constraint.
-- NUJ display names are not guaranteed unique, so remove this if present.
alter table if exists public.profiles
  drop constraint if exists profiles_username_key;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  raw_username text;
  raw_phone text;
  display_name text;
begin
  raw_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
  raw_username := coalesce(new.raw_user_meta_data ->> 'username', '');
  raw_phone := coalesce(new.raw_user_meta_data ->> 'phone', '');
  display_name := trim(coalesce(nullif(raw_username, ''), nullif(raw_name, '')));

  if display_name = '' then
    display_name := coalesce(new.email, 'Unknown user');
  end if;

  begin
    insert into public.profiles (id, username, name, email, phone)
    values (
      new.id,
      display_name,
      display_name,
      coalesce(new.email, ''),
      raw_phone
    )
    on conflict (id) do update
      set username = excluded.username,
          name = excluded.name,
          email = excluded.email,
          phone = excluded.phone;
  exception
    when unique_violation then
      -- If a remaining unique username index exists, make a deterministic fallback.
      insert into public.profiles (id, username, name, email, phone)
      values (
        new.id,
        trim(display_name || ' ' || substr(new.id::text, 1, 6)),
        display_name,
        coalesce(new.email, ''),
        raw_phone
      )
      on conflict (id) do update
        set username = excluded.username,
            name = excluded.name,
            email = excluded.email,
            phone = excluded.phone;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();