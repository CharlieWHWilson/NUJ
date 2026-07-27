-- Only return profiles for users who have verified their email address.
-- This keeps NUJ code lookup hidden until the account is confirmed.

create or replace function public.get_profile_by_user_code(
  p_user_code text
)
returns table (
  user_id uuid,
  username text,
  user_code text,
  email text,
  phone text
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
    u.email,
    null::text as phone
  from public.profiles p
  join auth.users u
    on u.id = p.id
  where upper(trim(p.user_code)) = upper(trim(p_user_code))
    and u.email_confirmed_at is not null;
$$;

grant execute on function public.get_profile_by_user_code(text) to authenticated;