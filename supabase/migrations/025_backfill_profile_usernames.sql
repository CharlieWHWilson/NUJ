-- Backfill any profile rows that still have a missing username.
-- This repairs old accounts and keeps the NUJ code lookup display name populated.

update public.profiles p
set username = coalesce(
  nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
  nullif(trim(u.email), ''),
  'Unknown user'
)
from auth.users u
where u.id = p.id
  and (p.username is null or length(trim(p.username)) = 0);

alter table if exists public.profiles
  alter column username set not null;