-- Extend group check-in cadence beyond a week: 1-6 days, 1/2/3 weeks, or a month (30 days).

alter table public.groups
  drop constraint if exists groups_checkin_cadence_days_range;

alter table public.groups
  add constraint groups_checkin_cadence_days_range
  check (checkin_cadence_days in (1, 2, 3, 4, 5, 6, 7, 14, 21, 30));
