-- Guard helper for reciprocal mate checks when sending NUJs.
-- SECURITY DEFINER bypasses RLS so this returns a trustworthy yes/no result.

create or replace function public.can_send_nuj_to_recipient(p_recipient_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  with sender_profile as (
    select username
    from public.profiles
    where id = auth.uid()
    limit 1
  )
  select case
    when auth.uid() is null then false
    when p_recipient_user_id is null then false
    else exists (
      select 1
      from public.mates m
      left join sender_profile sp on true
      where m.user_id = p_recipient_user_id
        and (
          m.mate_user_id = auth.uid()
          or (
            m.mate_user_id is null
            and sp.username is not null
            and lower(trim(m.name)) = lower(trim(sp.username))
          )
        )
    )
  end;
$$;

grant execute on function public.can_send_nuj_to_recipient(uuid) to authenticated, service_role;
