begin;

create function public.save_personal_group(p_group_id uuid, p_name text, p_mate_ids uuid[])
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.mate_request_require_user();
  target_group_id uuid := p_group_id;
begin
  if p_name is null or btrim(p_name) = '' then raise exception 'Enter a group name.'; end if;
  if exists (select 1 from unnest(coalesce(p_mate_ids, '{}'::uuid[])) requested(mate_id)
    where not exists (select 1 from public.mates mate where mate.id = requested.mate_id and mate.user_id = current_user_id)) then
    raise exception 'Only your own mates can be included in a personal group.';
  end if;
  if target_group_id is null then
    insert into public.groups(user_id, name) values(current_user_id, btrim(p_name)) returning id into target_group_id;
  else
    perform 1 from public.groups where id = target_group_id and user_id = current_user_id for update;
    if not found then raise exception 'This personal group is unavailable.'; end if;
    update public.groups set name = btrim(p_name) where id = target_group_id;
    delete from public.group_mates where group_id = target_group_id;
  end if;
  insert into public.group_mates(group_id, mate_id)
    select target_group_id, requested.mate_id from (select distinct unnest(coalesce(p_mate_ids, '{}'::uuid[])) as mate_id) requested;
  return target_group_id;
end;
$$;

revoke all on function public.save_personal_group(uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.save_personal_group(uuid, text, uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;