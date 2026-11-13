import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { distanceToVenue, findVenueAddress, hasVenueCoordinates } from "./venueLocations";

const venue = { id: "v", name: "Cafe", address: "High Street", description: "", timezone: "Europe/London", active: true };
let clock = Date.now();

describe("venue locations", () => {
  it("calculates straight-line miles and places missing coordinates outside distance sorting", () => {
    const origin = { name: "Origin", latitude: 0, longitude: 0 };
    expect(distanceToVenue(origin, { ...venue, latitude: 0, longitude: 0 })).toBe(0);
    expect(distanceToVenue(origin, { ...venue, latitude: 0, longitude: 1 })).toBeCloseTo(69.093, 2);
    expect(distanceToVenue(origin, venue)).toBeNull();
    expect(distanceToVenue(origin, { ...venue, latitude: 0, longitude: 180 })).toBeCloseTo(12436.8, 0);
  });
  beforeEach(() => { clock += 10_000; vi.spyOn(Date, "now").mockReturnValue(clock); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("accepts zero coordinates and rejects missing, out-of-range and non-finite locations", () => {
    expect(hasVenueCoordinates({ ...venue, latitude: 0, longitude: 0 })).toBe(true);
    for (const coords of [{}, { latitude: null, longitude: 1 }, { latitude: 91, longitude: 1 }, { latitude: 1, longitude: Infinity }]) {
      expect(hasVenueCoordinates({ ...venue, ...coords })).toBe(false);
    }
  });

  it("encodes explicit searches and rate-limits repeat requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ display_name: "Cafe, London", lat: "51.5", lon: "-0.12" }] });
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    expect(await findVenueAddress("  1 High St & Square  ", signal)).toEqual([{ name: "Cafe, London", latitude: 51.5, longitude: -0.12 }]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("q")).toBe("1 High St & Square");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal });
    await expect(findVenueAddress("Another", signal)).rejects.toThrow("wait a moment");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces failed lookups and rejects invalid response coordinates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    await expect(findVenueAddress("Address", signal)).rejects.toThrow("429");
    vi.mocked(Date.now).mockReturnValue(Date.now() + 2000);
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ display_name: "Wrong", lat: "95", lon: "0" }] });
    await expect(findVenueAddress("Address", signal)).rejects.toThrow("invalid coordinates");
  });

  it("handles no matches and refuses empty address searches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const signal = new AbortController().signal;
    await expect(findVenueAddress(" ", signal)).rejects.toThrow("Enter a venue address");
    expect(await findVenueAddress("Unknown street", signal)).toEqual([]);
  });
});
