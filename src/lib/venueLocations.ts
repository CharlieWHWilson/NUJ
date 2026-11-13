import type { Venue } from "./meetups";

export const hasVenueCoordinates = (venue: Venue): venue is Venue & { latitude: number; longitude: number } =>
  typeof venue.latitude === "number" && Number.isFinite(venue.latitude) && Math.abs(venue.latitude) <= 90 &&
  typeof venue.longitude === "number" && Number.isFinite(venue.longitude) && Math.abs(venue.longitude) <= 180;

export type AddressMatch = { name: string; latitude: number; longitude: number };
let nextLookupAt = 0;

export async function findVenueAddress(address: string, signal: AbortSignal): Promise<AddressMatch[]> {
  if (!address.trim()) throw new Error("Enter a venue address before searching.");
  if (Date.now() < nextLookupAt) throw new Error("Please wait a moment before another address lookup.");
  nextLookupAt = Date.now() + 1100;
  const endpoint = import.meta.env.VITE_GEOCODING_URL || "https://nominatim.openstreetmap.org/search";
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ q: address.trim(), format: "jsonv2", limit: "5" }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Location lookup failed (${response.status}). Try again later.`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Address lookup returned an invalid response.");
  return data.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("display_name" in item) || typeof item.display_name !== "string" ||
      !("lat" in item) || typeof item.lat !== "string" || !item.lat.trim() ||
      !("lon" in item) || typeof item.lon !== "string" || !item.lon.trim()) {
      throw new Error("Address lookup returned an invalid location.");
    }

    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      throw new Error("Address lookup returned invalid coordinates.");
    }
    return { name: item.display_name, latitude, longitude };
  });
}

export const distanceToVenue = (origin: AddressMatch, venue: Venue): number | null => {
  if (!hasVenueCoordinates(venue)) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDifference = radians(venue.latitude - origin.latitude);
  const longitudeDifference = radians(venue.longitude - origin.longitude);
  const a = Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(origin.latitude)) * Math.cos(radians(venue.latitude)) *
    Math.sin(longitudeDifference / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
};
