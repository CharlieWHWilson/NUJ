create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create unique index if not exists idx_push_tokens_user_token_unique
  on public.push_tokens (user_id, token);

create index if not exists idx_push_tokens_user_id
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "Users manage own push tokens" on public.push_tokens;

create policy "Users manage own push tokens"
on public.push_tokens
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
