-- Returns latest check-in timestamps for mates the current user has added.
-- Security-definer is used so this stays reliable even if checkins SELECT policies drift.

create or replace function public.get_relevant_mate_checkins(
  p_mate_user_ids uuid[]
)
returns table (
  user_id uuid,
  checked_in_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select c.user_id, c.checked_in_at
  from public.checkins c
  where c.user_id = any(coalesce(p_mate_user_ids, '{}'::uuid[]))
    and exists (
      select 1
      from public.mates m
      where m.user_id = auth.uid()
        and m.mate_user_id = c.user_id
    );
$$;

grant execute on function public.get_relevant_mate_checkins(uuid[]) to authenticated;
