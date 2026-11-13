begin;

alter table public.meetup_attempts add column redeemed_at timestamptz;

alter function public.refresh_meetup_attempt(uuid) rename to refresh_unredeemed_meetup_attempt;
revoke all on function public.refresh_unredeemed_meetup_attempt(uuid) from public, anon, authenticated;
create function public.refresh_meetup_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform 1 from public.meetup_attempts where id = p_attempt_id and redeemed_at is null for update;
  if found then perform public.refresh_unredeemed_meetup_attempt(p_attempt_id); end if;
end;
$$;
revoke all on function public.refresh_meetup_attempt(uuid) from public, anon, authenticated;

create function public.prevent_redeemed_meetup_join()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.accepted_at is not null and (
    exists(select 1 from public.meetup_attempts where id = new.attempt_id and redeemed_at is not null)
    or exists(select 1 from public.meetup_rewards r join public.meetup_attempts a on a.id = new.attempt_id
      where r.offer_id = a.offer_id and r.user_id = new.user_id and r.redeemed_at is not null)
  ) then raise exception 'This offer has already been redeemed and cannot be rejoined.'; end if;
  return new;
end;
$$;
revoke all on function public.prevent_redeemed_meetup_join() from public, anon, authenticated;
create trigger prevent_redeemed_meetup_join before insert or update of accepted_at
on public.meetup_participants for each row execute function public.prevent_redeemed_meetup_join();

create function public.redeem_meetup_group(p_attempt_id uuid)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp
as $$
declare uid uuid := public.shared_group_require_user(); attempt public.meetup_attempts;
begin
  select * into attempt from public.meetup_attempts where id = p_attempt_id for update;
  if not found or not exists(select 1 from public.shared_group_members where group_id = attempt.group_id and user_id = uid) then
    raise exception 'Join this shared group before redeeming its offer.';
  end if;
  if attempt.offer_snapshot->>'unlockRule' = 'individual' then raise exception 'Individual rewards must be redeemed by their owner.'; end if;
  if attempt.redeemed_at is not null then raise exception 'This group offer has already been redeemed.'; end if;
  perform public.refresh_meetup_attempt(p_attempt_id);
  if not exists(select 1 from public.meetup_rewards r join public.shared_group_members m
    on m.group_id = attempt.group_id and m.user_id = r.user_id
    where r.attempt_id = p_attempt_id and r.redeemed_at is null and r.expires_at > now()) then
    raise exception 'No unlocked, valid group reward is available.';
  end if;
  update public.meetup_attempts set redeemed_at = now() where id = p_attempt_id;
  update public.meetup_rewards set redeemed_at = now() where attempt_id = p_attempt_id and redeemed_at is null;
  return now();
end;
$$;
revoke all on function public.redeem_meetup_group(uuid) from public, anon, authenticated;
grant execute on function public.redeem_meetup_group(uuid) to authenticated;

create or replace function public.redeem_meetup_reward(p_reward_id uuid)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp
as $$
declare uid uuid := public.shared_group_require_user(); reward public.meetup_rewards; attempt public.meetup_attempts;
begin
  select a.* into attempt from public.meetup_attempts a join public.meetup_rewards r on r.attempt_id = a.id
    where r.id = p_reward_id and r.user_id = uid for update of a;
  if not found then raise exception 'Reward unavailable.'; end if;
  if attempt.offer_snapshot->>'unlockRule' <> 'individual' then return public.redeem_meetup_group(attempt.id); end if;
  select * into reward from public.meetup_rewards where id = p_reward_id and user_id = uid for update;
  if not exists(select 1 from public.shared_group_members where group_id = attempt.group_id and user_id = uid) then
    raise exception 'Reward unavailable.';
  end if;
  if reward.redeemed_at is not null then raise exception 'This reward has already been redeemed.'; end if;
  if reward.expires_at <= now() then raise exception 'This reward has expired.'; end if;
  update public.meetup_rewards set redeemed_at = now() where id = p_reward_id;
  return now();
end;
$$;

create or replace function public.list_meetup_attempts()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare uid uuid := public.shared_group_require_user(); attempt_id uuid; result jsonb;
begin
  for attempt_id in select a.id from public.meetup_attempts a
    join public.shared_group_members m on m.group_id = a.group_id and m.user_id = uid order by a.id
  loop perform public.refresh_meetup_attempt(attempt_id); end loop;
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
    'unlockedAt', r.unlocked_at, 'expiresAt', r.expires_at, 'redeemedAt', r.redeemed_at,
    'groupRedeemedAt', a.redeemed_at,
    'canRedeemGroup', a.offer_snapshot->>'unlockRule' <> 'individual' and a.redeemed_at is null and exists(
      select 1 from public.meetup_rewards gr join public.shared_group_members gm on gm.group_id = a.group_id and gm.user_id = gr.user_id
      where gr.attempt_id = a.id and gr.redeemed_at is null and gr.expires_at > now())
  ) order by a.selected_at desc, a.id), '[]') into result
  from public.meetup_attempts a join public.shared_groups g on g.id = a.group_id
  left join public.meetup_participants mine on mine.attempt_id = a.id and mine.user_id = uid
  left join public.meetup_rewards r on r.attempt_id = a.id and r.user_id = uid
  where exists(select 1 from public.shared_group_members m where m.group_id = a.group_id and m.user_id = uid);
  return result;
end;
$$;

notify pgrst, 'reload schema';
commit;
