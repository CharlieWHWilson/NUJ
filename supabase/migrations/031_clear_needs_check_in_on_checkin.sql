-- Clear the check-in reminder flag server-side whenever a user checks in, so push
-- notifications never carry a stale "+1" badge after the user has already checked in.

create or replace function public.clear_needs_check_in_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set needs_check_in = false
  where id = new.user_id
    and needs_check_in;

  return new;
end;
$$;

drop trigger if exists trg_clear_needs_check_in_on_checkin on public.checkins;

create trigger trg_clear_needs_check_in_on_checkin
after insert or update of checked_in_at on public.checkins
for each row
execute function public.clear_needs_check_in_on_checkin();

-- Backfill: anyone who checked in within the last day shouldn't be flagged.
update public.profiles p
set needs_check_in = false
where p.needs_check_in
  and exists (
    select 1
    from public.checkins c
    where c.user_id = p.id
      and c.checked_in_at > now() - interval '24 hours'
  );
