begin;

revoke update on public.nujs from public, anon, authenticated;
grant update (acknowledged_at, read_at) on public.nujs to authenticated;

create table public.nuj_push_deliveries (
  nuj_id uuid not null references public.nujs(id) on delete cascade,
  kind text not null check (kind in ('new_nuj', 'nuj_acknowledged')),
  claimed_at timestamptz not null default now(),
  primary key (nuj_id, kind)
);
alter table public.nuj_push_deliveries enable row level security;
revoke all on public.nuj_push_deliveries from public, anon, authenticated;

create function public.claim_nuj_push(p_nuj_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := public.mate_request_require_user();
  event public.nujs%rowtype;
  recipient_id uuid;
  display_name text;
  claimed_id uuid;
begin
  select * into event from public.nujs where id = p_nuj_id for update;
  if event.id is null or not public.are_mutual_mates(event.sender_user_id, event.recipient_user_id) then
    raise exception 'This notification is unavailable.';
  end if;
  if p_kind = 'new_nuj' then
    if event.sender_user_id <> current_user_id or event.acknowledged_at is not null
      or event.created_at < now() - interval '15 minutes' then
      raise exception 'This notification is unavailable.';
    end if;
    recipient_id := event.recipient_user_id;
  elsif p_kind = 'nuj_acknowledged' then
    if event.recipient_user_id <> current_user_id or event.acknowledged_at is null
      or event.acknowledged_at < now() - interval '15 minutes' then
      raise exception 'This notification is unavailable.';
    end if;
    recipient_id := event.sender_user_id;
  else
    raise exception 'Unknown notification type.';
  end if;
  insert into public.nuj_push_deliveries(nuj_id, kind) values(event.id, p_kind)
    on conflict do nothing returning nuj_id into claimed_id;
  if claimed_id is null then return null; end if;
  select coalesce(nullif(btrim(username), ''), 'Your mate') into display_name
    from public.profiles where id = current_user_id;
  return jsonb_build_object(
    'recipientUserId', recipient_id,
    'title', case when p_kind = 'new_nuj' then coalesce(display_name, 'Your mate') || ' sent a NUJ' else 'NUJ acknowledged' end,
    'body', case when p_kind = 'new_nuj' then 'Open NUJ to view it.' else coalesce(display_name, 'Your mate') || ' acknowledged your NUJ.' end,
    'data', jsonb_build_object('type', p_kind, 'nujId', event.id)
  );
end;
$$;

revoke all on function public.claim_nuj_push(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_nuj_push(uuid, text) to authenticated;
notify pgrst, 'reload schema';
commit;