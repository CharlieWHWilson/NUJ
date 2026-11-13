begin;

alter table public.meetup_venues
  add column category text not null default 'other'
  check (category in ('cafe', 'pub', 'entertainment', 'activity', 'other'));

create or replace function public.meetup_offer_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', o.id, 'venueId', v.id, 'title', o.title, 'reward', o.reward, 'terms', o.terms,
    'period', o.period, 'periods', o.periods, 'unlockRule', o.unlock_rule,
    'minimumMembers', o.minimum_members, 'recipients', o.recipients,
    'redemptionDays', o.redemption_days, 'endsAt', o.ends_at, 'active', o.active,
    'venue', jsonb_build_object('id', v.id, 'name', v.name, 'address', v.address,
      'description', v.description, 'timezone', v.timezone, 'active', v.active,
      'latitude', v.latitude, 'longitude', v.longitude, 'category', v.category)
  ) from public.meetup_offers o join public.meetup_venues v on v.id = o.venue_id where o.id = p_id;
$$;

create or replace function public.save_meetup_venue(p_id uuid, p_venue jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare venue_id uuid;
begin
  perform public.meetup_require_admin();
  if not exists(select 1 from pg_timezone_names where name = p_venue->>'timezone') then
    raise exception 'Choose a valid IANA timezone, such as Europe/London.';
  end if;
  if p_venue ? 'category' and (
    p_venue->>'category' is null or p_venue->>'category' not in ('cafe', 'pub', 'entertainment', 'activity', 'other')
  ) then raise exception 'Choose a valid venue category.'; end if;
  if p_id is null then
    insert into public.meetup_venues(name, address, description, timezone, active, latitude, longitude, category)
      values(btrim(p_venue->>'name'), btrim(p_venue->>'address'), coalesce(p_venue->>'description', ''),
        p_venue->>'timezone', (p_venue->>'active')::boolean,
        (p_venue->>'latitude')::double precision, (p_venue->>'longitude')::double precision,
        coalesce(p_venue->>'category', 'other'))
      returning id into venue_id;
  else
    update public.meetup_venues set name = btrim(p_venue->>'name'), address = btrim(p_venue->>'address'),
      description = coalesce(p_venue->>'description', ''), timezone = p_venue->>'timezone',
      active = (p_venue->>'active')::boolean,
      latitude = case when p_venue ? 'latitude' then (p_venue->>'latitude')::double precision else latitude end,
      longitude = case when p_venue ? 'longitude' then (p_venue->>'longitude')::double precision else longitude end,
      category = case when p_venue ? 'category' then p_venue->>'category' else category end
      where id = p_id returning id into venue_id;
    if venue_id is null then raise exception 'Venue not found.'; end if;
  end if;
  return venue_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
