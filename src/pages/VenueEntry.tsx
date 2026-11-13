import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isVenueAdmin, listOffers, listVenues, saveOffer, saveVenue, VENUE_CATEGORIES, type OfferInput, type VenueInput } from "@/lib/meetups";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppRefresh } from "@/hooks/useAppRefresh";
import { supabase } from "@/lib/supabase";
import { isVerifiedAuthUser } from "@/lib/auth";
import { VenueAddressLookup } from "@/components/VenueAddressLookup";
import { hasVenueCoordinates } from "@/lib/venueLocations";

const emptyVenue: VenueInput = { name: "", address: "", description: "", timezone: "Europe/London", active: true, category: "other" };
const emptyOffer: OfferInput = { venueId: "", title: "", reward: "", terms: "", period: "day", periods: 1, unlockRule: "individual", minimumMembers: 1, recipients: "qualifying", redemptionDays: 7, endsAt: null, active: true };
const inputClass = "mt-1 w-full rounded-xl border bg-background p-3";
const localDatetime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const VenueEntry = () => {
  const user = useCurrentUser();
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSessionUserId(session && isVerifiedAuthUser(session.user) ? session.user.id : null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const userId = sessionUserId === undefined ? user?.id : sessionUserId;
  return <VenueEntryContent key={userId ?? "signed-out"} user={userId ? { id: userId } : null} />;
};

const VenueEntryContent = ({ user }: { user: { id: string } | null }) => {
  const queryClient = useQueryClient();
  const admin = useQuery({ queryKey: ["venue-admin", user?.id], queryFn: isVenueAdmin, enabled: Boolean(user?.id), retry: false, staleTime: 0 });
  const authorized = admin.isSuccess && admin.data === true && !admin.isFetching && Boolean(user?.id);
  const venues = useQuery({ queryKey: ["venue-admin-venues", user?.id], queryFn: listVenues, enabled: authorized, retry: false });
  const offers = useQuery({ queryKey: ["venue-admin-offers", user?.id], queryFn: () => listOffers(true), enabled: authorized, retry: false });
  useAppRefresh(() => { if (user?.id) return admin.refetch(); });
  const [venueId, setVenueId] = useState("");
  const [venue, setVenue] = useState<VenueInput>({ ...emptyVenue });
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [offerId, setOfferId] = useState("");
  const [offer, setOffer] = useState<OfferInput>({ ...emptyOffer });
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const save = useMutation({
    mutationFn: async (value: { kind: "venue"; input: VenueInput; id: string | null } | { kind: "offer"; input: OfferInput; id: string | null }) => {
      if (!authorized) throw new Error("Venue admin access is required.");
      return value.kind === "venue" ? saveVenue(value.input, value.id) : saveOffer(value.input, value.id);
    },
    onSuccess: async (id, value) => {
      if (value.kind === "venue") setVenueId(id);
      else setOfferId(id);
      setNotice(`${value.kind === "venue" ? "Venue" : "Offer"} saved.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["venue-admin-venues", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["venue-admin-offers", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["meetup-offers"] }),
      ]);
    },
    onError: (failure) => setError(failure.message),
  });
  const resetMessages = () => { setError(""); setNotice(""); save.reset(); };
  const submitVenue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    const input = { ...venue, name: venue.name.trim(), address: venue.address.trim(), description: venue.description.trim(), timezone: venue.timezone.trim() };
    if (!input.name || !input.address || !input.description || !input.timezone) { setError("Complete all required venue fields."); return; }
    try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); } catch { setError("Enter a valid timezone, such as Europe/London."); return; }
    if (latitude.trim() || longitude.trim()) {
      if (!latitude.trim() || !longitude.trim() || !hasVenueCoordinates({ ...input, id: venueId, latitude: Number(latitude), longitude: Number(longitude) })) {
        setError("Enter both latitude (-90 to 90) and longitude (-180 to 180), or leave both blank."); return;
      }
    }
    input.latitude = latitude.trim() ? Number(latitude) : null;
    input.longitude = longitude.trim() ? Number(longitude) : null;
    save.mutate({ kind: "venue", input, id: venueId || null });
  };
  const submitOffer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    const input = { ...offer, title: offer.title.trim(), reward: offer.reward.trim(), terms: offer.terms.trim(), recipients: offer.unlockRule === "individual" ? "qualifying" as const : offer.recipients };
    if (!input.venueId || !input.title || !input.reward || !input.terms) { setError("Complete all required offer fields."); return; }
    if (!Number.isInteger(input.periods) || input.periods < 1 || input.periods > 52 || !Number.isInteger(input.redemptionDays) || input.redemptionDays < 1 || input.redemptionDays > 90) {
      setError("Periods must be 1–52 and redemption days must be 1–90."); return;
    }
    if (input.unlockRule === "minimum" && (!Number.isInteger(input.minimumMembers) || input.minimumMembers < 1)) { setError("Minimum qualifying members must be a positive whole number."); return; }
    input.minimumMembers = input.unlockRule === "minimum" ? input.minimumMembers : 1;
    if (endsAt && Number.isNaN(new Date(endsAt).getTime())) { setError("Enter a valid offer end date."); return; }
    input.endsAt = endsAt ? new Date(endsAt).toISOString() : null;
    save.mutate({ kind: "offer", input, id: offerId || null });
  };
  const busy = save.isPending;

  return <main className="min-h-screen bg-background max-w-md mx-auto px-5 nuj-safe-top-section nuj-safe-bottom-page space-y-5">
    <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18} />Back</Link>
    <h1 className="text-2xl font-bold">Venue entry</h1>
    {(admin.isPending || admin.isFetching) && <p role="status">Checking venue admin access…</p>}
    {admin.error && <div role="alert"><p>{admin.error.message}</p><button className="nuj-btn-secondary" onClick={() => void admin.refetch()}>Retry access check</button></div>}
    {admin.isSuccess && !admin.data && <p role="alert">Venue admin access is required. Private venue and offer data has not been loaded.</p>}
    {authorized && <>
      <p className="text-sm text-muted-foreground">Manage venues and offers separately. All saves are protected by server admin checks.</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {(venues.isPending || offers.isPending) && <p role="status">Loading admin venues and offers…</p>}
      {venues.error && <div role="alert"><p>{venues.error.message}</p><button className="nuj-btn-secondary" onClick={() => void venues.refetch()}>Retry venues</button></div>}
      {offers.error && <div role="alert"><p>{offers.error.message}</p><button className="nuj-btn-secondary" onClick={() => void offers.refetch()}>Retry admin offers</button></div>}
      <form onSubmit={submitVenue} className="nuj-card p-5 space-y-4">
        <h2 className="font-semibold">{venueId ? "Edit venue" : "Create venue"}</h2>
        <label className="block text-sm">Venue to edit
          <select className={inputClass} value={venueId} disabled={busy} onChange={(event) => {
            resetMessages();
            const selected = venues.data?.find((item) => item.id === event.target.value);
            setVenueId(selected?.id ?? "");
            setVenue(selected ? { name: selected.name, address: selected.address, description: selected.description, timezone: selected.timezone, active: selected.active, category: selected.category ?? "other" } : { ...emptyVenue });
            setLatitude(selected?.latitude?.toString() ?? "");
            setLongitude(selected?.longitude?.toString() ?? "");
          }}>
            <option value="">New venue</option>
            {venues.data?.map((item) => <option key={item.id} value={item.id}>{item.name}{!item.active ? " (inactive)" : ""}</option>)}
          </select>
        </label>
        {venues.data?.length === 0 && <p className="text-sm text-muted-foreground">No venues yet. Create a venue before its offers.</p>}
        <label className="block text-sm">Venue name (required)<input className={inputClass} required value={venue.name} disabled={busy} onChange={(event) => setVenue({ ...venue, name: event.target.value })} /></label>
        <label className="block text-sm">Venue category
          <select className={inputClass} value={venue.category} disabled={busy} onChange={(event) => {
            const category = VENUE_CATEGORIES.find((item) => item === event.target.value);
            if (category) setVenue({ ...venue, category });
          }}>
            {VENUE_CATEGORIES.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">All offers at this venue use this category.</p>
        <label className="block text-sm">Venue address (required)<input className={inputClass} required value={venue.address} disabled={busy} onChange={(event) => { setVenue({ ...venue, address: event.target.value }); setLatitude(""); setLongitude(""); }} /></label>
        <VenueAddressLookup key={`${venueId}:${venue.address}`} address={venue.address} disabled={busy}
          onSelect={(match) => { setLatitude(String(match.latitude)); setLongitude(String(match.longitude)); }} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Latitude (optional)<input type="number" step="any" min="-90" max="90" className={inputClass} value={latitude} disabled={busy} onChange={(event) => setLatitude(event.target.value)} /></label>
          <label className="block text-sm">Longitude (optional)<input type="number" step="any" min="-180" max="180" className={inputClass} value={longitude} disabled={busy} onChange={(event) => setLongitude(event.target.value)} /></label>
        </div>
        <p className="text-xs text-muted-foreground">Choose an address match or enter both coordinates. Venues without a pin remain in the offers list. Changing the address clears the old pin.</p>
        <label className="block text-sm">Venue description (required)<textarea className={inputClass} required value={venue.description} disabled={busy} onChange={(event) => setVenue({ ...venue, description: event.target.value })} /></label>
        <label className="block text-sm">Venue timezone (required)<input className={inputClass} required value={venue.timezone} disabled={busy} onChange={(event) => setVenue({ ...venue, timezone: event.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={venue.active} disabled={busy} onChange={(event) => setVenue({ ...venue, active: event.target.checked })} />Venue active</label>
        <button className="nuj-btn-primary w-full" disabled={busy} type="submit">{venueId ? "Save venue changes" : "Create venue"}</button>
      </form>
      <form onSubmit={submitOffer} className="nuj-card p-5 space-y-4">
        <h2 className="font-semibold">{offerId ? "Edit offer" : "Create offer"}</h2>
        <label className="block text-sm">Offer to edit
          <select className={inputClass} value={offerId} disabled={busy} onChange={(event) => {
            resetMessages();
            const selected = offers.data?.find((item) => item.id === event.target.value);
            setOfferId(selected?.id ?? "");
            if (selected) {
              const { id: _id, venue: _venue, ...input } = selected;
              setOffer(input);
              setEndsAt(localDatetime(input.endsAt));
            } else { setOffer({ ...emptyOffer }); setEndsAt(""); }
          }}>
            <option value="">New offer</option>
            {offers.data?.map((item) => <option key={item.id} value={item.id}>{item.venue.name} · {item.title}{!item.active ? " (inactive)" : ""}</option>)}
          </select>
        </label>
        {offers.data?.length === 0 && <p className="text-sm text-muted-foreground">No offers yet.</p>}
        <label className="block text-sm">Offer venue (required)
          <select className={inputClass} required value={offer.venueId} disabled={busy} onChange={(event) => setOffer({ ...offer, venueId: event.target.value })}>
            <option value="">Choose a venue</option>
            {venues.data?.map((item) => <option key={item.id} value={item.id}>{item.name}{!item.active ? " (inactive)" : ""}</option>)}
          </select>
        </label>
        <label className="block text-sm">Offer title (required)<input className={inputClass} required value={offer.title} disabled={busy} onChange={(event) => setOffer({ ...offer, title: event.target.value })} /></label>
        <label className="block text-sm">Reward description (required)<input className={inputClass} required value={offer.reward} disabled={busy} onChange={(event) => setOffer({ ...offer, reward: event.target.value })} /></label>
        <label className="block text-sm">Offer terms (required)<textarea className={inputClass} required value={offer.terms} disabled={busy} onChange={(event) => setOffer({ ...offer, terms: event.target.value })} /></label>
        <label className="block text-sm">Check-in period<select className={inputClass} value={offer.period} disabled={busy} onChange={(event) => setOffer({ ...offer, period: event.target.value as OfferInput["period"] })}><option value="day">Day</option><option value="week">Week</option></select></label>
        <label className="block text-sm">Consecutive periods (1–52)<input className={inputClass} type="number" min={1} max={52} step={1} required value={offer.periods} disabled={busy} onChange={(event) => setOffer({ ...offer, periods: Number(event.target.value) })} /></label>
        <label className="block text-sm">Unlock rule<select className={inputClass} value={offer.unlockRule} disabled={busy} onChange={(event) => {
          const unlockRule = event.target.value as OfferInput["unlockRule"];
          setOffer({ ...offer, unlockRule, recipients: unlockRule === "individual" ? "qualifying" : offer.recipients });
        }}><option value="individual">Individual</option><option value="minimum">Minimum qualifying members</option><option value="all">All starting members</option></select></label>
        {offer.unlockRule === "minimum" && <label className="block text-sm">Minimum qualifying members (required)<input className={inputClass} type="number" min={1} step={1} required value={offer.minimumMembers} disabled={busy} onChange={(event) => setOffer({ ...offer, minimumMembers: Number(event.target.value) })} /></label>}
        <label className="block text-sm">Reward recipients<select className={inputClass} value={offer.unlockRule === "individual" ? "qualifying" : offer.recipients} disabled={busy || offer.unlockRule === "individual"} onChange={(event) => setOffer({ ...offer, recipients: event.target.value as OfferInput["recipients"] })}><option value="qualifying">Qualifying members only</option><option value="all">All participating members</option></select></label>
        <label className="block text-sm">Redemption days (1–90)<input className={inputClass} type="number" min={1} max={90} step={1} required value={offer.redemptionDays} disabled={busy} onChange={(event) => setOffer({ ...offer, redemptionDays: Number(event.target.value) })} /></label>
        <label className="block text-sm">Offer ends at (optional, your device’s local time)<input className={inputClass} type="datetime-local" value={endsAt} disabled={busy} onChange={(event) => setEndsAt(event.target.value)} /></label>
        <p className="text-xs text-muted-foreground">The end date is saved as an ISO timestamp. The venue timezone controls check-in periods, not this local-time input.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offer.active} disabled={busy} onChange={(event) => setOffer({ ...offer, active: event.target.checked })} />Offer active</label>
        <button className="nuj-btn-primary w-full" disabled={busy || !venues.data?.length} type="submit">{offerId ? "Save offer changes" : "Create offer"}</button>
      </form>
    </>}
  </main>;
};

export default VenueEntry;
