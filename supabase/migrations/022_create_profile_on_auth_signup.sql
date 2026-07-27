-- Create a profile row as soon as a user signs up.
-- This ensures the username is stored immediately and the existing
-- profile user_code trigger generates a NUJ code for lookup.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  raw_username text;
  display_name text;
begin
  raw_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
  raw_username := coalesce(new.raw_user_meta_data ->> 'username', '');
  display_name := trim(coalesce(nullif(raw_username, ''), nullif(raw_name, '')));

  if display_name = '' then
    display_name := coalesce(new.email, 'Unknown user');
  end if;

  insert into public.profiles (id, username)
  values (new.id, display_name)
  on conflict (id) do update
    set username = excluded.username;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();