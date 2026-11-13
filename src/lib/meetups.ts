import { supabase } from "./supabase";

export type UnlockRule = "individual" | "minimum" | "all";
export type RewardRecipients = "qualifying" | "all";

export type Venue = {
  id: string;
  name: string;
  address: string;
  description: string;
  timezone: string;
  active: boolean;
  latitude?: number | null;
  longitude?: number | null;
};

export type Offer = {
  id: string;
  venueId: string;
  title: string;
  reward: string;
  terms: string;
  period: "day" | "week";
  periods: number;
  unlockRule: UnlockRule;
  minimumMembers: number;
  recipients: RewardRecipients;
  redemptionDays: number;
  endsAt: string | null;
  active: boolean;
  venue: Venue;
};

export type OfferInput = Omit<Offer, "id" | "venue">;
export type VenueInput = Omit<Venue, "id">;
export type MeetupParticipant = {
  userId: string;
  name: string;
  accepted: boolean;
  qualified: boolean;
  current: boolean;
};
export type MeetupAttempt = {
  id: string;
  groupId: string;
  groupName: string;
  offerId: string;
  offer: Offer;
  participants: MeetupParticipant[];
  participating: boolean;
  progress: number;
  qualified: boolean;
  rewardId: string | null;
  rewardEarnedElsewhere: boolean;
  unlockedAt: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
};

export const hasMeetupOfferEnded = (offer: Offer) =>
  offer.endsAt !== null && new Date(offer.endsAt).getTime() <= Date.now();

export const canOptIntoMeetupAttempt = (attempt: MeetupAttempt, userId: string) =>
  !attempt.participating && !hasMeetupOfferEnded(attempt.offer) && (attempt.offer.unlockRule !== "all" ||
    attempt.participants.some((member) => member.userId === userId && member.current));

async function rpc<Result>(name: string, args?: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (error.code === "PGRST202") {
      if (name === "leave_meetup_attempt") {
        throw new Error("Leaving offers is not available yet. Apply Supabase migration 040_leave_meetup_offers.sql.");
      }
      throw new Error("Meet-ups are not available yet. Apply Supabase migration 039_venue_meetups.sql.");
    }
    throw new Error(error.message || "Unable to update meet-ups.");
  }
  return data as Result;
}

export const isVenueAdmin = () => rpc<boolean>("is_venue_admin");
export const listVenues = () => rpc<Venue[]>("list_meetup_venues");
export const listOffers = (admin = false) => rpc<Offer[]>("list_meetup_offers", { p_admin: admin });
export const saveVenue = (venue: VenueInput, id: string | null = null) =>
  rpc<string>("save_meetup_venue", { p_id: id, p_venue: venue });
export const saveOffer = (offer: OfferInput, id: string | null = null) =>
  rpc<string>("save_meetup_offer", { p_id: id, p_offer: offer });
export const listMeetupAttempts = () => rpc<MeetupAttempt[]>("list_meetup_attempts");
export const selectMeetupOffer = (groupId: string, offerId: string) =>
  rpc<string>("select_meetup_offer", { p_group_id: groupId, p_offer_id: offerId });
export const joinMeetupAttempt = (attemptId: string) =>
  rpc<null>("join_meetup_attempt", { p_attempt_id: attemptId });
export const leaveMeetupAttempt = (attemptId: string) =>
  rpc<null>("leave_meetup_attempt", { p_attempt_id: attemptId });
export const redeemMeetupReward = (rewardId: string) =>
  rpc<string>("redeem_meetup_reward", { p_reward_id: rewardId });

export const describeOfferRule = (offer: Pick<Offer, "period" | "periods" | "unlockRule" | "minimumMembers" | "recipients">) => {
  const checkins = offer.period === "day"
    ? `Check in on ${offer.periods} consecutive days`
    : `Check in at least once in each of ${offer.periods} consecutive weeks`;
  const unlock = offer.unlockRule === "all"
    ? "All members in the starting group must qualify."
    : offer.unlockRule === "minimum"
      ? `At least ${offer.minimumMembers} members must qualify.`
      : "Each member qualifies independently.";
  return `${checkins}. ${unlock} ${offer.recipients === "all" ? "All participating members receive the reward." : "Only qualifying members receive the reward."}`;
};
