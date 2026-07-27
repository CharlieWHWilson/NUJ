-- Keep profiles readable only after the owning auth user has verified their email.
-- The NUJ-code RPC already filters unverified users; this closes direct select access too.

create or replace function public.is_profile_email_verified(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = profile_id
      and coalesce(u.email_confirmed_at, u.confirmed_at) is not null
  );
$$;

drop policy if exists "Public profile lookup" on public.profiles;

create policy "Verified profile lookup" on public.profiles
  for select
  using (public.is_profile_email_verified(id));

grant execute on function public.is_profile_email_verified(uuid) to public;