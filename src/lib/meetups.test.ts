import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeOfferRule, joinMeetupAttempt, leaveMeetupAttempt, listOffers, redeemMeetupReward,
  saveOffer, saveVenue, selectMeetupOffer,
} from "./meetups";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { rpc: mocks.rpc } }));

describe("meet-up RPC client", () => {
  beforeEach(() => { mocks.rpc.mockReset(); mocks.rpc.mockResolvedValue({ data: "id", error: null }); });

  it("uses separate owner selection, member opt-in and reward redemption endpoints", async () => {
    await selectMeetupOffer("group", "offer");
    expect(mocks.rpc).toHaveBeenLastCalledWith("select_meetup_offer", { p_group_id: "group", p_offer_id: "offer" });
    await joinMeetupAttempt("attempt");
    expect(mocks.rpc).toHaveBeenLastCalledWith("join_meetup_attempt", { p_attempt_id: "attempt" });
    await leaveMeetupAttempt("attempt");
    expect(mocks.rpc).toHaveBeenLastCalledWith("leave_meetup_attempt", { p_attempt_id: "attempt" });
    await redeemMeetupReward("reward");
    expect(mocks.rpc).toHaveBeenLastCalledWith("redeem_meetup_reward", { p_reward_id: "reward" });
  });

  it("preserves offer rules and admin listing flags", async () => {
    const venue = { name: "Cafe", address: "High Street", timezone: "Europe/London", description: "", active: true };
    await saveVenue(venue);
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_meetup_venue", { p_id: null, p_venue: venue });
    const offer = {
      venueId: "venue", title: "Coffee", reward: "Discount", terms: "One use",
      period: "week" as const, periods: 4, unlockRule: "minimum" as const,
      minimumMembers: 3, recipients: "qualifying" as const, redemptionDays: 7,
      endsAt: null, active: true,
    };
    await saveOffer(offer, "offer");
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_meetup_offer", { p_id: "offer", p_offer: offer });
    await listOffers(true);
    expect(mocks.rpc).toHaveBeenLastCalledWith("list_meetup_offers", { p_admin: true });
  });

  it("surfaces missing migration and backend errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(listOffers()).rejects.toThrow("039_venue_meetups.sql");
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Venue admin access required." } });
    await expect(listOffers(true)).rejects.toThrow("Venue admin access required.");
  });

  it("explains repeated check-ins and group reward thresholds", () => {
    expect(describeOfferRule({ period: "week", periods: 4, unlockRule: "minimum", minimumMembers: 3, recipients: "all" }))
      .toBe("Check in at least once in each of 4 consecutive weeks. At least 3 members must qualify. All participating members receive the reward.");
    expect(describeOfferRule({ period: "day", periods: 7, unlockRule: "individual", minimumMembers: 2, recipients: "qualifying" }))
      .toContain("Each member qualifies independently.");
  });
});
