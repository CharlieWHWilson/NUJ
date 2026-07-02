-- Keep profiles.last_checkin_at synchronized from checkins.

alter table if exists public.profiles
  add column if not exists last_checkin_at timestamptz;

create or replace function public.sync_profiles_last_checkin_from_checkins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  update public.profiles
  set last_checkin_at = greatest(coalesce(last_checkin_at, new.checked_in_at), new.checked_in_at)
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_last_checkin on public.checkins;

create trigger trg_sync_profile_last_checkin
after insert or update on public.checkins
for each row
execute function public.sync_profiles_last_checkin_from_checkins();

-- Backfill and repair stale profile timestamps from existing checkins.
update public.profiles p
set last_checkin_at = latest.checked_in_at
from (
  select user_id, max(checked_in_at) as checked_in_at
  from public.checkins
  group by user_id
) latest
where p.id = latest.user_id
  and (p.last_checkin_at is null or p.last_checkin_at < latest.checked_in_at);
