import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
let database: PGlite;
let migratedCode: string;

async function asUser(id: string) {
  await database.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role authenticated;`);
}

async function scalar<Value>(sql: string): Promise<Value> {
  const result = await database.query<{ value: Value }>(sql);
  return result.rows[0].value;
}

async function createGroup() {
  await asUser(owner);
  const id = await scalar<string>("select public.create_shared_group('School mates', 7) as value");
  const groups = await scalar<Array<{ inviteCode: string }>>("select public.list_shared_groups() as value");
  return { id, code: groups[0].inviteCode };
}

describe("shared-group database permissions", () => {
  beforeAll(async () => {
    database = new PGlite({
      fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob,
    });
    await database.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      create table public.profiles (
        id uuid primary key references auth.users(id) on delete cascade,
        username text, last_checkin_at timestamptz
      );
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    await database.exec(readFileSync("supabase/migrations/034_shared_groups.sql", "utf8"));
    await database.exec(`insert into auth.users values ('${owner}', now());
      insert into public.shared_groups(owner_id, name, invite_code)
      values ('${owner}', 'Existing group', 'abcdef0123456789abcdef0123456789');`);
    await database.exec(readFileSync("supabase/migrations/035_short_shared_group_invites.sql", "utf8"));
    migratedCode = await scalar<string>("select invite_code as value from public.shared_groups");
  }, 30000);

  beforeEach(async () => {
    await database.exec(`reset role; truncate auth.users cascade;
      insert into auth.users values ('${owner}', now()), ('${member}', now()), ('${stranger}', now());
      insert into public.profiles values ('${owner}', 'Owner', now()), ('${member}', 'Member', null), ('${stranger}', 'Stranger', now());`);
  });

  afterAll(async () => { await database?.close(); });

  it("migrates existing codes and generates unique seven-character alphanumeric codes", async () => {
    expect(migratedCode).toMatch(/^[A-Z0-9]{7}$/);
    const { code } = await createGroup();
    expect(code).toMatch(/^[A-Z0-9]{7}$/);
    await database.exec("select public.create_shared_group('Another group', 1) from generate_series(1, 40);");
    const codes = await scalar<Array<{ inviteCode: string }>>("select public.list_shared_groups() as value");
    expect(new Set(codes.map((group) => group.inviteCode)).size).toBe(41);
    expect(codes.every((group) => /^[A-Z0-9]{7}$/.test(group.inviteCode))).toBe(true);
  });

  it("denies direct table access and keeps non-member group lists empty", async () => {
    await createGroup();
    await asUser(stranger);
    expect(await scalar("select public.list_shared_groups() as value")).toEqual([]);
    await expect(database.query("select * from public.shared_groups")).rejects.toThrow(/permission denied/);
    await expect(database.query("select * from public.shared_group_members")).rejects.toThrow(/permission denied/);
    await expect(database.query("select public.shared_group_require_user()")).rejects.toThrow(/permission denied/);
  });

  it("allows anonymous previews without leaking member identities or check-ins", async () => {
    const { code } = await createGroup();
    await database.exec("reset role; set request.jwt.claim.sub = ''; set role anon;");
    const preview = await scalar<Record<string, unknown>>(`select public.preview_shared_group(' ${code.toLowerCase()} ') as value`);
    expect(Object.keys(preview).sort()).toEqual(["cadenceDays", "id", "memberCount", "name", "ownerName"]);
    expect(preview.memberCount).toBe(1);
    await expect(database.query("select public.list_shared_groups()")).rejects.toThrow(/permission denied/);
  });

  it("joins idempotently and shares only cadence status, not check-in history", async () => {
    const { code } = await createGroup();
    await asUser(member);
    await database.exec(`select public.join_shared_group(' ${code.toLowerCase()} '); select public.join_shared_group('${code}');`);
    const groups = await scalar<Array<{ inviteCode: string | null; members: Array<Record<string, unknown>> }>>("select public.list_shared_groups() as value");
    expect(groups[0].inviteCode).toBeNull();
    expect(groups[0].members).toHaveLength(2);
    expect(groups[0].members[0]).toEqual({ id: owner, name: "Owner", checkedIn: true });
    expect(groups[0].members[1]).toEqual({ id: member, name: "Member", checkedIn: false });
  });

  it("rejects unverified users and non-owner management", async () => {
    const { id, code } = await createGroup();
    await asUser(member);
    await database.query(`select public.join_shared_group('${code}')`);
    for (const action of ["update", "reset_invite", "remove_member", "transfer", "delete"]) {
      await expect(database.query(`select public.manage_shared_group('${id}', '${action}')`)).rejects.toThrow("Only the owner");
    }
    await database.exec(`reset role; update auth.users set email_confirmed_at = null where id = '${stranger}';`);
    await asUser(stranger);
    await expect(database.query(`select public.join_shared_group('${code}')`)).rejects.toThrow("verified email");
  });

  it("revokes old invite links and prevents removed members rejoining", async () => {
    const { id, code } = await createGroup();
    await asUser(member);
    await database.query(`select public.join_shared_group('${code}')`);
    await asUser(owner);
    await database.query(`select public.manage_shared_group('${id}', 'remove_member', null, null, '${member}')`);
    await asUser(member);
    await expect(database.query(`select public.join_shared_group('${code}')`)).rejects.toThrow("removed");
    expect(await scalar("select public.list_shared_groups() as value")).toEqual([]);
    await asUser(owner);
    await database.query(`select public.manage_shared_group('${id}', 'reset_invite')`);
    const updated = await scalar<Array<{ inviteCode: string }>>("select public.list_shared_groups() as value");
    expect(updated[0].inviteCode).toMatch(/^[A-Z0-9]{7}$/);
    expect(updated[0].inviteCode).not.toBe(code);
    expect(await scalar(`select public.preview_shared_group('${code}') as value`)).toBeNull();
    await expect(database.query(`select public.join_shared_group('${code}')`)).rejects.toThrow("no longer valid");
  });

  it("supports ownership transfer, leaving, cadence updates and deletion", async () => {
    const { id, code } = await createGroup();
    await expect(database.query(`select public.manage_shared_group('${id}', 'leave')`)).rejects.toThrow("Transfer ownership");
    await expect(database.query(`select public.manage_shared_group('${id}', 'update', 'School', 8)`)).rejects.toThrow(/check constraint/);
    await database.query(`select public.manage_shared_group('${id}', 'update', 'School', 30)`);
    await asUser(member);
    await database.query(`select public.join_shared_group('${code}')`);
    await asUser(owner);
    await database.query(`select public.manage_shared_group('${id}', 'transfer', null, null, '${member}')`);
    await database.query(`select public.manage_shared_group('${id}', 'leave')`);
    expect(await scalar("select public.list_shared_groups() as value")).toEqual([]);
    await asUser(member);
    await database.query(`select public.manage_shared_group('${id}', 'delete')`);
    expect(await scalar(`select public.preview_shared_group('${code}') as value`)).toBeNull();
  });
});