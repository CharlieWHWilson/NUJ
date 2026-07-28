-- Add shared attention-badge support for NUJ and check-in reminders.

alter table if exists public.profiles
  add column if not exists needs_check_in boolean not null default false;

alter table if exists public.nujs
  add column if not exists read_at timestamptz;

create index if not exists idx_nujs_recipient_unread
  on public.nujs (recipient_user_id, read_at, acknowledged_at);

create or replace function public.get_user_badge_count(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  unread_count integer := 0;
  checkin_needed boolean := false;
begin
  select count(*)::int
  into unread_count
  from public.nujs
  where recipient_user_id = p_user_id
    and acknowledged_at is null
    and read_at is null;

  select coalesce(p.needs_check_in, false)
  into checkin_needed
  from public.profiles p
  where p.id = p_user_id;

  return unread_count + case when checkin_needed then 1 else 0 end;
end;
$$;

create or replace function public.get_my_badge_count()
returns integer
language sql
security definer
set search_path = public, auth
as $$
  select case
    when auth.uid() is null then 0
    else public.get_user_badge_count(auth.uid())
  end;
$$;

grant execute on function public.get_user_badge_count(uuid) to authenticated, service_role;
grant execute on function public.get_my_badge_count() to authenticated;
