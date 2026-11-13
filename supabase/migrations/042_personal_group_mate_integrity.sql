begin;

delete from public.group_mates link
using public.groups owned_group
where owned_group.id = link.group_id
  and not exists (
    select 1 from public.mates mate
    where mate.id = link.mate_id and mate.user_id = owned_group.user_id
  );

-- Production mates use (user_id, id), so cleanup must include the owner.
create function public.remove_deleted_mate_group_links()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  delete from public.group_mates link
  using public.groups owned_group
  where owned_group.id = link.group_id
    and owned_group.user_id = old.user_id
    and link.mate_id = old.id;
  return old;
end;
$$;

revoke all on function public.remove_deleted_mate_group_links() from public, anon, authenticated;

create trigger remove_deleted_mate_group_links
after delete on public.mates
for each row execute function public.remove_deleted_mate_group_links();

commit;
