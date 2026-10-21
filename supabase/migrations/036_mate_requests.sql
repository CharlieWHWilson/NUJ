begin;

alter table public.mates add column connection_accepted boolean not null default false;
alter table public.mates drop constraint if exists mates_user_id_name_key;

update public.mates original set connection_accepted = true
where original.mate_user_id is not null and original.user_id <> original.mate_user_id
and exists (select 1 from public.mates reciprocal
  where reciprocal.user_id = original.mate_user_id and reciprocal.mate_user_id = original.user_id);

create table public.mate_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'closed', 'cancelled')),
  closed_by uuid references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create unique index mate_requests_pair_unique on public.mate_requests
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id));
create index mate_requests_recipient_idx on public.mate_requests(recipient_id) where status = 'pending';
create index mate_requests_sender_idx on public.mate_requests(sender_id) where status = 'pending';
alter table public.mate_requests enable row level security;
revoke all on public.mate_requests from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.mates from public, anon, authenticated;

create function public.mate_request_require_user()
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not exists (
    select 1 from auth.users where id = current_user_id and email_confirmed_at is not null
  ) then
    raise exception 'Sign in with a verified email to manage mates.';
  end if;
  return current_user_id;
end;
$$;

create function public.are_mutual_mates(p_first uuid, p_second uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select (auth.uid() = p_first or auth.uid() = p_second)
    and p_first <> p_second
    and exists (select 1 from public.mates where user_id = p_first and mate_user_id = p_second and connection_accepted)
    and exists (select 1 from public.mates where user_id = p_second and mate_user_id = p_first and connection_accepted);
$$;

create policy mates_accepted_connections on public.mates as restrictive
for select to public using (user_id = auth.uid() and connection_accepted);
create policy profiles_connection_privacy on public.profiles as restrictive
for select to public using (id = auth.uid() or public.are_mutual_mates(auth.uid(), id));
create policy checkins_connection_privacy on public.checkins as restrictive
for select to public using (user_id = auth.uid() or public.are_mutual_mates(auth.uid(), user_id));
create policy nujs_mutual_connection on public.nujs as restrictive
for insert to public with check (sender_user_id = auth.uid() and public.are_mutual_mates(sender_user_id, recipient_user_id));

create or replace function public.get_relevant_mate_checkins(p_mate_user_ids uuid[])
returns table(user_id uuid, checked_in_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select checkin.user_id, checkin.checked_in_at from public.checkins checkin
  where checkin.user_id = any(coalesce(p_mate_user_ids, '{}'::uuid[]))
    and public.are_mutual_mates(auth.uid(), checkin.user_id);
$$;

create or replace function public.can_send_nuj_to_recipient(p_recipient_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce(public.are_mutual_mates(auth.uid(), p_recipient_user_id), false); $$;

create or replace function public.get_profile_by_user_code(p_user_code text)
returns table(user_id uuid, username text, user_code text, email text)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  perform public.mate_request_require_user();
  return query select profile.id, coalesce(nullif(btrim(profile.username), ''), 'Mate'), profile.user_code, null::text
  from public.profiles profile join auth.users account on account.id = profile.id
  where profile.user_code = upper(btrim(p_user_code)) and account.email_confirmed_at is not null;
end;
$$;

create function public.send_mate_request(p_recipient_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.mate_request_require_user();
  existing public.mate_requests%rowtype;
  existing_mate_id uuid;
begin
  if p_recipient_id is null or p_recipient_id = current_user_id then
    raise exception 'Choose someone other than yourself.';
  end if;
  if not exists (select 1 from auth.users account join public.profiles profile on profile.id = account.id
    where account.id = p_recipient_id and account.email_confirmed_at is not null) then
    raise exception 'This person is unavailable.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(current_user_id, p_recipient_id)::text || greatest(current_user_id, p_recipient_id)::text, 36036));
  if public.are_mutual_mates(current_user_id, p_recipient_id) then
    select id into existing_mate_id from public.mates where user_id = current_user_id and mate_user_id = p_recipient_id;
    return jsonb_build_object('status', 'mates', 'requestId', null, 'mateId', existing_mate_id);
  end if;
  select * into existing from public.mate_requests
  where least(sender_id, recipient_id) = least(current_user_id, p_recipient_id)
    and greatest(sender_id, recipient_id) = greatest(current_user_id, p_recipient_id) for update;
  if existing.status = 'pending' then
    return jsonb_build_object('status', case when existing.sender_id = current_user_id then 'pending' else 'incoming' end,
      'requestId', existing.id, 'mateId', null);
  end if;
  if existing.status = 'closed' and existing.closed_by is distinct from current_user_id then
    raise exception 'A request cannot be sent right now.';
  end if;
  if existing.status = 'cancelled' and existing.requested_at > now() - interval '1 day' then
    raise exception 'Please wait before sending another request.';
  end if;
  if existing.id is null then
    insert into public.mate_requests(sender_id, recipient_id) values(current_user_id, p_recipient_id)
      returning * into existing;
  else
    update public.mate_requests set sender_id = current_user_id, recipient_id = p_recipient_id,
      status = 'pending', closed_by = null, requested_at = now() where id = existing.id returning * into existing;
  end if;
  return jsonb_build_object('status', 'pending', 'requestId', existing.id, 'mateId', null);
end;
$$;

create function public.respond_to_mate_request(p_request_id uuid, p_action text)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.mate_request_require_user();
  request public.mate_requests%rowtype;
  result_mate_id uuid;
begin
  select * into request from public.mate_requests where id = p_request_id;
  if request.id is null or current_user_id not in (request.sender_id, request.recipient_id) then
    raise exception 'This request is unavailable.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(request.sender_id, request.recipient_id)::text || greatest(request.sender_id, request.recipient_id)::text, 36036));
  select * into request from public.mate_requests where id = p_request_id for update;
  if p_action = 'cancel' then
    if request.sender_id <> current_user_id then raise exception 'Only the sender can cancel.'; end if;
  elsif p_action in ('accept', 'decline') then
    if request.recipient_id <> current_user_id then raise exception 'Only the recipient can accept or decline.'; end if;
  else
    raise exception 'Unknown request action.';
  end if;
  if request.status <> 'pending' then raise exception 'This request is no longer pending.'; end if;
  if p_action = 'accept' then
    if not exists (select 1 from auth.users where id = request.sender_id and email_confirmed_at is not null) then
      raise exception 'This person is unavailable.';
    end if;
    insert into public.mates(user_id, mate_user_id, name, initials, connection_accepted)
    select request.sender_id, profile.id, coalesce(nullif(btrim(profile.username), ''), 'Mate'),
      upper(left(coalesce(nullif(btrim(profile.username), ''), 'Mate'), 1)), true
      from public.profiles profile where profile.id = request.recipient_id
    union all
    select request.recipient_id, profile.id, coalesce(nullif(btrim(profile.username), ''), 'Mate'),
      upper(left(coalesce(nullif(btrim(profile.username), ''), 'Mate'), 1)), true
      from public.profiles profile where profile.id = request.sender_id
    on conflict (user_id, mate_user_id) do update set connection_accepted = true, name = excluded.name, initials = excluded.initials;
    if not public.are_mutual_mates(request.sender_id, request.recipient_id) then
      raise exception 'Both profiles are required to accept this request.';
    end if;
    update public.mate_requests set status = 'accepted', closed_by = null where id = request.id;
    select id into result_mate_id from public.mates where user_id = current_user_id and mate_user_id = request.sender_id;
    return result_mate_id;
  end if;
  update public.mate_requests set status = case when p_action = 'decline' then 'closed' else 'cancelled' end,
    closed_by = case when p_action = 'decline' then current_user_id else null end where id = request.id;
  return null;
end;
$$;

create function public.list_mate_requests()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.mate_request_require_user();
begin
  return jsonb_build_object(
    'incoming', (select coalesce(jsonb_agg(jsonb_build_object('id', request.id, 'userId', request.sender_id,
      'name', coalesce(nullif(btrim(profile.username), ''), 'Mate')) order by request.requested_at), '[]'::jsonb)
      from public.mate_requests request join public.profiles profile on profile.id = request.sender_id
      where request.recipient_id = current_user_id and request.status = 'pending'),
    'outgoing', (select coalesce(jsonb_agg(jsonb_build_object('id', request.id, 'userId', request.recipient_id,
      'name', coalesce(nullif(btrim(profile.username), ''), 'Mate')) order by request.requested_at), '[]'::jsonb)
      from public.mate_requests request join public.profiles profile on profile.id = request.recipient_id
      where request.sender_id = current_user_id and request.status = 'pending'),
    'previous', (select coalesce(jsonb_agg(jsonb_build_object('id', mate.id, 'userId', mate.mate_user_id, 'name', mate.name)
      order by mate.name), '[]'::jsonb) from public.mates mate where mate.user_id = current_user_id and not mate.connection_accepted)
  );
end;
$$;

create function public.remove_mate_connection(p_mate_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.mate_request_require_user();
  other_user_id uuid;
begin
  select mate_user_id into other_user_id from public.mates where id = p_mate_id and user_id = current_user_id and connection_accepted;
  if other_user_id is null then raise exception 'This mate is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(current_user_id, other_user_id)::text || greatest(current_user_id, other_user_id)::text, 36036));
  insert into public.mate_requests(sender_id, recipient_id, status, closed_by)
    values (current_user_id, other_user_id, 'closed', current_user_id)
    on conflict (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
    do update set status = 'closed', closed_by = current_user_id;
  delete from public.mates where (user_id = current_user_id and mate_user_id = other_user_id)
    or (user_id = other_user_id and mate_user_id = current_user_id);
  delete from public.nujs where acknowledged_at is null and
    ((sender_user_id = current_user_id and recipient_user_id = other_user_id)
    or (sender_user_id = other_user_id and recipient_user_id = current_user_id));
end;
$$;

create function public.dismiss_previous_mate(p_mate_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.mate_request_require_user();
begin
  delete from public.mates where id = p_mate_id and user_id = current_user_id and not connection_accepted;
end;
$$;

revoke all on function public.mate_request_require_user() from public, anon, authenticated;
revoke all on function public.are_mutual_mates(uuid, uuid) from public, anon, authenticated;
revoke all on function public.send_mate_request(uuid) from public, anon, authenticated;
revoke all on function public.respond_to_mate_request(uuid, text) from public, anon, authenticated;
revoke all on function public.list_mate_requests() from public, anon, authenticated;
revoke all on function public.remove_mate_connection(uuid) from public, anon, authenticated;
revoke all on function public.dismiss_previous_mate(uuid) from public, anon, authenticated;
revoke all on function public.get_relevant_mate_checkins(uuid[]) from public, anon;
revoke all on function public.get_profile_by_user_code(text) from public, anon;
revoke all on function public.can_send_nuj_to_recipient(uuid) from public, anon;
grant execute on function public.are_mutual_mates(uuid, uuid) to anon, authenticated;
grant execute on function public.send_mate_request(uuid) to authenticated;
grant execute on function public.respond_to_mate_request(uuid, text) to authenticated;
grant execute on function public.list_mate_requests() to authenticated;
grant execute on function public.remove_mate_connection(uuid) to authenticated;
grant execute on function public.dismiss_previous_mate(uuid) to authenticated;
grant execute on function public.get_relevant_mate_checkins(uuid[]) to authenticated;
grant execute on function public.get_profile_by_user_code(text) to authenticated;
grant execute on function public.can_send_nuj_to_recipient(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;