import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Offer } from "@/lib/meetups";
import OffersMap from "./OffersMap";

const mocks = vi.hoisted(() => ({
  map: vi.fn(), tileLayer: vi.fn(), marker: vi.fn(), remove: vi.fn(), redraw: vi.fn(), fitBounds: vi.fn(), tileError: () => {},
  popups: [] as HTMLElement[], elements: [] as SVGElement[],
}));
vi.mock("leaflet", () => ({
  map: mocks.map, tileLayer: mocks.tileLayer, circleMarker: mocks.marker,
  latLngBounds: (points: unknown) => points,
}));
const venue = { id: "venue", name: "Cafe <script>", address: "High Street", description: "", timezone: "Europe/London", active: true, latitude: 0, longitude: 0 };
const offer: Offer = { id: "offer", venueId: venue.id, venue, title: "£2 off", reward: "Discount", terms: "Terms", period: "day", periods: 3, unlockRule: "individual", minimumMembers: 1, recipients: "qualifying", redemptionDays: 7, endsAt: null, active: true };

describe("offers map", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    mocks.popups = [];
    mocks.elements = [];
    mocks.map.mockReturnValue({ fitBounds: mocks.fitBounds, invalidateSize: vi.fn(), remove: mocks.remove });
    mocks.tileLayer.mockReturnValue({ addTo() { return this; }, on: (_event: string, handler: () => void) => { mocks.tileError = handler; }, redraw: mocks.redraw });
    mocks.marker.mockImplementation(() => {
      const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
      mocks.elements.push(element);
      return { addTo() { return this; }, bindPopup: (popup: HTMLElement) => { mocks.popups.push(popup); }, getElement: () => element, openPopup: vi.fn() };
    });
    afterEach(() => vi.unstubAllGlobals());
  });

  it("creates one accessible pin per located venue with all offer headlines and safe text", () => {
    const { unmount } = render(<MemoryRouter><OffersMap offers={[offer, { ...offer, id: "second", title: "Free coffee" }]} /></MemoryRouter>);
    expect(mocks.marker).toHaveBeenCalledTimes(1);
    expect(mocks.marker.mock.calls[0][0]).toEqual([0, 0]);
    expect(mocks.elements[0]).toHaveAttribute("aria-label", "Offers at Cafe <script>");
    expect(mocks.elements[0]).toHaveAttribute("tabindex", "0");
    expect(mocks.popups[0].querySelector("script")).toBeNull();
    expect(mocks.popups[0].textContent).toContain("Free coffee");
    expect(mocks.popups[0].querySelectorAll("button")).toHaveLength(2);
    expect(mocks.tileLayer.mock.calls[0][1].attribution).toContain("OpenStreetMap");
    expect(mocks.fitBounds.mock.calls[0][0]).toEqual([[0, 0]]);
    unmount();
    expect(mocks.remove).toHaveBeenCalled();
  });

  it("reports missing locations without creating a map or requesting tiles", () => {
    render(<MemoryRouter><OffersMap offers={[{ ...offer, venue: { ...venue, latitude: null, longitude: null } }]} /></MemoryRouter>);
    expect(screen.getByText(/1 venue has no map location/)).toBeInTheDocument();
    expect(screen.getByText(/No offer locations are available/)).toBeInTheDocument();
    expect(mocks.map).not.toHaveBeenCalled();
  });

  it("reports tile failures and provides a retry action", () => {
    render(<MemoryRouter><OffersMap offers={[offer]} /></MemoryRouter>);
    act(() => mocks.tileError());
    expect(screen.getByRole("alert")).toHaveTextContent("Map tiles could not load");
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
    expect(mocks.redraw).toHaveBeenCalled();
  });
});
