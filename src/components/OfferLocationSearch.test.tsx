import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfferLocationSearch } from "./OfferLocationSearch";
import type { AddressMatch } from "@/lib/venueLocations";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/venueLocations", () => ({ findVenueAddress: lookup }));

describe("offer location search", () => {
  beforeEach(() => { lookup.mockReset(); });

  it("requires a submitted search and explicit match selection", async () => {
    const onSelect = vi.fn();
    const match = { name: "Tooting", latitude: 51.4, longitude: -0.1 };
    lookup.mockResolvedValue([match]);
    render(<OfferLocationSearch origin={null} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "SW17" } });
    expect(lookup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const button = await screen.findByRole("button", { name: /Tooting/ });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith({ ...match, searchText: "SW17" });
  });

  it("restores the selected search text when reopened and clears the selection", () => {
    const onSelect = vi.fn();
    render(<OfferLocationSearch origin={{ name: "Tooting, London, United Kingdom", latitude: 51.4, longitude: -0.1, searchText: "SW17" }} onSelect={onSelect} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change postcode / place" })).toHaveTextContent("SW17");
    fireEvent.click(screen.getByRole("button", { name: "Change postcode / place" }));
    expect(screen.getByRole("textbox")).toHaveValue("SW17");
    fireEvent.click(screen.getByRole("button", { name: "Clear location" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("shows empty-input, no-match and provider errors explicitly", async () => {
    render(<OfferLocationSearch origin={null} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a postcode");
    lookup.mockResolvedValueOnce([]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Missing" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("status")).toHaveTextContent("No locations found");
    lookup.mockRejectedValueOnce(new Error("Lookup unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Lookup unavailable");
    expect(screen.getByRole("button", { name: "Search" })).toBeEnabled();
  });

  it("aborts outdated searches when edited and on unmount", async () => {
    let resolve: (matches: AddressMatch[]) => void = () => {};
    lookup.mockImplementation(() => new Promise<AddressMatch[]>((done) => { resolve = done; }));
    const { unmount } = render(<OfferLocationSearch origin={null} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Old" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const signal = lookup.mock.calls[0][1] as AbortSignal;
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "New" } });
    expect(signal.aborted).toBe(true);
    await act(async () => resolve([{ name: "Old match", latitude: 0, longitude: 0 }]));
    expect(screen.queryByText("Old match")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const secondSignal = lookup.mock.calls[1][1] as AbortSignal;
    unmount();
    expect(secondSignal.aborted).toBe(true);
  });
});
