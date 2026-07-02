-- Allow only one active NUJ per sender/recipient pair until it is acknowledged.

delete from public.nujs duplicate
using public.nujs original
where duplicate.id <> original.id
  and duplicate.sender_user_id = original.sender_user_id
  and duplicate.recipient_user_id = original.recipient_user_id
  and duplicate.acknowledged_at is null
  and original.acknowledged_at is null
  and (
    duplicate.created_at > original.created_at
    or (duplicate.created_at = original.created_at and duplicate.id > original.id)
  );

create unique index if not exists idx_nujs_one_active_per_pair
  on public.nujs (sender_user_id, recipient_user_id)
  where acknowledged_at is null;