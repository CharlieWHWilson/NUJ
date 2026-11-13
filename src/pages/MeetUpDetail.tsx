import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCheck, Gift, MapPin, UsersRound, LogOut, Clock, Info, type LucideIcon } from "lucide-react";
import { VenueCategoryIcon } from "@/components/VenueCategoryIcon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { canOptIntoMeetupAttempt, hasMeetupOfferEnded, describeOfferRule, joinMeetupAttempt, leaveMeetupAttempt, listMeetupAttempts, listOffers, redeemMeetupReward, selectMeetupOffer, type Offer } from "@/lib/meetups";
import { listSharedGroups } from "@/lib/sharedGroups";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { isVerifiedAuthUser } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const date = (value: string, timezone?: string) => new Date(value).toLocaleString(undefined, timezone ? { timeZone: timezone, timeZoneName: "short" } : undefined);

const TermsSection = ({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) =>
  <section className="rounded-xl bg-muted/40 p-4 space-y-2">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />{title}</h3>
    <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
  </section>;

const OfferSummary = ({ offer }: { offer: Offer }) => <div className="nuj-card p-5 space-y-3">
  <div className="flex items-start justify-between gap-3">
    <h2 className="text-xl font-semibold">{offer.title}</h2>
    <VenueCategoryIcon category={offer.venue.category} />
  </div>
  <p className="text-sm text-muted-foreground">{offer.venue.name}</p>
  <dl className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <CalendarDays size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div><dt className="text-xs text-muted-foreground">Check in</dt>
        <dd className="text-sm font-semibold">{offer.period === "day" ? "Daily" : "Once a week"}</dd>
      </div>
    </div>
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <CheckCheck size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div><dt className="text-xs text-muted-foreground">Keep it going</dt>
        <dd className="text-sm font-semibold">{offer.periods} {offer.period === "day" ? offer.periods === 1 ? "day" : "days" : offer.periods === 1 ? "week" : "weeks"} in a row</dd>
      </div>
    </div>
  </dl>
  <div className="flex items-center gap-2">
    <p className="flex-1 text-sm">{offer.venue.address.match(/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i)?.[0].toUpperCase() ?? offer.venue.address}</p>
    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${offer.venue.name}, ${offer.venue.address}`)}`}
      target="_blank" rel="noopener noreferrer" aria-label={`Open map for ${offer.venue.name}`}
      className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors">
      <MapPin size={18} aria-hidden="true" />
    </a>
  </div>
  <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="text-sm text-muted-foreground underline underline-offset-4">T&Cs</button>
    </DialogTrigger>
    <DialogContent className="w-[calc(100%-2rem)] max-w-sm max-h-[85dvh] overflow-y-auto rounded-xl">
      <DialogHeader>
        <DialogTitle>Offer terms and conditions</DialogTitle>
        <DialogDescription>{offer.venue.name} · {offer.title}</DialogDescription>
      </DialogHeader>
      <TermsSection icon={Gift} title="Your reward">
        <p className="font-semibold text-foreground">{offer.reward}</p>
        <p className="whitespace-pre-line">{offer.terms}</p>
      </TermsSection>
      <TermsSection icon={UsersRound} title="Who qualifies">
        <dl className="space-y-2">
          <div><dt className="text-xs">Who needs to qualify?</dt>
            <dd className="font-medium text-foreground">{offer.unlockRule === "individual" ? "Each person independently" : offer.unlockRule === "minimum" ? `${offer.minimumMembers}+ members` : "All starting members"}</dd>
          </div>
          <div><dt className="text-xs">Who gets the reward?</dt>
            <dd className="font-medium text-foreground">{offer.recipients === "all" ? "All opted-in members" : "Qualifying members only"}</dd>
          </div>
        </dl>
        <p>{describeOfferRule(offer)}</p>
        {offer.unlockRule === "all" && <p>The starting group roster is fixed. Every starting member must opt in and qualify; members joining the group later are not eligible for that attempt. A starting member leaving before unlock can prevent the group from qualifying.</p>}
      </TermsSection>
      <TermsSection icon={CalendarDays} title="Check-in rules">
      <p className="text-sm">Opt in explicitly. Only accepted opt-ins count, and each member starts their own check-in period when they accept. Only normal NUJ check-ins after acceptance count; earlier check-ins do not. No extra check-in is needed.</p>
      <p className="text-sm">Daily periods use the venue timezone. Weekly periods are consecutive seven-day windows starting on each member’s acceptance date in that timezone, not calendar weeks. Multiple check-ins in one period count once. A missed completed period resets an unfinished streak.</p>
        <p>Check-in timezone: {offer.venue.timezone}</p>
      </TermsSection>
      <TermsSection icon={Clock} title="Using your reward">
        <p className="font-medium text-foreground">Redeem within {offer.redemptionDays} days of unlocking.</p>
        <p>Offer ends: {offer.endsAt ? date(offer.endsAt, offer.venue.timezone) : "No end date"}</p>
        <p>Each offer can be earned once per person, including across groups.</p>
        <p>Selecting an offer is not a reservation or proof of attendance. Venue staff review rewards on the member’s phone; redemption is member-confirmed, not independently venue verified.</p>
      </TermsSection>
      <TermsSection icon={LogOut} title="Leaving or rejoining">
      <p className="text-sm">Leaving this offer resets your progress and forfeits unused rewards for this group offer. Rejoining requires a fresh qualifying streak. Redeemed rewards remain single-use, including across groups.</p>
      </TermsSection>
      <TermsSection icon={Info} title="About the venue">
        <p className="font-medium text-foreground">{offer.venue.name}</p>
        <p>{offer.venue.description}</p>
        <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{offer.venue.address}</p>
      </TermsSection>
    </DialogContent>
  </Dialog>
</div>;

const MeetUpDetail = () => {
  const user = useCurrentUser();
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSessionUserId(session && isVerifiedAuthUser(session.user) ? session.user.id : null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const userId = sessionUserId === undefined ? user?.id : sessionUserId;
  return <MeetUpDetailContent key={userId ?? "signed-out"} user={userId ? { id: userId } : null} />;
};

const MeetUpDetailContent = ({ user }: { user: { id: string } | null }) => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState("");
  const [rewardId, setRewardId] = useState<string | null>(null);
  const [leavingAttemptId, setLeavingAttemptId] = useState<string | null>(null);
  const offers = useQuery({ queryKey: ["meetup-offers", user?.id], queryFn: () => listOffers(), enabled: Boolean(user?.id), retry: false });
  const attempts = useQuery({ queryKey: ["meetup-attempts", user?.id], queryFn: listMeetupAttempts, enabled: Boolean(user?.id), retry: false });
  const refetchAttempts = attempts.refetch;
  const groups = useQuery({ queryKey: ["shared-groups", user?.id], queryFn: listSharedGroups, enabled: Boolean(user?.id), retry: false });
  const refresh = () => { if (user?.id) return Promise.all([offers.refetch(), attempts.refetch(), groups.refetch()]); };
  useAppRefresh(refresh);
  useEffect(() => {
    const onCheckin = () => { if (user?.id) void refetchAttempts(); };
    window.addEventListener("nuj:checkin-updated", onCheckin);
    return () => window.removeEventListener("nuj:checkin-updated", onCheckin);
  }, [user?.id, refetchAttempts]);
  const update = useMutation({
    mutationFn: async (action: { type: "select" | "join" | "leave" | "redeem"; value: string }) => {
      if (action.type === "select") return selectMeetupOffer(action.value, id!);
      if (action.type === "join") return joinMeetupAttempt(action.value);
      if (action.type === "leave") return leaveMeetupAttempt(action.value);
      return redeemMeetupReward(action.value);
    },
    onSuccess: async (_, action) => {
      if (action.type === "redeem") setRewardId(null);
      if (action.type === "leave") setLeavingAttemptId(null);
      await queryClient.invalidateQueries({ queryKey: ["meetup-attempts", user?.id] });
    },
  });
  const matching = attempts.data?.filter((attempt) => attempt.offerId === id) ?? [];
  const listed = offers.data?.find((offer) => offer.id === id);
  const offer = listed ?? matching[0]?.offer;
  const owners = groups.data?.filter((group) => group.isOwner) ?? [];
  const available = Boolean(listed?.active && listed.venue.active && (!listed.endsAt || new Date(listed.endsAt).getTime() > Date.now()));
  const ownReward = matching.find((attempt) => attempt.rewardId === rewardId);
  const leavingAttempt = matching.find((attempt) => attempt.id === leavingAttemptId);
  const redeemable = ownReward && !ownReward.redeemedAt && Boolean(ownReward.expiresAt && new Date(ownReward.expiresAt).getTime() > Date.now());
  const busy = update.isPending;

  return <main className="min-h-screen bg-background max-w-md mx-auto px-5 nuj-safe-top-section nuj-safe-bottom-page space-y-5">
    <Link to="/meetups" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18} />Back to offers</Link>
    <h1 className="text-2xl font-bold">Offer details</h1>
    {(offers.isPending || attempts.isPending) && <p role="status">Loading offer and group attempts…</p>}
    {offers.error && <div role="alert"><p>{offers.error.message}</p><button className="nuj-btn-secondary" onClick={() => void offers.refetch()}>Retry offer</button></div>}
    {attempts.error && <div role="alert"><p>{attempts.error.message}</p><button className="nuj-btn-secondary" onClick={() => void attempts.refetch()}>Retry attempts</button></div>}
    {!offer && offers.isSuccess && attempts.isSuccess && <p>This offer is no longer available, and you have no saved attempts for it.</p>}
    {offer && <>
      <OfferSummary offer={offer} />
      {!available && <p className="text-sm text-muted-foreground">This offer is no longer available for new group selections. Saved attempts keep their original offer and rules.</p>}
      {available && <section className="nuj-card p-5 space-y-3">
        <h2 className="font-semibold">Select for a group you own</h2>
        {groups.isPending && <p role="status">Loading shared groups…</p>}
        {groups.error && <div role="alert"><p>{groups.error.message}</p><button className="nuj-btn-secondary" onClick={() => void groups.refetch()}>Retry groups</button></div>}
        {groups.isSuccess && owners.length === 0 && <p className="text-sm text-muted-foreground">Only a shared-group owner can select an offer. Ask your owner, or create a shared group.</p>}
        {owners.length > 0 && <>
          <label className="block text-sm" htmlFor="offer-group">Shared group</label>
          <select id="offer-group" className="w-full rounded-xl border bg-background p-3" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">Choose a group</option>
            {owners.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <button className="nuj-btn-primary w-full" disabled={busy || !owners.some((group) => group.id === groupId)} onClick={() => update.mutate({ type: "select", value: groupId })}>Select offer for group</button>
          <p className="text-xs text-muted-foreground">Selecting opts you in. Other members must opt in themselves.</p>
        </>}
      </section>}
    </>}
    {update.error && <p role="alert">{update.error.message}</p>}
    {update.isSuccess && <p role="status">Saved. Group progress and rewards have been refreshed.</p>}
    {offer && attempts.isSuccess && matching.length === 0 && <p className="text-sm text-muted-foreground">No group attempts yet for this offer.</p>}
    {matching.length > 0 && <h2 className="font-semibold">Group attempts</h2>}
    {matching.map((attempt) => {
      const expired = !attempt.expiresAt || new Date(attempt.expiresAt).getTime() <= Date.now();
      return <section key={attempt.id} className="nuj-card p-5 space-y-3">
        <h3 className="font-semibold">{attempt.groupName}</h3>
        <details><summary className="cursor-pointer text-sm">Original offer for this attempt</summary><OfferSummary offer={attempt.offer} /></details>
        <p className="text-sm">{attempt.participating ? `Your progress: ${attempt.progress}/${attempt.offer.periods} ${attempt.offer.period}s${attempt.qualified ? " · Qualified" : ""}` : "You have not opted in."}</p>
        {attempt.rewardEarnedElsewhere && <p className="text-sm">You already earned this offer with another group. Each offer can be earned once per person.</p>}
        <ul className="space-y-2 text-sm">
          {attempt.participants.map((member) => <li key={member.userId}>{member.name}{!member.current ? " (no longer in group)" : ""} · {member.accepted ? member.qualified ? "Accepted · Qualified" : "Accepted · In progress" : "Not accepted · Not counting"}</li>)}
        </ul>
        {user && canOptIntoMeetupAttempt(attempt, user.id) && <button className="nuj-btn-primary w-full" disabled={busy} onClick={() => update.mutate({ type: "join", value: attempt.id })}>Opt in to this attempt</button>}
        {!attempt.participating && hasMeetupOfferEnded(attempt.offer) && <p className="text-sm text-muted-foreground">Offer ended. You can no longer opt in.</p>}
        {!attempt.participating && attempt.offer.unlockRule === "all" && !attempt.participants.some((member) => member.userId === user?.id) && <p className="text-sm">You are not in this attempt’s starting roster and cannot opt in.</p>}
        {attempt.participating && <button className="nuj-btn-secondary w-full" disabled={busy} onClick={() => { update.reset(); setLeavingAttemptId(attempt.id); }}>Leave offer</button>}
        {attempt.rewardId && <div className="rounded-xl bg-muted p-4 space-y-2">
          <h4 className="font-semibold">Your reward: {attempt.offer.reward}</h4>
          <p className="text-sm">Expires: {attempt.expiresAt ? date(attempt.expiresAt) : "Not specified"}</p>
          {attempt.redeemedAt ? <p className="text-sm">Redeemed {date(attempt.redeemedAt)} · Member-confirmed, not independently venue verified. Single use.</p> : expired ? <p className="text-sm">Reward expired or unavailable for redemption.</p> : <>
            <p className="text-sm">Show this reward and its original terms to venue staff on your phone. After staff review, explicitly confirm redemption. Single use; member-confirmed, not independently venue verified.</p>
            <button className="nuj-btn-secondary w-full" disabled={busy} onClick={() => { update.reset(); setRewardId(attempt.rewardId); }}>Staff review / redeem</button>
          </>}
        </div>}
      </section>;
    })}
    <Dialog open={leavingAttemptId !== null} onOpenChange={(open) => { if (!open && !busy) setLeavingAttemptId(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Leave this offer?</DialogTitle>
          <DialogDescription>Your check-in progress will reset and any unused reward for this group offer will be forfeited. You will stay in the shared group. You can opt in again and start a fresh streak, but redeemed rewards remain single-use.</DialogDescription>
        </DialogHeader>
        {leavingAttempt && <p className="text-sm">{leavingAttempt.groupName} · {leavingAttempt.offer.venue.name} · {leavingAttempt.offer.reward}</p>}
        {update.error && <p role="alert">{update.error.message}</p>}
        <button className="nuj-btn-secondary" disabled={busy} onClick={() => setLeavingAttemptId(null)}>Cancel</button>
        <button className="nuj-btn-primary" disabled={busy || !leavingAttempt?.participating} onClick={() => { if (leavingAttemptId && leavingAttempt?.participating) update.mutate({ type: "leave", value: leavingAttemptId }); }}>Confirm leave offer</button>
      </DialogContent>
    </Dialog>
    <Dialog open={rewardId !== null} onOpenChange={(open) => { if (!open && !busy) setRewardId(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Confirm single-use redemption</DialogTitle><DialogDescription>Confirm only after venue staff have reviewed this reward on your phone. This is member-confirmed, not independently venue verified. It can only be redeemed once.</DialogDescription></DialogHeader>
        {ownReward && <><p className="font-semibold">{ownReward.offer.venue.name} · {ownReward.offer.reward}</p><p className="text-sm">{ownReward.offer.terms}</p><p className="text-sm">Expires: {ownReward.expiresAt ? date(ownReward.expiresAt) : "Not specified"}</p></>}
        {update.error && <p role="alert">{update.error.message}</p>}
        <button className="nuj-btn-secondary" disabled={busy} onClick={() => setRewardId(null)}>Cancel</button>
        <button className="nuj-btn-primary" disabled={busy || !redeemable} onClick={() => { if (rewardId && redeemable) update.mutate({ type: "redeem", value: rewardId }); }}>Confirm redemption</button>
      </DialogContent>
    </Dialog>
  </main>;
};

export default MeetUpDetail;
