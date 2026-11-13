import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VenueAddressLookup } from "./VenueAddressLookup";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/venueLocations", () => ({ findVenueAddress: lookup }));
const match = { name: "1 High Street, London", latitude: 51.5, longitude: -0.12 };

describe("venue address lookup", () => {
  beforeEach(() => { lookup.mockReset(); lookup.mockResolvedValue([match]); });

  it("searches only on click and requires explicit match confirmation", async () => {
    const onSelect = vi.fn();
    render(<VenueAddressLookup address="1 High Street" disabled={false} onSelect={onSelect} />);
    expect(lookup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Find address on map" }));
    const result = await screen.findByRole("button", { name: /Use this location/ });
    expect(lookup).toHaveBeenCalledWith("1 High Street", expect.any(AbortSignal));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(result);
    expect(onSelect).toHaveBeenCalledWith(match);
    expect(screen.getByRole("status")).toHaveTextContent("Save the venue");
  });

  it("reports no matches and failed lookups without choosing a location", async () => {
    lookup.mockResolvedValueOnce([]);
    render(<VenueAddressLookup address="Unknown" disabled={false} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Find address on map" }));
    expect(await screen.findByRole("status")).toHaveTextContent("No address matches");
    lookup.mockRejectedValueOnce(new Error("Rate limited"));
    fireEvent.click(screen.getByRole("button", { name: "Find address on map" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Rate limited");
  });

  it("aborts an outstanding search when the address/account component unmounts", async () => {
    lookup.mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<VenueAddressLookup address="Address" disabled={false} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Find address on map" }));
    await waitFor(() => expect(lookup).toHaveBeenCalled());
    const signal: AbortSignal = lookup.mock.calls[0][1];
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
