begin;

create table public.shared_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  checkin_cadence_days integer not null default 1
    check (checkin_cadence_days in (1, 2, 3, 4, 5, 6, 7, 14, 21, 30)),
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create table public.shared_group_members (
  group_id uuid not null references public.shared_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.shared_group_removals (
  group_id uuid not null references public.shared_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (group_id, user_id)
);

create index shared_group_members_user_idx on public.shared_group_members(user_id);
create index shared_groups_owner_idx on public.shared_groups(owner_id);

alter table public.shared_groups enable row level security;
alter table public.shared_group_members enable row level security;
alter table public.shared_group_removals enable row level security;
revoke all on public.shared_groups, public.shared_group_members, public.shared_group_removals
  from public, anon, authenticated;

create function public.shared_group_require_user()
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not exists (
    select 1 from auth.users where id = current_user_id and email_confirmed_at is not null
  ) then
    raise exception 'Sign in with a verified email to use shared groups.';
  end if;
  return current_user_id;
end;
$$;

create function public.create_shared_group(p_name text, p_cadence integer default 1)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.shared_group_require_user();
  new_group_id uuid;
begin
  insert into public.shared_groups(owner_id, name, checkin_cadence_days)
  values (current_user_id, btrim(p_name), p_cadence) returning id into new_group_id;
  insert into public.shared_group_members(group_id, user_id) values (new_group_id, current_user_id);
  return new_group_id;
end;
$$;

create function public.preview_shared_group(p_code text)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', shared_group.id, 'name', shared_group.name,
    'ownerName', coalesce(nullif(owner_profile.username, ''), 'Group owner'),
    'cadenceDays', shared_group.checkin_cadence_days,
    'memberCount', (select count(*) from public.shared_group_members where group_id = shared_group.id)
  )
  from public.shared_groups shared_group
  left join public.profiles owner_profile on owner_profile.id = shared_group.owner_id
  where shared_group.invite_code = lower(btrim(p_code));
$$;

create function public.join_shared_group(p_code text)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.shared_group_require_user();
  target_group_id uuid;
begin
  select id into target_group_id from public.shared_groups
  where invite_code = lower(btrim(p_code)) for update;
  if target_group_id is null then
    raise exception 'This invite is no longer valid. Ask the owner for a new link.';
  end if;
  if exists (select 1 from public.shared_group_removals
    where group_id = target_group_id and user_id = current_user_id) then
    raise exception 'You have been removed from this group and cannot rejoin.';
  end if;
  insert into public.shared_group_members(group_id, user_id)
  values (target_group_id, current_user_id) on conflict do nothing;
  return target_group_id;
end;
$$;

create function public.list_shared_groups()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.shared_group_require_user();
  result jsonb;
begin
  select coalesce(jsonb_agg(group_data order by group_data->>'name'), '[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id', shared_group.id, 'name', shared_group.name,
      'ownerId', shared_group.owner_id,
      'ownerName', coalesce(nullif(owner_profile.username, ''), 'Group owner'),
      'isOwner', shared_group.owner_id = current_user_id,
      'cadenceDays', shared_group.checkin_cadence_days,
      'inviteCode', case when shared_group.owner_id = current_user_id then shared_group.invite_code else null end,
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', member.user_id,
          'name', coalesce(nullif(member_profile.username, ''), 'Group member'),
          'checkedIn', coalesce(member_profile.last_checkin_at >=
            date_trunc('day', now()) - (shared_group.checkin_cadence_days - 1) * interval '1 day', false)
        ) order by member.joined_at, member.user_id), '[]'::jsonb)
        from public.shared_group_members member
        left join public.profiles member_profile on member_profile.id = member.user_id
        where member.group_id = shared_group.id
      )
    ) as group_data
    from public.shared_groups shared_group
    left join public.profiles owner_profile on owner_profile.id = shared_group.owner_id
    where exists (select 1 from public.shared_group_members
      where group_id = shared_group.id and user_id = current_user_id)
  ) visible_groups;
  return result;
end;
$$;

create function public.manage_shared_group(
  p_group_id uuid, p_action text, p_name text default null,
  p_cadence integer default null, p_member_id uuid default null
)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.shared_group_require_user();
  group_owner_id uuid;
begin
  select owner_id into group_owner_id from public.shared_groups where id = p_group_id for update;
  if group_owner_id is null or not exists (select 1 from public.shared_group_members
    where group_id = p_group_id and user_id = current_user_id) then
    raise exception 'This group is unavailable.';
  end if;
  if p_action = 'leave' then
    if group_owner_id = current_user_id then
      raise exception 'Transfer ownership or delete the group before leaving.';
    end if;
    delete from public.shared_group_members where group_id = p_group_id and user_id = current_user_id;
    return;
  end if;
  if group_owner_id <> current_user_id then
    raise exception 'Only the owner can do that.';
  end if;
  case p_action
    when 'update' then
      update public.shared_groups set name = coalesce(btrim(p_name), name),
        checkin_cadence_days = coalesce(p_cadence, checkin_cadence_days) where id = p_group_id;
    when 'reset_invite' then
      update public.shared_groups set invite_code = replace(gen_random_uuid()::text, '-', '') where id = p_group_id;
    when 'remove_member' then
      if p_member_id is null or p_member_id = current_user_id then
        raise exception 'The owner cannot remove themselves.';
      end if;
      insert into public.shared_group_removals(group_id, user_id)
      values (p_group_id, p_member_id) on conflict do nothing;
      delete from public.shared_group_members where group_id = p_group_id and user_id = p_member_id;
    when 'transfer' then
      if p_member_id is null or p_member_id = current_user_id or not exists (
        select 1 from public.shared_group_members where group_id = p_group_id and user_id = p_member_id
      ) then
        raise exception 'Choose another current member as the new owner.';
      end if;
      update public.shared_groups set owner_id = p_member_id where id = p_group_id;
    when 'delete' then
      delete from public.shared_groups where id = p_group_id;
    else
      raise exception 'Unknown group action.';
  end case;
end;
$$;

revoke all on function public.shared_group_require_user() from public, anon, authenticated;
revoke all on function public.create_shared_group(text, integer) from public, anon, authenticated;
revoke all on function public.preview_shared_group(text) from public, anon, authenticated;
revoke all on function public.join_shared_group(text) from public, anon, authenticated;
revoke all on function public.list_shared_groups() from public, anon, authenticated;
revoke all on function public.manage_shared_group(uuid, text, text, integer, uuid) from public, anon, authenticated;

grant execute on function public.preview_shared_group(text) to anon, authenticated;
grant execute on function public.create_shared_group(text, integer) to authenticated;
grant execute on function public.join_shared_group(text) to authenticated;
grant execute on function public.list_shared_groups() to authenticated;
grant execute on function public.manage_shared_group(uuid, text, text, integer, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;