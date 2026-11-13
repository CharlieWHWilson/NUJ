begin;

create table public.meetup_offer_codes (
  offer_id uuid primary key references public.meetup_offers(id) on delete cascade,
  code text not null check (length(btrim(code)) between 1 and 100)
);
alter table public.meetup_offer_codes enable row level security;
revoke all on public.meetup_offer_codes from public, anon, authenticated;

-- Existing rewards remain valid; listings need an admin-set code before reactivation.
update public.meetup_offers set active = false where active;

create or replace function public.save_meetup_offer(p_id uuid, p_offer jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare offer_id uuid; redemption_code text;
begin
  perform public.meetup_require_admin();
  if p_id is not null then
    perform 1 from public.meetup_offers where id = p_id for update;
    if not found then raise exception 'Offer not found.'; end if;
  end if;
  if p_offer ? 'redemptionCode' then
    redemption_code := nullif(btrim(p_offer->>'redemptionCode'), '');
  else
    select code into redemption_code from public.meetup_offer_codes where meetup_offer_codes.offer_id = p_id;
  end if;
  if length(redemption_code) > 100 then raise exception 'Redemption code must be 100 characters or fewer.'; end if;
  if (p_offer->>'active')::boolean and redemption_code is null then
    raise exception 'Set a redemption code before activating this offer.';
  end if;
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
  end if;
  if redemption_code is null then
    delete from public.meetup_offer_codes where meetup_offer_codes.offer_id = save_meetup_offer.offer_id;
  else
    insert into public.meetup_offer_codes values(offer_id, redemption_code)
      on conflict on constraint meetup_offer_codes_pkey do update set code = excluded.code;
  end if;
  return offer_id;
end;
$$;

create or replace function public.list_meetup_offers(p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  perform public.shared_group_require_user();
  if p_admin then perform public.meetup_require_admin(); end if;
  select coalesce(jsonb_agg(public.meetup_offer_json(o.id) ||
    case when p_admin then jsonb_build_object('redemptionCode', c.code) else '{}'::jsonb end
    order by v.name, o.title, o.id), '[]')
    into result from public.meetup_offers o join public.meetup_venues v on v.id = o.venue_id
    left join public.meetup_offer_codes c on c.offer_id = o.id
    where p_admin or (o.active and v.active and (o.ends_at is null or o.ends_at > now()));
  return result;
end;
$$;

create function public.get_meetup_reward_code(p_reward_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp
as $$
declare uid uuid := public.shared_group_require_user(); reward public.meetup_rewards%rowtype; result text;
begin
  select * into reward from public.meetup_rewards where id = p_reward_id and user_id = uid;
  if not found then raise exception 'Reward not available to this account.'; end if;
  if reward.redeemed_at is not null or reward.expires_at <= now() then
    raise exception 'This reward has expired or already been redeemed.';
  end if;
  if not exists (
    select 1 from public.meetup_participants p join public.meetup_attempts a on a.id = p.attempt_id
    join public.shared_group_members m on m.group_id = a.group_id and m.user_id = p.user_id
    where p.attempt_id = reward.attempt_id and p.user_id = uid and p.accepted_at is not null
  ) then raise exception 'You must still be opted in to this offer.'; end if;
  select code into result from public.meetup_offer_codes where offer_id = reward.offer_id;
  if result is null then raise exception 'The venue has not set a redemption code yet.'; end if;
  return result;
end;
$$;
revoke all on function public.get_meetup_reward_code(uuid) from public, anon, authenticated;
grant execute on function public.get_meetup_reward_code(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
