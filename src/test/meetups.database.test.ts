import { readFileSync } from "node:fs";
import { Blob as NodeBlob } from "node:buffer";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
let db: PGlite;

async function asUser(id: string) {
  await db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role authenticated;`);
}
async function scalar<T>(sql: string, params?: unknown[]): Promise<T> {
  const result = await db.query<{ value: T }>(sql, params);
  return result.rows[0].value;
}
const venueInput = { name: "Pilot cafe", address: "1 High Street", description: "Come together", timezone: "Europe/London", active: true };
const offerInput = {
  title: "Group coffee", reward: "20% off coffee", terms: "One use per person",
  period: "day", periods: 2, unlockRule: "individual", minimumMembers: 2,
  recipients: "qualifying", redemptionDays: 7, endsAt: null, active: true,
};
async function setupOffer(overrides: Partial<typeof offerInput> = {}) {
  await asUser(owner);
  const venueId = await scalar<string>("select save_meetup_venue(null, $1) as value", [venueInput]);
  const offerId = await scalar<string>("select save_meetup_offer(null, $1) as value", [{ ...offerInput, ...overrides, venueId }]);
  const groupId = await scalar<string>("select create_shared_group('Mates', 7) as value");
  await db.exec(`reset role; insert into shared_group_members values ('${groupId}', '${member}', now());`);
  await asUser(owner);
  const attemptId = await scalar<string>("select select_meetup_offer($1,$2) as value", [groupId, offerId]);
  return { venueId, offerId, groupId, attemptId };
}
async function acceptedDaysAgo(attemptId: string, user: string, days: number) {
  await db.exec("reset role");
  await db.query(`update meetup_participants set accepted_at =
    (((now() at time zone 'Europe/London')::date - $3::integer)::timestamp at time zone 'Europe/London')
    where attempt_id = $1 and user_id = $2`, [attemptId, user, days]);
  await db.query(`update shared_group_members set joined_at =
    (((now() at time zone 'Europe/London')::date - $3::integer)::timestamp at time zone 'Europe/London')
    where group_id = (select group_id from meetup_attempts where id = $1) and user_id = $2`, [attemptId, user, days]);
}
async function seedCheckins(user: string, daysAgo: number[]) {
  await db.exec("reset role");
  for (const days of daysAgo) {
    await db.query(`insert into meetup_checkin_events(user_id, received_at) values ($1,
      (((now() at time zone 'Europe/London')::date - $2::integer)::timestamp at time zone 'Europe/London'))`, [user, days]);
  }
}
async function checkin(user: string) {
  await asUser(user);
  await db.query(`insert into checkins(user_id, checked_in_at, checked_in_date)
    values ($1, '2099-01-01', '2099-01-01') on conflict(user_id)
    do update set checked_in_at = excluded.checked_in_at`, [user]);
}
type Attempt = { id: string; progress: number; qualified: boolean; participating: boolean; rewardId: string | null; offer: { reward: string }; rewardEarnedElsewhere: boolean };
const attempts = () => scalar<Attempt[]>("select list_meetup_attempts() as value");

describe("venue meet-ups database", () => {
  it("persists venue categories, preserves them for older clients and freezes attempt snapshots", async () => {
    const { venueId, offerId } = await setupOffer();
    expect(await scalar("select list_meetup_offers()->0->'venue'->>'category' as value")).toBe("other");
    await scalar("select save_meetup_venue($1,$2) as value", [venueId, { ...venueInput, category: "cafe" }]);
    expect(await scalar("select list_meetup_offers()->0->'venue'->>'category' as value")).toBe("cafe");
    await scalar("select save_meetup_venue($1,$2) as value", [venueId, venueInput]);
    expect(await scalar("select list_meetup_offers()->0->'venue'->>'category' as value")).toBe("cafe");
    expect((await attempts())[0].offer).toMatchObject({ venue: { category: "other" } });
    await expect(scalar("select save_meetup_venue($1,$2) as value", [venueId, { ...venueInput, category: "invalid" }])).rejects.toThrow("valid venue category");
    await expect(scalar("select save_meetup_venue($1,$2) as value", [venueId, { ...venueInput, category: null }])).rejects.toThrow("valid venue category");
    await asUser(member);
    await expect(scalar("select save_meetup_venue($1,$2) as value", [venueId, { ...venueInput, category: "pub" }])).rejects.toThrow();
  });
  beforeAll(async () => {
    db = new PGlite({ fsBundle: new NodeBlob([readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data")]) as unknown as Blob });
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      create table profiles(id uuid primary key references auth.users(id), username text, last_checkin_at timestamptz);
      create table checkins(user_id uuid primary key references auth.users(id), checked_in_at timestamptz, checked_in_date date);
      alter table checkins enable row level security;
      create policy self_checkins on checkins for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
      grant select, insert, update on checkins to authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    await db.exec(readFileSync("supabase/migrations/034_shared_groups.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/039_venue_meetups.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/040_leave_meetup_offers.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/041_offer_venue_coordinates.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/043_venue_categories.sql", "utf8"));
  }, 30000);
  beforeEach(async () => {
    await db.exec(`reset role; truncate auth.users, meetup_venues cascade;
      insert into auth.users values ('${owner}', now()), ('${member}', now()), ('${stranger}', now());
      insert into profiles values ('${owner}', 'Owner', null), ('${member}', 'Member', null), ('${stranger}', 'Stranger', null);
      insert into venue_admins values ('${owner}');`);
  });
  afterAll(async () => { await db?.close(); });

  it("restricts admin data and every table/qualification helper to trusted access", async () => {
    await asUser(stranger);
    expect(await scalar("select is_venue_admin() as value")).toBe(false);
    await expect(scalar("select save_meetup_venue(null,$1) as value", [venueInput])).rejects.toThrow(/admin access/);
    await expect(attempts()).resolves.toEqual([]);
    for (const table of ["venue_admins", "meetup_venues", "meetup_offers", "meetup_attempts", "meetup_participants", "meetup_rewards", "meetup_checkin_events"]) {
      await expect(db.query(`select * from ${table}`)).rejects.toThrow(/permission denied/);
    }
    await expect(db.query("select refresh_meetup_attempt(null)")).rejects.toThrow(/permission denied/);
    await expect(scalar("select list_meetup_offers(true) as value")).rejects.toThrow(/admin access/);
    await db.exec("reset role; set role anon");
    await expect(scalar("select list_meetup_offers(false) as value")).rejects.toThrow(/permission denied/);
  });

  it("validates timezone, thresholds, and individual reward recipients", async () => {
    await asUser(owner);
    await expect(scalar("select save_meetup_venue(null,$1) as value", [{ ...venueInput, timezone: "Invalid/Zone" }])).rejects.toThrow(/timezone/);
    const venueId = await scalar<string>("select save_meetup_venue(null,$1) as value", [venueInput]);
    await expect(scalar("select save_meetup_offer(null,$1) as value", [{ ...offerInput, venueId, periods: 0 }])).rejects.toThrow(/check constraint/);
    await expect(scalar("select save_meetup_offer(null,$1) as value", [{ ...offerInput, venueId, recipients: "all" }])).rejects.toThrow(/check constraint/);
  });

  it("stores valid coordinate pairs, lists them with offers and preserves them for older clients", async () => {
    const { venueId } = await setupOffer();
    await scalar("select save_meetup_venue($1,$2) as value", [venueId, { ...venueInput, latitude: 51.5, longitude: -0.12 }]);
    const listed = await scalar<{ venue: { latitude: number; longitude: number } }[]>("select list_meetup_offers(false) as value");
    expect(listed[0].venue).toMatchObject({ latitude: 51.5, longitude: -0.12 });
    await scalar("select save_meetup_venue($1,$2) as value", [venueId, venueInput]);
    const unchanged = await scalar<{ venue: { latitude: number; longitude: number } }[]>("select list_meetup_offers(false) as value");
    expect(unchanged[0].venue).toMatchObject({ latitude: 51.5, longitude: -0.12 });
    await db.exec("reset role");
    expect(await scalar("select latitude as value from meetup_venues where id=$1", [venueId])).toBe(51.5);
    await asUser(owner);
    await scalar("select save_meetup_venue($1,$2) as value", [venueId, { ...venueInput, latitude: null, longitude: null }]);
    const cleared = await scalar<{ venue: { latitude: null; longitude: null } }[]>("select list_meetup_offers(false) as value");
    expect(cleared[0].venue).toMatchObject({ latitude: null, longitude: null });
  });

  it.each([{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: 51, longitude: null }, { latitude: null, longitude: 0 }])("rejects invalid coordinate pairs: %j", async (coords) => {
    await asUser(owner);
    await expect(scalar("select save_meetup_venue(null,$1) as value", [{ ...venueInput, ...coords }])).rejects.toThrow(/meetup_venue_coordinates/);
  });

  it("requires the owner to select and group membership to opt in; selection is idempotent", async () => {
    const { attemptId, groupId, offerId } = await setupOffer();
    expect(await scalar("select select_meetup_offer($1,$2) as value", [groupId, offerId])).toBe(attemptId);
    await asUser(member);
    await expect(scalar("select select_meetup_offer($1,$2) as value", [groupId, offerId])).rejects.toThrow(/owner/);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await asUser(stranger);
    await expect(db.query("select join_meetup_attempt($1)", [attemptId])).rejects.toThrow(/Join this shared group/);
    expect(await attempts()).toEqual([]);
  });

  it("allows only the current member to leave their own joined offer", async () => {
    const { attemptId } = await setupOffer();
    await asUser(stranger);
    await expect(db.query("select leave_meetup_attempt($1)", [attemptId])).rejects.toThrow(/shared group/);
    await asUser(member);
    await expect(db.query("select leave_meetup_attempt($1)", [attemptId])).rejects.toThrow(/not joined/);
    await asUser(owner);
    expect((await attempts())[0].participating).toBe(true);
    await db.exec("reset role; set role anon");
    await expect(db.query("select leave_meetup_attempt(null)")).rejects.toThrow(/permission denied/);
  });

  it("resets progress and forfeits unused rewards, then requires fresh check-ins to earn again", async () => {
    const { attemptId, groupId } = await setupOffer();
    await acceptedDaysAgo(attemptId, owner, 1);
    await seedCheckins(owner, [1, 0]);
    await asUser(owner);
    const oldReward = (await attempts())[0].rewardId;
    expect(oldReward).not.toBeNull();
    await db.query("select leave_meetup_attempt($1)", [attemptId]);
    await db.query("select leave_meetup_attempt($1)", [attemptId]);
    expect((await attempts())[0]).toMatchObject({ participating: false, progress: 0, qualified: false, rewardId: null });
    await expect(db.query("select redeem_meetup_reward($1)", [oldReward])).rejects.toThrow(/unavailable/);
    await db.exec("reset role");
    expect(await scalar("select count(*)::integer as value from shared_group_members where group_id=$1", [groupId])).toBe(2);
    await asUser(owner);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    expect((await attempts())[0]).toMatchObject({ participating: true, progress: 0, qualified: false, rewardId: null });
    await checkin(owner);
    expect((await attempts())[0]).toMatchObject({ progress: 1, qualified: false, rewardId: null });
    await acceptedDaysAgo(attemptId, owner, 1);
    await seedCheckins(owner, [1]);
    await asUser(owner);
    const freshReward = (await attempts())[0].rewardId;
    expect(freshReward).not.toBeNull();
    expect(freshReward).not.toBe(oldReward);
  });

  it("keeps redeemed rewards single-use after leaving and rejoining, even across groups", async () => {
    const { attemptId, offerId } = await setupOffer({ periods: 1 });
    await checkin(owner);
    const rewardId = (await attempts())[0].rewardId;
    await db.query("select redeem_meetup_reward($1)", [rewardId]);
    await db.query("select leave_meetup_attempt($1)", [attemptId]);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await checkin(owner);
    expect((await attempts())[0].rewardId).toBe(rewardId);
    await expect(db.query("select redeem_meetup_reward($1)", [rewardId])).rejects.toThrow(/already been redeemed/);
    const groupId = await scalar<string>("select create_shared_group('Other',1) as value");
    const secondAttempt = await scalar<string>("select select_meetup_offer($1,$2) as value", [groupId, offerId]);
    await checkin(owner);
    expect((await attempts()).find((a) => a.id === secondAttempt)).toMatchObject({ rewardId: null, rewardEarnedElsewhere: true });
  });

  it("requires a new streak after leaving an unlocked all-recipient offer without resetting other members", async () => {
    const { attemptId } = await setupOffer({ periods: 2, unlockRule: "minimum", minimumMembers: 1, recipients: "all" });
    await asUser(member);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await acceptedDaysAgo(attemptId, owner, 1);
    await seedCheckins(owner, [1, 0]);
    await asUser(owner);
    const ownerReward = (await attempts())[0].rewardId;
    await asUser(member);
    expect((await attempts())[0]).toMatchObject({ qualified: false });
    expect((await attempts())[0].rewardId).not.toBeNull();
    await db.query("select leave_meetup_attempt($1)", [attemptId]);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    expect((await attempts())[0]).toMatchObject({ progress: 0, rewardId: null });
    await checkin(member);
    expect((await attempts())[0]).toMatchObject({ progress: 1, qualified: false, rewardId: null });
    await acceptedDaysAgo(attemptId, member, 1);
    await seedCheckins(member, [1]);
    await asUser(member);
    expect((await attempts())[0].rewardId).not.toBeNull();
    await asUser(owner);
    expect((await attempts())[0]).toMatchObject({ rewardId: ownerReward, qualified: true, participating: true });
  });

  it("preserves the whole-group starting roster when a participant leaves and rejoins", async () => {
    const { attemptId, groupId } = await setupOffer({ periods: 1, unlockRule: "all" });
    await asUser(member);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await db.query("select leave_meetup_attempt($1)", [attemptId]);
    await checkin(owner);
    expect((await attempts())[0].rewardId).toBeNull();
    await asUser(member);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await checkin(member);
    expect((await attempts())[0].rewardId).not.toBeNull();
    await db.exec("reset role");
    await db.query("insert into shared_group_members values($1,$2,now())", [groupId, stranger]);
    await asUser(stranger);
    await expect(db.query("select join_meetup_attempt($1)", [attemptId])).rejects.toThrow(/starting members/);
  });

  it("records trusted current time, counts daily taps once, and awards immediately on normal check-in", async () => {
    const { attemptId } = await setupOffer();
    await checkin(owner);
    await checkin(owner);
    expect((await attempts())[0]).toMatchObject({ progress: 1, qualified: false, rewardId: null });
    await acceptedDaysAgo(attemptId, owner, 1);
    await seedCheckins(owner, [1]);
    await checkin(owner);
    expect((await attempts())[0]).toMatchObject({ progress: 2, qualified: true });
    expect((await attempts())[0].rewardId).not.toBeNull();
    await db.exec("reset role");
    expect(await scalar<boolean>("select max(received_at) <= now() as value from meetup_checkin_events")).toBe(true);
  });

  it("ignores earlier history and restarts an incomplete streak after a missed day", async () => {
    const { attemptId } = await setupOffer({ periods: 3 });
    await seedCheckins(owner, [7, 6, 5]);
    await asUser(owner);
    expect((await attempts())[0].progress).toBe(0);
    await acceptedDaysAgo(attemptId, owner, 4);
    await seedCheckins(owner, [4, 2]);
    await asUser(owner);
    expect((await attempts())[0]).toMatchObject({ progress: 0, qualified: false });
    await checkin(owner);
    expect((await attempts())[0]).toMatchObject({ progress: 1, qualified: false });
  });

  it("requires a check-in in every seven-day window, not multiple taps in one week", async () => {
    const { attemptId } = await setupOffer({ period: "week", periods: 4 });
    await acceptedDaysAgo(attemptId, owner, 21);
    await seedCheckins(owner, [21, 20, 19, 18]);
    await asUser(owner);
    expect((await attempts())[0]).toMatchObject({ progress: 0, qualified: false });
    await seedCheckins(owner, [14, 7, 0]);
    await asUser(owner);
    expect((await attempts())[0]).toMatchObject({ progress: 4, qualified: true });
  });

  it("uses the venue timezone for calendar-day qualification across UTC midnight", async () => {
    const { attemptId, venueId, offerId, groupId } = await setupOffer();
    await db.exec("reset role");
    await db.query("delete from meetup_attempts where id=$1", [attemptId]);
    await asUser(owner);
    await scalar("select save_meetup_venue($1,$2) as value", [venueId, { ...venueInput, timezone: "Pacific/Honolulu" }]);
    const id = await scalar<string>("select select_meetup_offer($1,$2) as value", [groupId, offerId]);
    await db.exec("reset role");
    await db.query(`update meetup_participants set accepted_at = (now() at time zone 'Pacific/Honolulu')::date::timestamp
      at time zone 'Pacific/Honolulu' - interval '3 days' where attempt_id=$1`, [id]);
    await db.query(`update shared_group_members set joined_at = (now() at time zone 'Pacific/Honolulu')::date::timestamp
      at time zone 'Pacific/Honolulu' - interval '3 days' where group_id=$1`, [groupId]);
    await db.query(`insert into meetup_checkin_events(user_id,received_at)
      select $1, ((now() at time zone 'Pacific/Honolulu')::date - 2)::timestamp at time zone 'Pacific/Honolulu' + delta
      from (values (interval '13 hours'),(interval '15 hours')) offsets(delta)`, [owner]);
    await asUser(owner);
    expect((await attempts())[0].qualified).toBe(false);
  });

  it("unlocks minimum-member offers and respects qualifying-only versus all recipients", async () => {
    const { attemptId } = await setupOffer({ periods: 1, unlockRule: "minimum", recipients: "all", minimumMembers: 2 });
    await checkin(owner);
    expect((await attempts())[0].rewardId).toBeNull();
    await asUser(member);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await checkin(member);
    expect((await attempts())[0].rewardId).not.toBeNull();
    await asUser(owner);
    expect((await attempts())[0].rewardId).not.toBeNull();
  });

  it("awards non-qualifying opted-in members only when the venue selects all recipients", async () => {
    const { attemptId, groupId } = await setupOffer({ periods: 1, unlockRule: "minimum", recipients: "all" });
    await db.exec("reset role");
    await db.query("insert into shared_group_members values($1,$2,now())", [groupId, stranger]);
    await asUser(stranger);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await asUser(member);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await checkin(owner);
    await checkin(member);
    await asUser(stranger);
    expect((await attempts())[0].qualified).toBe(false);
    expect((await attempts())[0].rewardId).not.toBeNull();
  });

  it("does not count a departed member towards a threshold that has not unlocked", async () => {
    const { attemptId, groupId } = await setupOffer({ periods: 1, unlockRule: "minimum", recipients: "qualifying" });
    await checkin(owner);
    await db.exec("reset role");
    await db.query("delete from shared_group_members where group_id=$1 and user_id=$2", [groupId, owner]);
    await asUser(member);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await checkin(member);
    expect((await attempts())[0].rewardId).toBeNull();
  });

  it("starts a late participant's qualification at opt-in, not at group selection", async () => {
    const { attemptId } = await setupOffer();
    await seedCheckins(member, [2, 1]);
    await asUser(member);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await checkin(member);
    expect((await attempts())[0]).toMatchObject({ progress: 1, qualified: false });
  });

  it("does not give an unfinished participant credit for check-ins before rejoining the group", async () => {
    const { attemptId, groupId } = await setupOffer();
    await asUser(member);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await acceptedDaysAgo(attemptId, member, 2);
    await seedCheckins(member, [2, 1]);
    await db.exec("reset role");
    await db.query("delete from shared_group_members where group_id=$1 and user_id=$2", [groupId, member]);
    await db.query("insert into shared_group_members values($1,$2,now())", [groupId, member]);
    await checkin(member);
    expect((await attempts())[0]).toMatchObject({ progress: 1, qualified: false });
  });

  it("freezes whole-group membership and requires each member to opt in and qualify", async () => {
    const { attemptId, groupId } = await setupOffer({ periods: 1, unlockRule: "all" });
    await checkin(owner);
    expect((await attempts())[0].rewardId).toBeNull();
    await db.exec("reset role");
    await db.query("insert into shared_group_members values($1,$2,now())", [groupId, stranger]);
    await asUser(stranger);
    await expect(db.query("select join_meetup_attempt($1)", [attemptId])).rejects.toThrow(/starting members/);
    await asUser(member);
    await db.query("select join_meetup_attempt($1)", [attemptId]);
    await checkin(member);
    expect((await attempts())[0].rewardId).not.toBeNull();
  });

  it("preserves selected terms after venue/offer edits and hides inactive offers from the catalogue", async () => {
    const { offerId, venueId } = await setupOffer();
    await scalar("select save_meetup_offer($1,$2) as value", [offerId, { ...offerInput, venueId, reward: "Changed", active: false }]);
    expect(await scalar("select list_meetup_offers(false) as value")).toEqual([]);
    expect((await attempts())[0].offer.reward).toBe("20% off coffee");
  });

  it("blocks expired offers and prevents repeat/foreign/expired redemption", async () => {
    const { offerId, venueId } = await setupOffer({ periods: 1 });
    await checkin(owner);
    const rewardId = (await attempts())[0].rewardId;
    await asUser(member);
    await expect(scalar("select redeem_meetup_reward($1) as value", [rewardId])).rejects.toThrow(/unavailable/);
    await asUser(owner);
    expect(await scalar("select redeem_meetup_reward($1) as value", [rewardId])).toBeTruthy();
    await expect(scalar("select redeem_meetup_reward($1) as value", [rewardId])).rejects.toThrow(/already been redeemed/);
    await scalar("select save_meetup_offer($1,$2) as value", [offerId, { ...offerInput, venueId, endsAt: "2000-01-01" }]);
    const group = await scalar<string>("select create_shared_group('New',1) as value");
    await expect(scalar("select select_meetup_offer($1,$2) as value", [group, offerId])).rejects.toThrow(/unavailable/);
    await db.exec("reset role");
    await db.query("update meetup_rewards set redeemed_at=null, expires_at=now()-interval '1 second' where id=$1", [rewardId]);
    await asUser(owner);
    await expect(scalar("select redeem_meetup_reward($1) as value", [rewardId])).rejects.toThrow(/expired/);
  });

  it("cannot earn the same offer again by creating or deleting groups", async () => {
    const { groupId, offerId } = await setupOffer({ periods: 1 });
    await checkin(owner);
    expect((await attempts())[0].rewardId).not.toBeNull();
    await db.query("select manage_shared_group($1,'delete')", [groupId]);
    const other = await scalar<string>("select create_shared_group('Another',1) as value");
    await scalar("select select_meetup_offer($1,$2) as value", [other, offerId]);
    await checkin(owner);
    expect((await attempts())[0]).toMatchObject({ rewardId: null, rewardEarnedElsewhere: true });
  });
});
