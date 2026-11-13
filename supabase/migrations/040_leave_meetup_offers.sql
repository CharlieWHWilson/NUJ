begin;

alter table public.meetup_participants
  add column requires_requalification boolean not null default false;

create function public.leave_meetup_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare uid uuid := public.shared_group_require_user(); attempt public.meetup_attempts;
begin
  select * into attempt from public.meetup_attempts where id = p_attempt_id for update;
  if not found or not exists (
    select 1 from public.shared_group_members where group_id = attempt.group_id and user_id = uid
  ) then raise exception 'Join this shared group before changing participation.'; end if;
  perform 1 from public.meetup_participants where attempt_id = p_attempt_id and user_id = uid;
  if not found then raise exception 'You have not joined this offer.'; end if;
  update public.meetup_participants
    set accepted_at = null, qualified_at = null, progress = 0, requires_requalification = true
    where attempt_id = p_attempt_id and user_id = uid;
  -- Keep redeemed rewards so leaving cannot bypass the one-use-per-offer rule.
  delete from public.meetup_rewards
    where attempt_id = p_attempt_id and user_id = uid and redeemed_at is null;
end;
$$;

create or replace function public.refresh_meetup_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  attempt public.meetup_attempts;
  person record;
  zone text;
  days_per_period integer;
  required integer;
  current_bucket integer;
  current_streak integer;
  best_streak integer;
  qualified_count integer;
  cohort_count integer;
  unlock boolean;
  deadline timestamptz;
  reward_time timestamptz;
begin
  select * into attempt from public.meetup_attempts where id = p_attempt_id for update;
  if not found then return; end if;
  zone := attempt.offer_snapshot->'venue'->>'timezone';
  days_per_period := case when attempt.offer_snapshot->>'period' = 'week' then 7 else 1 end;
  required := (attempt.offer_snapshot->>'periods')::integer;
  deadline := (attempt.offer_snapshot->>'endsAt')::timestamptz;
  for person in select p.*, greatest(p.accepted_at, m.joined_at) as starts_at
    from public.meetup_participants p join public.shared_group_members m
      on m.group_id = attempt.group_id and m.user_id = p.user_id
    where p.attempt_id = p_attempt_id and p.accepted_at is not null and p.qualified_at is null
  loop
    current_bucket := ((least(now(), coalesce(deadline, now())) at time zone zone)::date -
      (person.starts_at at time zone zone)::date) / days_per_period;
    with buckets as (
      select distinct ((e.received_at at time zone zone)::date -
        (person.starts_at at time zone zone)::date) / days_per_period as bucket
      from public.meetup_checkin_events e
      where e.user_id = person.user_id and e.received_at >= person.starts_at
        and e.received_at <= now() and (deadline is null or e.received_at <= deadline)
    ), islands as (
      select bucket, bucket - row_number() over(order by bucket) as island from buckets
    ), streaks as (
      select count(*)::integer as length, max(bucket) as last_bucket from islands group by island
    )
    select coalesce(max(length),0), coalesce(max(length) filter(where last_bucket >= current_bucket - 1),0)
      into best_streak, current_streak from streaks;
    update public.meetup_participants set progress = least(required, current_streak),
      qualified_at = case when best_streak >= required then now() else null end
      where attempt_id = p_attempt_id and user_id = person.user_id;
  end loop;
  select count(*) filter(where p.qualified_at is not null and p.accepted_at is not null and exists (
      select 1 from public.shared_group_members m where m.group_id = attempt.group_id and m.user_id = p.user_id)),
    count(*) into qualified_count, cohort_count from public.meetup_participants p where p.attempt_id = p_attempt_id;
  unlock := case attempt.offer_snapshot->>'unlockRule'
    when 'all' then cohort_count > 0 and qualified_count = cohort_count
    when 'minimum' then qualified_count >= (attempt.offer_snapshot->>'minimumMembers')::integer
    else false end;
  if unlock and attempt.unlocked_at is null then
    update public.meetup_attempts set unlocked_at = now() where id = p_attempt_id;
    attempt.unlocked_at := now();
  end if;
  for person in select p.* from public.meetup_participants p where p.attempt_id = p_attempt_id
    and p.accepted_at is not null
    and exists(select 1 from public.shared_group_members m where m.group_id = attempt.group_id and m.user_id = p.user_id)
    and (not p.requires_requalification or p.qualified_at is not null)
    and (
      (attempt.offer_snapshot->>'unlockRule' = 'individual' and p.qualified_at is not null)
      or (attempt.unlocked_at is not null and
        (attempt.offer_snapshot->>'recipients' = 'all' or p.qualified_at is not null))
    )
  loop
    reward_time := case when attempt.offer_snapshot->>'unlockRule' = 'individual' then person.qualified_at
      else greatest(attempt.unlocked_at, coalesce(person.qualified_at, person.accepted_at), person.accepted_at) end;
    insert into public.meetup_rewards(attempt_id, offer_id, user_id, unlocked_at, expires_at)
      values(p_attempt_id, attempt.offer_id, person.user_id, reward_time,
        reward_time + ((attempt.offer_snapshot->>'redemptionDays')::integer * interval '1 day'))
      on conflict(offer_id, user_id) do nothing;
  end loop;
end;
$$;

revoke all on function public.leave_meetup_attempt(uuid) from public, anon, authenticated;
grant execute on function public.leave_meetup_attempt(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
