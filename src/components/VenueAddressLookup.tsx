import { useEffect, useRef, useState } from "react";
import { findVenueAddress, type AddressMatch } from "@/lib/venueLocations";

export const VenueAddressLookup = ({ address, disabled, onSelect }: {
  address: string;
  disabled: boolean;
  onSelect: (match: AddressMatch) => void;
}) => {
  const controller = useRef<AbortController | null>(null);
  const [matches, setMatches] = useState<AddressMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const search = async () => {
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy(true);
    setError("");
    setMatches(null);
    setSelected(null);
    try {
      const result = await findVenueAddress(address, signal);
      if (!signal.aborted) setMatches(result);
    } catch (failure) {
      if (!signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to look up this address.");
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };
  return <div className="space-y-2">
    <button type="button" className="nuj-btn-secondary text-sm" disabled={disabled || busy || !address.trim()} onClick={() => void search()}>
      {busy ? "Finding address..." : "Find address on map"}
    </button>
    <p className="text-xs text-muted-foreground">Sends this address to OpenStreetMap Nominatim. Confirm a match, then save the venue. No automatic lookups.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {matches?.length === 0 && <p role="status" className="text-sm">No address matches found. Try a full address with postcode, or enter coordinates manually.</p>}
    {matches && matches.length > 0 && <ul className="space-y-2" aria-label="Address matches">
      {matches.map((match, index) => <li key={`${match.latitude},${match.longitude},${index}`}>
        <button type="button" disabled={disabled} className="w-full rounded-xl bg-muted p-3 text-left text-sm"
          onClick={() => { onSelect(match); setSelected(match.name); setMatches(null); }}>
          {match.name}<span className="block text-xs text-muted-foreground">Use this location · {match.latitude}, {match.longitude}</span>
        </button>
      </li>)}
    </ul>}
    {selected && <p role="status" className="text-sm">Location selected: {selected}. Save the venue to keep this pin.</p>}
    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline">© OpenStreetMap contributors</a>
  </div>;
};
