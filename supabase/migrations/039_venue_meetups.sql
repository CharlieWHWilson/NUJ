begin;

create table public.venue_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.meetup_venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text not null check (char_length(btrim(address)) between 1 and 500),
  description text not null default '' check (char_length(description) <= 2000),
  timezone text not null default 'Europe/London',
  active boolean not null default true
);
create table public.meetup_offers (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.meetup_venues(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  reward text not null check (char_length(btrim(reward)) between 1 and 1000),
  terms text not null default '' check (char_length(terms) <= 4000),
  period text not null check (period in ('day', 'week')),
  periods integer not null check (periods between 1 and 52),
  unlock_rule text not null check (unlock_rule in ('individual', 'minimum', 'all')),
  minimum_members integer not null default 2 check (minimum_members between 1 and 100),
  recipients text not null check (recipients in ('qualifying', 'all')),
  redemption_days integer not null check (redemption_days between 1 and 90),
  ends_at timestamptz,
  active boolean not null default true,
  check (unlock_rule <> 'individual' or recipients = 'qualifying')
);
create table public.meetup_attempts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.shared_groups(id) on delete cascade,
  offer_id uuid not null references public.meetup_offers(id),
  offer_snapshot jsonb not null,
  selected_at timestamptz not null default now(),
  unlocked_at timestamptz,
  unique(group_id, offer_id)
);
create table public.meetup_participants (
  attempt_id uuid not null references public.meetup_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz,
  qualified_at timestamptz,
  progress integer not null default 0,
  primary key(attempt_id, user_id)
);
create table public.meetup_rewards (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references public.meetup_attempts(id) on delete set null,
  offer_id uuid not null references public.meetup_offers(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  unlocked_at timestamptz not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  unique(attempt_id, user_id),
  unique(offer_id, user_id)
);

-- Existing checkins holds only the latest check-in. Rewards need an immutable,
-- server-timed ledger; client timestamps and older profile values never qualify.
create table public.meetup_checkin_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  received_at timestamptz not null default now()
);
create index meetup_checkin_events_user_time on public.meetup_checkin_events(user_id, received_at);
create index meetup_participants_user on public.meetup_participants(user_id, attempt_id);
create index meetup_attempts_group on public.meetup_attempts(group_id);
create index meetup_rewards_user on public.meetup_rewards(user_id);

alter table public.venue_admins enable row level security;
alter table public.meetup_venues enable row level security;
alter table public.meetup_offers enable row level security;
alter table public.meetup_attempts enable row level security;
alter table public.meetup_participants enable row level security;
alter table public.meetup_rewards enable row level security;
alter table public.meetup_checkin_events enable row level security;
revoke all on public.venue_admins, public.meetup_venues, public.meetup_offers,
  public.meetup_attempts, public.meetup_participants, public.meetup_rewards,
  public.meetup_checkin_events from public, anon, authenticated;
revoke all on sequence public.meetup_checkin_events_id_seq from public, anon, authenticated;

create function public.is_venue_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.venue_admins a
    join auth.users u on u.id = a.user_id
    where a.user_id = auth.uid() and u.email_confirmed_at is not null);
$$;

create function public.meetup_require_admin()
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_venue_admin() then raise exception 'Venue admin access required.'; end if;
end;
$$;

create function public.meetup_offer_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', o.id, 'venueId', v.id, 'title', o.title, 'reward', o.reward, 'terms', o.terms,
    'period', o.period, 'periods', o.periods, 'unlockRule', o.unlock_rule,
    'minimumMembers', o.minimum_members, 'recipients', o.recipients,
    'redemptionDays', o.redemption_days, 'endsAt', o.ends_at, 'active', o.active,
    'venue', jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address,
      'description', v.description, 'timezone', v.timezone, 'active', v.active)
  ) from public.meetup_offers o join public.meetup_venues v on v.id = o.venue_id where o.id = p_id;
$$;

create function public.list_meetup_venues()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  perform public.meetup_require_admin();
  select coalesce(jsonb_agg(to_jsonb(v) order by v.name, v.id), '[]') into result from public.meetup_venues v;
  return result;
end;
$$;

create function public.list_meetup_offers(p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  perform public.shared_group_require_user();
  if p_admin then perform public.meetup_require_admin(); end if;
  select coalesce(jsonb_agg(public.meetup_offer_json(o.id) order by v.name, o.title, o.id), '[]')
    into result from public.meetup_offers o join public.meetup_venues v on v.id = o.venue_id
    where p_admin or (o.active and v.active and (o.ends_at is null or o.ends_at > now()));
  return result;
end;
$$;

create function public.save_meetup_venue(p_id uuid, p_venue jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare venue_id uuid;
begin
  perform public.meetup_require_admin();
  if not exists(select 1 from pg_timezone_names where name = p_venue->>'timezone') then
    raise exception 'Choose a valid IANA timezone, such as Europe/London.';
  end if;
  if p_id is null then
    insert into public.meetup_venues(name, address, description, timezone, active)
      values(btrim(p_venue->>'name'), btrim(p_venue->>'address'), coalesce(p_venue->>'description', ''),
        p_venue->>'timezone', (p_venue->>'active')::boolean) returning id into venue_id;
  else
    update public.meetup_venues set name = btrim(p_venue->>'name'), address = btrim(p_venue->>'address'),
      description = coalesce(p_venue->>'description', ''), timezone = p_venue->>'timezone',
      active = (p_venue->>'active')::boolean where id = p_id returning id into venue_id;
    if venue_id is null then raise exception 'Venue not found.'; end if;
  end if;
  return venue_id;
end;
$$;

create function public.save_meetup_offer(p_id uuid, p_offer jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare offer_id uuid;
begin
  perform public.meetup_require_admin();
  if p_id is null then
    insert into public.meetup_offers(venue_id, title, reward, terms, period, periods,
      unlock_rule, minimum_members, recipients, redemption_days, ends_at, active)
    values((p_offer->>'venueId')::uuid, btrim(p_offer->>'title'), btrim(p_offer->>'reward'),
      coalesce(p_offer->>'terms',''), p_offer->>'period', (p_offer->>'periods')::integer,
      p_offer->>'unlockRule', (p_offer->>'minimumMembers')::integer, p_offer->>'recipients',
      (p_offer->>'redemptionDays')::integer, nullif(p_offer->>'endsAt','')::timestamptz,
      (p_offer->>'active')::boolean) returning id into offer_id;
  else
    update public.meetup_offers set venue_id = (p_offer->>'venueId')::uuid,
      title = btrim(p_offer->>'title'), reward = btrim(p_offer->>'reward'),
      terms = coalesce(p_offer->>'terms',''), period = p_offer->>'period',
      periods = (p_offer->>'periods')::integer, unlock_rule = p_offer->>'unlockRule',
      minimum_members = (p_offer->>'minimumMembers')::integer, recipients = p_offer->>'recipients',
      redemption_days = (p_offer->>'redemptionDays')::integer,
      ends_at = nullif(p_offer->>'endsAt','')::timestamptz,
      active = (p_offer->>'active')::boolean where id = p_id returning id into offer_id;
    if offer_id is null then raise exception 'Offer not found.'; end if;
  end if;
  return offer_id;
end;
$$;

create function public.select_meetup_offer(p_group_id uuid, p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  uid uuid := public.shared_group_require_user();
  snapshot jsonb;
  selected_attempt_id uuid;
begin
  perform 1 from public.shared_groups where id = p_group_id and owner_id = uid for update;
  if not found or not exists(select 1 from public.shared_group_members where group_id = p_group_id and user_id = uid) then
    raise exception 'Only the current shared-group owner can select a venue offer.';
  end if;
  select id into selected_attempt_id from public.meetup_attempts where group_id = p_group_id and offer_id = p_offer_id;
  if selected_attempt_id is not null then return selected_attempt_id; end if;
  perform 1 from public.meetup_offers o join public.meetup_venues v on v.id = o.venue_id
    where o.id = p_offer_id and o.active and v.active and (o.ends_at is null or o.ends_at > now()) for share of o, v;
  if not found then raise exception 'This venue offer is unavailable.'; end if;
  snapshot := public.meetup_offer_json(p_offer_id);
  insert into public.meetup_attempts(group_id, offer_id, offer_snapshot)
    values(p_group_id, p_offer_id, snapshot) returning id into selected_attempt_id;
  -- Whole-group eligibility uses this fixed roster. Others opt in themselves.
  if snapshot->>'unlockRule' = 'all' then
    insert into public.meetup_participants(attempt_id, user_id)
      select selected_attempt_id, user_id from public.shared_group_members where group_id = p_group_id;
  end if;
  insert into public.meetup_participants(attempt_id, user_id, accepted_at) values(selected_attempt_id, uid, now())
    on conflict (attempt_id, user_id) do update set accepted_at = excluded.accepted_at;
  return selected_attempt_id;
end;
$$;

create function public.join_meetup_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare uid uuid := public.shared_group_require_user(); attempt public.meetup_attempts;
begin
  select * into attempt from public.meetup_attempts where id = p_attempt_id for update;
  if not found or not exists(select 1 from public.shared_group_members where group_id = attempt.group_id and user_id = uid) then
    raise exception 'Join this shared group before participating.';
  end if;
  if exists(select 1 from public.meetup_participants where attempt_id = p_attempt_id and user_id = uid and accepted_at is not null) then
    return;
  end if;
  if (attempt.offer_snapshot->>'endsAt')::timestamptz <= now() then raise exception 'This offer has ended.'; end if;
  if attempt.offer_snapshot->>'unlockRule' = 'all' and not exists (
    select 1 from public.meetup_participants where attempt_id = p_attempt_id and user_id = uid
  ) then raise exception 'This whole-group offer is limited to its starting members.'; end if;
  insert into public.meetup_participants(attempt_id, user_id, accepted_at) values(p_attempt_id, uid, now())
    on conflict (attempt_id, user_id) do update set accepted_at = coalesce(meetup_participants.accepted_at, excluded.accepted_at);
end;
$$;

-- Called only by trusted RPCs/trigger, never with a client-supplied clock.
create function public.refresh_meetup_attempt(p_attempt_id uuid)
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

create function public.capture_meetup_checkin()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare attempt_id uuid;
begin
  insert into public.meetup_checkin_events(user_id) values(new.user_id);
  -- Consistent lock ordering avoids deadlocks when two members check in together.
  for attempt_id in select a.id from public.meetup_attempts a
    join public.meetup_participants p on p.attempt_id = a.id
    where p.user_id = new.user_id and p.accepted_at is not null order by a.id
  loop
    perform public.refresh_meetup_attempt(attempt_id);
  end loop;
  return new;
end;
$$;
create trigger capture_meetup_checkin after insert or update on public.checkins
  for each row execute function public.capture_meetup_checkin();

create function public.list_meetup_attempts()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare uid uuid := public.shared_group_require_user(); attempt_id uuid; result jsonb;
begin
  for attempt_id in select a.id from public.meetup_attempts a
    join public.shared_group_members m on m.group_id = a.group_id and m.user_id = uid order by a.id
  loop
    perform public.refresh_meetup_attempt(attempt_id);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'groupId', g.id, 'groupName', g.name, 'offerId', a.offer_id, 'offer', a.offer_snapshot,
    'participants', (select coalesce(jsonb_agg(jsonb_build_object(
      'userId', p.user_id, 'name', coalesce(nullif(pr.username,''),'Group member'),
      'accepted', p.accepted_at is not null, 'qualified', p.qualified_at is not null,
      'current', exists(select 1 from public.shared_group_members m where m.group_id = a.group_id and m.user_id = p.user_id)
    ) order by p.user_id), '[]') from public.meetup_participants p left join public.profiles pr on pr.id = p.user_id where p.attempt_id = a.id),
    'participating', coalesce(mine.accepted_at is not null, false), 'progress', coalesce(mine.progress,0),
    'qualified', coalesce(mine.qualified_at is not null, false), 'rewardId', r.id,
    'rewardEarnedElsewhere', exists(select 1 from public.meetup_rewards other_reward
      where other_reward.offer_id = a.offer_id and other_reward.user_id = uid and other_reward.attempt_id is distinct from a.id),
    'unlockedAt', r.unlocked_at, 'expiresAt', r.expires_at, 'redeemedAt', r.redeemed_at
  ) order by a.selected_at desc, a.id), '[]') into result
  from public.meetup_attempts a join public.shared_groups g on g.id = a.group_id
  left join public.meetup_participants mine on mine.attempt_id = a.id and mine.user_id = uid
  left join public.meetup_rewards r on r.attempt_id = a.id and r.user_id = uid
  where exists(select 1 from public.shared_group_members m where m.group_id = a.group_id and m.user_id = uid);
  return result;
end;
$$;

create function public.redeem_meetup_reward(p_reward_id uuid)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp
as $$
declare uid uuid := public.shared_group_require_user(); reward public.meetup_rewards;
begin
  select * into reward from public.meetup_rewards where id = p_reward_id and user_id = uid for update;
  if not found or not exists(select 1 from public.meetup_attempts a join public.shared_group_members m on m.group_id = a.group_id
    where a.id = reward.attempt_id and m.user_id = uid) then raise exception 'Reward unavailable.'; end if;
  if reward.redeemed_at is not null then raise exception 'This reward has already been redeemed.'; end if;
  if reward.expires_at <= now() then raise exception 'This reward has expired.'; end if;
  update public.meetup_rewards set redeemed_at = now() where id = p_reward_id;
  return now();
end;
$$;

revoke all on function public.is_venue_admin(), public.meetup_require_admin(),
  public.meetup_offer_json(uuid), public.list_meetup_venues(), public.list_meetup_offers(boolean),
  public.save_meetup_venue(uuid,jsonb), public.save_meetup_offer(uuid,jsonb),
  public.select_meetup_offer(uuid,uuid), public.join_meetup_attempt(uuid),
  public.refresh_meetup_attempt(uuid), public.capture_meetup_checkin(),
  public.list_meetup_attempts(), public.redeem_meetup_reward(uuid) from public, anon, authenticated;
grant execute on function public.is_venue_admin(), public.list_meetup_venues(),
  public.list_meetup_offers(boolean), public.save_meetup_venue(uuid,jsonb),
  public.save_meetup_offer(uuid,jsonb), public.select_meetup_offer(uuid,uuid),
  public.join_meetup_attempt(uuid), public.list_meetup_attempts(),
  public.redeem_meetup_reward(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
