import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, HelpCircle, MapPin, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { isMeetupRetired, listMeetupAttempts, listOffers } from "@/lib/meetups";
import { supabase } from "@/lib/supabase";
import { isVerifiedAuthUser } from "@/lib/auth";
import { MeetupParticipation } from "@/components/MeetupParticipation";
import { VenueCategoryIcon } from "@/components/VenueCategoryIcon";

type Props = {
  userId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const DashboardMeetups = ({ userId, open, onOpenChange }: Props) => {
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSessionUserId(session && isVerifiedAuthUser(session.user) ? session.user.id : null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const activeUserId = sessionUserId === undefined ? userId : sessionUserId;
  const attempts = useQuery({
    queryKey: ["meetup-attempts", activeUserId],
    queryFn: listMeetupAttempts,
    enabled: Boolean(activeUserId) && open,
    retry: false,
  });
  const offers = useQuery({
    queryKey: ["meetup-offers", activeUserId],
    queryFn: () => listOffers(),
    enabled: Boolean(activeUserId) && open,
    retry: false,
  });
  useAppRefresh(() => { if (activeUserId && open) return Promise.all([attempts.refetch(), offers.refetch()]); });
  const refetchAttempts = attempts.refetch;
  useEffect(() => {
    const onCheckin = () => { if (activeUserId && open) void refetchAttempts(); };
    window.addEventListener("nuj:checkin-updated", onCheckin);
    return () => window.removeEventListener("nuj:checkin-updated", onCheckin);
  }, [activeUserId, open, refetchAttempts]);
  const joinedAttempts = activeUserId ? attempts.data?.filter((attempt) => !isMeetupRetired(attempt)) : undefined;

  return <div className="nuj-card p-4">
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex flex-1 items-center gap-2 text-left">
            <MapPin size={15} className="text-muted-foreground" aria-hidden="true" />
            <h2 className="font-semibold text-sm tracking-tight">Meet-ups</h2>
          </button>
        </CollapsibleTrigger>
        {open && <Dialog key={activeUserId ?? "signed-out"}>
          <DialogTrigger asChild>
            <button type="button" aria-label="About meet-ups" className="w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <HelpCircle size={16} aria-hidden="true" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Meet-ups</DialogTitle>
              <DialogDescription>
                Turn the rhythm of your NUJ check-ins into real-life meet-ups. Stay connected between visits, then give your group another reason to get together.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Choose an offer for a shared group. Your normal NUJ check-ins can count towards a reward for meeting there.
            </p>
          </DialogContent>
        </Dialog>}
        <CollapsibleTrigger asChild>
          <button type="button" aria-label="Expand meet-ups" className="w-4 h-5 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="pt-3">
        {activeUserId && attempts.isPending && <p role="status" className="text-xs text-muted-foreground">Loading joined meet-ups...</p>}
        {activeUserId && attempts.error && <div role="alert" className="text-xs text-destructive">
          {attempts.error.message}
          <button onClick={() => void attempts.refetch()} className="ml-2 underline">Retry meet-ups</button>
        </div>}
        {joinedAttempts?.length === 0 && <p className="text-xs text-muted-foreground">No meet-ups joined yet</p>}
        {activeUserId && offers.error && <div role="alert" className="text-xs text-destructive">
          Venue categories could not refresh: {offers.error.message}
          <button onClick={() => void offers.refetch()} className="ml-2 underline">Retry categories</button>
        </div>}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {joinedAttempts?.map((attempt) => {
                const progress = attempt.qualified ? attempt.offer.periods : Math.min(attempt.offer.periods, Math.max(0, attempt.progress));
                const participants = attempt.participants.filter((member) => member.current && member.accepted);
                const qualifiedCount = participants.filter((member) => member.qualified).length;
                const target = attempt.offer.unlockRule === "all" ? attempt.participants.length : attempt.offer.minimumMembers;
                return <article key={attempt.id}
                  className="relative shrink-0 w-32 p-2 bg-muted/40 hover:bg-muted rounded-xl transition-colors text-left">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="text-xs font-medium leading-tight line-clamp-2"><Link to={`/meetup/${encodeURIComponent(attempt.offerId)}`} className="after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring">{attempt.offer.venue.name} · {attempt.offer.title}</Link></h3>
                    <VenueCategoryIcon size={14} category={offers.data?.find((offer) => offer.venueId === attempt.offer.venueId)?.venue.category ?? attempt.offer.venue.category} />
                  </div>
                  <div className="mt-2 space-y-1">
                  <p className="flex items-center gap-1 text-[11px] font-medium"><UsersRound size={12} className="shrink-0" aria-hidden="true" /><span className="line-clamp-2">{attempt.groupName}</span><span className="shrink-0 text-muted-foreground" aria-label={`${participants.length} joined`}>({participants.length})</span></p>
                  {attempt.participating && <><progress max={attempt.offer.periods} value={progress}
                    aria-label={`Your check-in progress for ${attempt.groupName}: ${attempt.offer.reward}`}
                    className="block h-1.5 w-full overflow-hidden rounded-full bg-secondary accent-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
                  <p className="text-[10px] text-muted-foreground">{progress}/{attempt.offer.periods} {attempt.offer.period === "day" ? attempt.offer.periods === 1 ? "day" : "days" : attempt.offer.periods === 1 ? "week" : "weeks"}</p>
                  <p className="text-[10px] text-muted-foreground">{attempt.offer.unlockRule === "individual" ? `${qualifiedCount} qualified` : `${qualifiedCount}/${target} qualified`}</p>
                  </>}
                  {activeUserId && <MeetupParticipation key={activeUserId} attempt={attempt} userId={activeUserId} />}
                  {attempt.rewardId && <p className="text-[10px] font-medium">{attempt.redeemedAt ? "Reward redeemed" : attempt.expiresAt && new Date(attempt.expiresAt).getTime() <= Date.now() ? "Reward expired" : "Reward unlocked"}</p>}
                  </div>
                </article>;
              })}
        </div>
        <Link to="/meetups" className="w-full mt-3 text-sm text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground transition-colors py-1">
          See all offers
        </Link>
      </CollapsibleContent>
    </Collapsible>
  </div>;
};
