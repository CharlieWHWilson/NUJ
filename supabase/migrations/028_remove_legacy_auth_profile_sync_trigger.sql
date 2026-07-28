-- Remove legacy auth->profiles contact sync trigger that can break signup.
-- Current signup/profile behavior is handled by public.handle_new_auth_user().

drop trigger if exists trg_sync_profile_contact_from_auth on auth.users;
drop function if exists public.sync_profile_contact_from_auth();
