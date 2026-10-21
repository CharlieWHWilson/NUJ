begin;

create function public.assign_shared_group_invite_code()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  candidate text;
  random_byte integer;
begin
  if tg_op = 'UPDATE' and new.invite_code is not distinct from old.invite_code then
    return new;
  end if;
  perform pg_advisory_xact_lock(734035001);
  loop
    candidate := '';
    while char_length(candidate) < 7 loop
      random_byte := get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 0);
      if random_byte < 252 then
        candidate := candidate || substr(alphabet, (random_byte % 36) + 1, 1);
      end if;
    end loop;
    exit when not exists (select 1 from public.shared_groups where invite_code = candidate);
  end loop;
  new.invite_code := candidate;
  return new;
end;
$$;

revoke all on function public.assign_shared_group_invite_code() from public, anon, authenticated;

create trigger assign_shared_group_invite_code
before insert or update of invite_code on public.shared_groups
for each row execute function public.assign_shared_group_invite_code();

alter table public.shared_groups alter column invite_code drop default;
update public.shared_groups set invite_code = null;
alter table public.shared_groups add constraint shared_groups_invite_code_format
  check (invite_code ~ '^[A-Z0-9]{7}$');

create or replace function public.preview_shared_group(p_code text)
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
  where shared_group.invite_code = upper(btrim(p_code));
$$;

create or replace function public.join_shared_group(p_code text)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.shared_group_require_user();
  target_group_id uuid;
begin
  select id into target_group_id from public.shared_groups
  where invite_code = upper(btrim(p_code)) for update;
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

notify pgrst, 'reload schema';
commit;