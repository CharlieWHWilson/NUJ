-- Remove phone collection/storage now that it is no longer required for account creation.

-- Keep auth signup profile creation focused on required fields only.
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

  begin
    insert into public.profiles (id, username, name, email)
    values (
      new.id,
      display_name,
      display_name,
      coalesce(new.email, '')
    )
    on conflict (id) do update
      set username = excluded.username,
          name = excluded.name,
          email = excluded.email;
  exception
    when unique_violation then
      insert into public.profiles (id, username, name, email)
      values (
        new.id,
        trim(display_name || ' ' || substr(new.id::text, 1, 6)),
        display_name,
        coalesce(new.email, '')
      )
      on conflict (id) do update
        set username = excluded.username,
            name = excluded.name,
            email = excluded.email;
  end;

  return new;
end;
$$;

-- Drop phone from lookup contract now that it is not collected or stored.
drop function if exists public.get_profile_by_user_code(text);

create or replace function public.get_profile_by_user_code(
  p_user_code text
)
returns table (
  user_id uuid,
  username text,
  user_code text,
  email text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    coalesce(
      nullif(trim(p.username), ''),
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'username', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), ''),
      nullif(trim(u.email), ''),
      'Unknown user'
    ) as username,
    p.user_code,
    u.email
  from public.profiles p
  join auth.users u
    on u.id = p.id
  where upper(trim(p.user_code)) = upper(trim(p_user_code))
    and coalesce(u.email_confirmed_at, u.confirmed_at) is not null;
$$;

grant execute on function public.get_profile_by_user_code(text) to authenticated;

-- Purge previously stored phone data.
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'phone'
where coalesce(raw_user_meta_data, '{}'::jsonb) ? 'phone';

alter table if exists public.profiles
  drop column if exists phone;
