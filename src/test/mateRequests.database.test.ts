import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const third = "33333333-3333-4333-8333-333333333333";
let database: PGlite;
let migrated: Array<{ user_id: string; mate_user_id: string; connection_accepted: boolean }>;

async function asUser(id: string) {
  await database.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role authenticated;`);
}

async function scalar<Value>(sql: string): Promise<Value> {
  return (await database.query<{ value: Value }>(sql)).rows[0].value;
}

async function requestAndAccept() {
  await asUser(first);
  const request = await scalar<{ requestId: string }>(`select public.send_mate_request('${second}') as value`);
  await asUser(second);
  const mateId = await scalar<string>(`select public.respond_to_mate_request('${request.requestId}', 'accept') as value`);
  return { requestId: request.requestId, mateId };
}

describe("mate request consent and privacy", () => {
  beforeAll(async () => {
    database = new PGlite();
    await database.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      create table public.profiles(id uuid primary key references auth.users on delete cascade,
        username text, user_code text, last_checkin_at timestamptz);
      create table public.checkins(user_id uuid primary key references auth.users on delete cascade, checked_in_at timestamptz);
      create table public.nujs(id uuid primary key default gen_random_uuid(), sender_user_id uuid references auth.users on delete cascade,
        recipient_user_id uuid references auth.users on delete cascade, acknowledged_at timestamptz, read_at timestamptz, created_at timestamptz not null default now());
      alter table public.profiles enable row level security;
      alter table public.checkins enable row level security;
      alter table public.nujs enable row level security;
      create policy "lookup" on public.profiles for select using(true);
      create policy "read checkins" on public.checkins for select using(true);
      create policy "send" on public.nujs for insert with check(auth.uid() = sender_user_id);
      create policy "read own nujs" on public.nujs for select using(auth.uid() in (sender_user_id, recipient_user_id));
      create policy "acknowledge own nujs" on public.nujs for update using(auth.uid() = recipient_user_id) with check(auth.uid() = recipient_user_id);
      grant select on public.profiles, public.checkins, public.nujs to anon, authenticated;
      grant insert on public.nujs to authenticated;
    `);
    await database.exec(readFileSync("supabase/migrations/001_create_mates_and_groups.sql", "utf8"));
    await database.exec(`alter table public.mates add column mate_user_id uuid references auth.users on delete cascade;
      alter table public.mates add constraint mates_user_mate_unique unique(user_id, mate_user_id);
      grant all on public.mates to authenticated;
      insert into auth.users values ('${first}', now()), ('${second}', now()), ('${third}', now());
      insert into public.mates(user_id, mate_user_id, name, initials) values
      ('${first}', '${second}', 'Second', 'S'), ('${second}', '${first}', 'First', 'F'), ('${first}', '${third}', 'Third', 'T');`);
    await database.exec(readFileSync("supabase/migrations/034_shared_groups.sql", "utf8"));
    await database.exec(readFileSync("supabase/migrations/035_short_shared_group_invites.sql", "utf8"));
    await database.exec(readFileSync("supabase/migrations/036_mate_requests.sql", "utf8"));
    await database.exec(readFileSync("supabase/migrations/037_authorize_nuj_push.sql", "utf8"));
    migrated = (await database.query<typeof migrated[number]>("select user_id, mate_user_id, connection_accepted from public.mates")).rows;
  }, 30000);

  beforeEach(async () => {
    await database.exec(`reset role; truncate auth.users cascade;
      insert into auth.users values ('${first}', now()), ('${second}', now()), ('${third}', now());
      insert into public.profiles values ('${first}', 'Alex', 'ABC1234', now()), ('${second}', 'Alex', 'DEF5678', now()), ('${third}', 'Charlie', 'GHI9012', now());
      insert into public.checkins values ('${first}', now()), ('${second}', now()), ('${third}', now());`);
  });
  afterAll(async () => { await database?.close(); });

  it("preserves only existing reciprocal pairs without creating requests", async () => {
    expect(migrated.filter((mate) => mate.connection_accepted)).toHaveLength(2);
    expect(migrated.find((mate) => mate.mate_user_id === third)?.connection_accepted).toBe(false);
    expect(await scalar("select count(*)::int as value from public.mate_requests")).toBe(0);
  });

  it("keeps pending requests private and blocks direct mate writes and check-in access", async () => {
    await asUser(first);
    const request = await scalar<{ status: string; requestId: string }>(`select public.send_mate_request('${second}') as value`);
    expect(request.status).toBe("pending");
    expect((await database.query("select * from public.mates")).rows).toHaveLength(0);
    expect((await database.query(`select * from public.profiles where id = '${second}'`)).rows).toHaveLength(0);
    expect((await database.query(`select * from public.checkins where user_id = '${second}'`)).rows).toHaveLength(0);
    expect((await database.query(`select * from public.get_relevant_mate_checkins(array['${second}'::uuid])`)).rows).toHaveLength(0);
    await expect(database.exec(`insert into public.mates(user_id, mate_user_id, name, initials) values('${first}', '${second}', 'Alex', 'A')`)).rejects.toThrow(/permission denied/);
    await expect(database.exec(`insert into public.nujs(sender_user_id, recipient_user_id) values('${first}', '${second}')`)).rejects.toThrow(/row-level security/);
    await asUser(third);
    await expect(database.query("select * from public.mate_requests")).rejects.toThrow(/permission denied/);
    await expect(database.query(`select public.respond_to_mate_request('${request.requestId}', 'accept')`)).rejects.toThrow("unavailable");
  });

  it("does not auto-accept repeated or crossed requests", async () => {
    await asUser(first);
    const sent = await scalar<{ requestId: string }>(`select public.send_mate_request('${second}') as value`);
    expect(await scalar(`select public.send_mate_request('${second}')->>'status' as value`)).toBe("pending");
    await asUser(second);
    const crossed = await scalar<{ status: string; requestId: string }>(`select public.send_mate_request('${first}') as value`);
    expect(crossed).toMatchObject({ status: "incoming", requestId: sent.requestId });
    expect(await scalar(`select public.can_send_nuj_to_recipient('${first}') as value`)).toBe(false);
    await expect(database.query(`select public.respond_to_mate_request('${sent.requestId}', 'cancel')`)).rejects.toThrow("Only the sender");
    await asUser(first);
    await expect(database.query(`select public.respond_to_mate_request('${sent.requestId}', 'accept')`)).rejects.toThrow("Only the recipient");
  });

  it("creates both sides atomically only after acceptance and allows NUJs and check-ins", async () => {
    const { mateId } = await requestAndAccept();
    expect(mateId).toBeTruthy();
    expect(await scalar(`select public.can_send_nuj_to_recipient('${first}') as value`)).toBe(true);
    expect((await database.query(`select * from public.get_relevant_mate_checkins(array['${first}'::uuid])`)).rows).toHaveLength(1);
    await database.exec(`insert into public.nujs(sender_user_id, recipient_user_id) values('${second}', '${first}')`);
    await asUser(first);
    expect(await scalar(`select public.send_mate_request('${second}')->>'status' as value`)).toBe("mates");
    expect((await database.query(`select * from public.profiles where id = '${second}'`)).rows).toHaveLength(1);
    expect(await scalar("select count(*)::int as value from public.mates")).toBe(1);
  });

  it("keeps declines private and prevents repeated requests from the declined sender", async () => {
    await asUser(first);
    const request = await scalar<{ requestId: string }>(`select public.send_mate_request('${second}') as value`);
    await asUser(second);
    await database.query(`select public.respond_to_mate_request('${request.requestId}', 'decline')`);
    await asUser(first);
    expect(await scalar("select public.list_mate_requests() as value")).toEqual({ incoming: [], outgoing: [], previous: [] });
    await expect(database.query(`select public.send_mate_request('${second}')`)).rejects.toThrow("cannot be sent");
    await asUser(second);
    expect(await scalar(`select public.send_mate_request('${first}')->>'status' as value`)).toBe("pending");
  });

  it("allows cancellation but prevents immediate repeated requests", async () => {
    await asUser(first);
    const request = await scalar<{ requestId: string }>(`select public.send_mate_request('${second}') as value`);
    await database.query(`select public.respond_to_mate_request('${request.requestId}', 'cancel')`);
    await expect(database.query(`select public.send_mate_request('${second}')`)).rejects.toThrow("wait");
    expect(await scalar("select public.list_mate_requests() as value")).toEqual({ incoming: [], outgoing: [], previous: [] });
  });

  it("removes both sides and pending NUJs without letting the other person immediately reconnect", async () => {
    const { mateId } = await requestAndAccept();
    await database.exec(`insert into public.nujs(sender_user_id, recipient_user_id) values('${second}', '${first}')`);
    await database.query(`select public.remove_mate_connection('${mateId}')`);
    expect(await scalar(`select public.can_send_nuj_to_recipient('${first}') as value`)).toBe(false);
    expect((await database.query(`select * from public.profiles where id = '${first}'`)).rows).toHaveLength(0);
    await asUser(first);
    expect((await database.query("select * from public.mates")).rows).toHaveLength(0);
    await expect(database.query(`select public.send_mate_request('${second}')`)).rejects.toThrow("cannot be sent");
    await database.exec("reset role;");
    expect(await scalar("select count(*)::int as value from public.nujs")).toBe(0);
  });

  it("rejects self requests, unverified users and anonymous access", async () => {
    await asUser(first);
    await expect(database.query(`select public.send_mate_request('${first}')`)).rejects.toThrow("yourself");
    await database.exec(`reset role; update auth.users set email_confirmed_at = null where id = '${second}';`);
    await asUser(first);
    await expect(database.query(`select public.send_mate_request('${second}')`)).rejects.toThrow("unavailable");
    await asUser(second);
    await expect(database.query("select public.list_mate_requests()")).rejects.toThrow("verified email");
    await database.exec("reset role; set request.jwt.claim.sub = ''; set role anon;");
    expect((await database.query("select * from public.profiles")).rows).toHaveLength(0);
    await expect(database.query(`select public.send_mate_request('${first}')`)).rejects.toThrow(/permission denied/);
  });

  it("authorizes event-based pushes once, with the server choosing recipient and display name", async () => {
    await requestAndAccept();
    const id = await scalar<string>(`insert into public.nujs(sender_user_id, recipient_user_id) values('${second}', '${first}') returning id as value`);
    const push = await scalar<Record<string, unknown>>(`select public.claim_nuj_push('${id}', 'new_nuj') as value`);
    expect(push).toMatchObject({ recipientUserId: first, title: "Alex sent a NUJ", body: "Open NUJ to view it.", data: { type: "new_nuj", nujId: id } });
    expect(await scalar(`select public.claim_nuj_push('${id}', 'new_nuj') as value`)).toBeNull();
    await expect(database.query(`select public.claim_nuj_push('${id}', 'nuj_acknowledged')`)).rejects.toThrow("unavailable");
    await asUser(third);
    await expect(database.query(`select public.claim_nuj_push('${id}', 'new_nuj')`)).rejects.toThrow("unavailable");
    await expect(database.query("select * from public.nuj_push_deliveries")).rejects.toThrow(/permission denied/);
    await database.exec(`reset role; update public.nujs set acknowledged_at = now() where id = '${id}';`);
    await asUser(first);
    expect(await scalar(`select public.claim_nuj_push('${id}', 'nuj_acknowledged')->>'recipientUserId' as value`)).toBe(second);
    expect(await scalar(`select public.claim_nuj_push('${id}', 'nuj_acknowledged') as value`)).toBeNull();
  });

  it("rejects missing, old, or non-mutual notification events", async () => {
    await requestAndAccept();
    const id = await scalar<string>(`insert into public.nujs(sender_user_id, recipient_user_id) values('${second}', '${first}') returning id as value`);
    await database.exec(`reset role; update public.nujs set created_at = now() - interval '1 hour' where id = '${id}';`);
    await asUser(second);
    await expect(database.query(`select public.claim_nuj_push('${id}', 'new_nuj')`)).rejects.toThrow("unavailable");
    await expect(database.query(`select public.claim_nuj_push('${third}', 'new_nuj')`)).rejects.toThrow("unavailable");
    await database.exec(`reset role; update public.nujs set created_at = now() where id = '${id}'; update public.mates set connection_accepted = false;`);
    await asUser(second);
    await expect(database.query(`select public.claim_nuj_push('${id}', 'new_nuj')`)).rejects.toThrow("unavailable");
  });

  it("allows acknowledgement but prevents clients rewriting a NUJ's sender or creation time", async () => {
    await requestAndAccept();
    const id = await scalar<string>(`insert into public.nujs(sender_user_id, recipient_user_id) values('${second}', '${first}') returning id as value`);
    await asUser(first);
    await expect(database.query(`update public.nujs set sender_user_id = '${third}' where id = '${id}'`)).rejects.toThrow(/permission denied/);
    await expect(database.query(`update public.nujs set created_at = now() where id = '${id}'`)).rejects.toThrow(/permission denied/);
    await database.query(`update public.nujs set acknowledged_at = now(), read_at = now() where id = '${id}'`);
    expect(await scalar(`select public.claim_nuj_push('${id}', 'nuj_acknowledged')->>'recipientUserId' as value`)).toBe(second);
  });

  it("keeps shared membership separate from mate consent and preserves it after removal", async () => {
    await asUser(first);
    const groupId = await scalar<string>("select public.create_shared_group('School', 7) as value");
    const groups = await scalar<Array<{ inviteCode: string }>>("select public.list_shared_groups() as value");
    await asUser(second);
    await database.query(`select public.join_shared_group('${groups[0].inviteCode}')`);
    expect((await database.query(`select * from public.profiles where id = '${first}'`)).rows).toHaveLength(0);
    const { mateId } = await requestAndAccept();
    await database.query(`select public.remove_mate_connection('${mateId}')`);
    const remaining = await scalar<Array<{ id: string; members: unknown[] }>>("select public.list_shared_groups() as value");
    expect(remaining[0].id).toBe(groupId);
    expect(remaining[0].members).toHaveLength(2);
  });

  it("keeps previous additions private until accepted and allows names to be shared by different mates", async () => {
    await database.exec(`insert into public.mates(user_id, mate_user_id, name, initials, last_checkin, days_since_checkin)
      values ('${first}', '${second}', 'Old Alex', 'A', 'today', 0);
      update public.profiles set username = 'Alex' where id = '${third}';`);
    await asUser(first);
    const pending = await scalar<{ previous: Array<Record<string, unknown>> }>("select public.list_mate_requests() as value");
    expect(Object.keys(pending.previous[0]).sort()).toEqual(["id", "name", "userId"]);
    expect((await database.query("select * from public.mates")).rows).toHaveLength(0);
    await requestAndAccept();
    await asUser(first);
    const request = await scalar<{ requestId: string }>(`select public.send_mate_request('${third}') as value`);
    await asUser(third);
    await database.query(`select public.respond_to_mate_request('${request.requestId}', 'accept')`);
    await asUser(first);
    expect((await database.query("select * from public.mates where name = 'Alex'")).rows).toHaveLength(2);
    const result = await scalar<{ previous: unknown[] }>("select public.list_mate_requests() as value");
    expect(result.previous).toEqual([]);
  });
});