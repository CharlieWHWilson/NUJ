import { useEffect, useRef, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import { findVenueAddress, type AddressMatch } from "@/lib/venueLocations";

export type OfferSearchOrigin = AddressMatch & { searchText: string };

export const OfferLocationSearch = ({ origin, onSelect }: {
  origin: OfferSearchOrigin | null;
  onSelect: (origin: OfferSearchOrigin | null) => void;
}) => {
  const [query, setQuery] = useState(origin?.searchText ?? "");
  const [matches, setMatches] = useState<AddressMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(!origin);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) { setError("Enter a postcode or place name."); return; }
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy(true);
    setError("");
    setMatches(null);
    try {
      const result = await findVenueAddress(query, signal);
      if (!signal.aborted) setMatches(result);
    } catch (failure) {
      if (!signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to find this location.");
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };
  return <div className="min-w-0 space-y-3">
    {origin && !editing ? <button type="button" aria-label="Change postcode / place" title={origin.name}
      className="flex w-full min-w-0 items-center gap-2 rounded-xl border bg-secondary p-3 text-left text-sm font-semibold"
      onClick={() => { setQuery(origin.searchText); setEditing(true); }}>
      <MapPin size={18} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{origin.searchText}</span>
    </button> : <form onSubmit={(event) => void search(event)} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <label className="min-w-0">
        <span className="sr-only">Postcode or place name</span>
        <input className="w-full rounded-xl border bg-background p-3 text-sm" placeholder="Postcode or place name"
          value={query} onChange={(event) => {
            controller.current?.abort();
            setBusy(false);
            setMatches(null);
            setError("");
            setQuery(event.target.value);
          }} />
      </label>
      <button type="submit" className="rounded-xl bg-secondary px-3 py-3 text-sm font-medium disabled:opacity-50" disabled={busy}>{busy ? "Searching..." : "Search"}</button>
    </form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {matches?.length === 0 && <p role="status" className="text-sm">No locations found. Try a fuller postcode or place name.</p>}
    {matches && matches.length > 0 && <ul aria-label="Location matches" className="space-y-2">
      {matches.map((match, index) => <li key={`${match.latitude},${match.longitude},${index}`}>
        <button type="button" className="w-full break-words rounded-xl bg-muted p-3 text-left text-sm"
          onClick={() => { onSelect({ ...match, searchText: query.trim() }); setMatches(null); setEditing(false); }}>{match.name}<span className="block text-xs text-muted-foreground">Sort from here</span></button>
      </li>)}
    </ul>}
    {origin && <div className="text-right text-xs text-muted-foreground">
      <button type="button" className="underline" onClick={() => {
        controller.current?.abort(); setBusy(false); setQuery(""); setMatches(null); setError(""); setEditing(true); onSelect(null);
      }}>Clear location</button>
    </div>}
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer">About location search</summary>
      <p className="mt-2">Search text is sent to OpenStreetMap Nominatim. Distances are approximate and straight-line. No device location is used.</p>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a>
    </details>
  </div>;
};
