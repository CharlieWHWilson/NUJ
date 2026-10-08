-- Per-group check-in cadence (in days) used to decide who counts as "checked in" for that group.

alter table if exists public.groups
  add column if not exists checkin_cadence_days smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'groups_checkin_cadence_days_range'
  ) then
    alter table public.groups
      add constraint groups_checkin_cadence_days_range
      check (checkin_cadence_days between 1 and 7);
  end if;
end;
$$;
