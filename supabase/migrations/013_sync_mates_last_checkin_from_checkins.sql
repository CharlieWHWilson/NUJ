-- Keep public.mates synced from public.checkins so mate presence stays current.

create or replace function public.sync_mates_last_checkin_from_checkins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  synced_days integer;
begin
  if new.user_id is null then
    return new;
  end if;

  synced_days := greatest(0, current_date - (new.checked_in_at at time zone 'utc')::date);

  update public.mates
  set last_checkin = case
        when synced_days <= 0 then 'today'
        when synced_days = 1 then 'yesterday'
        else 'few-days'
      end,
      days_since_checkin = synced_days,
      updated_at = now()
  where mate_user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_mate_last_checkin on public.checkins;

create trigger trg_sync_mate_last_checkin
after insert or update on public.checkins
for each row
execute function public.sync_mates_last_checkin_from_checkins();

with latest_checkins as (
  select distinct on (c.user_id)
    c.user_id,
    c.checked_in_at
  from public.checkins c
  order by c.user_id, c.checked_in_at desc
)
update public.mates m
set last_checkin = case
      when greatest(0, current_date - (latest_checkins.checked_in_at at time zone 'utc')::date) <= 0 then 'today'
      when greatest(0, current_date - (latest_checkins.checked_in_at at time zone 'utc')::date) = 1 then 'yesterday'
      else 'few-days'
    end,
    days_since_checkin = greatest(0, current_date - (latest_checkins.checked_in_at at time zone 'utc')::date),
    updated_at = now()
from latest_checkins
where m.mate_user_id = latest_checkins.user_id;