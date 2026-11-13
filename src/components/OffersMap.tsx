import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { distanceToVenue, hasVenueCoordinates, type AddressMatch } from "@/lib/venueLocations";
import type { Offer } from "@/lib/meetups";

const OffersMap = ({ offers, origin = null }: { offers: Offer[]; origin?: AddressMatch | null }) => {
  const container = useRef<HTMLDivElement>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const [tileError, setTileError] = useState(false);
  const navigate = useNavigate();
  const located = offers.filter((offer) => hasVenueCoordinates(offer.venue));
  const missingVenues = new Set(offers.filter((offer) => !hasVenueCoordinates(offer.venue)).map((offer) => offer.venueId)).size;

  useEffect(() => {
    if (!container.current || !offers.some((offer) => hasVenueCoordinates(offer.venue))) return;
    setTileError(false);
    const map = L.map(container.current, { scrollWheelZoom: false });
    const layer = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(map);
    tiles.current = layer;
    layer.on("tileerror", () => setTileError(true));
    const venues = new Map<string, Offer[]>();
    const points: L.LatLngTuple[] = [];
    for (const offer of offers) {
      if (!hasVenueCoordinates(offer.venue)) continue;
      const group = venues.get(offer.venueId) ?? [];
      if (group.length === 0) points.push([offer.venue.latitude, offer.venue.longitude]);
      group.push(offer);
      venues.set(offer.venueId, group);
    }
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 16 });
    for (const venueOffers of venues.values()) {
      const venue = venueOffers[0].venue;
      if (!hasVenueCoordinates(venue)) continue;
      const point: L.LatLngTuple = [venue.latitude, venue.longitude];
      const popup = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = venue.name;
      popup.append(heading);
      const address = document.createElement("p");
      address.textContent = venue.address;
      popup.append(address);
      if (origin) {
        const distance = distanceToVenue(origin, venue);
        const distanceLabel = document.createElement("p");
        distanceLabel.textContent = distance === null ? "Distance unavailable" : `${distance.toFixed(1)} miles away`;
        popup.append(distanceLabel);
      }
      for (const offer of venueOffers) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "block py-2 text-sm underline";
        button.textContent = offer.title;
        button.addEventListener("click", () => navigate(`/meetup/${offer.id}`));
        popup.append(button);
      }
      const marker = L.circleMarker(point, { radius: 9, color: "#0369a1", fillColor: "#38bdf8", fillOpacity: 1, weight: 2 }).addTo(map);
      marker.bindPopup(popup);
      const element = marker.getElement();
      element?.setAttribute("tabindex", "0");
      element?.setAttribute("role", "button");
      element?.setAttribute("aria-label", `Offers at ${venue.name}`);
      element?.addEventListener("keydown", (event: Event) => {
        if (event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          marker.openPopup();
        }
      });
    }
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); tiles.current = null; map.remove(); };
  }, [offers, origin, navigate]);

  return <div className="space-y-2">
    {missingVenues > 0 && <p className="text-xs text-muted-foreground">{missingVenues} {missingVenues === 1 ? "venue has" : "venues have"} no map location yet. Their offers are still available in List view.</p>}
    {located.length === 0 ? <p className="text-sm text-muted-foreground">No offer locations are available on the map yet.</p> : <>
      {tileError && <div role="alert" className="text-sm text-destructive">Map tiles could not load. Offers remain available in List view.
        <button type="button" className="ml-2 underline" onClick={() => { setTileError(false); tiles.current?.redraw(); }}>Retry map</button>
      </div>}
      <div ref={container} role="region" aria-label="Map of offer venues" className="relative z-0 h-80 w-full rounded-xl" />
      <p className="text-xs text-muted-foreground">Tap a pin to see offers. Map data © OpenStreetMap contributors.</p>
    </>}
  </div>;
};

export default OffersMap;
