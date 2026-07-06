-- Allow NUJ senders to cancel pending NUJs they created.
-- Keep recipient-side delete permissions for received NUJs.

drop policy if exists "Recipients can delete received NUJs" on public.nujs;

create policy "Users can delete own received or pending sent NUJs" on public.nujs
  for delete using (
    auth.uid() = recipient_user_id
    or (
      auth.uid() = sender_user_id
      and acknowledged_at is null
    )
  );
