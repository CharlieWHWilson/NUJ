-- Compatibility migration for legacy triggers/functions that update profiles.last_checkin_at
-- Some environments still run a checkins-side trigger that references this column.
alter table if exists public.profiles
  add column if not exists last_checkin_at timestamptz;

-- Backfill from latest check-in so existing profiles have accurate value.
update public.profiles p
set last_checkin_at = latest.checked_in_at
from (
  select user_id, max(checked_in_at) as checked_in_at
  from public.checkins
  group by user_id
) as latest
where p.id = latest.user_id
  and (p.last_checkin_at is null or p.last_checkin_at < latest.checked_in_at);

create index if not exists idx_profiles_last_checkin_at
  on public.profiles (last_checkin_at);