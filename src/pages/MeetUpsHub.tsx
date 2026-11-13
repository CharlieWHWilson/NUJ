import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, SlidersHorizontal, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { describeOfferRule, listMeetupAttempts, listOffers, VENUE_CATEGORIES, type VenueCategory } from "@/lib/meetups";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { isVerifiedAuthUser } from "@/lib/auth";
import { MeetupParticipation } from "@/components/MeetupParticipation";
import { OfferLocationSearch, type OfferSearchOrigin } from "@/components/OfferLocationSearch";
import { VenueCategoryIcon } from "@/components/VenueCategoryIcon";
import { distanceToVenue } from "@/lib/venueLocations";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const OffersMap = lazy(() => import("@/components/OffersMap"));

const MeetUpsHub = () => {
  const user = useCurrentUser();
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSessionUserId(session && isVerifiedAuthUser(session.user) ? session.user.id : null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const userId = sessionUserId === undefined ? user?.id : sessionUserId;
  return <MeetUpsHubContent key={userId ?? "signed-out"} user={userId ? { id: userId } : null} />;
};

const MeetUpsHubContent = ({ user }: { user: { id: string } | null }) => {
  const [searchParams] = useSearchParams();
  const venueId = searchParams.get("venue");
  const [view, setView] = useState<"list" | "map">("list");
  const [categories, setCategories] = useState<VenueCategory[]>([]);
  const [origin, setOrigin] = useState<OfferSearchOrigin | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const offers = useQuery({ queryKey: ["meetup-offers", user?.id], queryFn: () => listOffers(), enabled: Boolean(user?.id), retry: false });
  const attempts = useQuery({ queryKey: ["meetup-attempts", user?.id], queryFn: listMeetupAttempts, enabled: Boolean(user?.id), retry: false });
  const visibleOffers = offers.data?.filter((offer) => (!venueId || offer.venueId === venueId) &&
    (categories.length === 0 || categories.includes(offer.venue.category ?? "other")));
  const updateCategories = (next: VenueCategory[]) => {
    setCategories(next);
  };
  if (origin) visibleOffers?.sort((a, b) =>
    (distanceToVenue(origin, a.venue) ?? Infinity) - (distanceToVenue(origin, b.venue) ?? Infinity));
  const refetchAttempts = attempts.refetch;
  const refresh = () => { if (user?.id) return Promise.all([offers.refetch(), attempts.refetch()]); };
  useAppRefresh(refresh);
  useEffect(() => {
    const onCheckin = () => { if (user?.id) void refetchAttempts(); };
    window.addEventListener("nuj:checkin-updated", onCheckin);
    return () => window.removeEventListener("nuj:checkin-updated", onCheckin);
  }, [user?.id, refetchAttempts]);

  return <main className="min-h-screen bg-background max-w-md mx-auto px-5 nuj-safe-top-section nuj-safe-bottom-page space-y-5">
    <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18} />Back</Link>
    <h1 className="text-2xl font-bold">Offers</h1>
    <p className="text-sm text-muted-foreground">Offers for your shared group.</p>
    <section className="space-y-3" aria-labelledby="joined-rewards">
      <h2 id="joined-rewards" className="font-semibold">Joined Rewards</h2>
      {attempts.isPending && <p role="status">Loading group attempts…</p>}
      {attempts.error && <div role="alert"><p>{attempts.error.message}</p><button className="nuj-btn-secondary mt-2" onClick={() => void attempts.refetch()}>Retry attempts</button></div>}
      {attempts.data?.length === 0 && <p className="text-muted-foreground">Your groups haven’t selected an offer yet.</p>}
      {attempts.data?.map((attempt) => <article key={attempt.id} className="nuj-card p-5 relative space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold"><Link to={`/meetup/${attempt.offerId}`} className="after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring">{attempt.offer.venue.name} · {attempt.offer.title}</Link></h3>
          <VenueCategoryIcon category={offers.data?.find((offer) => offer.venueId === attempt.offer.venueId)?.venue.category ?? attempt.offer.venue.category} />
        </div>
        <p className="text-sm text-muted-foreground"><Link to={`/shared-group/${encodeURIComponent(attempt.groupId)}`} className="relative z-10 inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"><UsersRound size={14} className="shrink-0" aria-hidden="true" />{attempt.groupName}</Link></p>
        <p className="text-sm">{attempt.offer.reward}</p>
        {attempt.participating && <p className="text-sm text-muted-foreground">Your progress: {attempt.progress}/{attempt.offer.periods} {attempt.offer.period}s</p>}
        {user && <MeetupParticipation attempt={attempt} userId={user.id} />}
        {attempt.rewardEarnedElsewhere && <p className="text-sm">You already earned this offer with another group. Each offer can be earned once per person.</p>}
        {attempt.rewardId && <p className="text-sm">{attempt.redeemedAt ? "Reward redeemed · member-confirmed" : `Your reward expires: ${attempt.expiresAt ? new Date(attempt.expiresAt).toLocaleString() : "Not specified"}`}</p>}
      </article>)}
    </section>
    <section className="space-y-3" aria-labelledby="available-offers">
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="available-offers" className="font-semibold">Available offers</h2>
        <DialogTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-2 text-sm"><SlidersHorizontal size={16} aria-hidden="true" />Filters{(categories.length > 0 && categories.length < VENUE_CATEGORIES.length) || origin ? " · Active" : ""}</button>
        </DialogTrigger>
      </div>
      {(categories.length > 0 || origin) && <div className="flex flex-wrap items-center gap-2 pt-2" aria-label="Selected filters">
        {categories.map((item) => {
          return <span key={item} role="img" aria-label={`Selected category: ${item}`} title={item}
            className="inline-flex rounded-full bg-muted p-2"><VenueCategoryIcon category={item} size={16} decorative /></span>;
        })}
        {origin && <span title={`Sort from ${origin.name}`} className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-muted px-3 py-2 text-sm">
          <MapPin size={16} className="shrink-0" aria-hidden="true" /><span className="truncate">{origin.searchText}</span>
        </span>}
        <button type="button" className="px-1 py-2 text-xs text-muted-foreground underline underline-offset-4"
          onClick={() => { setCategories([]); setOrigin(null); }}>Clear</button>
      </div>}
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm max-h-[85dvh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription>Choose categories or sort from a postcode or place.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Venue categories">
          <button type="button" aria-pressed={categories.length === 0 || categories.length === VENUE_CATEGORIES.length}
            className={`rounded-xl border px-3 py-2 text-sm ${categories.length === 0 || categories.length === VENUE_CATEGORIES.length ? "bg-secondary font-bold" : "bg-background"}`}
            onClick={() => updateCategories([])}>All categories</button>
          {VENUE_CATEGORIES.map((item) => {
            const label = item[0].toUpperCase() + item.slice(1);
            const selected = categories.includes(item);
            return <button type="button" key={item} aria-pressed={selected}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${selected ? "bg-secondary font-bold" : "bg-background"}`}
              onClick={() => updateCategories(selected ? categories.filter((category) => category !== item) : [...categories, item])}>
              <VenueCategoryIcon category={item} size={16} decorative />{label}
            </button>;
          })}
        </div>
          <h3 className="text-sm font-medium">Sort by distance</h3>
          <OfferLocationSearch origin={origin} onSelect={setOrigin} />
          <button type="button" className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold"
            onClick={() => setFiltersOpen(false)}>Done</button>
        </DialogContent>
      </Dialog>
      <div className="flex gap-2" role="group" aria-label="Offers display">
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={`rounded-full px-4 py-2 text-sm ${view === "list" ? "bg-secondary font-medium" : "bg-muted/40"}`}>List</button>
        <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={`rounded-full px-4 py-2 text-sm ${view === "map" ? "bg-secondary font-medium" : "bg-muted/40"}`}>Map</button>
      </div>
      {offers.isPending && <p role="status">Loading offers…</p>}
      {offers.error && <div role="alert"><p>{offers.error.message}</p><button className="nuj-btn-secondary mt-2" onClick={() => void offers.refetch()}>Retry offers</button></div>}
      {venueId && <Link to="/meetups" className="block text-sm text-muted-foreground underline underline-offset-4">Show all offers</Link>}
      {visibleOffers?.length === 0 && <p className="text-muted-foreground">{categories.length > 0 && categories.length < VENUE_CATEGORIES.length ? "No offers match these categories. Try All categories or another category." : venueId ? "No offers are available at this venue right now." : "No offers are available right now."}</p>}
      {view === "map" && visibleOffers && visibleOffers.length > 0 && <Suspense fallback={<p role="status">Loading map...</p>}><OffersMap offers={visibleOffers} origin={origin} /></Suspense>}
      {view === "list" && visibleOffers?.map((offer) => {
        const venueCategory = offer.venue.category ?? "other";
        const distance = origin ? distanceToVenue(origin, offer.venue) : null;
        return <Link key={offer.id} to={`/meetup/${offer.id}`} className="nuj-card p-5 block space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold">{offer.venue.name} · {offer.title}</h3>
          <div className="shrink-0 text-right text-muted-foreground">
            <VenueCategoryIcon category={venueCategory} />
            {origin && <p className="text-xs">{distance === null ? "Distance unavailable" : `${distance.toFixed(1)} miles`}</p>}
          </div>
        </div>
        <p>{offer.reward}</p>
        <p className="text-sm text-muted-foreground">{describeOfferRule(offer)}</p>
      </Link>;
      })}
    </section>
  </main>;
};

export default MeetUpsHub;
